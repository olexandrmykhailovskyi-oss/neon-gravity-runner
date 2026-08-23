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
                vibration: true,
                gravityGuide: true,  // QOL: пунктирна лінія гравітації від гравця
                difficulty: 'normal', // 'easy' | 'normal' | 'hardcore'
                language: 'auto'     // 'auto' | 'uk' | 'ru' | 'en'
            },
            campaign: {
                maxLevel: 1,
                stars: (function () {
                    // Config завантажується пізніше за state — на старті фоллбек 25
                    const maxL = (typeof window !== 'undefined' && window.Config && window.Config.MAX_LEVEL) || 25;
                    const s = {};
                    for (let k = 1; k <= maxL; k++) s[k] = 0;
                    return s;
                })(),
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
                dailyDate: '',
                dailyStreak: 0
            },
            achievements: [],
            tutorialDone: false,
            hints: {}               // QOL: одноразові підказки (перший підбір кожного бонусу)
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

    // ---- Експорт / імпорт / скидання прогресу ----

    // Unicode-безпечний base64
    function _b64Encode(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (m, p) {
            return String.fromCharCode(parseInt(p, 16));
        }));
    }

    function _b64Decode(str) {
        return decodeURIComponent(Array.prototype.map.call(atob(str), function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    }

    function exportProgress() {
        try {
            const payload = { state: data, leaderboard: getLeaderboard(), exportedAt: Date.now() };
            const code = _b64Encode(JSON.stringify(payload));
            // Коротка контрольна сума для валідації при імпорті
            return 'NGR1-' + _hash36(code) + '-' + code;
        } catch (e) {
            try { if (window.Logger) window.Logger.error('exportProgress', e.message || ''); } catch (x) {}
            return null;
        }
    }

    // Несекретна контрольна сума (djb2-подібна) для перевірки цілісності payload
    function _hash36(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return (hash >>> 0).toString(36);
    }

    function importProgress(code) {
        try {
            if (typeof code !== 'string' || code.indexOf('NGR1-') !== 0) return false;
            const rest = code.slice(5);
            const dash = rest.indexOf('-');
            if (dash < 0) return false;

            const hashToken = rest.slice(0, dash);
            const payloadB64 = rest.slice(dash + 1);
            if (!payloadB64) return false;

            // Перевірка чексуми: будь-яка підміна символів у payload відхиляється
            if (_hash36(payloadB64) !== hashToken) return false;

            const payloadRaw = JSON.parse(_b64Decode(payloadB64));
            return _applyPayload(payloadRaw);
        } catch (e) {
            try { if (window.Logger) window.Logger.error('importProgress', e.message || ''); } catch (x) {}
            return false;
        }
    }

    // Злиття стану з хмари (той самий формат, що всередині експорт-коду)
    function mergeRemote(remoteState) {
        try {
            if (!remoteState || typeof remoteState !== 'object' ||
                !remoteState.settings || !remoteState.stats) return false;
            return _applyPayload({ state: remoteState });
        } catch (e) {
            try { if (window.Logger) window.Logger.error('mergeRemote', e.message || ''); } catch (x) {}
            return false;
        }
    }

    function _applyPayload(payloadRaw) {
        try {
            if (!payloadRaw || typeof payloadRaw !== 'object' || !payloadRaw.state) return false;

            const incoming = payloadRaw.state;
            if (typeof incoming !== 'object' || !incoming.settings || !incoming.stats) return false;

            // Захоплюємо ЛОКАЛЬНІ значення до злиття — вони не мають зникнути
            const maxLvl = (window.Config && window.Config.MAX_LEVEL) || 25;
            const prevStars = {};
            const prevC = data.campaign || {};
            if (prevC.stars) {
                for (let k = 1; k <= maxLvl; k++) prevStars[k] = prevC.stars[k] || 0;
            }
            const prevMaxLevel = prevC.maxLevel || 1;
            const MAXIMA = [
                'bestScore', 'bestCombo', 'longestGame', 'dailyBest',
                'totalGames', 'totalDeaths', 'starsCollected', 'stormsSurvived',
                'nearMisses', 'ghostPasses', 'totalPlaytime'
            ];
            const prevStats = {};
            for (let i = 0; i < MAXIMA.length; i++) {
                prevStats[MAXIMA[i]] = (data.stats && data.stats[MAXIMA[i]]) || 0;
            }
            const prevAch = Array.isArray(data.achievements) ? data.achievements.slice() : [];

            // Поточний стан — база; імпорт доповнює його (налаштування — з коду)
            data = deepMerge(data, incoming);

            // Зірки, maxLevel, статистика, досягнення — тільки вгору/об'єднання
            const c = data.campaign;
            const incC = incoming.campaign || {};
            for (let k = 1; k <= maxLvl; k++) {
                c.stars[k] = Math.max((incC.stars && incC.stars[k]) || 0, prevStars[k] || 0);
            }
            c.maxLevel = Math.max(typeof incC.maxLevel === 'number' ? incC.maxLevel : 1, prevMaxLevel);

            const incS = incoming.stats || {};
            for (let i = 0; i < MAXIMA.length; i++) {
                const kk = MAXIMA[i];
                data.stats[kk] = Math.max(incS[kk] || 0, prevStats[kk] || 0);
            }

            if (!Array.isArray(data.achievements)) data.achievements = [];
            const allAch = prevAch.concat(Array.isArray(incoming.achievements) ? incoming.achievements : []);
            for (let i = 0; i < allAch.length; i++) {
                if (data.achievements.indexOf(allAch[i]) === -1) {
                    data.achievements.push(allAch[i]);
                }
            }

            // Рекорди — мержимо та залишаємо ТОП-5
            if (Array.isArray(payloadRaw.leaderboard) && payloadRaw.leaderboard.length > 0) {
                const merged = getLeaderboard();
                for (let i = 0; i < payloadRaw.leaderboard.length; i++) merged.push(payloadRaw.leaderboard[i]);
                merged.sort(function (a, b) { return b.score - a.score; });
                window.SafeStorage.set(LEADERBOARD_KEY, merged.slice(0, 5));
            }

            save();
            return true;
        } catch (e) {
            try { if (window.Logger) window.Logger.error('_applyPayload', e.message || ''); } catch (x) {}
            return false;
        }
    }

    function resetProgress() {
        try {
            window.SafeStorage.remove(STORAGE_KEY);
            window.SafeStorage.remove(LEADERBOARD_KEY);
            data = createDefaults();
            save();
            return true;
        } catch (e) {
            return false;
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
        addLeaderboardEntry: addLeaderboardEntry,
        exportProgress: exportProgress,
        importProgress: importProgress,
        mergeRemote: mergeRemote,
        resetProgress: resetProgress
    };
})();
