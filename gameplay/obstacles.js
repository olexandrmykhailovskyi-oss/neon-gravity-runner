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
            _spawn(a, spd);
        }
    }

    function _spawn(area, speed) {
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

            const x = area.width + 80;

            // QOL: структури — рідше поодинокі блоки, частіше осмислені комбінації
            const patternChance = Math.min(0.34, 0.14 + _densityMult * 0.08);
            let patternWidth = 0;
            if (types.length > 1 && _rng() < patternChance) {
                patternWidth = _spawnPattern(x, area, types, speed);
            }

            if (patternWidth <= 0) {
                const type = types[Math.floor(_rng() * types.length)] || 'wall';
                const obs = window.Obstacle.create(type, x, area, {});
                if (obs) {
                    list.push(obs);
                    totalSpawned++;
                }
            }

            // Наступний спавн — після ширини структури, щоб не перекривати її
            _scheduleNext(area, speed, patternWidth);
        } catch (e) {
            _log('error', '_spawn помилка', e.message);
        }
    }

    // Ширина структури враховується у наступному інтервалі спавну
    function _scheduleNext(area, speed, extraWidth) {
        let MIN_GAP = 460;
        let MAX_GAP = 850;
        try {
            if (window.Config && window.Config.SPAWN) {
                MIN_GAP = window.Config.SPAWN.MIN_GAP || 460;
                MAX_GAP = window.Config.SPAWN.MAX_GAP || 850;
            }
        } catch (e) {}

        let gapDiffMult = 1.0;
        try {
            if (window.State && typeof window.State.getDifficultyMultipliers === 'function') {
                gapDiffMult = window.State.getDifficultyMultipliers().gap;
            }
        } catch (e) {}

        const minG = Math.max(220, (MIN_GAP - difficulty * 35) * gapDiffMult / _densityMult);
        const maxG = Math.max(minG + 60, (MAX_GAP - difficulty * 50) * gapDiffMult / _densityMult);

        nextSpawnAt = spawnDistance + (extraWidth || 0) + minG + _rng() * (maxG - minG);
    }

    // ---- Патерни-структури ----
    const PATTERNS = [
        {
            id: 'gate_corridor',
            types: ['gate'],
            build: function (x, area, rng) {
                const out = [{ type: 'gate', dx: 0 }];
                out.push({ type: 'gate', dx: 340 });
                return out;
            }
        },
        {
            id: 'laser_line',
            types: ['laser'],
            build: function (x, area, rng) {
                const gap = 300;
                return [
                    { type: 'laser', dx: 0 },
                    { type: 'laser', dx: gap },
                    { type: 'laser', dx: gap * 2 }
                ];
            }
        },
        {
            id: 'spike_teeth',
            types: ['spikes'],
            build: function (x, area, rng) {
                const out = [];
                for (let i = 0; i < 3; i++) {
                    const floor = i % 2 === 0;
                    const obs = window.Obstacle.create('spikes', x + i * 160, area, { onFloor: floor });
                    if (obs) out.push({ obs: obs, dx: i * 160 });
                }
                return out;
            }
        },
        {
            id: 'wall_stair',
            types: ['wall'],
            build: function (x, area, rng) {
                const out = [];
                const w1 = window.Obstacle.create('wall', x, area, { fromTop: true });
                if (w1) out.push({ obs: w1, dx: 0 });
                const w2 = window.Obstacle.create('wall', x + 280, area, { fromTop: false });
                if (w2) out.push({ obs: w2, dx: 280 });
                return out;
            }
        },
        {
            id: 'gate_laser',
            types: ['gate', 'laser'],
            build: function (x, area, rng) {
                const out = [{ type: 'gate', dx: 0 }, { type: 'laser', dx: 300 }];
                return out;
            }
        },
        {
            id: 'pulsar_pair',
            types: ['pulsar'],
            build: function (x, area, rng) {
                return [{ type: 'pulsar', dx: 0 }, { type: 'pulsar', dx: 280 }];
            }
        },
        {
            id: 'moving_gauntlet',
            types: ['moving'],
            build: function (x, area, rng) {
                return [{ type: 'moving', dx: 0 }, { type: 'moving', dx: 380 }];
            }
        },
        {
            id: 'spike_laser',
            types: ['spikes', 'laser'],
            build: function (x, area, rng) {
                // Шипи знизу + лазер зверху — прохід тільки через центр
                const out = [];
                const sp = window.Obstacle.create('spikes', x, area, { onFloor: true });
                if (sp) out.push({ obs: sp, dx: 0 });
                out.push({ type: 'laser', dx: 220 });
                return out;
            }
        },
        {
            id: 'gravity_maze',
            types: ['gravity_zone', 'wall'],
            build: function (x, area, rng) {
                // Стіна → воронка (перевертає гравітацію) → стіна з іншого боку
                const out = [];
                const w1 = window.Obstacle.create('wall', x, area, { fromTop: true });
                if (w1) out.push({ obs: w1, dx: 0 });
                out.push({ type: 'gravity_zone', dx: 200 });
                const w2 = window.Obstacle.create('wall', x + 420, area, { fromTop: false });
                if (w2) out.push({ obs: w2, dx: 420 });
                return out;
            }
        },
        {
            id: 'pulsar_gate',
            types: ['gate', 'pulsar'],
            build: function (x, area, rng) {
                // Ворота, а одразу за виходом — пульсар
                return [{ type: 'gate', dx: 0 }, { type: 'pulsar', dx: 280 }];
            }
        },
        {
            id: 'laser_corridor',
            types: ['laser', 'moving_laser'],
            build: function (x, area, rng) {
                // Стационарний лазер + рухомий попереду
                return [{ type: 'laser', dx: 0 }, { type: 'moving_laser', dx: 340 }];
            }
        },
        {
            id: 'zigzag_walls',
            types: ['wall'],
            build: function (x, area, rng) {
                // Зигзаг із трьох стін: верх → низ → верх
                const out = [];
                const sides = [true, false, true];
                for (let i = 0; i < sides.length; i++) {
                    const w = window.Obstacle.create('wall', x + i * 250, area, { fromTop: sides[i] });
                    if (w) out.push({ obs: w, dx: i * 250 });
                }
                return out;
            }
        },
        {
            id: 'chaos_mix',
            types: ['wall', 'spikes', 'pulsar'],
            build: function (x, area, rng) {
                // Мікс: стіна → шипи на ПРОТИЛЕЖНОМУ боці (гарантований зигзаг) → пульсар
                const out = [];
                const wallTop = rng() < 0.5;
                const w = window.Obstacle.create('wall', x, area, { fromTop: wallTop });
                if (w) out.push({ obs: w, dx: 0 });
                const sp = window.Obstacle.create('spikes', x + 220, area, { onFloor: wallTop });
                if (sp) out.push({ obs: sp, dx: 220 });
                out.push({ type: 'pulsar', dx: 440 });
                return out;
            }
        }
    ];

    function _spawnPattern(x, area, allowedTypes, speed) {
        try {
            const candidates = PATTERNS.filter(function (p) {
                return p.types.every(function (t) { return allowedTypes.indexOf(t) !== -1; });
            });
            if (candidates.length === 0) return 0;

            const pat = candidates[Math.floor(_rng() * candidates.length)];
            const items = pat.build(x, area, _rng);
            let width = 0;
            let spawned = 0;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                let obs;
                if (item.obs) {
                    obs = item.obs;
                    obs.x = x + item.dx;
                } else {
                    obs = window.Obstacle.create(item.type, x + item.dx, area, {});
                }
                if (!obs) continue;

                // Розумна фаза лазерів у структурі: перший у лінії — гарантовано
                // синхронізований з підльотом, решта — з випадковою фазою (менш механічно)
                if (obs.type === 'laser' && typeof speed === 'number' && speed > 60) {
                    const alwaysSync = pat.id === 'laser_line' && i === 0;
                    window.Obstacle.applyLaserPhase(obs, obs.x, area, speed, alwaysSync);
                }

                list.push(obs);
                spawned++;
                width = Math.max(width, item.dx + (obs.w || 40));
            }

            if (spawned > 0) totalSpawned += spawned;
            return spawned > 0 ? width : 0;
        } catch (e) {
            _log('error', '_spawnPattern помилка', e.message);
            return 0;
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

    /**
     * Геометрії перешкод у діапазоні X — для перевірки безпечного спавну бонусів.
     * Повертає { rects: [{x,y,w,h}], circles: [{x,y,radius}] }.
     * Для рухомих блоків — повна огибающая коливання (baseY ± amp),
     * для пульсарів — максимальний радіус, лазери завжди рахуються повною колонкою.
     */
    function getBlockers(xMin, xMax) {
        const result = { rects: [], circles: [] };
        try {
            for (let i = 0; i < list.length; i++) {
                const obs = list[i];
                if (obs.x + obs.w < xMin || obs.x > xMax) continue;

                switch (obs.type) {
                    case 'moving':
                        result.rects.push({
                            x: obs.x,
                            y: obs.baseY - obs.amp,
                            w: obs.w,
                            h: obs.h + obs.amp * 2
                        });
                        break;

                    case 'laser':
                    case 'moving_laser':
                        // Завжди блокуємо колонку: фази циклічні, стан на момент спавну невідомий
                        result.rects.push({ x: obs.x, y: obs.y, w: obs.w, h: obs.h });
                        break;

                    case 'pulsar':
                        result.circles.push({ x: obs.x, y: obs.y, radius: obs.baseRadius * 1.2 });
                        break;

                    case 'gravity_zone':
                        result.circles.push({ x: obs.x, y: obs.y, radius: obs.radius });
                        break;

                    default: {
                        // wall / gate / spikes — через фабрику getRects (gate дає два прямокутники)
                        const rects = window.Obstacle ? window.Obstacle.getRects(obs) : [];
                        for (let r = 0; r < rects.length; r++) {
                            result.rects.push({ x: rects[r].x, y: rects[r].y, w: rects[r].w, h: rects[r].h });
                        }
                        break;
                    }
                }
            }
        } catch (e) {
            _log('error', 'getBlockers', e.message);
        }
        return result;
    }

    window.Obstacles = {
        reset: reset,
        update: update,
        draw: draw,
        hit: hit,
        checkNearMiss: checkNearMiss,
        count: count,
        getList: getList,
        getBlockers: getBlockers
    };
})();
