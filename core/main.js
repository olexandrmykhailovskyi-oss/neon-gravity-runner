/**
 * Main.js — точка входу.
 * - Глобальний обробник помилок (без console.log)
 * - Збереження стану при закритті вкладки
 * - Запуск Boot при завантаженні сторінки
 */
(function () {
    'use strict';

    window.onerror = function (msg, url, line, col, err) {
        try {
            if (window.Logger) {
                window.Logger.error('Global: ' + msg, {
                    url: url, line: line, col: col,
                    stack: err && err.stack ? err.stack : ''
                });
            }
            if (window.Boot && window.Boot.showError) {
                window.Boot.showError(err || msg);
            }
        } catch (e) {}
        return true;
    };

    window.addEventListener('unhandledrejection', function (e) {
        try {
            if (window.Logger) {
                window.Logger.error('Unhandled rejection', e.reason ? String(e.reason) : '');
            }
        } catch (x) {}
    });

    window.addEventListener('beforeunload', function () {
        try { if (window.State) window.State.save(); } catch (e) {}
    });

    window.addEventListener('load', function () {
        try {
            if (window.Boot) {
                window.Boot.start();
            }
        } catch (e) {
            try {
                if (window.Boot && window.Boot.showError) {
                    window.Boot.showError(e);
                }
            } catch (x) {}
        }
    });
})();
