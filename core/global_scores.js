/**
 * GlobalScores.js — світовий лідерборд через Supabase.
 * - Таблиця scores(player, score, mode, level, combo, device_id, created_at)
 * - submit після кожного забігу (fire-and-forget) через Edge Function verify-run:
 *   прямого INSERT для anon немає, тому клієнт не може вставити довільний
 *   рядок у таблицю — усі очки валідуються на сервері (A5-lite: межі, темп, частота).
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
 * @property {number} [seed] — сид забігу (int)
 * @property {number} [stars] — зірки (0..3)
 * @property {number} [obstaclesPassed] — перешкод пройдено
 * @property {number} [nearMisses] — майже-зіткнень
 * @property {number[]} [inputs] — таймінги вводу (мс від старту), макс. ~5000 елементів
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
     * Ім'я гравця для лідерборда: береться з налаштувань, чиститься від
     * HTML-символів (нік бачать інші гравці) і обрізається до 24 символів.
     * @returns {string} безпечний нік або 'Пілот'
     */
    function _playerName() {
        try {
            const n = window.State && window.State.getSetting('nickname');
            if (typeof n === 'string' && n.trim()) {
                return n.trim().replace(/[<>&"']/g, '').slice(0, 24) || 'Пілот';
            }
        } catch (e) {}
        return 'Пілот';
    }

    /**
     * Перевіряє готовність хмарного сховища.
     * @returns {boolean} true якщо клієнт Supabase готовий до запитів
     */
    function ready() {
        try { return !!(window.CloudStorage && window.CloudStorage.isReady() && window.CloudStorage.getClient()); } catch (e) { return false; }
    }

    /** Надіслати результат. Promise<boolean>
     *  Викликає Edge Function verify-run (серверна валідація A5-lite).
     *  entry: { score, mode, level?, combo?, duration?, seed?, stars?,
     *   obstaclesPassed?, nearMisses?, inputs? } — duration це тривалість
     *  забігу в секундах; inputs — масив таймінгів вводу (мс від старту).
     *  Успіх: { ok: true, id } → resolve(true). Помилка/не-2xx/мережа → resolve(false).
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
                // Загальний затискач: невід'ємне ціле число або 0
                const num = function (x) { return Math.max(0, Math.floor(Number(x) || 0)); };
                // device_id потрібен для переходного режиму (поки немає user-JWT)
                let deviceId = null;
                try { deviceId = window.CloudStorage.getDeviceId(); } catch (e) {}
                const payload = {
                    seed: num(entry.seed),
                    mode: String(entry.mode || 'endless').slice(0, 16),
                    level: typeof entry.level === 'number' ? Math.floor(entry.level) : null,
                    duration: num(entry.duration),
                    score: Math.min(MAX_SCORE, Math.max(1, Math.floor(entry.score))),
                    combo: num(entry.combo),
                    stars: num(entry.stars),
                    obstaclesPassed: num(entry.obstaclesPassed),
                    nearMisses: num(entry.nearMisses),
                    inputs: Array.isArray(entry.inputs) ? entry.inputs : [],
                    player: _playerName(),
                    deviceId: deviceId,
                    clientVersion: '1.2.0'
                };
                // Edge Function verify-run: сервер сам вирішує, чи приймати результат
                client.functions.invoke('verify-run', { body: payload }).then(function (res) {
                    if (res && res.error) {
                        if (!_warned) { _log('warn', 'submit: ' + (res.error.message || res.error)); _warned = true; }
                        resolve(false);
                        return;
                    }
                    const data = res && res.data;
                    if (data && data.ok) {
                        _log('info', 'score submitted');
                        resolve(true);
                        return;
                    }
                    if (!_warned) { _log('warn', 'submit: сервер відхилив результат'); _warned = true; }
                    resolve(false);
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
     * @property {Function} submit — надіслати результат (Edge Function verify-run)
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
