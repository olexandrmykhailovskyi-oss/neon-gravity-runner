/**
 * Input.js — обробка введення та подій вікна.
 * - SPACE / клік / тап → зміна гравітації або дія
 * - ESC → пауза
 * - R → швидкий рестарт на екранах Game Over / Victory / Pause
 * - Автопауза при зміні вкладки (visibilitychange / blur)
 * - Debouncing для запобігання подвійних кліків на мобільних
 */
(function () {
    'use strict';

    let _lastActionTime = 0;
    let _lastTouchTime = 0;
    let _isTouchDevice = false;
    const ACTION_DEBOUNCE_MS = 50;      // захист від дублів, не заважає швидким фліпам гравітації
    const TOUCH_MOUSE_SUPPRESS_MS = 700; // ігноруємо синтетичний mousedown після касання

    function _log(level, msg) {
        try { if (window.Logger) window.Logger[level]('[Input] ' + msg); } catch (e) {}
    }

    function init() {
        try {
            // Визначення touch пристрою
            _isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

            window.UI.safeBind(document, 'keydown', _onKeyDown);
            const canvas = document.getElementById('game-canvas');
            if (canvas) {
                window.UI.safeBind(canvas, 'mousedown', _onPointer);
                window.UI.safeBind(canvas, 'touchstart', _onTouch, { passive: false });
            }
            window.UI.safeBind(document, 'contextmenu', function (e) { e.preventDefault(); });

            // Автопауза при згортанні / зміні вкладки
            window.UI.safeBind(document, 'visibilitychange', function () {
                if (document.hidden) {
                    try { if (window.Game && window.Game.isPlaying()) window.Game.pause(); } catch (e) {}
                }
            });
            window.UI.safeBind(window, 'blur', function () {
                try { if (window.Game && window.Game.isPlaying()) window.Game.pause(); } catch (e) {}
            });

            _log('info', 'init OK, touch device: ' + _isTouchDevice);
        } catch (e) {
            _log('error', 'init: ' + e.message);
        }
    }

    function _onKeyDown(e) {
        // Клавіша R для швидкого рестарту
        if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
            const cur = window.UI.currentScreen();
            if (cur === 'gameover' || cur === 'victory' || cur === 'pause') {
                e.preventDefault();
                try { if (window.Game) window.Game.retryCurrent(); } catch (err) {}
                return;
            }
        }

        if (e.code === 'Space' || e.key === ' ') {
            const t = e.target;
            const tag = t ? t.tagName : '';
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (tag === 'BUTTON') {
                if (t.offsetParent === null) {
                    try { t.blur(); } catch (x) {}
                } else {
                    return;
                }
            }
            e.preventDefault();
            _action();
        } else if (e.code === 'Escape') {
            _pause();
        }
    }

    function _onPointer(e) {
        e.preventDefault();
        // Після touchstart браузери генерують синтетичний mousedown — придушуємо його
        // лише у вікні після реального дотику, щоб не ламати мишу на гібридних пристроях
        if (_isTouchDevice && Date.now() - _lastTouchTime < TOUCH_MOUSE_SUPPRESS_MS) {
            return;
        }
        _action();
    }

    function _onTouch(e) {
        e.preventDefault();
        _lastTouchTime = Date.now();
        _action();
    }

    function _action() {
        const now = Date.now();
        if (now - _lastActionTime < ACTION_DEBOUNCE_MS) {
            return; // Debouncing
        }
        _lastActionTime = now;

        try { if (window.AudioSys) window.AudioSys.ensure(); } catch (e) {}
        try { if (window.Game) window.Game.pressAction(); } catch (e) {}
    }

    function _pause() {
        try { if (window.Game) window.Game.togglePause(); } catch (e) {}
    }

    window.Input = {
        init: init
    };
})();
