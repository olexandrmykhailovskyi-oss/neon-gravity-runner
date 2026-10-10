/**
 * UI.js — DOM-утиліти та базове перемикання екранів.
 */
(function () {
    'use strict';

    let _currentScreen = 'boot';

    // Доступність: запам'ятовуємо активний елемент кожного екрана перед приховуванням,
    // щоб повертати фокус при поверненні на екран
    const _screenFocus = {};

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
            const active = document.activeElement;
            const target = $('#screen-' + id);

            for (let i = 0; i < screens.length; i++) {
                const s = screens[i];
                if (target && s === target) continue;
                if (!s.classList.contains('hidden')) {
                    // Запам'ятовуємо активний елемент единого екрана перед приховуванням
                    if (active && (s === active || s.contains(active))) {
                        _screenFocus[s.id] = active;
                    }
                    s.classList.add('hidden');
                    s.setAttribute('aria-hidden', 'true');
                }
            }

            if (target) {
                target.classList.remove('hidden');
                target.setAttribute('aria-hidden', 'false');
                // Доступність: екран як діалог; підпис із першого заголовка
                if (!target.hasAttribute('role')) target.setAttribute('role', 'dialog');
                if (target.getAttribute('aria-modal') !== 'true') target.setAttribute('aria-modal', 'true');
                if (!target.hasAttribute('aria-label')) {
                    const heading = target.querySelector('h1, h2');
                    if (heading && heading.textContent) target.setAttribute('aria-label', heading.textContent.trim());
                }
                if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
                // QOL-4: плавна поява екрана (перезапуск CSS-анімації через reflow)
                target.classList.remove('screen-enter');
                void target.offsetWidth;
                target.classList.add('screen-enter');
                // Фокус: на запомнений елемент цього екрана (якщо він ще в DOM), інакше — на контейнер
                const restore = _screenFocus[target.id];
                if (restore && document.contains(restore)) {
                    try { restore.focus(); } catch (e) { target.focus(); }
                } else {
                    target.focus();
                }
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
                    // QOL-4: плавне зникнення тоста перед видаленням
                    el.classList.add('toast-out');
                    setTimeout(function () {
                        try { if (el.parentNode) el.parentNode.removeChild(el); } catch (e) {}
                    }, 220);
                } catch (e) {
                    try { if (el.parentNode) el.parentNode.removeChild(el); } catch (x) {}
                }
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
