/**
 * Bonuses.js — менеджер бонусів.
 * - Спавн за таймером (зірки, щит, slow, double, magnet, ghost, revive, phase)
 * - Колекція та застосування ефектів
 * - Підтримка магніту гравця
 */
(function () {
    'use strict';

    const list = [];
    let spawnTimer = 0;
    let _rng = Math.random;

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[Bonuses] ' + msg, data); } catch (e) {}
    }

    function reset(customRng) {
        list.length = 0;
        spawnTimer = 2.5;
        _rng = typeof customRng === 'function' ? customRng : Math.random;
    }

    function update(dt, speed, area, player) {
        if (dt <= 0) return;
        const a = area || { top: 60, bottom: 660, width: 1280 };
        const spd = typeof speed === 'number' ? speed : 250;

        for (let i = list.length - 1; i >= 0; i--) {
            const b = list[i];
            try {
                if (window.Bonus) window.Bonus.update(b, dt, spd, player);
            } catch (e) {}
            if (b.x < -60 || b.collected) {
                list.splice(i, 1);
            }
        }

        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            _spawn(a);
            spawnTimer = 3.5 + _rng() * 3.5;
        }
    }

    function _spawn(area) {
        try {
            const types = ['star', 'shield', 'slow', 'double', 'magnet', 'ghost', 'revive', 'phase'];
            const weights = [0.36, 0.12, 0.10, 0.10, 0.10, 0.08, 0.07, 0.07];
            let r = _rng();
            let type = types[0];
            for (let i = 0; i < weights.length; i++) {
                if (r < weights[i]) {
                    type = types[i];
                    break;
                }
                r -= weights[i];
            }

            const x = area.width + 60;
            const BONUS_R = 16;       // максимальний радіус бонуса (14) + запас
            const SAFE_MARGIN = 70;   // QOL: щедрий відступ — бонус не повинен «прилипати» до перешкод

            // Геометрії перешкод у зоні спавну (ураховує gates, рухомі блоки, пульсари)
            let blockers = { rects: [], circles: [] };
            try {
                if (window.Obstacles && typeof window.Obstacles.getBlockers === 'function') {
                    blockers = window.Obstacles.getBlockers(x - 480, x + 260);
                }
            } catch (e) {}

            let y = 0;
            let freeFound = false;
            const MAX_ATTEMPTS = 10;

            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                y = area.top + 40 + _rng() * (area.bottom - area.top - 80);

                let blocked = false;
                const need = BONUS_R + SAFE_MARGIN;

                for (let i = 0; i < blockers.rects.length && !blocked; i++) {
                    const rc = blockers.rects[i];
                    if (window.Collision) {
                        blocked = window.Collision.circleRectDist(x, y, need, rc.x, rc.y, rc.w, rc.h) <= 0;
                    } else {
                        blocked = !(y + need < rc.y || y - need > rc.y + rc.h);
                    }
                }
                for (let i = 0; i < blockers.circles.length && !blocked; i++) {
                    const cc = blockers.circles[i];
                    if (window.Collision) {
                        blocked = window.Collision.circleCircleDist(
                            { x: x, y: y, radius: need },
                            { x: cc.x, y: cc.y, radius: cc.radius }
                        ) <= 0;
                    } else {
                        const dx = x - cc.x;
                        const dy = y - cc.y;
                        const rr = need + cc.radius;
                        blocked = (dx * dx + dy * dy) <= rr * rr;
                    }
                }

                if (!blocked) {
                    freeFound = true;
                    break;
                }
            }

            // Краще пропустити спавн, ніж видати бонус усередині перешкоди
            if (!freeFound) return;

            const b = window.Bonus.create(type, x, y, area);
            if (b) list.push(b);
        } catch (e) {
            _log('error', '_spawn помилка', e.message);
        }
    }

    function draw(ctx) {
        if (!ctx) return;
        for (let i = 0; i < list.length; i++) {
            try {
                if (window.Bonus) window.Bonus.draw(list[i], ctx);
            } catch (e) {}
        }
    }

    function collect(player) {
        if (!player || !player.alive) return null;
        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            let can = false;
            try {
                if (window.Bonus) can = window.Bonus.canCollect(b, player);
            } catch (e) {}
            if (can) {
                b.collected = true;
                b.active = false;
                _applyEffect(b, player);
                try {
                    if (window.Particles) {
                        window.Particles.explosion(b.x, b.y, b.color, 14, 160);
                    }
                    if (window.FloatingTexts) {
                        window.FloatingTexts.add(b.x, b.y - 20, _collectText(b), b.color);
                    }
                    // QOL: легка вібрація підбору бонусу (мобільні)
                    if (window.Utils) window.Utils.vibrate(b.type === 'star' ? 20 : 35);
                    // QOL: одноразова підказка при першому підборі бонусу
                    _maybeHint(b.type);
                } catch (e) {}
                return b;
            }
        }
        return null;
    }

    function _applyEffect(b, player) {
        try {
            switch (b.type) {
                case 'star':
                    if (window.Scoring) window.Scoring.addStar();
                    if (window.AudioSys) window.AudioSys.playStar();
                    try {
                        if (window.State) {
                            window.State.updateStats(function (s) {
                                s.starsCollected = (s.starsCollected || 0) + 1;
                            });
                        }
                    } catch (e) {}
                    break;

                case 'shield':
                    player.shield = true;
                    if (window.AudioSys) window.AudioSys.playBonus();
                    break;

                case 'slow':
                    if (window.Effects) window.Effects.slowmo(0.5, 3000);
                    if (window.AudioSys) window.AudioSys.playBonus();
                    break;

                case 'double':
                    if (window.Scoring) window.Scoring.setDouble(8);
                    if (window.AudioSys) window.AudioSys.playBonus();
                    break;

                case 'magnet':
                    player.magnet = 8;
                    if (window.AudioSys) window.AudioSys.playBonus();
                    break;

                case 'ghost':
                    player.ghost = 5;
                    if (window.AudioSys) window.AudioSys.playBonus();
                    break;

                case 'revive':
                    player.revive = true;
                    if (window.AudioSys) window.AudioSys.playBonus();
                    break;

                case 'phase':
                    player.phase = 0.8;
                    if (window.Effects) window.Effects.flash('#00ffee', 0.2, 100);
                    if (window.AudioSys) window.AudioSys.playPhase();
                    break;
            }
        } catch (e) {
            _log('error', '_applyEffect помилка', e.message);
        }
    }

    // QOL: одноразові підказки — що робить бонус, показується лише раз за весь прогрес
    const HINT_KEYS = {
        shield: 'hint.shield',
        slow: 'hint.slow',
        double: 'hint.double',
        magnet: 'hint.magnet',
        ghost: 'hint.ghost',
        revive: 'hint.revive',
        phase: 'hint.phase'
    };

    function _maybeHint(type) {
        try {
            const key = HINT_KEYS[type];
            if (!key || !window.State || !window.State.data) return;
            if (!window.State.data.hints) window.State.data.hints = {};
            if (window.State.data.hints[type]) return;
            window.State.data.hints[type] = true;
            window.State.save();
            if (window.UI && window.I18n) {
                window.UI.showToast(window.I18n.t(key), 'info');
            }
        } catch (e) {}
    }

    function _collectText(b) {
        const key = 'bonus.' + b.type;
        let text = key;
        try {
            if (window.I18n) text = window.I18n.t(key);
        } catch (e) {}
        if (text === key) {
            switch (b.type) {
                case 'star': return '+50';
                case 'shield': return 'ЩИТ!';
                case 'slow': return 'SLOW-MO';
                case 'double': return '×2 ОЧКИ';
                case 'magnet': return 'МАГНІТ';
                case 'ghost': return 'ПРИВИД';
                case 'revive': return 'ДРУГЕ ЖИТТЯ';
                case 'phase': return 'ФАЗА!';
                default: return '';
            }
        }
        return text;
    }

    function count() {
        return list.length;
    }

    window.Bonuses = {
        reset: reset,
        update: update,
        draw: draw,
        collect: collect,
        count: count
    };
})();
