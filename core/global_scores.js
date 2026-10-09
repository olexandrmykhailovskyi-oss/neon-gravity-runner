/**
 * GlobalScores.js — світовий лідерборд через Supabase.
 * - Таблиця scores(player, score, mode, level, combo, device_id, created_at)
 * - submit після кожного забігу (fire-and-forget) через RPC submit_score:
 *   прямого INSERT для anon немає, тому клієнт не може вставити довільний
 *   рядок у таблицю — усі очки валідуються на сервері (межі, темп, частота).
 * - top(mode, limit) для UI
 * - Graceful: без клієнта/таблиці повертає false/null і ніколи не падає
 */

/**
 * @typedef {Object} ScoreEntry
 * @property {number} score — очки (>0, ≤99999999)
 * @property {string} mode — режим гри ('endless', 'daily', 'timeattack', 'survival', 'zen', 'campaign')
 * @property {number} [level] — рівень кампанії
 * @property {number} [combo] — максимальне комбо
 * @property {number} [duration] — тривалість забігу в секундах
 */
(function () {
    'use strict';

    const TABLE = 'scores';
    const MAX_SCORE = 99999999;
    let _warned = false;

    function _log(level, msg) {
        try { if (window.Logger) window.Logger[level]('[GlobalScores] ' + msg); } catch (e) {}
    }

    /**
     * Перевіряє готовність хмарного сховища.
     * @returns {boolean} true якщо клієнт Supabase готовий до запитів
     */
    function ready() {
        try { return !!(window.CloudStorage && window.CloudStorage.isReady() && window.CloudStorage.getClient()); } catch (e) { return false; }
    }

    function _playerName() {
        try {
            const n = window.State && window.State.getSetting('nickname');
            // Нік потрапляє у світовий лідерборд і рендериться в інших гравців —
            // прибираємо HTML-символи вже на етапі відправки (захист від stored-XSS)
            if (typeof n === 'string' && n.trim()) {
                return n.trim().replace(/[<>&"']/g, '').slice(0, 24) || 'Пілот';
            }
        } catch (e) {}
        return 'Пілот';
    }

    /** Надіслати результат. Promise<boolean>
     *  entry: { score, mode, level?, combo?, duration? } — duration це тривалість
     *  забігу в секундах; сервер використовує її для перевірки правдоподібності.
     * @param {ScoreEntry} entry — дані результату забігу
     * @returns {Promise<boolean>} true якщо сервер прийняв результат, false при помилці
     */
    function submit(entry) {
        return new Promise(function (resolve) {
            try {
                const client = ready() ? window.CloudStorage.getClient() : null;
                if (!client || !entry || typeof entry.score !== 'number' || entry.score <= 0) {
                    resolve(false);
                    return;
                }
                const params = {
                    p_player: _playerName(),
                    p_score: Math.min(MAX_SCORE, Math.max(1, Math.floor(entry.score))),
                    p_mode: String(entry.mode || 'endless').slice(0, 16),
                    p_level: typeof entry.level === 'number' ? Math.floor(entry.level) : null,
                    p_combo: Math.max(0, Math.floor(Number(entry.combo) || 0)),
                    p_device_id: window.CloudStorage.getDeviceId(),
                    p_duration: Math.max(0, Math.floor(Number(entry.duration) || 0))
                };
                // Не insert у таблицю, а RPC: сервер сам вирішує, чи приймати результат
                client.rpc('submit_score', params).then(function (res) {
                    if (res && res.error) {
                        if (!_warned) { _log('warn', 'submit: ' + res.error.message + ' (потрібна SQL-міграція submit_score)'); _warned = true; }
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

    /** ТОП результатів. mode=null → всі режими. Promise<Array|null>
     * @param {string} [mode] — фільтр за режимом; null/undefined — всі режими
     * @param {number} [limit] — кількість записів (1..50, за замовчуванням 10)
     * @returns {Promise<Array|null>} масив записів або null при помилці/відсутності клієнта
     */
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

    /**
     * @typedef {Object} GlobalScoresAPI
     * @property {Function} submit — надіслати результат (RPC submit_score)
     * @property {Function} top — отримати ТОП результатів
     * @property {Function} ready — перевірити готовність клієнта
     */

    /** @type {GlobalScoresAPI} */
    window.GlobalScores = {
        submit: submit,
        top: top,
        ready: ready
    };
})();
