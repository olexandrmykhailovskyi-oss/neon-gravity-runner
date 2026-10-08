/**
 * SafeStorage.js — безпечна обгортка над localStorage.
 * - Fallback у пам'ять, якщо localStorage заблоковано (інкогніто, file://, приватний режим)
 * - Обробка QuotaExceededError
 * - Безпечний JSON-parse з захистом від битих даних
 */
(function () {
    'use strict';

    const TEST_KEY = '__ngr_storage_test__';
    let memory = {};
    let useMemory = false;
    // Overlay: сюди потрапляють ключі, які не вдалося записати в localStorage
    // (напр. QuotaExceeded посеред сесії). Читання спершу дивиться сюди,
    // тож раніше збережені дані лишаються видимими.
    let overlay = {};

    // Перевірка доступності localStorage
    (function detect() {
        try {
            if (typeof window.localStorage === 'undefined') {
                useMemory = true;
                return;
            }
            window.localStorage.setItem(TEST_KEY, TEST_KEY);
            window.localStorage.removeItem(TEST_KEY);
            useMemory = false;
        } catch (e) {
            useMemory = true;
            try {
                if (window.Logger) {
                    window.Logger.warn('localStorage недоступний, перехід у пам\'ять', e.message || '');
                }
            } catch (x) { /* тиша */ }
        }
    })();

    function _logError(action, err) {
        try {
            if (window.Logger) {
                window.Logger.error('SafeStorage.' + action + ': ' + (err && err.message ? err.message : String(err)));
            }
        } catch (x) { /* тиша */ }
    }

    function get(key) {
        if (typeof key !== 'string' || key === '') return null;
        try {
            let raw = null;
            if (useMemory) {
                raw = memory[key];
            } else if (Object.prototype.hasOwnProperty.call(overlay, key)) {
                raw = overlay[key];
            } else {
                raw = window.localStorage.getItem(key);
            }
            if (raw === null || raw === undefined) return null;
            try {
                return JSON.parse(raw);
            } catch (e) {
                return raw;
            }
        } catch (e) {
            _logError('get', e);
            return null;
        }
    }

    function set(key, value) {
        if (typeof key !== 'string' || key === '') return false;
        try {
            const raw = JSON.stringify(value);
            if (useMemory) {
                memory[key] = raw;
                return true;
            }
            try {
                window.localStorage.setItem(key, raw);
                delete overlay[key];
                return true;
            } catch (e) {
                // Не перемикаємо весь режим у пам'ять: лише цей ключ
                // тимчасово живе в overlay, решта даних читається з localStorage
                overlay[key] = raw;
                try {
                    if (window.Logger) {
                        window.Logger.warn('localStorage запис невдалий, ключ у тимчасовому overlay', e.message || '');
                    }
                } catch (x) { /* тиша */ }
                return true;
            }
        } catch (e) {
            _logError('set', e);
            return false;
        }
    }

    function remove(key) {
        if (typeof key !== 'string') return;
        try {
            delete overlay[key];
            if (useMemory) { delete memory[key]; return; }
            window.localStorage.removeItem(key);
        } catch (e) {
            _logError('remove', e);
        }
    }

    function clear() {
        try {
            memory = {};
            overlay = {};
            if (!useMemory) window.localStorage.clear();
        } catch (e) {
            _logError('clear', e);
        }
    }

    function isMemoryMode() { return useMemory; }

    window.SafeStorage = {
        get: get,
        set: set,
        remove: remove,
        clear: clear,
        isMemoryMode: isMemoryMode
    };
})();
