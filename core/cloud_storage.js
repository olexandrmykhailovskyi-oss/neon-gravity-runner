/**
 * CloudStorage.js — хмарна синхронізація прогресу через Supabase.
 * - Увімкнюється, лише якщо задано window.NGR_CLOUD_CONFIG (core/app_config.js)
 * - Supabase SDK завантажується динамічно з CDN (гру не ламає, якщо мережі нема)
 * - Ідентичність: anonymous auth → прогрес прив'язаний до user_id (RLS auth.uid()).
 *   Якщо anonymous sign-in недоступний — тихий фоллбэк на схему за device_id.
 * - Одноразовий claim_device_progress переносить прогрес пристрою в акаунт
 * - Push після кожного забігу, pull + merge «тільки вгору» на старті
 * - Таблиця: user_progress(device_id text pk, user_id uuid, data jsonb, updated_at)
 */
(function () {
    'use strict';

    const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    const TABLE = 'user_progress';

    let _client = null;
    let _deviceId = null;
    let _userId = null;        // id анонімного акаунта (null — працюємо за device_id)
    let _claimTried = false;   // claim виконується один раз за сесію
    let _ready = false;
    let _busy = false;
    let _pulling = false;      // захист від паралельних pullFromCloud
    let _lastSyncTime = 0;
    let _initPromise = null;

    function _log(level, msg) {
        try { if (window.Logger) window.Logger[level]('[CloudStorage] ' + msg); } catch (e) {}
    }

    function _generateDeviceId() {
        try {
            // SafeStorage: працює й коли localStorage заблоковано
            const S = window.SafeStorage;
            let did = S ? S.get('ngr_device_id') : null;
            if (!did || typeof did !== 'string') {
                did = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
                if (S) S.set('ngr_device_id', did);
            }
            return did;
        } catch (e) {
            return 'dev_' + Date.now().toString(36);
        }
    }

    // Динамічне завантаження UMD-білки Supabase v2
    function _loadSdk(cb) {
        try {
            if (window.supabase && typeof window.supabase.createClient === 'function') {
                cb(null);
                return;
            }
            if (typeof document === 'undefined' || !document.createElement) {
                cb(new Error('document unavailable'));
                return;
            }
            const s = document.createElement('script');
            s.src = SDK_URL;
            s.async = true;
            s.onload = function () { cb(null); };
            s.onerror = function () { cb(new Error('Не вдалося завантажити Supabase SDK')); };
            (document.head || document.documentElement).appendChild(s);
        } catch (e) {
            cb(e);
        }
    }

    /**
     * Забезпечує анонімну сесію: якщо сесії немає — signInAnonymously.
     * Будь-яка помилка не критична: працюємо далі за device_id.
     * @returns {Promise<boolean>} true, якщо є user_id
     */
    function _ensureAuth() {
        if (!_client || !_client.auth || typeof _client.auth.getSession !== 'function') {
            return Promise.resolve(false);
        }
        // Якщо сесія помре (протух refresh-токен, користувача видалено) —
        // скидаємо user_id, щоб клієнт не вважав себе авторизованим даремно
        try {
            if (typeof _client.auth.onAuthStateChange === 'function') {
                _client.auth.onAuthStateChange(function (event) {
                    if (event === 'SIGNED_OUT') _userId = null;
                });
            }
        } catch (e) {}
        return _client.auth.getSession().then(function (res) {
            const session = res && res.data ? res.data.session : null;
            if (session && session.user) {
                _userId = session.user.id;
                return true;
            }
            if (typeof _client.auth.signInAnonymously !== 'function') return false;
            return _client.auth.signInAnonymously().then(function (r) {
                if (r && r.error) {
                    _log('warn', 'auth: ' + (r.error.message || r.error) + ' (anonymous sign-in недоступний — працюємо за device_id)');
                    return false;
                }
                const s = r && r.data ? r.data.session : null;
                if (s && s.user) {
                    _userId = s.user.id;
                    _log('info', 'anonymous auth ok');
                    return true;
                }
                return false;
            }, function (err) {
                _log('warn', 'auth: ' + (err && err.message ? err.message : err));
                return false;
            });
        }, function () { return false; });
    }

    /**
     * Одноразовий перенос прогресу пристрою в акаунт (RPC claim_device_progress).
     * Виконується лише за наявності user_id і лише раз за сесію.
     * @returns {Promise<boolean>}
     */
    function claimDeviceProgress() {
        if (_claimTried) return Promise.resolve(false);
        _claimTried = true;
        if (!_ready || !_client || !_userId || typeof _client.rpc !== 'function') return Promise.resolve(false);
        return _client.rpc('claim_device_progress', { p_device_id: _deviceId }).then(function (res) {
            if (res && res.error) {
                _log('warn', 'claim: ' + res.error.message);
                return false;
            }
            const remote = res ? res.data : null;
            if (remote && window.State && typeof window.State.mergeRemote === 'function') {
                if (window.State.mergeRemote(remote)) {
                    _log('info', 'claim: прогрес пристрою перенесено');
                    return pushProgress();
                }
            }
            return false;
        }, function () { return false; });
    }

    /**
     * Ініціалізація. Повертає Promise<boolean> — true, якщо хмара готова.
     * Викликається один раз; повторні виклики повертають той самий Promise.
     */
    function init() {
        if (_initPromise) return _initPromise;
        _initPromise = new Promise(function (resolve) {
            try {
                const cfg = window.NGR_CLOUD_CONFIG;
                if (!cfg || !cfg.supabaseUrl || !cfg.supabaseKey) {
                    _log('info', 'Cloud disabled: NGR_CLOUD_CONFIG не задано');
                    resolve(false);
                    return;
                }
                _deviceId = _generateDeviceId();
                _loadSdk(function (err) {
                    if (err || !window.supabase || typeof window.supabase.createClient !== 'function') {
                        _log('error', 'init: ' + (err && err.message ? err.message : 'SDK недоступний'));
                        resolve(false);
                        return;
                    }
                    try {
                        _client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
                        _ready = true;
                        _bindOnlineListeners();
                        _log('info', 'Supabase initialized');
                        // Ідентичність → перенос прогресу пристрою → автопідхват із хмари
                        _ensureAuth()
                            .then(function () { return claimDeviceProgress(); })
                            .then(function () { return pullFromCloud(); })
                            .then(
                                function () { resolve(_ready); },
                                function () { resolve(_ready); }
                            );
                    } catch (e) {
                        _log('error', 'createClient: ' + e.message);
                        resolve(false);
                    }
                });
            } catch (e) {
                _log('error', 'init: ' + e.message);
                resolve(false);
            }
        });
        return _initPromise;
    }

    function _bindOnlineListeners() {
        try {
            if (typeof window.addEventListener !== 'function') return;
            window.addEventListener('online', function () { setOnlineStatus(true); });
            window.addEventListener('offline', function () { setOnlineStatus(false); });
            setOnlineStatus(navigator.onLine !== false);
        } catch (e) {}
    }

    /** Відправити локальний прогрес у хмару. Promise<boolean> */
    function pushProgress() {
        if (!_ready || !_client || _busy) return Promise.resolve(false);
        if (!window.State || !window.State.data) return Promise.resolve(false);

        _busy = true;
        // Для авторизованого користувача PK не може збігатися зі старою
        // «пристроєвою» строкою (user_id = null): RLS UPDATE її не бачить.
        // Тому в акаунта — власний ключ, а легасі-строку забирає claim.
        const row = {
            device_id: _userId ? ('u_' + _userId) : _deviceId,
            data: window.State.data,
            updated_at: new Date().toISOString()
        };
        if (_userId) row.user_id = _userId;

        return _client.from(TABLE)
            .upsert(row)
            .then(function (res) {
                _busy = false;
                if (res && res.error) {
                    _log('error', 'push: ' + res.error.message);
                    return false;
                }
                _lastSyncTime = Date.now();
                _log('info', 'Push successful');
                return true;
            }, function (err) {
                _busy = false;
                _log('error', 'push: ' + (err && err.message ? err.message : err));
                return false;
            });
    }

    /** Завантажити прогрес із хмари та злити його з локальним («тільки вгору»). Promise<object|null> */
    function pullFromCloud() {
        if (!_ready || !_client) return Promise.resolve(null);
        if (_pulling) return Promise.resolve(null);  // pull уже виконується — пропускаємо

        _pulling = true;

        // За наявності акаунта читаємо свій рядок за user_id (RLS auth.uid()),
        // інакше — за device_id (перехідний режим для старих клієнтів).
        let query = _client.from(TABLE).select('data');
        query = _userId ? query.eq('user_id', _userId) : query.eq('device_id', _deviceId);

        return query
            .maybeSingle()
            .then(function (res) {
                _pulling = false;
                if (res && res.error) {
                    _log('error', 'pull: ' + res.error.message);
                    return null;
                }
                const remote = res && res.data && res.data.data;
                if (remote && window.State && typeof window.State.mergeRemote === 'function') {
                    if (window.State.mergeRemote(remote)) {
                        _lastSyncTime = Date.now();
                        _log('info', 'Pull successful, прогрес об\'єднано');
                    }
                }
                return remote || null;
            }, function (err) {
                _pulling = false;
                _log('error', 'pull: ' + (err && err.message ? err.message : err));
                return null;
            });
    }

    // Зворотна сумісність зі старим API
    function syncToCloud() { return pushProgress(); }
    function syncFromCloud() { return pullFromCloud(); }

    function setOnlineStatus(isOnline) {
        _log('info', 'Online status: ' + isOnline);
        if (isOnline && _ready) {
            setTimeout(function () {
                // Послідовно: спершу pull і злиття «тільки вгору», потім push
                // об'єднаного стану — інакше паралельні запити можуть
                // відкотити локальні налаштування до старих хмарних
                pullFromCloud().then(function () {
                    pushProgress();
                });
            }, 1000);
        }
    }

    function isReady() {
        return _ready;
    }

    function getProvider() {
        return _ready ? 'supabase' : null;
    }

    function getLastSyncTime() {
        return _lastSyncTime;
    }

    function getDeviceId() {
        return _deviceId;
    }

    /** @returns {string|null} id анонімного акаунта або null у перехідному режимі */
    function getUserId() {
        return _userId;
    }

    // Доступ до спільного supabase-клієнта для інших модулів (GlobalScores, Analytics)
    function getClient() {
        return _ready ? _client : null;
    }

    window.CloudStorage = {
        init: init,
        pushProgress: pushProgress,
        pullFromCloud: pullFromCloud,
        syncToCloud: syncToCloud,
        syncFromCloud: syncFromCloud,
        setOnlineStatus: setOnlineStatus,
        isReady: isReady,
        getProvider: getProvider,
        getLastSyncTime: getLastSyncTime,
        getDeviceId: getDeviceId,
        getUserId: getUserId,
        claimDeviceProgress: claimDeviceProgress,
        getClient: getClient
    };
})();
