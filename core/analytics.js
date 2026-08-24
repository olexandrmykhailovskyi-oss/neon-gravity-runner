/**
 * Analytics.js — анонімна телеметрія подій у Supabase.
 * - Таблиця analytics_events(anon_id, event, props jsonb, created_at)
 * - Черга з батч-флешем кожні 15с + на hidden/beforeunload (keepalive)
 * - Вимикається налаштуванням State.settings.analytics = false
 * - Без клієнта/таблиці тихо скасовується (черга обрізається до 50)
 */
(function () {
    'use strict';

    const TABLE = 'analytics_events';
    const FLUSH_MS = 15000;
    const QUEUE_CAP = 50;

    let _queue = [];
    let _timer = null;
    let _anonId = null;
    let _warned = false;
    let _flushing = false;

    function _log(level, msg) {
        try { if (window.Logger) window.Logger[level]('[Analytics] ' + msg); } catch (e) {}
    }

    function enabled() {
        try { return window.State && window.State.getSetting && window.State.getSetting('analytics') !== false; } catch (e) { return true; }
    }

    function _getAnonId() {
        if (_anonId) return _anonId;
        try {
            _anonId = localStorage.getItem('ngr_anon_id');
            if (!_anonId) {
                _anonId = 'an_' +
                    (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 13) : Math.random().toString(36).slice(2, 15));
                localStorage.setItem('ngr_anon_id', _anonId);
            }
        } catch (e) {
            _anonId = 'an_' + Date.now().toString(36);
        }
        return _anonId;
    }

    /** Зареєструвати подію (fire-and-forget, ніколи не кидає) */
    function track(event, props) {
        try {
            if (!enabled()) return;
            if (_queue.length >= QUEUE_CAP) _queue.shift();
            _queue.push({
                anon_id: _getAnonId(),
                event: String(event || '').slice(0, 40),
                props: (props && typeof props === 'object') ? _shallow(props) : {},
                ts: new Date().toISOString()
            });
            _scheduleFlush();
        } catch (e) {}
    }

    function _shallow(o) {
        const r = {};
        for (const k in o) {
            if (Object.prototype.hasOwnProperty.call(o, k)) {
                const v = o[k];
                r[k] = (typeof v === 'number' && isFinite(v)) ? v : (typeof v === 'string' ? v.slice(0, 64) : null);
            }
        }
        return r;
    }

    function _scheduleFlush() {
        try {
            if (_timer) return;
            _timer = setTimeout(function () {
                _timer = null;
                flush();
            }, FLUSH_MS);
        } catch (e) {}
    }

    /** Відправити чергу. Promise<number> — кількість надісланих */
    function flush() {
        if (_flushing || !_queue.length) return Promise.resolve(0);
        if (!(window.CloudStorage && window.CloudStorage.isReady() && typeof window.CloudStorage.getClient === 'function' && window.CloudStorage.getClient())) {
            return Promise.resolve(0);
        }
        _flushing = true;
        const batch = _queue.splice(0, QUEUE_CAP);
        return new Promise(function (resolve) {
            try {
                window.CloudStorage.getClient().from(TABLE).insert(batch).then(function (res) {
                    _flushing = false;
                    if (res && res.error) {
                        if (!_warned) { _log('warn', 'flush: ' + res.error.message + ' (потрібна SQL-міграція таблиці analytics_events)'); _warned = true; }
                        resolve(0);
                        return;
                    }
                    _log('info', 'flush ' + batch.length + ' events');
                    resolve(batch.length);
                }, function () { _flushing = false; resolve(0); });
            } catch (e) {
                _flushing = false;
                resolve(0);
            }
        });
    }

    function sessionStart() {
        track('session_start', {});
    }

    function _bindLifecycle() {
        try {
            if (typeof document !== 'undefined' && document.addEventListener) {
                document.addEventListener('visibilitychange', function () {
                    if (document.visibilityState === 'hidden') flush();
                });
            }
            if (typeof window !== 'undefined' && window.addEventListener) {
                window.addEventListener('beforeunload', function () { flush(); });
                window.addEventListener('online', function () { flush(); });
            }
        } catch (e) {}
    }
    _bindLifecycle();

    window.Analytics = {
        track: track,
        flush: flush,
        sessionStart: sessionStart,
        enabled: enabled
    };
})();
