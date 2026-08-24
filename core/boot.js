/**
 * Boot.js — контроль запуску гри.
 * - Перевірка наявності всіх модулів (включно з Levels)
 * - Послідовна ініціалізація з прогрес-баром
 * - Екран критичної помилки замість чорного крашу
 */
(function () {
    'use strict';

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[Boot] ' + msg, data); } catch (e) {}
    }

    function _setProgress(pct, text) {
        try {
            const fill = document.getElementById('boot-fill');
            if (fill) fill.style.width = pct + '%';
            const label = document.getElementById('boot-text');
            if (label && text) label.textContent = text;
        } catch (e) {}
    }

    function _checkModules() {
        const required = [
            'Logger', 'SafeStorage', 'State', 'Config', 'Utils', 'Collision', 'I18n',
            'AudioSys', 'Particles', 'FloatingTexts', 'Background', 'Effects',
            'Skins', 'Achievements', 'Player', 'Obstacle', 'Obstacles',
            'Bonus', 'Bonuses', 'Storm', 'Scoring', 'Levels', 'Modes', 'UI', 'Screens',
            'HUD', 'Game', 'Input', 'Editor', 'Analytics', 'GlobalScores'
        ];
        const missing = [];
        for (let i = 0; i < required.length; i++) {
            if (typeof window[required[i]] === 'undefined') {
                missing.push(required[i]);
            }
        }
        if (missing.length > 0) {
            throw new Error('Відсутні модулі: ' + missing.join(', '));
        }
    }

    function _applySettings() {
        try {
            const t = window.State.getSetting('theme');
            if (window.Background) window.Background.setTheme(t);
            if (window.AudioSys) window.AudioSys.applyVolumes();
        } catch (e) {
            _log('warn', '_applySettings: ' + e.message);
        }
    }

    function showError(e) {
        try {
            const errScreen = document.getElementById('screen-error');
            if (errScreen) errScreen.classList.remove('hidden');
            const bootScreen = document.getElementById('screen-boot');
            if (bootScreen) bootScreen.classList.add('hidden');
            const textEl = document.getElementById('error-text');
            const stackEl = document.getElementById('error-stack');
            if (textEl) {
                textEl.textContent = e && e.message ? e.message : String(e);
            }
            if (stackEl) {
                stackEl.textContent = e && e.stack ? e.stack : '';
            }
            _log('error', 'Критична помилка', e && e.message ? e.message : String(e));
        } catch (x) {
            // Повна тиша
        }
    }

    function _tr(key, fallback) {
        try {
            const v = window.I18n ? window.I18n.t(key) : key;
            return v === key ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    function start() {
        try {
            _setProgress(5, _tr('boot.check', 'Перевірка модулів…'));
            _checkModules();

            _setProgress(20, _tr('boot.state', 'Ініціалізація стану…'));
            window.State.init();

            _setProgress(30, _tr('boot.lang', 'Ініціалізація мови…'));
            window.I18n.init();

            _setProgress(40, _tr('boot.ui', 'Побудова інтерфейсу…'));
            window.Screens.init();
            window.HUD.init();
            window.Editor.build();

            _setProgress(60, _tr('boot.game', 'Ініціалізація гри…'));
            window.Game.init();
            window.Input.init();

            _setProgress(75, _tr('boot.settings', 'Застосування налаштувань…'));
            _applySettings();

            // Хмарна синхронізація (асинхронна, не блокує старт гри)
            try { if (window.CloudStorage) window.CloudStorage.init(); } catch (e) {
                _log('warn', 'CloudStorage.init: ' + e.message);
            }

            // QOL-5: телеметрія сесії (анонімно, вимикається в налаштуваннях)
            try { if (window.Analytics) window.Analytics.sessionStart(); } catch (e) {}

            _setProgress(90, _tr('boot.update', 'Оновлення інтерфейсу…'));
            try {
                window.Screens.updateLanguage();
            } catch (e) {
                _log('warn', 'Language update failed: ' + e.message);
            }

            _setProgress(100, _tr('boot.ready', 'Готово!'));

            try {
                const reloadBtn = document.getElementById('error-reload');
                if (reloadBtn) {
                    window.UI.safeBind(reloadBtn, 'click', function () {
                        window.location.reload();
                    });
                }
            } catch (e) {}

            setTimeout(function () {
                try {
                    window.UI.showScreen('main');
                    window.Screens.updateMenuStats();
                } catch (e) {
                    showError(e);
                }
            }, 350);

            _log('info', 'start OK');
        } catch (e) {
            showError(e);
        }
    }

    window.Boot = {
        start: start,
        showError: showError
    };
})();
