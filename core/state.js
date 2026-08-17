/**
 * State.js — єдине джерело правди для всієї гри.
 * - data НІКОЛИ не null
 * - Глибоке злиття збережених даних з дефолтами
 * - Підтримка кампанії (15 рівнів + зірки), складності, локальних рекордів ТОП-5
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'ngr_state_v1';
    const LEADERBOARD_KEY = 'ngr_leaderboard_v1';

    function createDefaults() {
        return {
            version: 2,
            settings: {
                sfxVolume: 0.7,
                musicVolume: 0.4,
                quality: 2,          // 0=LOW, 1=MED, 2=HIGH, 3=ULTRA
                theme: 0,
                skin: 'default',
                reducedMotion: false,
                mute: false,
                difficulty: 'normal' // 'easy' | 'normal' | 'hardcore'
            },
            campaign: {
                maxLevel: 1,
                stars: {
                    1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
                    6: 0, 7: 0, 8: 0, 9: 0, 10: 0,
                    11: 0, 12: 0, 13: 0, 14: 0, 15: 0
                },
                selected: 1
            },
            stats: {
                bestScore: 0,
                bestCombo: 0,
                totalGames: 0,
                totalDeaths: 0,
                starsCollected: 0,
                stormsSurvived: 0,
                nearMisses: 0,
                ghostPasses: 0,
                longestGame: 0,
                totalPlaytime: 0,
                lastPlayed: 0,
                dailyBest: 0,
                dailyDate: ''
            },
            achievements: [],
            tutorialDone: false
        };
    }

    let data = createDefaults();

    // Глибоке злиття: base + overrides
    function deepMerge(base, override) {
        if (!override || typeof override !== 'object' || Array.isArray(override)) {
            return base;
        }
        const result = {};
        let key;
        for (key in base) {
            if (!Object.prototype.hasOwnProperty.call(base, key)) continue;
            const bv = base[key];
            const ov = override[key];
            if (ov !== undefined) {
                if (
                    bv && typeof bv === 'object' && !Array.isArray(bv) &&
                    ov && typeof ov === 'object' && !Array.isArray(ov)
                ) {
                    result[key] = deepMerge(bv, ov);
                } else {
                    result[key] = ov;
                }
            } else {
                result[key] = bv;
            }
        }
        for (key in override) {
            if (
                Object.prototype.hasOwnProperty.call(override, key) &&
                !(key in result)
            ) {
                result[key] = override[key];
            }
        }
        return result;
    }

    function init() {
        try {
            if (window.Logger) window.Logger.info('State.init');
            const saved = window.SafeStorage.get(STORAGE_KEY);
            if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
                data = deepMerge(createDefaults(), saved);
            } else {
                data = createDefaults();
            }
            if (!data.settings || typeof data.settings !== 'object') {
                data.settings = createDefaults().settings;
            }
            if (!data.campaign || typeof data.campaign !== 'object') {
                data.campaign = createDefaults().campaign;
            }
            if (!data.stats || typeof data.stats !== 'object') {
                data.stats = createDefaults().stats;
            }
            if (!Array.isArray(data.achievements)) {
                data.achievements = [];
            }
            save();
        } catch (e) {
            data = createDefaults();
            try {
                if (window.Logger) {
                    window.Logger.error('State.init: fallback до дефолтів', e.message || '');
                }
            } catch (x) { /* тиша */ }
        }
    }

    function save() {
        try {
            return window.SafeStorage.set(STORAGE_KEY, data);
        } catch (e) {
            try {
                if (window.Logger) {
                    window.Logger.error('State.save помилка', e.message || '');
                }
            } catch (x) { /* тиша */ }
            return false;
        }
    }

    function getSetting(key) {
        if (!data.settings) return undefined;
        return data.settings[key];
    }

    function setSetting(key, value) {
        if (!data.settings) data.settings = {};
        data.settings[key] = value;
        save();
    }

    function getStats(key) {
        if (!data.stats) return key ? undefined : data.stats;
        return key ? data.stats[key] : data.stats;
    }

    function updateStats(updater) {
        if (!data.stats) data.stats = createDefaults().stats;
        if (typeof updater === 'function') {
            try { updater(data.stats); } catch (e) {
                try { if (window.Logger) window.Logger.error('updateStats fn помилка', e.message || ''); } catch (x) {}
            }
        } else if (updater && typeof updater === 'object') {
            let k;
            for (k in updater) {
                if (Object.prototype.hasOwnProperty.call(updater, k)) {
                    data.stats[k] = updater[k];
                }
            }
        }
        save();
    }

    function unlockAchievement(id) {
        if (!Array.isArray(data.achievements)) data.achievements = [];
        if (data.achievements.indexOf(id) === -1) {
            data.achievements.push(id);
            save();
            return true;
        }
        return false;
    }

    function isAchievementUnlocked(id) {
        return Array.isArray(data.achievements) && data.achievements.indexOf(id) !== -1;
    }

    function getDifficultyMultipliers() {
        const diff = (data.settings && data.settings.difficulty) || 'normal';
        switch (diff) {
            case 'easy':
                return { speed: 0.85, gravity: 0.85, gap: 1.25, name: 'Легко' };
            case 'hardcore':
                return { speed: 1.15, gravity: 1.1, gap: 0.85, name: 'Хардкор' };
            case 'normal':
            default:
                return { speed: 1.0, gravity: 1.0, gap: 1.0, name: 'Нормально' };
        }
    }

    // ТОП-5 локальних рекордів
    function getLeaderboard() {
        try {
            const raw = window.SafeStorage.get(LEADERBOARD_KEY);
            if (Array.isArray(raw)) return raw;
        } catch (e) {}
        return [];
    }

    function addLeaderboardEntry(entry) {
        try {
            const list = getLeaderboard();
            list.push({
                score: entry.score || 0,
                mode: entry.mode || 'endless',
                level: entry.level || null,
                combo: entry.combo || 0,
                date: entry.date || new Date().toLocaleDateString('uk-UA')
            });
            list.sort(function (a, b) { return b.score - a.score; });
            const top5 = list.slice(0, 5);
            window.SafeStorage.set(LEADERBOARD_KEY, top5);
            return top5;
        } catch (e) {
            return [];
        }
    }

    window.State = {
        init: init,
        save: save,
        get data() { return data; },
        getSetting: getSetting,
        setSetting: setSetting,
        getStats: getStats,
        updateStats: updateStats,
        unlockAchievement: unlockAchievement,
        isAchievementUnlocked: isAchievementUnlocked,
        getDifficultyMultipliers: getDifficultyMultipliers,
        getLeaderboard: getLeaderboard,
        addLeaderboardEntry: addLeaderboardEntry
    };
})();
