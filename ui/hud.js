/**
 * HUD.js — ігровий інтерфейс під час гри.
 * - Рахунок, комбо, бейджі активних бонусів (щит, магніт, привид, ×2, друге життя, фаза)
 * - Прогрес-бар рівня для Кампанії (Рівень N + час)
 * - Індикатор рекорду та кнопка паузи
 *
 * Оптимізація: усі записи в DOM ідуть через кеш «пиши лише при зміні».
 * Раніше HUD переписував ~12 елементів (і innerHTML бейджів) кожні 80 мс,
 * що давало постійне навантаження на layout/paint під час гри.
 */
(function () {
    'use strict';

    function _log(level, msg) {
        try { if (window.Logger) window.Logger[level]('[HUD] ' + msg); } catch (e) {}
    }

    // ---- Кеш DOM: елементи + останні значення (щоб не писати зайвого) ----
    const _els = {};
    const _last = {};

    function _el(id) {
        if (!(id in _els)) {
            _els[id] = document.getElementById(id);
        }
        return _els[id];
    }

    function _setText(id, text) {
        if (_last['t:' + id] === text) return;
        _last['t:' + id] = text;
        const el = _el(id);
        if (el) el.textContent = text;
    }

    function _setHidden(id, hidden) {
        const h = !!hidden;
        if (_last['h:' + id] === h) return;
        _last['h:' + id] = h;
        const el = _el(id);
        if (el) el.classList.toggle('hidden', h);
    }

    function _setWidth(id, pct) {
        if (_last['w:' + id] === pct) return;
        _last['w:' + id] = pct;
        const el = _el(id);
        if (el) el.style.width = pct + '%';
    }

    // Скидання кеша: новий забіг має перемалювати HUD повністю
    function _resetCache() {
        for (const k in _last) delete _last[k];
        for (const k in _els) delete _els[k];
        _scoreEl = null;
    }

    let _scoreEl = null;

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
        try {
            // Показ HUD = старт/продовження забігу: скидаємо кеш, щоб усе записалось
            if (bool) _resetCache();
            window.UI.toggle('#hud', !!bool);
        } catch (e) {}
    }

    function _tr(key, fallback) {
        try {
            const v = window.I18n ? window.I18n.t(key) : key;
            return v === key ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    // Лічильник FPS: елемент .hud-fps створюється один раз, видимість
    // перемикається налаштуванням showFps (оформлення — у CSS)
    let _fpsEl = null;

    /**
     * Створює елемент .hud-fps у блоці .hud-right (поруч з бейджами),
     * якщо його ще немає. Тихо нічого не робить, якщо контейнер відсутній.
     * @returns {Element|null} елемент лічильника FPS або null
     */
    function _ensureFpsEl() {
        if (_fpsEl) return _fpsEl;
        try {
            const wrap = document.querySelector('.hud-right');
            if (!wrap) return null;
            const el = document.createElement('div');
            el.className = 'hud-fps';
            el.textContent = '— FPS';
            el.classList.add('hidden');
            const pauseBtn = wrap.querySelector('#hud-pause');
            if (pauseBtn) wrap.insertBefore(el, pauseBtn);
            else wrap.appendChild(el);
            _fpsEl = el;
        } catch (e) {
            _log('error', '_ensureFpsEl: ' + e.message);
        }
        return _fpsEl;
    }

    /**
     * Оновлює лічильник FPS: показує/ховає елемент за налаштуванням
     * showFps і виводить поточне значення.
     * @param {number} fps — поточне середнє FPS
     */
    function _updateFps(fps) {
        try {
            if (!window.State || window.State.getSetting('showFps') !== true) {
                if (_fpsEl) _fpsEl.classList.add('hidden');
                return;
            }
            const el = _ensureFpsEl();
            if (!el) return;
            el.classList.remove('hidden');
            const text = Math.round(fps || 0) + ' FPS';
            if (_last.fpsText !== text) {
                _last.fpsText = text;
                el.textContent = text;
            }
        } catch (e) { /* тиха деградація */ }
    }

    function update(data) {
        if (!data) return;
        try {
            const U = window.Utils;

            // Zen — без очок: ховаємо рахунок і комбо
            if (!_scoreEl) _scoreEl = document.querySelector('.hud-score');
            if (_scoreEl) _scoreEl.classList.toggle('hidden', data.mode === 'zen');

            // Рекорд під рукою — видно, скільки наздоганяєш (в Zen не потрібно)
            if (data.mode === 'zen' || typeof data.best !== 'number') {
                _setHidden('hud-best', true);
            } else {
                _setHidden('hud-best', false);
                _setText('hud-best-value', U.formatNumber(data.best));
            }

            if (data.mode !== 'zen') {
                _setText('hud-score', U.formatNumber(data.score || 0));

                // Комбо
                if (data.combo > 1) {
                    _setHidden('hud-combo', false);
                    _setText('hud-combo-value', '×' + data.combo);
                    // QOL: смуга — скільки лишилось до зникнення комбо
                    const rem = typeof data.comboRemaining === 'number' ? data.comboRemaining : 1;
                    _setWidth('hud-combo-bar-fill', Math.round(Math.max(0, Math.min(1, rem)) * 100));
                } else {
                    _setHidden('hud-combo', true);
                }
            } else {
                _setHidden('hud-combo', true);
            }

            // Інформація про режим / рівень кампанії
            if ((data.mode === 'campaign' || data.mode === 'custom') && data.level) {
                _setHidden('hud-level-info', false);
                const lvl = data.level;
                if (data.mode === 'custom') {
                    // Кастомний рівень з редактора — показуємо його назву
                    _setText('hud-level-title', '🛠 ' + (lvl.name || 'Custom'));
                } else {
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
                    _setText('hud-level-title', _tr('hud.level', 'Рівень') + ' ' + lvl.id + ' — ' + lvlName);
                }
                if (typeof data.levelProgress === 'number') {
                    _setHidden('hud-level-progress-bar', false);
                    const pct = Math.min(100, Math.max(0, data.levelProgress * 100));
                    _setWidth('hud-level-progress-fill', pct);
                }
            } else if (data.mode === 'daily') {
                _setHidden('hud-level-info', false);
                _setText('hud-level-title', _tr('hud.daily', '📅 Виклик дня'));
                _setHidden('hud-level-progress-bar', true);
            } else if (data.mode === 'timeattack') {
                // Time Attack — зворотний відлік + прогрес-бар
                _setHidden('hud-level-info', false);
                const remain = Math.max(0, (data.duration || 180) - (data.elapsed || 0));
                _setText('hud-level-title', _tr('mode.timeattack.hud', '⏱ Time Attack') + ' — ' + U.formatTime(remain));
                if (typeof data.levelProgress === 'number') {
                    _setHidden('hud-level-progress-bar', false);
                    const pct = Math.min(100, Math.max(0, data.levelProgress * 100));
                    _setWidth('hud-level-progress-fill', pct);
                }
            } else if (data.mode === 'survival') {
                // Survival — час виживання
                _setHidden('hud-level-info', false);
                _setText('hud-level-title', _tr('mode.survival.hud', '💀 Survival') + ' — ' + U.formatTime(data.elapsed || 0));
                _setHidden('hud-level-progress-bar', true);
            } else if (data.mode === 'zen') {
                // Zen — просто заголовок режиму
                _setHidden('hud-level-info', false);
                _setText('hud-level-title', _tr('mode.zen.hud', '🧘 Zen'));
                _setHidden('hud-level-progress-bar', true);
            } else if (data.mode === 'endless') {
                // QOL: таймер виживання для нескінченного режиму (раніше видно було лише очки)
                _setHidden('hud-level-info', false);
                _setText('hud-level-title', _tr('mode.endless.hud', '♾ Нескінченний') + ' — ' + U.formatTime(data.elapsed || 0));
                _setHidden('hud-level-progress-bar', true);
            } else {
                _setHidden('hud-level-info', true);
                _setHidden('hud-level-progress-bar', true);
            }

            // Лічильник FPS (лише якщо увімкнено в налаштуваннях)
            _updateFps(data.fps);

            // Бейджі активних бонусів
            _updateBadges(data);
        } catch (e) {
            _log('error', 'update: ' + e.message);
        }
    }

    function _updateBadges(data) {
        // _tr ніколи не кидає винятків, тож fallback-гілка з дублюванням бейджів не потрібна
        let html = '';
        // Складність завжди видима: ×1.3 / ×0.85 у HUD, поки граєш
        if (typeof data.diffMult === 'number' && Math.abs(data.diffMult - 1) > 0.01) {
            const hard = data.diffMult > 1;
            html += '<div class="badge ' + (hard ? 'revive' : 'shield') + '" title="' +
                _tr('settings.difficulty', 'Складність') + '">×' + data.diffMult + '</div>';
        }
        if (data.shield) html += '<div class="badge shield" title="' + _tr('bonus.shield', 'Щит') + '">⛨</div>';
        if (data.revive) html += '<div class="badge revive" title="' + _tr('bonus.revive', 'Друге життя') + '">♥</div>';
        if (data.phase) html += '<div class="badge phase" title="' + _tr('bonus.phase', 'Фаза') + '">⚡</div>';
        if (data.magnet) html += '<div class="badge magnet" title="' + _tr('bonus.magnet', 'Магніт') + '">M</div>';
        if (data.ghost) html += '<div class="badge ghost" title="' + _tr('bonus.ghost', 'Привид') + '">👻</div>';
        if (data.double) html += '<div class="badge double" title="' + _tr('bonus.double', '×2 очки') + '">×2</div>';

        // innerHTML — лише коли набір бейджів реально змінився
        if (_last.badgesHtml === html) return;
        _last.badgesHtml = html;
        const c = _el('hud-badges');
        if (c) c.innerHTML = html;
    }

    window.HUD = {
        init: init,
        show: show,
        update: update
    };
})();
