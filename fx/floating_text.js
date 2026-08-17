/**
 * FloatingText.js — плаваючий текст для комбо, очок, бонусів.
 */
(function () {
    'use strict';

    const MAX = 40;
    const list = [];

    function _log(level, msg) {
        try { if (window.Logger) window.Logger[level]('[FloatText] ' + msg); } catch (e) {}
    }

    function add(x, y, text, color) {
        if (text == null) return;
        if (typeof x !== 'number' || typeof y !== 'number') return;
        const str = String(text);
        if (str.length === 0) return;
        if (list.length >= MAX) list.shift();
        list.push({
            x: x,
            y: y,
            text: str,
            color: color || '#ffffff',
            life: 1.0,
            maxLife: 1.0,
            vy: -90,
            scale: 1
        });
    }

    function update(dt) {
        let timeScale = 1;
        try { if (window.Effects && typeof window.Effects.getTimeScale === 'function') timeScale = window.Effects.getTimeScale(); } catch (e) {}
        const realDt = dt * timeScale;
        for (let i = list.length - 1; i >= 0; i--) {
            const t = list[i];
            t.life -= realDt;
            if (t.life <= 0) {
                list.splice(i, 1);
                continue;
            }
            t.y += t.vy * realDt;
            t.vy *= 0.94;
            const age = 1 - (t.life / t.maxLife);
            t.scale = age < 0.15 ? 1 + (0.15 - age) * 2 : 1;
        }
    }

    function draw(ctx) {
        if (!ctx) return;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
        for (let i = 0; i < list.length; i++) {
            const t = list[i];
            const alpha = Math.max(0, t.life / t.maxLife);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(t.x, t.y);
            ctx.scale(t.scale, t.scale);
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.strokeText(t.text, 0, 0);
            ctx.fillStyle = t.color;
            ctx.shadowBlur = 12;
            ctx.shadowColor = t.color;
            ctx.fillText(t.text, 0, 0);
            ctx.restore();
        }
        ctx.restore();
    }

    function clear() { list.length = 0; }

    window.FloatingTexts = {
        add: add,
        update: update,
        draw: draw,
        clear: clear
    };
})();
