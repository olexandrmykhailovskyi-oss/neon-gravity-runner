/**
 * Levels.js — менеджер рівнів Кампанії (15 рівнів).
 * - Отримання конфігурацій рівнів
 * - Розрахунок зірок:
 *   ★ = рівень пройдено живим
 *   ★★ = рахунок >= starScore
 *   ★★★ = без втрати щита і >=5 near-miss
 * - Збереження прогресу та розблокування наступного рівня
 */
(function () {
    'use strict';

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[Levels] ' + msg, data); } catch (e) {}
    }

    function list() {
        try {
            if (window.Config && Array.isArray(window.Config.LEVELS)) {
                return window.Config.LEVELS;
            }
        } catch (e) {}
        return [];
    }

    function get(id) {
        const all = list();
        const numId = parseInt(id, 10);
        for (let i = 0; i < all.length; i++) {
            if (all[i].id === numId) return all[i];
        }
        return all[0] || null;
    }

    function isUnlocked(id) {
        const numId = parseInt(id, 10);
        if (numId <= 1) return true;
        try {
            const c = window.State && window.State.data && window.State.data.campaign;
            if (c && typeof c.maxLevel === 'number') {
                return numId <= c.maxLevel;
            }
        } catch (e) {}
        return false;
    }

    function getStars(id) {
        const numId = parseInt(id, 10);
        try {
            const c = window.State && window.State.data && window.State.data.campaign;
            if (c && c.stars && typeof c.stars[numId] === 'number') {
                return c.stars[numId];
            }
        } catch (e) {}
        return 0;
    }

    /**
     * Розрахунок зароблених зірок:
     * 1★ — рівень успішно завершено (таймер вичерпано, гравець живий)
     * 2★ — рахунок >= starScore
     * 3★ — щит не був розбитий / використаний ТА >= 5 near-misses
     */
    function calculateStars(level, score, shieldUsed, nearMisses) {
        if (!level) return 1;
        let stars = 1;

        if (score >= (level.starScore || 300)) {
            stars = 2;
        }

        const perfectRun = !shieldUsed && (nearMisses >= 5);
        if (stars === 2 && perfectRun) {
            stars = 3;
        }

        return stars;
    }

    /**
     * Збереження прогресу після проходження рівня.
     */
    function saveProgress(levelId, starsEarned) {
        const numId = parseInt(levelId, 10);
        try {
            if (!window.State || !window.State.data) return;
            if (!window.State.data.campaign) {
                window.State.data.campaign = { maxLevel: 1, stars: {}, selected: 1 };
            }
            const c = window.State.data.campaign;
            if (!c.stars) c.stars = {};

            const oldStars = c.stars[numId] || 0;
            if (starsEarned > oldStars) {
                c.stars[numId] = starsEarned;
            }

            // Розблоковуємо наступний рівень
            const maxLvl = (window.Config && window.Config.MAX_LEVEL) || 15;
            if (numId >= (c.maxLevel || 1) && numId < maxLvl) {
                c.maxLevel = numId + 1;
            }
            c.selected = Math.min(maxLvl, numId + 1);

            window.State.save();

            // Перевірка досягнень кампанії
            try { if (window.Achievements) window.Achievements.checkAll(); } catch (e) {}
            try { if (window.Skins) window.Skins.checkUnlocks(); } catch (e) {}
        } catch (e) {
            _log('error', 'saveProgress помилка', e.message);
        }
    }

    function getSelected() {
        try {
            const c = window.State && window.State.data && window.State.data.campaign;
            return (c && c.selected) || 1;
        } catch (e) {
            return 1;
        }
    }

    function setSelected(id) {
        try {
            if (window.State && window.State.data && window.State.data.campaign) {
                window.State.data.campaign.selected = parseInt(id, 10) || 1;
                window.State.save();
            }
        } catch (e) {}
    }

    window.Levels = {
        list: list,
        get: get,
        isUnlocked: isUnlocked,
        getStars: getStars,
        calculateStars: calculateStars,
        saveProgress: saveProgress,
        getSelected: getSelected,
        setSelected: setSelected
    };
})();
