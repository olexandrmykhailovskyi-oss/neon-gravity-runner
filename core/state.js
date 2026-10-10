/**
 * State.js — єдине джерело правди для всієї гри.
 * - data НІКОЛИ не null
 * - Глибоке злиття збережених даних з дефолтами
 * - Підтримка кампанії (35 рівнів + зірки), складності, локальних рекордів ТОП-5
 */

/**
 * @typedef {Object} LeaderboardEntry
 * @property {number} score — очки (0..99999999)
 * @property {string} mode — режим гри (до 16 символів)
 * @property {number|null} level — рівень кампанії або null
 * @property {number} combo — максимальне комбо
 * @property {string} date — дата запису (локальний формат)
 */

/**
 * @typedef {Object} GameSettings
 * @property {number} sfxVolume — гучність ефектів (0..1)
 * @property {number} musicVolume — гучність музики (0..1)
 * @property {number} quality — якість графіки (0=LOW, 1=MED, 2=HIGH, 3=ULTRA)
 * @property {number} theme — індекс теми
 * @property {string} skin — скін гравця
 * @property {boolean} reducedMotion — зменшений рух
 * @property {boolean} mute — повне вимкнення звуку
 * @property {boolean} vibration — вібрація (мобільні)
 * @property {boolean} gravityGuide — пунктирна лінія гравітації
 * @property {string} difficulty — 'easy' | 'normal' | 'hardcore'
 * @property {string} language — 'auto' | 'uk' | 'ru' | 'en'
 * @property {string} nickname — ім'я у світовому лідерборді
 * @property {boolean} analytics — анонімна телеметрія
 * @property {boolean} showFps — показувати лічильник FPS у HUD
 * @property {boolean} autoQuality — автоматично знижувати якість при просадці FPS
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
                language: 'auto',    // 'auto' | 'uk' | 'ru' | 'en'
                nickname: '',        // QOL-5: ім'я у світовому лідерборді
                analytics: true,     // QOL-5: анонімна телеметрія (можна вимкнути)
                showFps: false,      // лічильник FPS у HUD (перф-моніторинг)
                autoQuality: true    // авто-зниження якості при просадці FPS
            },
            campaign: {
                maxLevel: 1,
                stars: (function () {
                    // Config завантажується пізніше за state — на старті фоллбек 35
                    const maxL = (typeof window !== 'undefined' && window.Config && window.Config.MAX_LEVEL) || 35;
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
                dailyStreak: 0,
                bestByMode: {
                    endless: 0,
                    daily: 0,
                    timeattack: 0,
                    survival: 0,
                    zen: 0,
                    campaign: 0
                }
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

    /**
     * Ініціалізація стану: зчитує збережені дані з SafeStorage,
     * глибоко зливає з дефолтами, виправляє пошкоджені секції.
     * Побічний ефект: одразу викликає save().
     */
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

    /**
     * Зберігає поточний стан у SafeStorage.
     * @returns {boolean} true при успіху, false при помилці
     */
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

    /**
     * Повертає значення налаштування.
     * @param {string} key — ключ налаштування
     * @returns {*} значення або undefined
     */
    function getSetting(key) {
        if (!data.settings) return undefined;
        return data.settings[key];
    }

    /**
     * Встановлює значення налаштування і зберігає стан.
     * @param {string} key — ключ налаштування
     * @param {*} value — нове значення
     */
    function setSetting(key, value) {
        if (!data.settings) data.settings = {};
        data.settings[key] = value;
        save();
    }

    /**
     * Повертає статистику гри.
     * @param {string} [key] — ключ статистики; без аргумента весь об'єкт
     * @returns {Object|*} об'єкт статистики або значення ключа
     */
    function getStats(key) {
        if (!data.stats) return key ? undefined : data.stats;
        return key ? data.stats[key] : data.stats;
    }

    /**
     * Оновлює статистику гри і зберігає стан.
     * @param {Object|Function} updater — об'єкт з новими значеннями або функція-мутатор
     */
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

    /**
     * Розблоковує досягнення (якщо ще не розблоковане).
     * @param {string} id — ідентифікатор досягнення
     * @returns {boolean} true якщо було розблоковане зараз, false якщо вже було
     */
    function unlockAchievement(id) {
        if (!Array.isArray(data.achievements)) data.achievements = [];
        if (data.achievements.indexOf(id) === -1) {
            data.achievements.push(id);
            save();
            return true;
        }
        return false;
    }

    /**
     * Перевіряє, чи розблоковане досягнення.
     * @param {string} id — ідентифікатор досягнення
     * @returns {boolean}
     */
    function isAchievementUnlocked(id) {
        return Array.isArray(data.achievements) && data.achievements.indexOf(id) !== -1;
    }

    /**
     * Повертає множники складності для поточного налаштування difficulty.
     * @returns {{speed: number, gravity: number, gap: number, density: number, name: string}}
     */
    function getDifficultyMultipliers() {
        const diff = (data.settings && data.settings.difficulty) || 'normal';
        switch (diff) {
            case 'easy':
                // Легко: повільніше, м'якша гравітація, ширші проміжки, рідший спавн
                return { speed: 0.80, gravity: 0.85, gap: 1.35, density: 0.85, name: 'Легко' };
            case 'hardcore':
                // Хардкор: швидко, різко, тісно, густо + очки ×1.3
                return { speed: 1.25, gravity: 1.15, gap: 0.78, density: 1.15, name: 'Хардкор' };
            case 'normal':
            default:
                return { speed: 1.0, gravity: 1.0, gap: 1.0, density: 1.0, name: 'Нормально' };
        }
    }

    /**
     * Повертає локальний лідерборд (ТОП-5).
     * @returns {LeaderboardEntry[]}
     */
    function getLeaderboard() {
        try {
            const raw = window.SafeStorage.get(LEADERBOARD_KEY);
            if (Array.isArray(raw)) return raw;
        } catch (e) {}
        return [];
    }

    // Дедуплікація: однакові score/mode/level/combo вважаємо дублікатом
    // (дату не порівнюємо — вона у кожного своя)
    function _isDuplicateEntry(a, b) {
        return a.score === b.score &&
            a.mode === b.mode &&
            a.level === b.level &&
            a.combo === b.combo;
    }

    /**
     * Додає запис у локальний лідерборд (ТОП-5).
     * Якщо ідентичний запис уже є — дублікат відкидається.
     * @param {LeaderboardEntry} entry — запис результату
     * @returns {LeaderboardEntry[]} оновлений ТОП-5
     */
    function addLeaderboardEntry(entry) {
        try {
            const clean = _sanitizeEntry(entry);
            if (!clean) return getLeaderboard();
            const list = getLeaderboard();
            for (let i = 0; i < list.length; i++) {
                if (_isDuplicateEntry(list[i], clean)) return list;
            }
            list.push(clean);
            list.sort(function (a, b) { return b.score - a.score; });
            const top5 = list.slice(0, 5);
            window.SafeStorage.set(LEADERBOARD_KEY, top5);
            return top5;
        } catch (e) {
            return [];
        }
    }

    // Захист від XSS/сміття: поля рекордів жорстко нормалізуються
    // (дата й режим можуть потрапляти в innerHTML екрана рекордів)
    function _sanitizeEntry(raw) {
        try {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
            const score = Math.floor(Number(raw.score));
            if (!isFinite(score) || score < 0 || score >= 100000000) return null;
            const mode = String(raw.mode || 'endless').replace(/[<>&"']/g, '').slice(0, 16) || 'endless';
            const lvlNum = Math.floor(Number(raw.level));
            const level = (raw.level != null && isFinite(lvlNum) && lvlNum > 0) ? lvlNum : null;
            const comboNum = Math.floor(Number(raw.combo));
            const combo = isFinite(comboNum) && comboNum > 0 ? Math.min(comboNum, 100000) : 0;
            const date = String(raw.date || '').replace(/[<>&"']/g, '').slice(0, 24);
            return {
                score: score,
                mode: mode,
                level: level,
                combo: combo,
                date: date || new Date().toLocaleDateString('uk-UA')
            };
        } catch (e) {
            return null;
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

    /**
     * Експортує прогрес у код формату 'NGR1-<hash>-<base64>'.
     * @returns {string|null} код експорту або null при помилці
     */
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

    /**
     * Імпортує прогрес з коду формату 'NGR1-<hash>-<base64>'.
     * Зливає з поточним станом (максимуми, зірки, досягнення).
     * @param {string} code — код експорту
     * @returns {boolean} true при успіху
     */
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

    /**
     * Зливає віддалений стан (той самий формат, що в експорт-коді).
     * @param {Object} remoteState — об'єкт стану з полями settings і stats
     * @returns {boolean} true при успіху
     */
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

    function _isPlainObject(v) {
        return !!v && typeof v === 'object' && !Array.isArray(v);
    }

    function _applyPayload(payloadRaw) {
        try {
            if (!payloadRaw || typeof payloadRaw !== 'object' || !payloadRaw.state) return false;

            const rawState = payloadRaw.state;
            if (typeof rawState !== 'object' || !rawState.settings || !rawState.stats) return false;

            // Не даємо битим/шкідливим секціям зіпсути in-memory стан:
            // campaign:null чи не-об'єктні settings/stats відкидаються ДО злиття
            const incoming = {};
            for (const ik in rawState) {
                if (Object.prototype.hasOwnProperty.call(rawState, ik)) incoming[ik] = rawState[ik];
            }
            if ('campaign' in incoming && !_isPlainObject(incoming.campaign)) delete incoming.campaign;
            if ('settings' in incoming && !_isPlainObject(incoming.settings)) delete incoming.settings;
            if ('stats' in incoming && !_isPlainObject(incoming.stats)) delete incoming.stats;
            if ('achievements' in incoming && !Array.isArray(incoming.achievements)) delete incoming.achievements;
            if (!_isPlainObject(incoming.settings) || !_isPlainObject(incoming.stats)) return false;

            // Захоплюємо ЛОКАЛЬНІ значення до злиття — вони не мають зникнути
            const maxLvl = (window.Config && window.Config.MAX_LEVEL) || 35;
            const prevStars = {};
            const prevC = data.campaign || {};
            if (prevC.stars) {
                for (let k = 1; k <= maxLvl; k++) prevStars[k] = prevC.stars[k] || 0;
            }
            const prevMaxLevel = prevC.maxLevel || 1;
            const MAXIMA = [
                'bestScore', 'bestCombo', 'longestGame', 'dailyBest', 'dailyStreak',
                'totalGames', 'totalDeaths', 'starsCollected', 'stormsSurvived',
                'nearMisses', 'ghostPasses', 'totalPlaytime'
            ];
            const prevStats = {};
            for (let i = 0; i < MAXIMA.length; i++) {
                prevStats[MAXIMA[i]] = Number(data.stats && data.stats[MAXIMA[i]]) || 0;
            }
            const prevAch = Array.isArray(data.achievements) ? data.achievements.slice() : [];
            const prevBestByMode = Object.assign({}, (data.stats && data.stats.bestByMode) || {});

            // Поточний стан — база; імпорт доповнює його (налаштування — з коду)
            data = deepMerge(data, incoming);

            // Зірки, maxLevel, статистика, досягнення — тільки вгору/об'єднання
            if (!_isPlainObject(data.campaign)) data.campaign = createDefaults().campaign;
            if (!_isPlainObject(data.campaign.stars)) data.campaign.stars = {};
            const c = data.campaign;
            const incC = _isPlainObject(incoming.campaign) ? incoming.campaign : {};
            for (let k = 1; k <= maxLvl; k++) {
                c.stars[k] = Math.max(Number(incC.stars && incC.stars[k]) || 0, prevStars[k] || 0);
            }
            c.maxLevel = Math.max(Number(incC.maxLevel) || 1, prevMaxLevel);

            if (!_isPlainObject(data.stats)) data.stats = createDefaults().stats;
            const incS = _isPlainObject(incoming.stats) ? incoming.stats : {};
            for (let i = 0; i < MAXIMA.length; i++) {
                const kk = MAXIMA[i];
                data.stats[kk] = Math.max(Number(incS[kk]) || 0, prevStats[kk] || 0);
            }
            // dailyDate — тільки рядок (інакше потрапить у innerHTML статистики)
            if (typeof data.stats.dailyDate !== 'string') {
                data.stats.dailyDate = (typeof incS.dailyDate === 'string') ? incS.dailyDate : '';
            }

            // Рекорди за режимами — тільки вгору (імпорт не може занизити)
            if (!data.stats.bestByMode || typeof data.stats.bestByMode !== 'object') {
                data.stats.bestByMode = createDefaults().stats.bestByMode;
            }
            const incBM = (incS && _isPlainObject(incS.bestByMode)) ? incS.bestByMode : {};
            const bmSeen = {};
            let bk;
            for (bk in prevBestByMode) bmSeen[bk] = true;
            for (bk in incBM) bmSeen[bk] = true;
            for (bk in bmSeen) {
                data.stats.bestByMode[bk] = Math.max(Number(prevBestByMode[bk]) || 0, Number(incBM[bk]) || 0);
            }

            if (!Array.isArray(data.achievements)) data.achievements = [];
            const allAch = prevAch.concat(Array.isArray(incoming.achievements) ? incoming.achievements : []);
            for (let i = 0; i < allAch.length; i++) {
                if (typeof allAch[i] === 'string' && data.achievements.indexOf(allAch[i]) === -1) {
                    data.achievements.push(allAch[i]);
                }
            }

            // Рекорди — мержимо та залишаємо ТОП-5 (записи санітизуються, дублікати відкидаються)
            if (Array.isArray(payloadRaw.leaderboard) && payloadRaw.leaderboard.length > 0) {
                const merged = getLeaderboard();
                for (let i = 0; i < payloadRaw.leaderboard.length; i++) {
                    const clean = _sanitizeEntry(payloadRaw.leaderboard[i]);
                    if (!clean) continue;
                    let dup = false;
                    for (let j = 0; j < merged.length; j++) {
                        if (_isDuplicateEntry(merged[j], clean)) { dup = true; break; }
                    }
                    if (!dup) merged.push(clean);
                }
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

    /**
     * Скидає весь прогрес: видаляє дані з SafeStorage і створює дефолтний стан.
     * @returns {boolean} true при успіху
     */
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

    /**
     * @typedef {Object} StateAPI
     * @property {Function} init — ініціалізація зі сховища
     * @property {Function} save — зберегти стан
     * @property {Object} data — поточний стан (тільки читання)
     * @property {Function} getSetting — отримати налаштування
     * @property {Function} setSetting — встановити налаштування
     * @property {Function} getStats — отримати статистику
     * @property {Function} updateStats — оновити статистику
     * @property {Function} unlockAchievement — розблокувати досягнення
     * @property {Function} isAchievementUnlocked — перевірити досягнення
     * @property {Function} getDifficultyMultipliers — множники складності
     * @property {Function} getLeaderboard — локальний ТОП-5
     * @property {Function} addLeaderboardEntry — додати запис у ТОП-5
     * @property {Function} exportProgress — експорт у код NGR1
     * @property {Function} importProgress — імпорт з коду NGR1
     * @property {Function} mergeRemote — злиття віддаленого стану
     * @property {Function} resetProgress — скидання прогресу
     */

    /** @type {StateAPI} */
    window.State = {
        init: init,
        save: save,
        /** Поточний стан гри (тільки читання). Ніколи не null. */
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
