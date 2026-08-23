/**
 * Config.js — усі константи гри.
 * Глибоко заморожений (deepFreeze) — жодних мутацій.
 * НЕ залежить від інших модулів.
 */
(function () {
    'use strict';

    const Config = {
        GAME: {
            BASE_SPEED: 250,        // пікселів/сек на старті (P1)
            SPEED_GROWTH: 2.5,      // приріст за секунду (P1)
            MAX_SPEED: 700,         // максимальна швидкість (P1)
            GRAVITY: 1900,          // прискорення гравітації (P1)
            FLIP_IMPULSE: 420,      // імпульс стрибка при зміні гравітації (P1)
            MAX_VY: 700,            // обмеження вертикальної швидкості (P1)
            NEAR_MISS_DIST: 28,     // відстань "ледь оминули"
            COMBO_DECAY: 1.5,       // сек без перешкод → комбо зникає
            HITBOX_FORGIVE: 0.82,   // QOL: множник хітбокса гравця проти перешкод (менше = милостивіше)
            FLIP_BUFFER: 0.15,      // QOL: сек — натискання фліпа під час кулдауну не губиться
            STORM_INTERVAL: 45,     // сек між штормами
            STORM_DURATION: 8,
            TUTORIAL_OBSTACLES: 3
        },

        CANVAS: {
            DESIGN_WIDTH: 1280,
            DESIGN_HEIGHT: 720,
            PLAYER_X_RATIO: 0.22,
            TUNNEL_MARGIN: 60
        },

        SPAWN: {
            MIN_GAP: 460,           // мінімальний проміжок між перешкодами (P1)
            MAX_GAP: 850,           // максимальний проміжок (P1)
            BONUS_CHANCE: 0.16,
            OBSTACLE_TYPES: ['wall', 'gate', 'moving', 'spikes', 'laser', 'moving_laser', 'gravity_zone', 'pulsar'],
            BONUS_TYPES: ['star', 'shield', 'slow', 'double', 'magnet', 'ghost', 'revive', 'phase']
        },

        QUALITY: [
            { id: 'low',    name: 'Низька',  particles: 0.3, glow: false, trails: 0, nebulae: false },
            { id: 'medium', name: 'Середня', particles: 0.6, glow: true,  trails: 2, nebulae: true  },
            { id: 'high',   name: 'Висока',  particles: 1.0, glow: true,  trails: 4, nebulae: true  },
            { id: 'ultra',  name: 'Ультра',  particles: 1.5, glow: true,  trails: 6, nebulae: true  }
        ],

        THEMES: [
            { id: 0, i18n: 'cyberpunk', name: 'Кіберпанк',      bg1: '#05010f', bg2: '#0c0628', grid: '#00e5ff', accent: '#ff2bd6' },
            { id: 1, i18n: 'retrowave', name: 'Ретро-вейв',     bg1: '#1a0033', bg2: '#4b0082', grid: '#ff00ff', accent: '#00ffff' },
            { id: 2, i18n: 'matrix',    name: 'Матриця',        bg1: '#000800', bg2: '#002200', grid: '#00ff41', accent: '#00ff41' },
            { id: 3, i18n: 'fire',      name: 'Вогонь',         bg1: '#1a0500', bg2: '#3a0c00', grid: '#ff6b00', accent: '#ff2bd6' },
            { id: 4, i18n: 'dark',      name: 'Темний сектор', bg1: '#020008', bg2: '#120024', grid: '#9d4edd', accent: '#e0aaff' },
            { id: 5, i18n: 'iris',      name: 'Ірис',           bg1: '#001f24', bg2: '#003840', grid: '#00f5d4', accent: '#ffd166' }
        ],

        SKINS: [
            { id: 'default', name: 'Базовий',      color: '#00e5ff', trailShape: 'circle',  unlock: 'free' },
            { id: 'pink',    name: 'Неон-рожевий', color: '#ff2bd6', trailShape: 'spark',   unlock: { stats: 'bestScore', value: 300 } },
            { id: 'gold',    name: 'Золотий',      color: '#ffd700', trailShape: 'star',    unlock: { stats: 'bestScore', value: 1000 } },
            { id: 'green',   name: 'Хакер',        color: '#39ff14', trailShape: 'square',  unlock: { achievement: 'first_storm' } },
            { id: 'rainbow', name: 'Веселка',      color: 'rainbow', trailShape: 'diamond', unlock: { stats: 'bestCombo', value: 12 } },
            { id: 'white',   name: 'Привид',       color: '#ffffff', trailShape: 'spark',   unlock: { achievement: 'ghost_master' } },
            { id: 'plasma',  name: 'Плазма',       color: '#ff00ff', trailShape: 'star',    unlock: { stats: 'starsCollected', value: 50 } },
            { id: 'toxic',   name: 'Токсичний',    color: '#ccff00', trailShape: 'diamond', unlock: { stats: 'dailyStreak', value: 3 } }
        ],

        ACHIEVEMENTS: [
            { id: 'first_game',   name: 'Перший політ',      desc: 'Зіграйте одну гру',           check: function (s) { return s.totalGames >= 1; } },
            { id: 'score_300',    name: 'Початківець',       desc: 'Наберіть 300 очок',           check: function (s) { return s.bestScore >= 300; } },
            { id: 'score_1000',   name: 'Пілот',             desc: 'Наберіть 1000 очок',          check: function (s) { return s.bestScore >= 1000; } },
            { id: 'score_2500',   name: 'Ас',                desc: 'Наберіть 2500 очок',          check: function (s) { return s.bestScore >= 2500; } },
            { id: 'combo_6',      name: 'Комбо-майстер',     desc: 'Комбо 6+',                    check: function (s) { return s.bestCombo >= 6; } },
            { id: 'combo_12',     name: 'Серія',             desc: 'Комбо 12+',                   check: function (s) { return s.bestCombo >= 12; } },
            { id: 'near_miss_20', name: 'Ледь оминули',      desc: '20 near-miss',                check: function (s) { return s.nearMisses >= 20; } },
            { id: 'stars_50',     name: 'Зіркозбирач',       desc: 'Зібрати 50 зірок',            check: function (s) { return s.starsCollected >= 50; } },
            { id: 'first_storm',  name: 'Пережити бурю',     desc: 'Пережити перший Neon Storm',  check: function (s) { return s.stormsSurvived >= 1; } },
            { id: 'ghost_master', name: 'Привид',            desc: '5 разів пройти крізь стіни',  check: function (s) { return s.ghostPasses >= 5; } },
            { id: 'marathon',     name: 'Марафон',           desc: 'Протриматися 2 хвилини',      check: function (s) { return s.longestGame >= 120; } },
            {
                id: 'level_5',
                name: 'Рубіж 5',
                desc: 'Пройти 5 рівень кампанії',
                check: function () {
                    try {
                        const c = window.State && window.State.data && window.State.data.campaign;
                        return !!(c && c.stars && c.stars[5] > 0);
                    } catch (e) { return false; }
                }
            },
            {
                id: 'level_10',
                name: 'Рубіж 10',
                desc: 'Пройти 10 рівень кампанії',
                check: function () {
                    try {
                        const c = window.State && window.State.data && window.State.data.campaign;
                        return !!(c && c.stars && c.stars[10] > 0);
                    } catch (e) { return false; }
                }
            },
            {
                id: 'level_15',
                name: 'Чемпіон',
                desc: 'Пройти всі 15 рівнів кампанії',
                check: function () {
                    try {
                        const c = window.State && window.State.data && window.State.data.campaign;
                        return !!(c && c.stars && c.stars[15] > 0);
                    } catch (e) { return false; }
                }
            },
            {
                id: 'stars_15',
                name: 'Колекціонер зірок',
                desc: 'Зібрати 15★ у кампанії',
                check: function () {
                    try {
                        const c = window.State && window.State.data && window.State.data.campaign;
                        if (!c || !c.stars) return false;
                        let sum = 0;
                        for (let k = 1; k <= 15; k++) sum += (c.stars[k] || 0);
                        return sum >= 15;
                    } catch (e) { return false; }
                }
            }
        ],

        LEVELS: [
            {
                id: 1,
                name: 'Перший політ',
                duration: 30,
                speedMult: 0.80,
                obstacles: ['wall', 'spikes'],
                density: 1.0,
                storm: false,
                theme: 0,
                starScore: 300
            },
            {
                id: 2,
                name: 'Ворота',
                duration: 35,
                speedMult: 0.85,
                obstacles: ['wall', 'spikes', 'gate'],
                density: 1.0,
                storm: false,
                theme: 0,
                starScore: 400
            },
            {
                id: 3,
                name: 'Хиткі блоки',
                duration: 35,
                speedMult: 0.90,
                obstacles: ['wall', 'spikes', 'gate', 'moving'],
                density: 1.0,
                storm: false,
                theme: 1,
                starScore: 450
            },
            {
                id: 4,
                name: 'Шиповий пояс',
                duration: 40,
                speedMult: 0.90,
                obstacles: ['spikes', 'wall'],
                density: 1.5,
                storm: false,
                theme: 1,
                starScore: 500
            },
            {
                id: 5,
                name: 'Лазерний рубіж',
                duration: 40,
                speedMult: 0.95,
                obstacles: ['wall', 'spikes', 'gate', 'laser'],
                density: 1.0,
                storm: false,
                theme: 2,
                starScore: 550
            },
            {
                id: 6,
                name: 'Подвійна загроза',
                duration: 45,
                speedMult: 1.00,
                obstacles: ['wall', 'gate', 'moving', 'laser', 'moving_laser'],
                density: 1.0,
                storm: false,
                theme: 2,
                starScore: 650
            },
            {
                id: 7,
                name: 'Неоновий шторм',
                duration: 45,
                speedMult: 1.00,
                obstacles: ['wall', 'spikes', 'gate', 'laser'],
                density: 1.1,
                storm: true,
                theme: 3,
                starScore: 700
            },
            {
                id: 8,
                name: 'Щільний вогонь',
                duration: 50,
                speedMult: 1.05,
                obstacles: ['wall', 'gate', 'moving', 'laser', 'moving_laser'],
                density: 1.3,
                storm: false,
                theme: 3,
                starScore: 800
            },
            {
                id: 9,
                name: 'Гравітаційні зони',
                duration: 50,
                speedMult: 1.05,
                obstacles: ['wall', 'gate', 'spikes', 'gravity_zone'],
                density: 1.1,
                storm: false,
                theme: 4,
                starScore: 850
            },
            {
                id: 10,
                name: 'Пульсар',
                duration: 55,
                speedMult: 1.10,
                obstacles: ['wall', 'moving', 'pulsar', 'gravity_zone'],
                density: 1.2,
                storm: true,
                theme: 4,
                starScore: 950
            },
            {
                id: 11,
                name: 'Хаос',
                duration: 55,
                speedMult: 1.15,
                obstacles: ['wall', 'gate', 'moving', 'spikes', 'laser', 'moving_laser', 'gravity_zone', 'pulsar'],
                density: 1.4,
                storm: false,
                theme: 5,
                starScore: 1100
            },
            {
                id: 12,
                name: 'Штормове ядро',
                duration: 60,
                speedMult: 1.20,
                obstacles: ['wall', 'gate', 'moving', 'spikes', 'laser', 'moving_laser', 'gravity_zone', 'pulsar'],
                density: 1.2,
                storm: 'double', // 2 шторми за рівень
                theme: 5,
                starScore: 1300
            },
            {
                id: 13,
                name: 'Межа швидкості',
                duration: 60,
                speedMult: 1.30,
                speedGrowthMax: 1.50, // плавний ріст до 1.5
                obstacles: ['wall', 'gate', 'moving', 'spikes', 'laser', 'gravity_zone', 'pulsar'],
                density: 1.2,
                storm: false,
                theme: 0,
                starScore: 1500
            },
            {
                id: 14,
                name: 'Темний сектор',
                duration: 65,
                speedMult: 1.30,
                obstacles: ['wall', 'gate', 'moving', 'spikes', 'laser', 'moving_laser', 'gravity_zone', 'pulsar'],
                density: 1.3,
                storm: true,
                theme: 4, // нова тема «Темний сектор»
                starScore: 1700
            },
            {
                id: 15,
                name: 'Фінальний рубіж',
                duration: 70,
                speedMult: 1.35,
                obstacles: ['wall', 'gate', 'moving', 'spikes', 'laser', 'moving_laser', 'gravity_zone', 'pulsar'],
                density: 1.4,
                storm: 'boss', // бос-шторм з moving_laser
                theme: 5,
                starScore: 2000
            }
        ],

        SCORE: {
            OBSTACLE: 10,
            NEAR_MISS: 25,
            STAR: 50,
            STORM: 200,
            DOUBLE_TIME: 8
        },

        COLORS: {
            STAR: '#fff36b',
            SHIELD: '#39ff14',
            SLOW: '#00b8ff',
            DOUBLE: '#ff2bd6',
            MAGNET: '#ff6b00',
            GHOST: '#c0a0ff',
            REVIVE: '#ff2a70',
            PHASE: '#00ffee',
            LASER: '#ff3860',
            WALL: '#00e5ff',
            SPIKES: '#ff2bd6',
            GRAVITY_ZONE: '#a855f7',
            PULSAR: '#f59e0b'
        },

        UI: {
            TOAST_DURATION: 2800,
            GAME_OVER_DELAY: 800,
            FLASH_DURATION: 120,
            SHAKE_DECAY: 0.92
        }
    };

    function deepFreeze(obj) {
        Object.freeze(obj);
        Object.getOwnPropertyNames(obj).forEach(function (prop) {
            const val = obj[prop];
            if (
                val !== null &&
                (typeof val === 'object' || typeof val === 'function') &&
                !Object.isFrozen(val)
            ) {
                deepFreeze(val);
            }
        });
        return obj;
    }

    window.Config = deepFreeze(Config);
})();
