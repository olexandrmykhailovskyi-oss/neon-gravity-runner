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
            'Logger', 'SafeStorage', 'State', 'Config', 'Utils', 'Collision',
            'AudioSys', 'Particles', 'FloatingTexts', 'Background', 'Effects',
            'Skins', 'Achievements', 'Player', 'Obstacle', 'Obstacles',
            'Bonus', 'Bonuses', 'Storm', 'Scoring', 'Levels', 'UI', 'Screens',
            'HUD', 'Game', 'Input'
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

    function start() {
        try {
            _setProgress(5, 'Перевірка модулів…');
            _checkModules();

            _setProgress(20, 'Ініціалізація стану…');
            window.State.init();

            _setProgress(40, 'Побудова інтерфейсу…');
            window.Screens.init();
            window.HUD.init();

            _setProgress(60, 'Ініціалізація гри…');
            window.Game.init();
            window.Input.init();

            _setProgress(80, 'Застосування налаштувань…');
            _applySettings();

            _setProgress(100, 'Готово!');

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
