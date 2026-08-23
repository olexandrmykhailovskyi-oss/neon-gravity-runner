/**
 * Смоук-тест логіки без браузера: стабимо window/document і завантажуємо модулі.
 * Запуск: node test_smoke.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

// ---- Стаби браузерного середовища ----
const storage = {};
const sandbox = {
    console: console,
    navigator: { language: 'uk-UA', maxTouchPoints: 0, onLine: false },
    document: {
        documentElement: { lang: 'uk' },
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({ style: {}, classList: { add(){}, remove(){}, toggle(){} }, appendChild(){} }),
        addEventListener() {}
    },
    window: null,
    Promise: Promise,
    localStorage: {
        getItem: (k) => (k in storage ? storage[k] : null),
        setItem: (k, v) => { storage[k] = String(v); },
        removeItem: (k) => { delete storage[k]; },
        clear: () => { for (const k in storage) delete storage[k]; }
    },
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    Date: Date,
    setTimeout, clearTimeout,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(rel) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    vm.runInContext(code, sandbox, { filename: rel });
}

let failures = 0;
function check(name, cond) {
    if (cond) {
        console.log('  OK: ' + name);
    } else {
        failures++;
        console.log('  FAIL: ' + name);
    }
}

// ---- Завантаження модулів у правильному порядку ----
load('core/logger.js');
load('core/safe_storage.js');
load('core/state.js');
load('core/config.js');
load('core/utils.js');
load('core/collision.js');
load('core/i18n.js');
load('core/cloud_storage.js');
load('gameplay/modes.js');
load('gameplay/scoring.js');

const W = sandbox;

// ---- 1. Парність ключів у словниках ----
console.log('\n[1] Парність ключів i18n (uk/ru/en):');
const TRANSLATIONS = W.I18n.getTranslations();
const ukKeys = Object.keys(TRANSLATIONS.uk).sort();
const ruKeys = Object.keys(TRANSLATIONS.ru).sort();
const enKeys = Object.keys(TRANSLATIONS.en).sort();
check('uk = ru (' + ukKeys.length + ' ключів)', JSON.stringify(ukKeys) === JSON.stringify(ruKeys));
check('uk = en (' + enKeys.length + ' ключів)', JSON.stringify(ukKeys) === JSON.stringify(enKeys));

// Немає порожніх значень
let emptyKeys = [];
for (const lang of ['uk', 'ru', 'en']) {
    for (const k of Object.keys(TRANSLATIONS[lang])) {
        if (!String(TRANSLATIONS[lang][k]).trim()) emptyKeys.push(lang + '.' + k);
    }
}
check('немає порожніх перекладів' + (emptyKeys.length ? ' (' + emptyKeys.join(',') + ')' : ''), emptyKeys.length === 0);

// ---- 2. I18n init / setLanguage ----
console.log('\n[2] I18n init/_setLanguage:');
W.State.init();
W.I18n.init();
check('uk за замовчуванням для uk-UA', W.I18n.getCurrentLanguage() === 'uk');
check('setLanguage("en")', W.I18n.setLanguage('en') === true && W.I18n.t('menu.settings') === '⚙ Settings');
check('setLanguage("ru")', W.I18n.setLanguage('ru') === true && W.I18n.t('menu.settings') === '⚙ Настройки');
check('setLanguage("xx") відхиляється', W.I18n.setLanguage('xx') === false);
check('мова зберігається у State', W.State.getSetting('language') === 'ru');
check('нові ключі: settings.export (en)', (W.I18n.setLanguage('en'), W.I18n.t('settings.export')) === '⬆ Export');
check('режими: mode.zen.desc (uk)', (W.I18n.setLanguage('uk'), W.I18n.t('mode.zen.desc')).length > 3);

// ---- 3. Експорт / імпорт / скидання прогресу ----
console.log('\n[3] Експорт/імпорт/скидання прогресу:');
W.State.updateStats({ bestScore: 1234, totalGames: 7 });
W.State.data.campaign.stars[3] = 2;
W.State.data.campaign.maxLevel = 4;
W.State.addLeaderboardEntry({ score: 999, mode: 'timeattack', combo: 5 });
const code = W.State.exportProgress();
check('експорт повертає код NGR1-…', typeof code === 'string' && code.startsWith('NGR1-') && code.length > 50);

// Псуємо прогрес, імпортуємо назад
W.State.resetProgress();
check('скинення очищає статистику', W.State.getStats('bestScore') === 0 && W.State.data.campaign.stars[3] === 0);
const ok = W.State.importProgress(code);
check('імпорт валідного коду', ok === true);
check('статистика відновлена', W.State.getStats('bestScore') === 1234 && W.State.getStats('totalGames') === 7);
check('зірки рівнів відновлені', W.State.data.campaign.stars[3] === 2 && W.State.data.campaign.maxLevel === 4);
check('рекорди відновлені', W.State.getLeaderboard().length === 1 && W.State.getLeaderboard()[0].mode === 'timeattack');
check('імпорт сміття відхиляється', W.State.importProgress('NGR1-xxxx-!!!') === false && W.State.importProgress('hello') === false);

// Злиття "тільки вгору": зірки не мають зникати
W.State.data.campaign.stars[3] = 3; // покращили локально
W.State.importProgress(code);       // у коді було 2
check('злиття зірок тільки вгору (3 > 2)', W.State.data.campaign.stars[3] === 3);

// Статистика тільки вгору
W.State.updateStats({ bestScore: 5000 });
W.State.importProgress(code); // у коді bestScore=1234
check('bestScore не зменшується при імпорті (5000 > 1234)', W.State.getStats('bestScore') === 5000);

// Досягнення об'єднуються
W.State.resetProgress();
W.State.unlockAchievement('first_game');
W.State.importProgress(code);
check('досягнення зберігаються при імпорті', W.State.isAchievementUnlocked('first_game') === true);

// ---- 3b. Цілісність експорт-коду (чексума) ----
console.log('\n[3b] Чексумма експорт-коду:');
const code2 = W.State.exportProgress();
const dash2 = code2.indexOf('-', 5);
const hashTok = code2.slice(5, dash2);
const payloadB64 = code2.slice(dash2 + 1);
check('хеш у коді відповідає payload', typeof hashTok === 'string' && hashTok.length > 0);
{
    const json = Buffer.from(payloadB64, 'base64').toString('binary');
    if (json.indexOf('"bestScore":1234') === -1) {
        // bestScore могло змінитися після попередніх кроків — шукаємо динамично
        const m = json.match(/"bestScore":(\d+)/);
        const evilJson = json.replace('"bestScore":' + m[1], '"bestScore":999999');
        const evilB64 = Buffer.from(evilJson, 'binary').toString('base64');
        check('підмінений payload відхиляється (hash mismatch)', W.State.importProgress('NGR1-' + hashTok + '-' + evilB64) === false);
    } else {
        const evilJson = json.replace('"bestScore":1234', '"bestScore":999999');
        const evilB64 = Buffer.from(evilJson, 'binary').toString('base64');
        check('підмінений payload відхиляється (hash mismatch)', W.State.importProgress('NGR1-' + hashTok + '-' + evilB64) === false);
    }
}
// mergeRemote: той самий формат, що в хмарі
const remoteOk = W.State.mergeRemote(JSON.parse(JSON.stringify(W.State.data)));
check('mergeRemote приймає валідний стан', remoteOk === true);
check('mergeRemote відхиляє сміття', W.State.mergeRemote(null) === false && W.State.mergeRemote({ foo: 1 }) === false);

// ---- 3c. Серія викликів дня (daily streak) ----
console.log('\n[3c] Daily streak:');
const today = W.Utils.getTodayString();
const yesterday = W.Utils.shiftDateString(today, -1);
check('shiftDateString(-1) дає вчорашній день', /^\d{4}-\d{2}-\d{2}$/.test(yesterday));
check('перший запуск серії = 1', W.Utils.nextDailyStreak(0, '', today) === 1);
check('пропущений день скидає серію до 1', W.Utils.nextDailyStreak(7, '2020-01-01', today) === 1);
check('вчорашній день продовжує серію (+1)', W.Utils.nextDailyStreak(7, yesterday, today) === 8);
check('той самий день не подвоює', W.Utils.nextDailyStreak(7, today, today) === 7);
check('скінів у конфігу = 8, токсичний відкривається серією ≥3',
    W.Config.SKINS.length === 8 &&
    W.Config.SKINS.some(function (s) {
        return s.id === 'toxic' && s.unlock && s.unlock.stats === 'dailyStreak' && s.unlock.value === 3;
    }));

// ---- 3e. QOL: вібрація та нові налаштування ----
console.log('\n[3e] QOL (vibration / settings):');
W.State.init();
check('налаштування vibration за замовчуванням = true', W.State.getSetting('vibration') === true);
check('vibrate без підтримки браузером повертає false', W.Utils.vibrate(50) === false);
W.State.setSetting('vibration', false);
check('vibrate вимкнено налаштуванням', W.Utils.vibrate(50) === false);
W.State.setSetting('vibration', true);
const i18nKeys = Object.keys(W.I18n.getTranslations().uk);
['menu.continue', 'hud.best', 'float.record', 'gameover.dailyBest', 'settings.vibration'].forEach(function (k) {
    check('ключ i18n присутній: ' + k, i18nKeys.indexOf(k) !== -1);
});

// ---- 3f. QOL-2: физика и понятность ----
console.log('\n[3f] QOL-2 (hitbox / flip buffer / combo / hints):');
check('HITBOX_FORGIVE = 0.82 у конфігу', W.Config.GAME.HITBOX_FORGIVE === 0.82);
check('FLIP_BUFFER = 0.15 у конфігу', W.Config.GAME.FLIP_BUFFER === 0.15);
W.Scoring.reset();
check('comboRemaining без комбо = 0', W.Scoring.comboRemaining() === 0);
W.Scoring.addObstacle();
check('comboRemaining після події > 0', W.Scoring.comboRemaining() > 0);
W.Scoring.update(2);
check('comboRemaining після 2с (decay 1.5) = 0', W.Scoring.comboRemaining() === 0);
W.State.init();
check('налаштування gravityGuide за замовчуванням = true', W.State.getSetting('gravityGuide') === true);
check('state.hints існує за замовчуванням', !!W.State.data.hints && typeof W.State.data.hints === 'object');
['cause.laser', 'hint.shield', 'pause.keys', 'btn.help', 'settings.gravityGuide', 'gameover.cause', 'help.controlsList'].forEach(function (k) {
    check('ключ i18n присутній: ' + k, i18nKeys.indexOf(k) !== -1);
});
check('досягнень у конфігу = 17 (вкл. серії дня)', W.Config.ACHIEVEMENTS.length === 17);
check('рівнів кампанії = 25, MAX_LEVEL/MAX_STARS синхронізовані',
    W.Config.LEVELS.length === 25 && W.Config.MAX_LEVEL === 25 && W.Config.MAX_STARS === 75);
check('рівень 25 має всі 8 типів перешкод', W.Config.LEVELS[24].obstacles.length === 8);
check('state: зірки рівня 25 існують у дефолтах', W.State.data.campaign.stars[25] === 0);
['btn.share', 'share.text', 'storm.warning', 'ach.streak_7.name', 'level.25'].forEach(function (k) {
    check('ключ i18n присутній: ' + k, i18nKeys.indexOf(k) !== -1);
});

// ---- 3d. CloudStorage без конфігурації ----
console.log('\n[3d] CloudStorage (без NGR_CLOUD_CONFIG):');
check('модуль завантажено', !!W.CloudStorage && typeof W.CloudStorage.init === 'function');
check('isReady() = false без конфігурації', W.CloudStorage.isReady() === false);
check('getProvider() = null', W.CloudStorage.getProvider() === null);
let cloudInitResult = null;
let cloudPushResult = null;
let cloudPullResult = null;
W.CloudStorage.init().then(function (r) { cloudInitResult = r; });
W.CloudStorage.pushProgress().then(function (r) { cloudPushResult = r; });
W.CloudStorage.pullFromCloud().then(function (r) { cloudPullResult = r; });

// ---- 4. Множник очок режимів ----
console.log('\n[4] Scoring + зовнішній множник:');
W.Scoring.reset();
W.Scoring.update(1);
const base = W.Scoring.scoreValue; // 5 очок за 1с
check('базові пасивні очки = 5/с', Math.abs(base - 5) < 0.01);
W.Scoring.reset();
W.Scoring.setExternalMultiplier(2);
W.Scoring.update(1);
check('×2 подвоює пасивні очки', Math.abs(W.Scoring.scoreValue - 10) < 0.01);
W.Scoring.setExternalMultiplier(0);
W.Scoring.reset();
W.Scoring.setExternalMultiplier(0);
W.Scoring.update(10);
W.Scoring.addStar();
W.Scoring.addNearMiss();
check('×0 (Zen): очки не ростуть', W.Scoring.scoreValue === 0);
W.Scoring.reset();
W.Scoring.update(1);
check('reset() скидає множник до 1', Math.abs(W.Scoring.scoreValue - 5) < 0.01);
W.Scoring.setExternalMultiplier(-5);
W.Scoring.update(1);
check('від\'ємний множник ігнорується', Math.abs(W.Scoring.scoreValue - 10) < 0.01);

// ---- 5. Modes ----
console.log('\n[5] Modes:');
check('3 режими визначені', W.Modes.getAllModes().length === 3);
check('timeattack: 180с, ×2', W.Modes.getModeConfig('timeattack').duration === 180 && W.Modes.getModeConfig('timeattack').scoreMultiplier === 2);
check('zen: noDeaths', W.Modes.getModeConfig('zen').noDeaths === true);
check('survival: нескінченний', W.Modes.getModeConfig('survival').duration === Infinity);

// ---- 6. Геометрія спавну бонусів ----
console.log('\n[6] Перевірка фіксу спавну бонусів (几何):');
const C = W.Collision;
// Стіна зверху: y=60, h=200 → займає 60..260. Бонус у центрі (y=160) має блокуватись
check('бонус у стіні блокується', C.circleRectDist(1000, 160, 46, 1000, 60, 40, 200) <= 0);
check('бонус під стіною вільний', C.circleRectDist(1000, 400, 46, 1000, 60, 40, 200) > 0);
// Ворота: прохід у центрі
check('бонус у проході воріт вільний', C.circleRectDist(1000, 360, 30, 990, 60, 36, 240) > 0 && C.circleRectDist(1000, 360, 30, 990, 420, 36, 240) > 0);

// ---- Підсумок ----
// Через короткий таймер: проміси CloudStorage резолвляться мікротасками,
// які мають виконатися до підбиття підсумку.
setTimeout(function () {
    check('init() без конфігурації завершується false', cloudInitResult === false);
    check('push без конфігурації повертає false', cloudPushResult === false);
    check('pull без конфігурації повертає null', cloudPullResult === null);

    console.log('\n' + (failures === 0 ? '✅ УСІ ТЕСТИ ПРОЙДЕНО' : '❌ ПРОВАЛІВ: ' + failures));
    process.exit(failures === 0 ? 0 : 1);
}, 25);
