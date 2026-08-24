/**
 * Achievements.js — система досягнень.
 * - Досягнення із Config.ACHIEVEMENTS
 * - Перевірка після кожної зміни статистики або проходження рівня
 * - Тост + звук при розблокуванні
 */
(function () {
    'use strict';

    let _toastCb = null;

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[Ach] ' + msg, data); } catch (e) {}
    }

    function onToast(cb) {
        if (typeof cb === 'function') _toastCb = cb;
    }

    function list() {
        const result = [];
        try {
            const cfg = window.Config && window.Config.ACHIEVEMENTS ? window.Config.ACHIEVEMENTS : [];
            for (let i = 0; i < cfg.length; i++) {
                const a = cfg[i];
                result.push({
                    id: a.id,
                    name: a.name,
                    desc: a.desc,
                    unlocked: isUnlocked(a.id)
                });
            }
        } catch (e) {
            _log('error', 'list помилка', e.message);
        }
        return result;
    }

    function isUnlocked(id) {
        try {
            if (window.State) return window.State.isAchievementUnlocked(id);
        } catch (e) {}
        return false;
    }

    function checkAll(stats) {
        const newly = [];
        try {
            const cfg = window.Config && window.Config.ACHIEVEMENTS ? window.Config.ACHIEVEMENTS : [];
            const s = stats || (window.State ? window.State.getStats() : {});
            for (let i = 0; i < cfg.length; i++) {
                const a = cfg[i];
                if (isUnlocked(a.id)) continue;
                let passed = false;
                try {
                    if (typeof a.check === 'function') {
                        passed = !!a.check(s);
                    }
                } catch (e) {
                    _log('warn', 'check fn помилка для ' + a.id, e.message);
                }
                if (passed) {
                    _unlock(a);
                    newly.push(a);
                }
            }
        } catch (e) {
            _log('error', 'checkAll помилка', e.message);
        }
        return newly;
    }

    function _unlock(a) {
        try {
            if (window.State) {
                const isNew = window.State.unlockAchievement(a.id);
                if (isNew) {
                    _log('info', 'розблоковано: ' + a.name);
                    try { if (window.AudioSys) window.AudioSys.playAchievement(); } catch (e) {}
                    if (_toastCb) {
                        try { _toastCb('🏆 ' + a.name + ' — ' + a.desc, 'success'); } catch (e) {}
                    }
                    try { if (window.Skins) window.Skins.checkUnlocks(); } catch (e) {}
                }
            }
        } catch (e) {
            _log('error', '_unlock помилка', e.message);
        }
    }

    function unlockById(id) {
        try {
            const cfg = window.Config && window.Config.ACHIEVEMENTS ? window.Config.ACHIEVEMENTS : [];
            for (let i = 0; i < cfg.length; i++) {
                if (cfg[i].id === id) {
                    _unlock(cfg[i]);
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }

    window.Achievements = {
        list: list,
        isUnlocked: isUnlocked,
        checkAll: checkAll,
        unlockById: unlockById,
        onToast: onToast
    };
})();
