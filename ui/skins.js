/**
 * Skins.js — система скінів гравця.
 * - 7 скінів із Config.SKINS
 * - Унікальна форма трейлу для кожного скіна (circle, spark, star, square, diamond)
 * - Розблокування за статистикою або досягненнями
 */
(function () {
    'use strict';

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[Skins] ' + msg, data); } catch (e) {}
    }

    function list() {
        const result = [];
        try {
            const cfg = window.Config && window.Config.SKINS ? window.Config.SKINS : [];
            for (let i = 0; i < cfg.length; i++) {
                const s = cfg[i];
                result.push({
                    id: s.id,
                    name: s.name,
                    color: s.color,
                    trailShape: s.trailShape || 'circle',
                    unlock: s.unlock,
                    unlocked: isUnlocked(s.id)
                });
            }
        } catch (e) {
            _log('error', 'list помилка', e.message);
        }
        return result;
    }

    function get(id) {
        try {
            const cfg = window.Config && window.Config.SKINS ? window.Config.SKINS : [];
            for (let i = 0; i < cfg.length; i++) {
                if (cfg[i].id === id) return cfg[i];
            }
        } catch (e) {}
        return null;
    }

    function current() {
        try {
            if (window.State) {
                const id = window.State.getSetting('skin');
                const skin = get(id);
                if (skin && isUnlocked(id)) return skin;
            }
        } catch (e) {}
        return get('default') || { id: 'default', name: 'Базовий', color: '#00e5ff', trailShape: 'circle', unlock: 'free' };
    }

    function isUnlocked(id) {
        const skin = get(id);
        if (!skin) return false;
        const u = skin.unlock;
        if (u === 'free') return true;
        if (!u || typeof u !== 'object') return true;

        try {
            if (u.stats && typeof u.value === 'number') {
                const val = window.State ? window.State.getStats(u.stats) : 0;
                if (typeof val === 'number' && val >= u.value) return true;
            }
            if (u.achievement && window.State) {
                if (window.State.isAchievementUnlocked(u.achievement)) return true;
            }
        } catch (e) {
            _log('error', 'isUnlocked помилка', e.message);
        }
        return false;
    }

    function select(id) {
        if (!isUnlocked(id)) {
            _log('warn', 'select: скін заблокований', id);
            return false;
        }
        try {
            if (window.State) {
                window.State.setSetting('skin', id);
                _log('info', 'select: обрано', id);
                return true;
            }
        } catch (e) {
            _log('error', 'select помилка', e.message);
        }
        return false;
    }

    function getColor(id, time) {
        const skin = get(id);
        if (!skin) return '#00e5ff';
        if (skin.color === 'rainbow') {
            const t = typeof time === 'number' ? time : Date.now() * 0.001;
            const hue = Math.floor((t * 80) % 360);
            return 'hsl(' + hue + ', 100%, 60%)';
        }
        return skin.color;
    }

    function getTrailShape(id) {
        const skin = get(id);
        return skin && skin.trailShape ? skin.trailShape : 'circle';
    }

    function checkUnlocks() {
        const newly = [];
        try {
            const all = list();
            for (let i = 0; i < all.length; i++) {
                const s = all[i];
                if (!s.unlocked && isUnlocked(s.id)) {
                    newly.push(s);
                }
            }
        } catch (e) {}
        return newly;
    }

    window.Skins = {
        list: list,
        get: get,
        current: current,
        isUnlocked: isUnlocked,
        select: select,
        getColor: getColor,
        getTrailShape: getTrailShape,
        checkUnlocks: checkUnlocks
    };
})();
