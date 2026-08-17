/**
 * Background.js — багатошаровий неоновий фон.
 * Шари:
 * 1. Градієнт неба (bg1 → bg2)
 * 2. Туманності (parallax 0.1x)
 * 3. Мерехтливі зірки (parallax 0.3x)
 * 4. Спідлайни (parallax 1.0x) — вимикаються при reducedMotion
 * 5. Перспективна сітка (parallax 0.6x)
 * 6. Межі тунелю
 */
(function () {
    'use strict';

    let canvas = null;
    let ctx = null;
    let W = 0, H = 0;
    let theme = null;
    let stars = [];
    let nebulae = [];
    let speedLines = [];
    let offset = 0;

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[BG] ' + msg, data); } catch (e) {}
    }

    function init(c) {
        canvas = c;
        if (!canvas) { _log('warn', 'init без canvas'); return; }
        try { ctx = canvas.getContext('2d'); } catch (e) { _log('error', 'getContext', e.message); }
        try {
            if (window.Config && window.Config.THEMES && window.Config.THEMES.length > 0) {
                theme = window.Config.THEMES[0];
            } else {
                theme = { bg1: '#05010f', bg2: '#0c0628', grid: '#00e5ff', accent: '#ff2bd6' };
            }
        } catch (e) {
            theme = { bg1: '#05010f', bg2: '#0c0628', grid: '#00e5ff', accent: '#ff2bd6' };
        }
        resize();
        _log('info', 'init OK');
    }

    function resize() {
        if (!canvas) return;
        W = canvas.width;
        H = canvas.height;
        _generate();
    }

    function _generate() {
        stars = [];
        const starCount = Math.floor((W * H) / 6000);
        for (let i = 0; i < starCount; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                size: Math.random() * 1.6 + 0.4,
                base: Math.random() * 0.5 + 0.3,
                phase: Math.random() * Math.PI * 2,
                speed: Math.random() * 1.5 + 0.5
            });
        }
        nebulae = [];
        const nebulaCount = 4;
        for (let i = 0; i < nebulaCount; i++) {
            nebulae.push({
                x: Math.random() * W * 1.5,
                y: Math.random() * H,
                r: Math.random() * 280 + 180,
                color: Math.random() < 0.5 ? (theme ? theme.accent : '#ff2bd6') : (theme ? theme.grid : '#00e5ff'),
                alpha: Math.random() * 0.08 + 0.03
            });
        }
        speedLines = [];
        for (let i = 0; i < 30; i++) {
            speedLines.push({
                x: Math.random() * W,
                y: Math.random() * H,
                len: Math.random() * 60 + 20,
                speed: Math.random() * 400 + 300
            });
        }
    }

    function setTheme(idxOrObj) {
        try {
            if (typeof idxOrObj === 'object' && idxOrObj !== null) {
                theme = idxOrObj;
            } else if (window.Config && window.Config.THEMES) {
                const idx = typeof idxOrObj === 'number' ? idxOrObj : 0;
                theme = window.Config.THEMES[idx] || window.Config.THEMES[0];
            }
            _generate();
        } catch (e) {
            _log('error', 'setTheme помилка', e.message);
        }
    }

    function themeInfo() {
        return theme || { bg1: '#000', bg2: '#000', grid: '#fff', accent: '#fff' };
    }

    function update(dt, speed) {
        const spd = typeof speed === 'number' ? speed : 300;
        offset += spd * dt;
        for (let i = 0; i < speedLines.length; i++) {
            const l = speedLines[i];
            l.x -= (l.speed + spd * 0.5) * dt;
            if (l.x + l.len < 0) {
                l.x = W + Math.random() * 100;
                l.y = Math.random() * H;
                l.len = Math.random() * 60 + 20;
            }
        }
    }

    function draw() {
        if (!ctx) return;
        try {
            const reduced = !!(window.State && window.State.getSetting('reducedMotion'));

            // 1. Градієнт неба
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, theme.bg1);
            grad.addColorStop(1, theme.bg2);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // 2. Туманності
            let drawNebulae = !reduced;
            try {
                if (window.State && window.Config) {
                    const q = window.State.getSetting('quality');
                    const cfg = window.Config.QUALITY[q];
                    if (cfg) drawNebulae = drawNebulae && cfg.nebulae;
                }
            } catch (e) {}

            if (drawNebulae) {
                for (let i = 0; i < nebulae.length; i++) {
                    const n = nebulae[i];
                    const nx = ((n.x - offset * 0.1) % (W + n.r * 2)) - n.r;
                    const rGrad = ctx.createRadialGradient(nx, n.y, 0, nx, n.y, n.r);
                    const rgba = _hexRgba(n.color, n.alpha);
                    rGrad.addColorStop(0, rgba);
                    rGrad.addColorStop(1, _hexRgba(n.color, 0));
                    ctx.fillStyle = rGrad;
                    ctx.fillRect(nx - n.r, n.y - n.r, n.r * 2, n.r * 2);
                }
            }

            // 3. Зірки з мерехтінням
            const time = Date.now() * 0.001;
            let starGlow = false;
            try {
                if (window.State && window.Config) {
                    const qc = window.Config.QUALITY[window.State.getSetting('quality')];
                    if (qc) starGlow = qc.glow;
                }
            } catch (e) {}

            ctx.save();
            ctx.shadowBlur = starGlow ? 4 : 0;
            for (let i = 0; i < stars.length; i++) {
                const s = stars[i];
                const sx = ((s.x - offset * 0.3) % W + W) % W;
                const twinkle = s.base + Math.sin(time * s.speed + s.phase) * 0.3;
                ctx.globalAlpha = Math.max(0.1, Math.min(1, twinkle));
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#ffffff';
                ctx.beginPath();
                ctx.arc(sx, s.y, s.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // 4. Спідлайни (вимкнено при reducedMotion)
            if (!reduced) {
                ctx.save();
                ctx.strokeStyle = _hexRgba(theme.grid, 0.35);
                ctx.lineWidth = 1;
                ctx.shadowBlur = 6;
                ctx.shadowColor = theme.grid;
                for (let i = 0; i < speedLines.length; i++) {
                    const l = speedLines[i];
                    ctx.beginPath();
                    ctx.moveTo(l.x, l.y);
                    ctx.lineTo(l.x + l.len, l.y);
                    ctx.stroke();
                }
                ctx.restore();
            }

            // 5. Перспективна сітка
            _drawGrid();

            // 6. Межі тунелю
            _drawTunnelBounds();
        } catch (e) {
            _log('error', 'draw помилка', e.message);
        }
    }

    function _drawGrid() {
        if (!ctx) return;
        let m = 60;
        try {
            if (window.Config) m = window.Config.CANVAS.TUNNEL_MARGIN || 60;
        } catch (e) {}
        ctx.save();
        ctx.strokeStyle = _hexRgba(theme.grid, 0.18);
        ctx.lineWidth = 1;
        ctx.shadowBlur = 8;
        ctx.shadowColor = theme.grid;

        for (let i = 0; i < 4; i++) {
            const y = m - i * 14;
            ctx.globalAlpha = 0.18 - i * 0.04;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        for (let i = 0; i < 4; i++) {
            const y = H - m + i * 14;
            ctx.globalAlpha = 0.18 - i * 0.04;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        const spacing = 120;
        const offX = -(offset * 0.6) % spacing;
        ctx.globalAlpha = 0.08;
        for (let x = offX; x < W; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, m);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, H - m);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        ctx.restore();
    }

    function _drawTunnelBounds() {
        if (!ctx) return;
        let m = 60;
        try {
            if (window.Config) m = window.Config.CANVAS.TUNNEL_MARGIN || 60;
        } catch (e) {}
        ctx.save();
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 16;
        ctx.shadowColor = theme.accent;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(0, m);
        ctx.lineTo(W, m);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, H - m);
        ctx.lineTo(W, H - m);
        ctx.stroke();
        ctx.restore();
    }

    function _hexRgba(hex, a) {
        try {
            if (window.Utils && typeof window.Utils.hexToRgba === 'function') {
                return window.Utils.hexToRgba(hex, a);
            }
        } catch (e) {}
        return 'rgba(255,255,255,' + a + ')';
    }

    window.Background = {
        init: init,
        resize: resize,
        setTheme: setTheme,
        theme: themeInfo,
        update: update,
        draw: draw
    };
})();
