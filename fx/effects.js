/**
 * Effects.js — візуальні ефекти.
 * - Screen shake (тряска) — вимикається при reducedMotion
 * - Flash (спалах)
 * - Slow-motion
 * - Hit-stop
 * - Pulse & Vignette
 * - slowTime доступний як getter
 */
(function () {
    'use strict';

    const state = {
        shakeAmount: 0,
        shakeDecay: 0.92,
        shakeX: 0,
        shakeY: 0,

        flashAlpha: 0,
        flashColor: '#ffffff',
        flashDecay: 0,

        slowTime: 1.0,
        slowDuration: 0,
        slowTarget: 1.0,

        hitStopTime: 0,
        pulse: 0,
        vignetteIntensity: 0.6
    };

    function _log(level, msg) {
        try { if (window.Logger) window.Logger[level]('[FX] ' + msg); } catch (e) {}
    }

    function addShake(amount) {
        try {
            if (window.State && window.State.getSetting('reducedMotion')) return;
        } catch (e) {}
        const a = typeof amount === 'number' ? amount : 10;
        state.shakeAmount = Math.min(state.shakeAmount + a, 60);
    }

    function flash(color, alpha, duration) {
        state.flashColor = color || '#ffffff';
        state.flashAlpha = alpha != null ? alpha : 0.6;
        state.flashDecay = duration != null ? duration / 1000 : 0.12;
    }

    function slowmo(scale, duration) {
        state.slowTarget = scale != null ? scale : 0.4;
        state.slowDuration = duration != null ? duration / 1000 : 1.5;
    }

    function hitStop(ms) {
        state.hitStopTime = (ms || 60) / 1000;
    }

    function pulseNow() {
        state.pulse = 1;
    }

    function update(dt) {
        // Shake
        if (state.shakeAmount > 0.1) {
            state.shakeX = (Math.random() - 0.5) * state.shakeAmount * 2;
            state.shakeY = (Math.random() - 0.5) * state.shakeAmount * 2;
            state.shakeAmount *= state.shakeDecay;
        } else {
            state.shakeAmount = 0;
            state.shakeX = 0;
            state.shakeY = 0;
        }

        // Flash
        if (state.flashAlpha > 0) {
            state.flashAlpha -= dt / Math.max(0.01, state.flashDecay);
            if (state.flashAlpha < 0) state.flashAlpha = 0;
        }

        // Slow-mo
        if (state.slowDuration > 0) {
            state.slowTime += (state.slowTarget - state.slowTime) * Math.min(1, dt * 6);
            state.slowDuration -= dt;
        } else {
            state.slowTime += (1.0 - state.slowTime) * Math.min(1, dt * 4);
            if (Math.abs(state.slowTime - 1.0) < 0.005) state.slowTime = 1.0;
        }

        // Hit-stop
        if (state.hitStopTime > 0) {
            state.hitStopTime -= dt;
        }

        // Pulse
        if (state.pulse > 0) {
            state.pulse -= dt * 3;
            if (state.pulse < 0) state.pulse = 0;
        }
    }

    function getTimeScale() {
        if (state.hitStopTime > 0) return 0;
        return state.slowTime;
    }

    function applyShake(ctx) {
        if (!ctx) return;
        if (state.shakeX !== 0 || state.shakeY !== 0) {
            ctx.translate(state.shakeX, state.shakeY);
        }
    }

    function drawFlash(ctx, W, H) {
        if (!ctx || state.flashAlpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = state.flashAlpha;
        ctx.fillStyle = state.flashColor;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    function drawVignette(ctx, W, H) {
        if (!ctx) return;
        try {
            const cx = W / 2;
            const cy = H / 2;
            const r = Math.max(W, H) * 0.75;
            const grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(0,0,0,' + state.vignetteIntensity + ')');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        } catch (e) {
            _log('error', 'drawVignette помилка', e.message);
        }
    }

    function getPulse() { return state.pulse; }
    function setVignette(v) { state.vignetteIntensity = v; }

    const module = {
        addShake: addShake,
        flash: flash,
        slowmo: slowmo,
        hitStop: hitStop,
        pulseNow: pulseNow,
        update: update,
        getTimeScale: getTimeScale,
        applyShake: applyShake,
        drawFlash: drawFlash,
        drawVignette: drawVignette,
        getPulse: getPulse,
        setVignette: setVignette
    };

    Object.defineProperty(module, 'slowTime', {
        get: function () { return state.slowTime; },
        enumerable: true,
        configurable: false
    });

    window.Effects = module;
})();
