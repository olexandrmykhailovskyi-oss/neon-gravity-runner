/**
 * CloudStorage.js — хмарна синхронізація прогресу через Supabase.
 * - Увімкнюється, лише якщо в index.html задано window.NGR_CLOUD_CONFIG
 * - Supabase SDK завантажується динамічно з CDN (гру не ламає, якщо мережі нема)
 * - Push після кожного забігу, pull + merge «тільки вгору» на старті
 * - Таблиця: user_progress(device_id text pk, data jsonb, updated_at timestamptz)
 *   SQL для створення — у README.md, розділ «Хмарна синхронізація (Supabase)»
 */
(function () {
    'use strict';

    const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    const TABLE = 'user_progress';

    let _client = null;
    let _deviceId = null;
    let _ready = false;
    let _busy = false;
    let _lastSyncTime = 0;
    let _initPromise = null;

    function _log(level, msg) {
        try { if (window.Logger) window.Logger[level]('[CloudStorage] ' + msg); } catch (e) {}
    }

    function _generateDeviceId() {
        try {
            let did = localStorage.getItem('ngr_device_id');
            if (!did) {
                did = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
                localStorage.setItem('ngr_device_id', did);
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
                        // Автопідхват прогресу з хмари при старті
                        pullFromCloud().then(
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
        return _client.from(TABLE)
            .upsert({
                device_id: _deviceId,
                data: window.State.data,
                updated_at: new Date().toISOString()
            })
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

        return _client.from(TABLE)
            .select('data')
            .eq('device_id', _deviceId)
            .maybeSingle()
            .then(function (res) {
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
                pushProgress();
                pullFromCloud();
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
        getDeviceId: getDeviceId
    };
})();
