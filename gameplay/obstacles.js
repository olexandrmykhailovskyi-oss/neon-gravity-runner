/**
 * Obstacles.js — менеджер перешкод.
 * - Спавн перешкод з урахуванням дозволених типів поточного рівня / режиму
 * - Підтримка множників густини (density) та складності (gapMult)
 * - Підтримка Daily Challenge (детермінований RNG)
 * - Near-miss детекція
 */
(function () {
    'use strict';

    const list = [];
    let spawnDistance = 0;
    let nextSpawnAt = 0;
    let difficulty = 0;
    let totalSpawned = 0;

    let _allowedTypes = null;
    let _densityMult = 1.0;
    let _rng = Math.random;

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[Obstacles] ' + msg, data); } catch (e) {}
    }

    function reset(allowedTypes, density, customRng) {
        list.length = 0;
        spawnDistance = 0;
        nextSpawnAt = 450;
        difficulty = 0;
        totalSpawned = 0;

        _allowedTypes = Array.isArray(allowedTypes) && allowedTypes.length > 0 ? allowedTypes.slice() : null;
        _densityMult = typeof density === 'number' && density > 0 ? density : 1.0;
        _rng = typeof customRng === 'function' ? customRng : Math.random;
    }

    function update(dt, speed, area) {
        if (dt <= 0) return;
        const spd = typeof speed === 'number' ? speed : 250;
        const a = area || { top: 60, bottom: 660, width: 1280 };

        difficulty += dt * 0.008;

        for (let i = list.length - 1; i >= 0; i--) {
            const obs = list[i];
            try {
                if (window.Obstacle) window.Obstacle.update(obs, dt, spd);
            } catch (e) {
                _log('error', 'update перешкоди', e.message);
            }
            if (obs.x + obs.w < -60) {
                list.splice(i, 1);
            }
        }

        // Спавн
        spawnDistance += spd * dt;
        if (spawnDistance >= nextSpawnAt) {
            _spawn(a);

            let MIN_GAP = 460;
            let MAX_GAP = 850;
            try {
                if (window.Config && window.Config.SPAWN) {
                    MIN_GAP = window.Config.SPAWN.MIN_GAP || 460;
                    MAX_GAP = window.Config.SPAWN.MAX_GAP || 850;
                }
            } catch (e) {}

            // Множник складності
            let gapDiffMult = 1.0;
            try {
                if (window.State && typeof window.State.getDifficultyMultipliers === 'function') {
                    gapDiffMult = window.State.getDifficultyMultipliers().gap;
                }
            } catch (e) {}

            // Коригуємо проміжки за густиною та складністю
            const minG = Math.max(220, (MIN_GAP - difficulty * 35) * gapDiffMult / _densityMult);
            const maxG = Math.max(minG + 60, (MAX_GAP - difficulty * 50) * gapDiffMult / _densityMult);

            nextSpawnAt = spawnDistance + minG + _rng() * (maxG - minG);
        }
    }

    function _spawn(area) {
        try {
            let types = [];
            if (_allowedTypes) {
                types = _allowedTypes.slice();
            } else {
                types = ['wall', 'spikes', 'gate', 'moving'];
                if (difficulty > 0.25) types.push('gravity_zone');
                if (difficulty > 0.35) types.push('laser');
                if (difficulty > 0.50) types.push('pulsar');
                if (difficulty > 0.65) types.push('moving_laser');
            }

            const type = types[Math.floor(_rng() * types.length)] || 'wall';
            const x = area.width + 80;
            const obs = window.Obstacle.create(type, x, area, {});
            if (obs) {
                list.push(obs);
                totalSpawned++;
            }
        } catch (e) {
            _log('error', '_spawn помилка', e.message);
        }
    }

    function draw(ctx) {
        if (!ctx) return;
        for (let i = 0; i < list.length; i++) {
            try {
                if (window.Obstacle) window.Obstacle.draw(list[i], ctx);
            } catch (e) {}
        }
    }

    function hit(player) {
        if (!player || !player.alive) return null;
        for (let i = 0; i < list.length; i++) {
            const obs = list[i];
            try {
                if (window.Obstacle && window.Obstacle.hitTest(obs, player)) {
                    return obs;
                }
            } catch (e) {}
        }
        return null;
    }

    function checkNearMiss(player) {
        if (!player || !player.alive) return null;
        let NEAR_MISS_DIST = 28;
        try {
            if (window.Config && window.Config.GAME) NEAR_MISS_DIST = window.Config.GAME.NEAR_MISS_DIST || 28;
        } catch (e) {}

        for (let i = 0; i < list.length; i++) {
            const obs = list[i];
            if (obs.nearMissCounted) continue;
            if (obs.type === 'gravity_zone') continue;
            if (obs.x + obs.w > player.x) continue;

            let dist = Infinity;
            try {
                if (window.Obstacle) dist = window.Obstacle.nearMissDist(obs, player);
            } catch (e) {}

            if (dist < NEAR_MISS_DIST) {
                obs.nearMissCounted = true;
                return { obs: obs, dist: dist };
            }
        }
        return null;
    }

    function count() {
        return list.length;
    }

    function getList() {
        return list.slice();
    }

    window.Obstacles = {
        reset: reset,
        update: update,
        draw: draw,
        hit: hit,
        checkNearMiss: checkNearMiss,
        count: count,
        getList: getList
    };
})();
