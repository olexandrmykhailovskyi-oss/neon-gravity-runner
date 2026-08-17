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
            const raw = useMemory ? memory[key] : window.localStorage.getItem(key);
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
                return true;
            } catch (e) {
                useMemory = true;
                memory[key] = raw;
                try {
                    if (window.Logger) {
                        window.Logger.warn('localStorage запис невдалий, fallback у пам\'ять', e.message || '');
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
            if (useMemory) { delete memory[key]; return; }
            window.localStorage.removeItem(key);
        } catch (e) {
            _logError('remove', e);
        }
    }

    function clear() {
        try {
            memory = {};
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
