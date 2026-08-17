/**
 * Logger.js — тихий логер гри.
 * - НЕ використовує console.log
 * - Зберігає кільцевий буфер для екрана помилок
 * - Підтримує підписників
 * - Завантажується першим
 */
(function () {
    'use strict';

    const MAX_BUFFER = 200;
    const buffer = [];
    const listeners = [];

    function _ts() {
        try {
            const d = new Date();
            const h = String(d.getHours()).padStart(2, '0');
            const m = String(d.getMinutes()).padStart(2, '0');
            const s = String(d.getSeconds()).padStart(2, '0');
            return h + ':' + m + ':' + s;
        } catch (e) {
            return '00:00:00';
        }
    }

    function _push(level, msg, data) {
        try {
            const entry = {
                t: _ts(),
                level: level,
                msg: String(msg == null ? '' : msg)
            };
            if (data !== undefined) {
                try {
                    entry.data = typeof data === 'string' ? data : JSON.stringify(data);
                } catch (e) {
                    entry.data = String(data);
                }
            }
            buffer.push(entry);
            if (buffer.length > MAX_BUFFER) buffer.shift();
            for (let i = 0; i < listeners.length; i++) {
                try { listeners[i](entry); } catch (e) { /* тиша */ }
            }
        } catch (e) {
            // Повна тиша
        }
    }

    function info(msg, data)  { _push('info',  msg, data); }
    function warn(msg, data)  { _push('warn',  msg, data); }
    function error(msg, data) { _push('error', msg, data); }

    function getBuffer() { return buffer.slice(); }

    function subscribe(fn) {
        if (typeof fn === 'function') listeners.push(fn);
    }

    function clear() { buffer.length = 0; }

    window.Logger = {
        info: info,
        warn: warn,
        error: error,
        buffer: getBuffer,
        subscribe: subscribe,
        clear: clear
    };
})();
