/**
 * HUD.js — ігровий інтерфейс під час гри.
 * - Рахунок, комбо, бейджі активних бонусів (щит, магніт, привид, ×2, друге життя, фаза)
 * - Прогрес-бар рівня для Кампанії (Рівень N + час)
 * - Індикатор рекорду та кнопка паузи
 */
(function () {
    'use strict';

    function _log(level, msg) {
        try { if (window.Logger) window.Logger[level]('[HUD] ' + msg); } catch (e) {}
    }

    function init() {
        try {
            const btn = window.UI.$('#hud-pause');
            if (btn) {
                window.UI.safeBind(btn, 'click', function (e) {
                    e.stopPropagation();
                    e.preventDefault();
                    try { if (window.Game) window.Game.togglePause(); } catch (err) {}
                });
                window.UI.safeBind(btn, 'mousedown', function (e) { e.stopPropagation(); });
                window.UI.safeBind(btn, 'touchstart', function (e) { e.stopPropagation(); }, { passive: true });
            }
        } catch (e) {
            _log('error', 'init: ' + e.message);
        }
    }

    function show(bool) {
        try { window.UI.toggle('#hud', !!bool); } catch (e) {}
    }

    function update(data) {
        if (!data) return;
        try {
            const U = window.Utils;
            window.UI.setText('#hud-score', U.formatNumber(data.score || 0));

            // Комбо
            const comboEl = window.UI.$('#hud-combo');
            if (comboEl) {
                if (data.combo > 1) {
                    comboEl.classList.remove('hidden');
                    window.UI.setText('#hud-combo-value', '×' + data.combo);
                } else {
                    comboEl.classList.add('hidden');
                }
            }

            // Інформація про режим / рівень кампанії
            const levelInfoEl = window.UI.$('#hud-level-info');
            const levelProgressEl = window.UI.$('#hud-level-progress-bar');
            if (data.mode === 'campaign' && data.level) {
                if (levelInfoEl) {
                    levelInfoEl.classList.remove('hidden');
                    const lvl = data.level;
                    window.UI.setText('#hud-level-title', 'Рівень ' + lvl.id + ' — ' + lvl.name);
                }
                if (levelProgressEl && typeof data.levelProgress === 'number') {
                    levelProgressEl.classList.remove('hidden');
                    const fill = window.UI.$('#hud-level-progress-fill');
                    if (fill) {
                        const pct = Math.min(100, Math.max(0, data.levelProgress * 100));
                        fill.style.width = pct + '%';
                    }
                }
            } else if (data.mode === 'daily') {
                if (levelInfoEl) {
                    levelInfoEl.classList.remove('hidden');
                    window.UI.setText('#hud-level-title', '📅 Виклик дня');
                }
                if (levelProgressEl) levelProgressEl.classList.add('hidden');
            } else {
                if (levelInfoEl) levelInfoEl.classList.add('hidden');
                if (levelProgressEl) levelProgressEl.classList.add('hidden');
            }

            // Бейджі активних бонусів
            _updateBadges(data);
        } catch (e) {
            _log('error', 'update: ' + e.message);
        }
    }

    function _updateBadges(data) {
        const c = window.UI.$('#hud-badges');
        if (!c) return;
        let html = '';
        if (data.shield) html += '<div class="badge shield" title="Щит">⛨</div>';
        if (data.revive) html += '<div class="badge revive" title="Друге життя">♥</div>';
        if (data.phase) html += '<div class="badge phase" title="Фаза">⚡</div>';
        if (data.magnet) html += '<div class="badge magnet" title="Магніт">M</div>';
        if (data.ghost) html += '<div class="badge ghost" title="Привид">👻</div>';
        if (data.double) html += '<div class="badge double" title="×2 очки">×2</div>';
        c.innerHTML = html;
    }

    window.HUD = {
        init: init,
        show: show,
        update: update
    };
})();
