/**
 * Bonus.js — фабрика бонусів.
 * Типи:
 * 1. star — +50 очок
 * 2. shield — захисний щит від 1 удару
 * 3. slow — сповільнення часу на 3с
 * 4. double — подвоєння очок на 8с
 * 5. magnet — магніт для зірок на 8с
 * 6. ghost — привид на 5с (прохід крізь стіни)
 * 7. revive — друге життя (воскресіння при смерті з 2с невразливості)
 * 8. phase — фаза на 0.8с (миттєвий прохід крізь перешкоди + спідлайни)
 */
(function () {
    'use strict';

    let _uidCounter = 0;

    function _uid() {
        _uidCounter++;
        return 'bonus_' + _uidCounter;
    }

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[Bonus] ' + msg, data); } catch (e) {}
    }

    function create(type, x, y, area) {
        const a = area || { top: 60, bottom: 660 };
        const b = {
            id: _uid(),
            type: type,
            x: x,
            y: y,
            baseY: y,
            radius: 14,
            active: true,
            collected: false,
            time: Math.random() * Math.PI * 2,
            floatAmp: 8 + Math.random() * 6,
            floatFreq: 1.5 + Math.random(),
            color: '#ffffff',
            symbol: '?'
        };

        try {
            const C = window.Config ? window.Config.COLORS : {};
            switch (type) {
                case 'star':
                    b.color = C.STAR || '#fff36b';
                    b.symbol = '★';
                    b.radius = 12;
                    break;
                case 'shield':
                    b.color = C.SHIELD || '#39ff14';
                    b.symbol = '⛨';
                    break;
                case 'slow':
                    b.color = C.SLOW || '#00b8ff';
                    b.symbol = '◷';
                    break;
                case 'double':
                    b.color = C.DOUBLE || '#ff2bd6';
                    b.symbol = '×2';
                    break;
                case 'magnet':
                    b.color = C.MAGNET || '#ff6b00';
                    b.symbol = 'M';
                    break;
                case 'ghost':
                    b.color = C.GHOST || '#c0a0ff';
                    b.symbol = 'G';
                    break;
                case 'revive':
                    b.color = C.REVIVE || '#ff2a70';
                    b.symbol = '♥';
                    break;
                case 'phase':
                    b.color = C.PHASE || '#00ffee';
                    b.symbol = '⚡';
                    break;
                default:
                    _log('warn', 'невідомий тип бонуса: ' + type);
                    break;
            }
        } catch (e) {
            _log('error', 'create помилка', e.message);
        }
        return b;
    }

    function update(b, dt, speed, player) {
        if (!b || !b.active) return;
        b.time += dt;

        const spd = typeof speed === 'number' ? speed : 250;
        b.x -= spd * dt;
        b.y = b.baseY + Math.sin(b.time * b.floatFreq) * b.floatAmp;

        // Магніт: притягуємо зірки (радіус 420, сильний підтягуючий імпульс)
        try {
            if (player && player.magnet > 0 && b.type === 'star') {
                const dx = player.x - b.x;
                const dy = player.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const MAGNET_RADIUS = 420;
                if (dist < MAGNET_RADIUS && dist > 1) {
                    // Чим ближче зірка, тим сильніше тягне (плавний захоплюючий ефект)
                    const pull = (620 + (1 - dist / MAGNET_RADIUS) * 420) * dt;
                    b.x += (dx / dist) * pull;
                    b.y += (dy / dist) * pull;
                    b.baseY = b.y;
                }
            }
        } catch (e) {}
    }

    function canCollect(b, player) {
        if (!b || !b.active || b.collected) return false;
        if (!player || !player.alive) return false;
        try {
            if (window.Collision && window.Collision.circles) {
                return window.Collision.circles(b, player);
            }
        } catch (e) {}
        return false;
    }

    function draw(b, ctx) {
        if (!b || !ctx || !b.active) return;
        try {
            ctx.save();
            const pulse = 1 + Math.sin(b.time * 4) * 0.1;
            const r = b.radius * pulse;

            ctx.shadowBlur = 18;
            ctx.shadowColor = b.color;
            ctx.fillStyle = _hexRgba(b.color, 0.15);
            ctx.beginPath();
            ctx.arc(b.x, b.y, r + 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000000';
            ctx.font = 'bold ' + Math.floor(r * 1.1) + 'px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(b.symbol, b.x, b.y + 1);

            ctx.restore();
        } catch (e) {
            _log('error', 'draw помилка', e.message);
        }
    }

    function _hexRgba(hex, a) {
        try {
            if (window.Utils && typeof window.Utils.hexToRgba === 'function') {
                return window.Utils.hexToRgba(hex, a);
            }
        } catch (e) {}
        return 'rgba(255,255,255,' + a + ')';
    }

    window.Bonus = {
        create: create,
        update: update,
        canCollect: canCollect,
        draw: draw
    };
})();
