/**
 * GlobalScores.js — світовий лідерборд через Supabase.
 * - Таблиця scores(player, score, mode, level, combo, device_id, created_at)
 * - submit після кожного забігу (fire-and-forget), top(mode, limit) для UI
 * - Graceful: без клієнта/таблиці повертає false/null і ніколи не падає
 */
(function () {
    'use strict';

    const TABLE = 'scores';
    const MAX_SCORE = 99999999;
    let _warned = false;

    function _log(level, msg) {
        try { if (window.Logger) window.Logger[level]('[GlobalScores] ' + msg); } catch (e) {}
    }

    function ready() {
        try { return !!(window.CloudStorage && window.CloudStorage.isReady() && window.CloudStorage.getClient()); } catch (e) { return false; }
    }

    function _playerName() {
        try {
            const n = window.State && window.State.getSetting('nickname');
            if (typeof n === 'string' && n.trim()) return n.trim().slice(0, 24);
        } catch (e) {}
        return 'Пілот';
    }

    /** Надіслати результат. Promise<boolean> */
    function submit(entry) {
        return new Promise(function (resolve) {
            try {
                if (!ready() || !entry || typeof entry.score !== 'number' || entry.score <= 0) {
                    resolve(false);
                    return;
                }
                const client = window.CloudStorage.getClient();
                client.from(TABLE).insert({
                    player: _playerName(),
                    score: Math.min(MAX_SCORE, Math.max(1, Math.floor(entry.score))),
                    mode: String(entry.mode || 'endless').slice(0, 16),
                    level: typeof entry.level === 'number' ? entry.level : null,
                    combo: Math.max(0, entry.combo | 0),
                    device_id: window.CloudStorage.getDeviceId()
                }).then(function (res) {
                    if (res && res.error) {
                        if (!_warned) { _log('warn', 'submit: ' + res.error.message + ' (потрібна SQL-міграція таблиці scores)'); _warned = true; }
                        resolve(false);
                        return;
                    }
                    _log('info', 'score submitted');
                    resolve(true);
                }, function (err) {
                    if (!_warned) { _log('warn', 'submit: ' + (err && err.message ? err.message : err)); _warned = true; }
                    resolve(false);
                });
            } catch (e) {
                resolve(false);
            }
        });
    }

    /** ТОП результатів. mode=null → всі режими. Promise<Array|null> */
    function top(mode, limit) {
        return new Promise(function (resolve) {
            try {
                if (!ready()) { resolve(null); return; }
                const lim = Math.min(50, Math.max(1, limit || 10));
                let q = window.CloudStorage.getClient()
                    .from(TABLE)
                    .select('player,score,mode,level,created_at')
                    .order('score', { ascending: false })
                    .limit(lim);
                if (mode) q = q.eq('mode', String(mode));
                q.then(function (res) {
                    if (res && res.error) {
                        if (!_warned) { _log('warn', 'top: ' + res.error.message + ' (потрібна SQL-міграція таблиці scores)'); _warned = true; }
                        resolve(null);
                        return;
                    }
                    resolve(res.data || []);
                }, function () { resolve(null); });
            } catch (e) {
                resolve(null);
            }
        });
    }

    window.GlobalScores = {
        submit: submit,
        top: top,
        ready: ready
    };
})();
