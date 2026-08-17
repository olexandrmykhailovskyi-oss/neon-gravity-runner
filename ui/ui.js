/**
 * UI.js — DOM-утиліти та базове перемикання екранів.
 */
(function () {
    'use strict';

    let _currentScreen = 'boot';

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[UI] ' + msg, data); } catch (e) {}
    }

    function $(sel) {
        if (typeof sel !== 'string') return sel;
        try {
            return document.querySelector(sel);
        } catch (e) {
            return null;
        }
    }

    function showScreen(id) {
        try {
            const screens = document.querySelectorAll('.screen');
            for (let i = 0; i < screens.length; i++) {
                screens[i].classList.add('hidden');
            }
            const target = $('#screen-' + id);
            if (target) {
                target.classList.remove('hidden');
                _currentScreen = id;
            } else {
                _log('warn', 'showScreen: не знайдено screen-' + id);
                const main = $('#screen-main');
                if (main) {
                    main.classList.remove('hidden');
                    _currentScreen = 'main';
                }
            }
        } catch (e) {
            _log('error', 'showScreen помилка', e.message);
        }
    }

    function currentScreen() {
        return _currentScreen;
    }

    function showToast(msg, type) {
        try {
            const container = $('#toast-container');
            if (!container) return;
            const el = document.createElement('div');
            el.className = 'toast' + (type ? ' ' + type : '');
            el.textContent = msg;
            container.appendChild(el);

            let dur = 2800;
            try {
                if (window.Config && window.Config.UI) {
                    dur = window.Config.UI.TOAST_DURATION || 2800;
                }
            } catch (e) {}

            setTimeout(function () {
                try {
                    if (el.parentNode) el.parentNode.removeChild(el);
                } catch (e) {}
            }, dur);
        } catch (e) {
            _log('error', 'showToast помилка', e.message);
        }
    }

    function safeBind(el, event, fn, opts) {
        if (!el || typeof fn !== 'function' || typeof event !== 'string') return;
        try {
            el.addEventListener(event, fn, opts || false);
        } catch (e) {
            _log('error', 'safeBind помилка', e.message);
        }
    }

    function setText(sel, text) {
        const el = $(sel);
        if (el) el.textContent = text;
    }

    function toggle(sel, visible) {
        const el = $(sel);
        if (!el) return;
        if (visible) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }

    window.UI = {
        $: $,
        showScreen: showScreen,
        currentScreen: currentScreen,
        showToast: showToast,
        safeBind: safeBind,
        setText: setText,
        toggle: toggle
    };
})();
