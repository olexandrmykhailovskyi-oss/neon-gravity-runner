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

    function _tr(key, fallback) {
        try {
            const v = window.I18n ? window.I18n.t(key) : key;
            return v === key ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    function update(data) {
        if (!data) return;
        try {
            const U = window.Utils;

            // Zen — без очок: ховаємо рахунок і комбо
            const scoreEl = document.querySelector('.hud-score');
            if (scoreEl) scoreEl.classList.toggle('hidden', data.mode === 'zen');
            const comboWrap = window.UI.$('#hud-combo');
            if (comboWrap && data.mode === 'zen') comboWrap.classList.add('hidden');

            if (data.mode !== 'zen') {
                window.UI.setText('#hud-score', U.formatNumber(data.score || 0));

                // Комбо
                if (comboWrap) {
                    if (data.combo > 1) {
                        comboWrap.classList.remove('hidden');
                        window.UI.setText('#hud-combo-value', '×' + data.combo);
                    } else {
                        comboWrap.classList.add('hidden');
                    }
                }
            }

            // Інформація про режим / рівень кампанії
            const levelInfoEl = window.UI.$('#hud-level-info');
            const levelProgressEl = window.UI.$('#hud-level-progress-bar');
            if (data.mode === 'campaign' && data.level) {
                if (levelInfoEl) {
                    levelInfoEl.classList.remove('hidden');
                    const lvl = data.level;
                    const levelWord = _tr('hud.level', 'Рівень');
                    let lvlName = '';
                    try {
                        if (window.Config && window.Config.LEVELS) {
                            for (let i = 0; i < window.Config.LEVELS.length; i++) {
                                if (window.Config.LEVELS[i].id === lvl.id) {
                                    lvlName = _tr('level.' + lvl.id, window.Config.LEVELS[i].name);
                                    break;
                                }
                            }
                        }
                    } catch (e) {}
                    window.UI.setText('#hud-level-title', levelWord + ' ' + lvl.id + ' — ' + lvlName);
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
                    window.UI.setText('#hud-level-title', _tr('hud.daily', '📅 Виклик дня'));
                }
                if (levelProgressEl) levelProgressEl.classList.add('hidden');
            } else if (data.mode === 'timeattack') {
                // Time Attack — зворотний відлік + прогрес-бар
                if (levelInfoEl) {
                    levelInfoEl.classList.remove('hidden');
                    const remain = Math.max(0, (data.duration || 180) - (data.elapsed || 0));
                    window.UI.setText('#hud-level-title', _tr('mode.timeattack.hud', '⏱ Time Attack') + ' — ' + U.formatTime(remain));
                }
                if (levelProgressEl && typeof data.levelProgress === 'number') {
                    levelProgressEl.classList.remove('hidden');
                    const fill = window.UI.$('#hud-level-progress-fill');
                    if (fill) {
                        const pct = Math.min(100, Math.max(0, data.levelProgress * 100));
                        fill.style.width = pct + '%';
                    }
                }
            } else if (data.mode === 'survival') {
                // Survival — час виживання
                if (levelInfoEl) {
                    levelInfoEl.classList.remove('hidden');
                    window.UI.setText('#hud-level-title', _tr('mode.survival.hud', '💀 Survival') + ' — ' + U.formatTime(data.elapsed || 0));
                }
                if (levelProgressEl) levelProgressEl.classList.add('hidden');
            } else if (data.mode === 'zen') {
                // Zen — просто заголовок режиму
                if (levelInfoEl) {
                    levelInfoEl.classList.remove('hidden');
                    window.UI.setText('#hud-level-title', _tr('mode.zen.hud', '🧘 Zen'));
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
        // _tr ніколи не кидає винятків, тож fallback-гілка з дублюванням бейджів не потрібна
        let html = '';
        if (data.shield) html += '<div class="badge shield" title="' + _tr('bonus.shield', 'Щит') + '">⛨</div>';
        if (data.revive) html += '<div class="badge revive" title="' + _tr('bonus.revive', 'Друге життя') + '">♥</div>';
        if (data.phase) html += '<div class="badge phase" title="' + _tr('bonus.phase', 'Фаза') + '">⚡</div>';
        if (data.magnet) html += '<div class="badge magnet" title="' + _tr('bonus.magnet', 'Магніт') + '">M</div>';
        if (data.ghost) html += '<div class="badge ghost" title="' + _tr('bonus.ghost', 'Привид') + '">👻</div>';
        if (data.double) html += '<div class="badge double" title="' + _tr('bonus.double', '×2 очки') + '">×2</div>';
        c.innerHTML = html;
    }

    window.HUD = {
        init: init,
        show: show,
        update: update
    };
})();
