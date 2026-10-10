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

    let _allowedTypes = null;
    let _densityMult = 1.0;
    let _rng = Math.random;

    // ---- Авто-набір типів перешкод за складністю (статичні масиви, без алокацій при спавні) ----
    const AUTO_TYPES_BASE = ['wall', 'spikes', 'gate', 'moving'];
    const AUTO_TYPES_GRAVITY = AUTO_TYPES_BASE.concat(['gravity_zone']);
    const AUTO_TYPES_LASER = AUTO_TYPES_GRAVITY.concat(['laser']);
    const AUTO_TYPES_PULSAR = AUTO_TYPES_LASER.concat(['pulsar']);
    const AUTO_TYPES_FULL = AUTO_TYPES_PULSAR.concat(['moving_laser']);

    // Переиспользуемый буфер для getBlockers: виклик синхронний, результат не зберігається між викликами
    const _blockersBuf = { rects: [], circles: [] };

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[Obstacles] ' + msg, data); } catch (e) {}
    }

    /**
     * @param {string[]|null} allowedTypes Дозволені типи перешкод (напр. ['wall','spikes']); null — авто-набір за складністю
     * @param {number} density Множник густини (>0): 1.0 — базово, 2.0 — вдвічі частіше
     * @param {Function} [customRng] Випадкова функция ()=>0..1 для детермінізму (Daily Challenge)
     */
    function reset(allowedTypes, density, customRng) {
        list.length = 0;
        spawnDistance = 0;
        nextSpawnAt = 450;
        difficulty = 0;

        _allowedTypes = Array.isArray(allowedTypes) && allowedTypes.length > 0 ? allowedTypes.slice() : null;
        _densityMult = typeof density === 'number' && density > 0 ? density : 1.0;
        _rng = typeof customRng === 'function' ? customRng : Math.random;
    }

    /**
     * Оновлює рух і спавн перешкод за кадр
     * @param {number} dt Час з попереднього кадру (секунди)
     * @param {number} [speed] Швидкість сцени (px/сек); за замовчуванням 250
     * @param {Object} [area] Область гри {top,bottom,width}; за замовчуванням {top:60,bottom:660,width:1280}
     */
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
            let types;
            if (_allowedTypes) {
                types = _allowedTypes;
            } else if (difficulty <= 0.25) {
                types = AUTO_TYPES_BASE;
            } else if (difficulty <= 0.35) {
                types = AUTO_TYPES_GRAVITY;
            } else if (difficulty <= 0.50) {
                types = AUTO_TYPES_LASER;
            } else if (difficulty <= 0.65) {
                types = AUTO_TYPES_PULSAR;
            } else {
                types = AUTO_TYPES_FULL;
            }

            // Не спавнимо перешкоду впритул до щойно створеного бонуса:
            // обидва рухаються з однаковою швидкістю, тож збіг лишився б назавжди
            let x = area.width + 80;
            try {
                if (window.Bonuses && typeof window.Bonuses.getList === 'function') {
                    const bl = window.Bonuses.getList();
                    for (let i = 0; i < bl.length; i++) {
                        if (bl[i].x > area.width - 200) {
                            x = Math.max(x, bl[i].x + 140);
                        }
                    }
                }
            } catch (e) {}

            // QOL: структури — рідше поодинокі блоки, частіше осмислені комбінації
            const patternChance = Math.min(0.34, 0.14 + _densityMult * 0.08);
            let patternWidth = 0;
            if (types.length > 1 && _rng() < patternChance) {
                patternWidth = _spawnPattern(x, area, types, speed);
            }

            if (patternWidth <= 0) {
                const type = types[Math.floor(_rng() * types.length)] || 'wall';
                const obs = window.Obstacle.create(type, x, area, { speed: speed, rng: _rng });
                if (obs) {
                    list.push(obs);
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
                    const obs = window.Obstacle.create('spikes', x + i * 160, area, { onFloor: floor, rng: rng });
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
                const w1 = window.Obstacle.create('wall', x, area, { fromTop: true, rng: rng });
                if (w1) out.push({ obs: w1, dx: 0 });
                const w2 = window.Obstacle.create('wall', x + 280, area, { fromTop: false, rng: rng });
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
                const sp = window.Obstacle.create('spikes', x, area, { onFloor: true, rng: rng });
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
                const w1 = window.Obstacle.create('wall', x, area, { fromTop: true, rng: rng });
                if (w1) out.push({ obs: w1, dx: 0 });
                out.push({ type: 'gravity_zone', dx: 200 });
                const w2 = window.Obstacle.create('wall', x + 420, area, { fromTop: false, rng: rng });
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
                    const w = window.Obstacle.create('wall', x + i * 250, area, { fromTop: sides[i], rng: rng });
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
                const w = window.Obstacle.create('wall', x, area, { fromTop: wallTop, rng: rng });
                if (w) out.push({ obs: w, dx: 0 });
                const sp = window.Obstacle.create('spikes', x + 220, area, { onFloor: wallTop, rng: rng });
                if (sp) out.push({ obs: sp, dx: 220 });
                out.push({ type: 'pulsar', dx: 440 });
                return out;
            }
        },
        {
            id: 'gate_gauntlet',
            types: ['gate', 'moving'],
            build: function (x, area, rng) {
                // Ворота, а одразу за виходом — рухомий блок
                return [{ type: 'gate', dx: 0 }, { type: 'moving', dx: 320 }];
            }
        },
        {
            id: 'laser_gate_laser',
            types: ['laser', 'gate'],
            build: function (x, area, rng) {
                // Лазер → ворота → лазер: тримаємо ритм фаз
                return [{ type: 'laser', dx: 0 }, { type: 'gate', dx: 280 }, { type: 'laser', dx: 560 }];
            }
        },
        {
            id: 'pulsar_wall_sandwich',
            types: ['pulsar', 'wall'],
            build: function (x, area, rng) {
                // Стіна зверху → пульсар → стіна знизу: вертикальний коридор
                const out = [];
                const w1 = window.Obstacle.create('wall', x, area, { fromTop: true, rng: rng });
                if (w1) out.push({ obs: w1, dx: 0 });
                out.push({ type: 'pulsar', dx: 240 });
                const w2 = window.Obstacle.create('wall', x + 480, area, { fromTop: false, rng: rng });
                if (w2) out.push({ obs: w2, dx: 480 });
                return out;
            }
        },
        {
            id: 'gravity_teeth',
            types: ['gravity_zone', 'spikes'],
            build: function (x, area, rng) {
                // Воронка перевертає гравітацію, далі — зубці з обох боків
                const out = [{ type: 'gravity_zone', dx: 0 }];
                const sp1 = window.Obstacle.create('spikes', x + 260, area, { onFloor: true, rng: rng });
                if (sp1) out.push({ obs: sp1, dx: 260 });
                const sp2 = window.Obstacle.create('spikes', x + 470, area, { onFloor: false, rng: rng });
                if (sp2) out.push({ obs: sp2, dx: 470 });
                return out;
            }
        },
        {
            id: 'triple_mover',
            types: ['moving'],
            build: function (x, area, rng) {
                // Три рухомі блоки з природним розкидом фаз (phase випадковий у create)
                return [{ type: 'moving', dx: 0 }, { type: 'moving', dx: 260 }, { type: 'moving', dx: 520 }];
            }
        },
        {
            id: 'spike_strip',
            types: ['spikes'],
            build: function (x, area, rng) {
                // Довга смуга зубців знизу + відповідь зверху
                const out = [];
                const s1 = window.Obstacle.create('spikes', x, area, { onFloor: true, rng: rng });
                if (s1) out.push({ obs: s1, dx: 0 });
                const s2 = window.Obstacle.create('spikes', x + 110, area, { onFloor: true, rng: rng });
                if (s2) out.push({ obs: s2, dx: 110 });
                const s3 = window.Obstacle.create('spikes', x + 320, area, { onFloor: false, rng: rng });
                if (s3) out.push({ obs: s3, dx: 320 });
                return out;
            }
        },
        {
            id: 'spike_laser_alt',
            types: ['spikes', 'laser'],
            build: function (x, area, rng) {
                // Дзеркало spike_laser: шипи зі стелі + лазер — прохід через низ
                const out = [];
                const sp = window.Obstacle.create('spikes', x, area, { onFloor: false, rng: rng });
                if (sp) out.push({ obs: sp, dx: 0 });
                out.push({ type: 'laser', dx: 220 });
                return out;
            }
        },
        {
            id: 'laser_wall_gate',
            types: ['laser', 'wall', 'gate'],
            build: function (x, area, rng) {
                // Лазер → стіна → ворота: повний набір по черзі
                const out = [{ type: 'laser', dx: 0 }];
                const wallTop = rng() < 0.5;
                const w = window.Obstacle.create('wall', x + 280, area, { fromTop: wallTop, rng: rng });
                if (w) out.push({ obs: w, dx: 280 });
                out.push({ type: 'gate', dx: 560 });
                return out;
            }
        },
        {
            id: 'spike_gauntlet',
            types: ['spikes'],
            build: function (x, area, rng) {
                // Щільна гребінка: 4 блоки, сторони чергуються
                const out = [];
                const sides = [true, false, true, false];
                for (let i = 0; i < sides.length; i++) {
                    const sp = window.Obstacle.create('spikes', x + i * 150, area, { onFloor: sides[i], rng: rng });
                    if (sp) out.push({ obs: sp, dx: i * 150 });
                }
                return out;
            }
        },
        {
            id: 'pulsar_trio',
            types: ['pulsar'],
            build: function (x, area, rng) {
                // Три пульсари — хвилі радіусу перекривають центр
                return [{ type: 'pulsar', dx: 0 }, { type: 'pulsar', dx: 230 }, { type: 'pulsar', dx: 460 }];
            }
        },
        {
            id: 'gate_tunnel',
            types: ['gate'],
            build: function (x, area, rng) {
                // Тунель із трьох воріт підряд
                return [{ type: 'gate', dx: 0 }, { type: 'gate', dx: 310 }, { type: 'gate', dx: 620 }];
            }
        },
        {
            id: 'moving_wall_mix',
            types: ['moving', 'wall'],
            build: function (x, area, rng) {
                // Стіна задає сторону, рухомий блок назустріч
                const out = [];
                const wallTop = rng() < 0.5;
                const w = window.Obstacle.create('wall', x, area, { fromTop: wallTop, rng: rng });
                if (w) out.push({ obs: w, dx: 0 });
                out.push({ type: 'moving', dx: 320 });
                return out;
            }
        },
        {
            id: 'gravity_pulsar',
            types: ['gravity_zone', 'pulsar'],
            build: function (x, area, rng) {
                // Воронка перевертає гравітацію, пульсар змушує рухатись
                return [{ type: 'gravity_zone', dx: 0 }, { type: 'pulsar', dx: 280 }];
            }
        },
        {
            id: 'laser_corridor_long',
            types: ['laser', 'moving_laser'],
            build: function (x, area, rng) {
                // Довгий коридор: лазер → рухомий → лазер
                return [{ type: 'laser', dx: 0 }, { type: 'moving_laser', dx: 320 }, { type: 'laser', dx: 640 }];
            }
        },
        {
            id: 'zigzag_spikes_wall',
            types: ['spikes', 'wall'],
            build: function (x, area, rng) {
                // Стіна → шипи їй назустріч → стіна навпаки
                const out = [];
                const wallTop = rng() < 0.5;
                const w1 = window.Obstacle.create('wall', x, area, { fromTop: wallTop, rng: rng });
                if (w1) out.push({ obs: w1, dx: 0 });
                const sp = window.Obstacle.create('spikes', x + 250, area, { onFloor: !wallTop, rng: rng });
                if (sp) out.push({ obs: sp, dx: 250 });
                const w2 = window.Obstacle.create('wall', x + 500, area, { fromTop: !wallTop, rng: rng });
                if (w2) out.push({ obs: w2, dx: 500 });
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
                    obs = window.Obstacle.create(item.type, x + item.dx, area, { speed: speed, rng: _rng });
                }
                if (!obs) continue;

                // Розумна фаза лазерів у структурі: перший у лінії — гарантовано
                // синхронізований з підльотом, решта — з випадковою фазою (менш механічно)
                if (obs.type === 'laser' && typeof speed === 'number' && speed > 60) {
                    const alwaysSync = pat.id === 'laser_line' && i === 0;
                    window.Obstacle.applyLaserPhase(obs, obs.x, area, speed, alwaysSync, _rng);
                }

                list.push(obs);
                spawned++;
                width = Math.max(width, item.dx + (obs.w || 40));
            }

            return spawned > 0 ? width : 0;
        } catch (e) {
            _log('error', '_spawnPattern помилка', e.message);
            return 0;
        }
    }

    /**
     * Малює всі активні перешкоди на канвісі
     * @param {CanvasRenderingContext2D} ctx
     */
    function draw(ctx) {
        if (!ctx) return;
        for (let i = 0; i < list.length; i++) {
            try {
                if (window.Obstacle) window.Obstacle.draw(list[i], ctx);
            } catch (e) {}
        }
    }

    /**
     * Перевіряє зіткнення гравця з перешкодами за кадр
     * @param {Object} player Об'єкт гравця (має поле alive)
     * @returns {Object|null} Перешкода, що зіткнулась, або null
     */
    function hit(player) {
        if (!player || !player.alive) return null;
        let zoneTriggeredThisFrame = false;
        for (let i = 0; i < list.length; i++) {
            const obs = list[i];
            try {
                // Дві зони в одному кадрі = подвійна інверсія (ефект нульовий) —
                // дозволяємо спрацювати лише одній gravity_zone за кадр
                if (obs.type === 'gravity_zone' && zoneTriggeredThisFrame && !obs.triggered) continue;
                const wasTriggered = obs.triggered;
                if (window.Obstacle && window.Obstacle.hitTest(obs, player)) {
                    return obs;
                }
                if (obs.type === 'gravity_zone' && !wasTriggered && obs.triggered) {
                    zoneTriggeredThisFrame = true;
                }
            } catch (e) {}
        }
        return null;
    }

    /**
     * Near-miss детекція: перешкода, яку гравець щойно минув близько
     * @param {Object} player Об'єкт гравця (має поле alive)
     * @returns {{obs:Object, dist:number}|null}
     */
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

    /**
     * Поточна кількість активних перешкод у списку
     * @returns {number}
     */
    function count() {
        return list.length;
    }

    /**
     * Копія списку активних перешкод
     * @returns {Object[]}
     */
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
        const result = _blockersBuf;
        result.rects.length = 0;
        result.circles.length = 0;
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

    /**
     * Менеджер перешкод (window.Obstacles)
     * Керує спавном, рухом, зіткненнями та near-miss детекцією перешкод.
     *
     * Що таке «паттерни» (структури):
     * Паттерн — це структурний шаблон спавна, який об'єднує кілька перешкод
     * в єдину комбінацію (напр. «стіна → шипи → стіна» або «лазер → ворота → лазер»).
     * Кожен паттерн має id, список дозволених типів та build-функцію, яка
     * повертає масив елементів {type або obs, dx} (dx — зміщення відносно точки спавну).
     * При спавні паттерни обираються випадково серед тих, чиї типи присутні в _allowedTypes.
     * Паттерни збільшують різноманітність рівнів і роблять їх більш передбачуваними
     * порівняно з повністю випадковим спавном поодиноких блоків.
     *
     * Вплив density (множника густини):
     * - Більший density → частіше спавн перешкод (інтервал між ними менший)
     * - Більший density → вища ймовірність спавну паттерна замість поодинокого блока
     * - Менший density → рідкі перешкоди, більше простору для проходження
     */
    window.Obstacles = {
        /**
         * Скидає стан і задає параметри рівня
         * @param {string[]|null} allowedTypes Дозволені типи перешкод; null — авто-набір за складністю
         * @param {number} density Множник густини (>0): 1.0 — базово, 2.0 — вдвічі частіше
         * @param {Function} [customRng] Випадкова функция ()=>0..1 для детермінізму (Daily Challenge)
         */
        reset: reset,
        /**
         * Оновлює рух і спавн перешкод за кадр
         * @param {number} dt Час з попереднього кадру (секунди)
         * @param {number} [speed] Швидкість сцени (px/сек); за замовчуванням 250
         * @param {Object} [area] Область гри {top,bottom,width}; за замовчуванням {top:60,bottom:660,width:1280}
         */
        update: update,
        /**
         * Малює всі активні перешкоди на канвісі
         * @param {CanvasRenderingContext2D} ctx
         */
        draw: draw,
        /**
         * Перевіряє зіткнення гравця з перешкодами за кадр
         * @param {Object} player Об'єкт гравця (має поле alive)
         * @returns {Object|null} Перешкода, що зіткнулась, або null
         */
        hit: hit,
        /**
         * Near-miss детекція: перешкода, яку гравець щойно минув близько
         * @param {Object} player Об'єкт гравця (має поле alive)
         * @returns {{obs:Object, dist:number}|null}
         */
        checkNearMiss: checkNearMiss,
        /**
         * Поточна кількість активних перешкод у списку
         * @returns {number}
         */
        count: count,
        /**
         * Копія списку активних перешкод
         * @returns {Object[]}
         */
        getList: getList,
        /**
         * Прямокутники та кола, які перешкоди займають у діапазоні X — для перевірки безпечного спавну бонусів
         * @param {number} xMin Ліва межа діапазону (px)
         * @param {number} xMax Права межа діапазону (px)
         * @returns {{rects:Object[], circles:Object[]}}
         */
        getBlockers: getBlockers,
        /**
         * Кількість структурних шаблонів (паттернів) спавн-патернів
         * @returns {number}
         */
        patternCount: function () { return PATTERNS.length; }
    };
})();
