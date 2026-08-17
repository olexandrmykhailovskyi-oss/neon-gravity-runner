/**
 * Particles.js — система частинок з об'єктним пулом.
 * - Типи: trail, explosion, spark, collect, storm
 * - Підтримка форм: circle, square, spark, star, diamond (для скінів)
 * - Зсув часток трейла вліво на швидкості vx ≈ -speed * 0.9
 */
(function () {
    'use strict';

    const POOL_SIZE = 650;
    let canvas = null;
    let ctx = null;
    const pool = [];
    let qualityScale = 1;
    let glowEnabled = true;

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[Particles] ' + msg, data); } catch (e) {}
    }

    function _make() {
        return {
            active: false,
            x: 0, y: 0, vx: 0, vy: 0,
            ax: 0, ay: 0,
            size: 2, sizeStart: 2, sizeEnd: 0,
            life: 0, maxLife: 1,
            color: '#fff', alpha: 1,
            shape: 'circle',
            glow: false,
            rot: 0, vrot: 0
        };
    }

    function _acquire() {
        for (let i = 0; i < pool.length; i++) {
            if (!pool[i].active) return pool[i];
        }
        let oldest = pool[0];
        for (let i = 1; i < pool.length; i++) {
            if (pool[i].life < oldest.life) oldest = pool[i];
        }
        return oldest;
    }

    function init(c) {
        canvas = c;
        if (!canvas) {
            _log('warn', 'init: canvas не передано');
            return;
        }
        try { ctx = canvas.getContext('2d'); } catch (e) { _log('error', 'getContext', e.message); }
        if (pool.length === 0) {
            for (let i = 0; i < POOL_SIZE; i++) pool.push(_make());
        }
        _applyQuality();
        _log('info', 'init OK, pool=' + POOL_SIZE);
    }

    function _applyQuality() {
        try {
            if (window.State && window.Config) {
                const q = window.State.getSetting('quality');
                const cfg = window.Config.QUALITY[q] || window.Config.QUALITY[1];
                qualityScale = cfg.particles;
                glowEnabled = cfg.glow;
            } else {
                qualityScale = 1;
                glowEnabled = true;
            }
        } catch (e) {
            qualityScale = 1;
            glowEnabled = true;
        }
    }

    function clear() {
        for (let i = 0; i < pool.length; i++) pool[i].active = false;
    }

    function spawn(opts) {
        if (!opts) return null;
        if (qualityScale <= 0) return null;
        if (qualityScale < 1 && Math.random() > qualityScale) return null;
        const p = _acquire();
        if (!p) return null;
        p.active = true;
        p.x = opts.x || 0;
        p.y = opts.y || 0;
        p.vx = opts.vx || 0;
        p.vy = opts.vy || 0;
        p.ax = opts.ax || 0;
        p.ay = opts.ay || 0;
        p.sizeStart = opts.size || 3;
        p.sizeEnd = opts.sizeEnd != null ? opts.sizeEnd : 0;
        p.size = p.sizeStart;
        p.maxLife = opts.life || 0.8;
        p.life = p.maxLife;
        p.color = opts.color || '#ffffff';
        p.alpha = 1;
        p.shape = opts.shape || 'circle';
        p.glow = opts.glow != null ? opts.glow : true;
        p.rot = 0;
        p.vrot = opts.vrot || 0;
        return p;
    }

    // Шлейф за гравцем (P1: vx ≈ -speed * 0.9)
    function trail(x, y, color, count, speed, shape) {
        const n = count || 2;
        const spd = typeof speed === 'number' ? speed : 300;
        const shp = shape || 'circle';
        for (let i = 0; i < n; i++) {
            spawn({
                x: x + (Math.random() - 0.5) * 6,
                y: y + (Math.random() - 0.5) * 6,
                vx: -spd * 0.9 - Math.random() * 40,
                vy: (Math.random() - 0.5) * 40,
                size: 3 + Math.random() * 2.5,
                sizeEnd: 0,
                life: 0.32 + Math.random() * 0.18,
                color: color,
                shape: shp,
                glow: true,
                vrot: (Math.random() - 0.5) * 6
            });
        }
    }

    function explosion(x, y, color, count, speed) {
        const n = Math.floor((count || 24) * qualityScale);
        const spd = speed || 220;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = spd * (0.4 + Math.random() * 0.8);
            spawn({
                x: x,
                y: y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s,
                ax: 0,
                ay: 150,
                size: 2 + Math.random() * 3,
                sizeEnd: 0,
                life: 0.5 + Math.random() * 0.6,
                color: color,
                shape: Math.random() < 0.5 ? 'circle' : 'square',
                glow: true,
                vrot: (Math.random() - 0.5) * 10
            });
        }
    }

    function update(dt) {
        if (!ctx) return;
        let timeScale = 1;
        try { if (window.Effects && typeof window.Effects.getTimeScale === 'function') timeScale = window.Effects.getTimeScale(); } catch (e) {}
        const realDt = dt * timeScale;
        for (let i = 0; i < pool.length; i++) {
            const p = pool[i];
            if (!p.active) continue;
            p.life -= realDt;
            if (p.life <= 0) {
                p.active = false;
                continue;
            }
            p.vx += p.ax * realDt;
            p.vy += p.ay * realDt;
            p.x += p.vx * realDt;
            p.y += p.vy * realDt;
            p.rot += p.vrot * realDt;
            const t = 1 - (p.life / p.maxLife);
            p.size = p.sizeStart + (p.sizeEnd - p.sizeStart) * t;
            p.alpha = Math.max(0, p.life / p.maxLife);
        }
    }

    function draw() {
        if (!ctx) return;
        for (let i = 0; i < pool.length; i++) {
            const p = pool[i];
            if (!p.active) continue;
            ctx.save();
            ctx.globalAlpha = p.alpha;
            if (glowEnabled && p.glow) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = p.color;
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.fillStyle = p.color;

            if (p.shape === 'square') {
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                const s = p.size;
                ctx.fillRect(-s / 2, -s / 2, s, s);
            } else if (p.shape === 'diamond') {
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot + Math.PI / 4);
                const s = p.size * 0.9;
                ctx.fillRect(-s / 2, -s / 2, s, s);
            } else if (p.shape === 'star') {
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                _drawStarShape(ctx, 0, 0, 4, p.size * 1.2, p.size * 0.5);
                ctx.fill();
            } else if (p.shape === 'spark') {
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillRect(-p.size * 1.5, -p.size * 0.4, p.size * 3, p.size * 0.8);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    function _drawStarShape(c, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        c.beginPath();
        c.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            c.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            c.lineTo(x, y);
            rot += step;
        }
        c.lineTo(cx, cy - outerRadius);
        c.closePath();
    }

    window.Particles = {
        init: init,
        clear: clear,
        spawn: spawn,
        trail: trail,
        explosion: explosion,
        update: update,
        draw: draw
    };
})();
