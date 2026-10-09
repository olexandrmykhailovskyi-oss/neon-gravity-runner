# Архітектура Neon Gravity Runner

## 1. Обзор і принципи

**Neon Gravity Runner** — браузерна аркада на чистому JavaScript (ES6+, без модулів і бандлера) з рендерингом через Canvas 2D. Гравець керує неоновою частинкою, яка рухається в тунелі між стелею та підлогою; основна механіка — перемикання гравітації (flip) для уникнення перешкод.

### Ключові принципи

| Принцип | Реалізація |
|---------|-------------|
| **Нуль runtime-зависимостей** | Жодних npm-пакетів, жодних імпортів. Тільки нативний JS + Canvas 2D + Web Audio API. |
| **Без бандлера** | Кожен модуль — окремий `<script>` файл. Збірка не потрібна: достатньо відкрити `index.html`. |
| **Працює через `file://`** | Модулі не використовують `import`/`require`. Всі глобальні об'єкти — через `window.*`. |
| **IIFE-модулі** | Кожен файл обгорнутий у `(function () { 'use strict'; ... })()` — ізоляція скоупу, експорт через `window.<Namespace>`. |
| **Єдине джерело правди** | `window.State` — центральне сховище прогресу, налаштувань, статистики. |
| **Конфігурація — заморожена** | `window.Config` — deep-frozen об'єкт усіх констант (баланс, рівні, скіни, досягнення). |
| **Безпека за замовчуванням** | Екранування HTML перед `innerHTML`, санітизація полів рекордів, валідація імпорт-кодів. |

---

## 2. Карта модулів

### `core/` — фундамент

| Модуль | Відповідність |
|--------|---------------|
| `core/logger.js` | Логування з рівнями (info/warn/error), безпечне для production |
| `core/safe_storage.js` | Обгортка над localStorage з fallback у пам'ять, обробка QuotaExceededError |
| `core/state.js` | **Єдине джерело правди**: прогрес кампанії, статистика, налаштування, досягнення, експорт/імпорт/mergeRemote |
| `core/config.js` | Заморожені константи: баланс гри, 35 рівнів, 8 скінів, 17 досягнь, теми, кольори |
| `core/utils.js` | Утиліти: `vibrate`, `getTodayString`, `seedFromString`, `createRng` (детермінований RNG для Daily) |
| `core/collision.js` | Геометрія колізій: `circleRect`, `circles`, `circleRectDist`, `circleCircleDist` |
| `core/i18n.js` | Інтернаціоналія: uk/ru/en словники, `t(key)`, `setLanguage` |
| `core/cloud_storage.js` | Хмарна синхронізація прогресу через Supabase (динамічне завантаження SDK) |
| `core/global_scores.js` | Світовий лідерборд через RPC `submit_score` (серверна валідація) |
| `core/analytics.js` | Анонімна телеметрія подій (track/flush), вимикається в налаштуваннях |
| `core/boot.js` | Контроль запуску: перевірка модулів, послідовна ініціалізація, екран помилки |
| `core/main.js` | Точка входу: глобальний onerror, beforeunload, реєстрація SW, запуск Boot |

### `fx/` — візуал і звук

| Модуль | Відповідність |
|--------|---------------|
| `fx/audio.js` | Процедурний звуковий движок на Web Audio API: SFX (осцилятори) + фонова музика (ембієнт-луп + тривожний шар на штормах) |
| `fx/particles.js` | Система частинок з об'єктним пулом (650 об'єктів): трейл, вибух, іскри, збір, шторм |
| `fx/floating_text.js` | Плаваючий текст для комбо, очок, бонусів (NEAR!, ШТОРМ!, НОВИЙ РЕКОРД!) |
| `fx/background.js` | Багатошаровий неоновий фон: градієнт, туманності, зірки, спідлайни, сітка, межі тунелю |
| `fx/effects.js` | Візуальні ефекти: screen shake, flash, slow-motion (timeScale), hit-stop, pulse, vignette |

### `gameplay/` — ігрова логіка

| Модуль | Відповідність |
|--------|---------------|
| `gameplay/player.js` | Гравець: фізика (GRAVITY 1900, FLIP_IMPULSE 420), трейл, бонуси (shield/magnet/ghost/revive/phase), gravity_zone |
| `gameplay/obstacle.js` | **Фабрика перешкод**: 8 типів (wall, gate, moving, spikes, laser, moving_laser, gravity_zone, pulsar), колізії, рендер |
| `gameplay/obstacles.js` | **Менеджер перешкод**: спавн з урахуванням типів рівня, 28+ патернів-структур, near-miss, sweep-колізії |
| `gameplay/bonus.js` | Фабрика бонусів: 8 типів (star, shield, slow, double, magnet, ghost, revive, phase) |
| `gameplay/bonuses.js` | Менеджер бонусів: спавн за таймером з вагами, колекція, застосування ефектів |
| `gameplay/storm.js` | Движок Neon Storm: інтервал 45с (endless) або абсолютні позначки рівня (campaign: true/double/boss) |
| `gameplay/scoring.js` | Підрахунок очок: пасивні 5/с, комбо з множником, подвоєння, зовнішній множник режиму |
| `gameplay/levels.js` | Менеджер кампанії: 35 рівнів, розрахунок зірок (1-3★), збереження прогресу, розблокування |
| `gameplay/modes.js` | Режими: timeattack (180с, ×2), survival (нескінченний, ×1.5), zen (без смерті, ×0) |
| `gameplay/game.js` | **Головний рушій**: ігровий цикл, режими, update/render, переходи станів, інтеграція всіх систем |

### `ui/` — інтерфейс

| Модуль | Відповідність |
|--------|---------------|
| `ui/ui.js` | DOM-утиліти: `showScreen`, `showToast`, `safeBind`, `$` (querySelector) |
| `ui/screens.js` | Побудова всіх екранів: меню, кампанія, перемога, game over, лідерборд, налаштування, статистика, допомога |
| `ui/hud.js` | Ігровий HUD: рахунок, комбо, бейджі бонусів, прогрес-бар рівня, рекорд, пауза |
| `ui/input.js` | Введення: клавіатура (Space/ESC/R/P/M/F), мишь, тач, автопауза при зміні вкладки, debouncing |
| `ui/editor.js` | Конструктор рівнів: форма, валідація (sanitize), кодек NGRL1, бібліотека «Мої рівні» |
| `ui/skins.js` | Система скінів: 8 скінів, унікальні форми трейлу, розблокування за статистикою/досягненнями |
| `ui/achievements.js` | Система досягнень: 17 досягнень, перевірка після кожної зміни статистики |

---

## 3. Порядок завантаження скриптів

Порядок у `index.html` (рядки 108-161) **критичний** — кожен модуль очікує, що його залежності вже існують у `window`.

```
core/logger.js
core/safe_storage.js
core/state.js          ← очікує SafeStorage
core/config.js         ← незалежний
core/utils.js
core/collision.js
core/i18n.js
    ↓
core/cloud_storage.js  ← очікує SafeStorage, Config
core/global_scores.js   ← очікує CloudStorage, State
core/analytics.js      ← очікує State
    ↓
fx/audio.js            ← очікує State (гучність)
fx/particles.js
fx/floating_text.js
fx/background.js       ← очікує Config (теми)
fx/effects.js
    ↓
ui/skins.js            ← очікує Config, State
ui/achievements.js     ← очікує Config, State
    ↓
gameplay/player.js     ← очікує Config, Utils
gameplay/obstacle.js   ← очікує Config, Collision
gameplay/obstacles.js  ← очікує Obstacle, Config, State
gameplay/bonus.js      ← очікує Config
gameplay/bonuses.js    ← очікує Bonus
gameplay/storm.js      ← очікує Config, AudioSys, Effects
gameplay/scoring.js    ← очікує Config
gameplay/levels.js     ← очікує Config, State
gameplay/modes.js
    ↓
ui/ui.js               ← базові DOM-утиліти
ui/screens.js          ← очікує UI, I18n, State, Config
ui/editor.js            ← очікує UI, I18n, SafeStorage
ui/hud.js              ← очікує UI, I18n
gameplay/game.js       ← очікує ВСЕ вище (HUD, Background, Player, Obstacles, Bonuses, Storm, Scoring, Effects, Screens, Modes, Levels, Input)
ui/input.js            ← очікує UI, Game, AudioSys
    ↓
core/boot.js           ← перевіряє наявність усіх модулів, ініціалізує
core/main.js           ← запускає Boot при window.load
```

### Чому такий порядок

1. **Спочатку беззалежні утиліти** (logger, config, utils, collision) — вони не потребують нікого.
2. **Потім State** — використовує SafeStorage, але сам потрібен майже всім.
3. **Потім візуал (fx/)** — частинки, фон, звук не залежать від гравця чи перешкод.
4. **Потім gameplay** — гравець, перешкоди, бонуси залежать від Config і утиліт.
5. **Потім UI** — екрани та HUD залежать від gameplay (Game, Player, Scoring).
6. **Наприкінці boot.js + main.js** — boot перевіряє, що всі модулі завантажені, і лише тоді ініціалізує гру.

---

## 4. Поток даних і життєвий цикл

### Стани гри (`Game._state`)

```
boot → menu → tutorial → playing ⇄ paused → gameover/victory → menu
```

### Режими (`Game._mode`)

| Режим | Опис | Завершення |
|-------|------|------------|
| `campaign` | 35 рівнів з таймером і зірками | Таймер вичерпано → victory |
| `endless` | Нескінченна гра зі зростаючою складністю | Смерть → gameover |
| `daily` | Виклик дня з детермінованим RNG | Смерть → gameover |
| `timeattack` | 180 секунд, очки ×2 | Таймер вичерпано → victory |
| `survival` | Нескінченний зі зростаючою складністю ×1.5 | Смерть → gameover |
| `zen` | Без смерті і очок, релакс | Вихід у меню |
| `custom` | Користувацький рівень з редактора | Таймер вичерпано → victory |

### Що відбувається при старту забігу (`Game._startRun`)

1. **Перевірка туторіалу** — якщо `tutorialDone === false` і режим `endless`, показується екран туторіалу.
2. **Детермінований RNG** — для `daily` режиму створюється RNG з сида від дати.
3. **Множники** — застосовується множник режиму (timeattack ×2, survival ×1.5, zen ×0) × складність (easy ×0.85, normal ×1.0, hardcore ×1.3).
4. **Скидання систем** — `Scoring.reset()`, `Particles.clear()`, `FloatingTexts.clear()`.
5. **Спавн перешкод** — `Obstacles.reset(allowedTypes, density, rng)` — типи залежать від рівня або режиму.
6. **Спавн бонусів** — `Bonuses.reset(rng)`.
7. **Шторм** — `Storm.reset(levelConfig)` — налаштовує чергу штормів для рівня або інтервал 45с для endless.
8. **Гравець** — `Player.reset(bounds)` — позиція, гравітація, бонуси.
9. **Швидкість** — розраховується від режиму, рівня, складності.
10. **Стан** — `_state = 'playing'`, HUD показується, Wake Lock активується, музика стартує.

---

## 5. Ігровий цикл

### Цикл (`Game._loop`)

```javascript
_loop(timestamp) {
    _rafId = requestAnimationFrame(_loop);
    let dt = (timestamp - _lastTime) / 1000;
    if (dt > 0.05) dt = 0.05;  // Кламп: захист від великих стрибків ( Alt-Tab )
    if (dt <= 0) return;

    if (_state === 'playing') {
        update(dt);
    } else {
        // Фонові ефекти в меню/паузі
        Effects.update(dt);
        Background.update(dt, 90);
        Particles.update(dt);
        FloatingTexts.update(dt);
    }
    render();
}
```

### Порядок update систем (у `Game.update`)

```
1. Effects.update(dt)          — тряска, flash, slow-mo
2. Background.update(dt, speed) — паралакс фону
3. Player.update(dt, bounds, timeScale, speed) — фізика гравця
4. Obstacles.update(realDt, speed, area) — рух перешкод + спавн
5. Bonuses.update(realDt, speed, area, player) — рух бонусів + спавн
6. Storm.update(realDt, playerAlive) — таймер шторму
7. Scoring.update(realDt)      — пасивні очки, комбо-таймер
8. Particles.update(dt)        — частинки
9. FloatingTexts.update(dt)    — плаваючий текст
10. Перевірка проходження перешкод → Scoring.addObstacle()
11. Перевірка завершення рівня/режиму
12. Колізії → Player.hit() → gameover/victory
13. Near-miss детекція
14. Збір бонусів → Bonuses.collect(player)
15. Шторм пережито → Scoring.addStorm()
16. Досягнення (кожні 2 сек)
17. Оновлення HUD (кожні 0.08 сек)
```

### Рендер-слої (`Game.render`)

```
1. clearRect
2. Effects.applyShake(ctx)     — зсув камери
3. Background.draw()           — градієнт, зірки, сітка, межі
4. Obstacles.draw(ctx)         — перешкоди
5. Bonuses.draw(ctx)           — бонуси
6. _drawGravityGuide(ctx)      — пунктирна лінія гравітації (опція)
7. Particles.draw()            — частинки
8. Player.draw(ctx)            — гравець + трейл
9. FloatingTexts.draw(ctx)     — текст
10. Effects.drawFlash()        — спалах
11. Effects.drawVignette()     — віньєтка
```

### timeScale (slow-mo)

`Effects.slowmo(scale, duration)` встановлює `timeScale < 1`. Усі системи використовують `realDt = dt * timeScale`, крім:
- `Background.update(dt, ...)` — фон рухається в реальному часі
- `Particles.update(dt)` — частинки в реальному часі
- `FloatingTexts.update(dt)` — текст в реальному часі

---

## 6. Состояння і персистентність

### State — єдине джерело правди

`window.State` зберігає:

```javascript
{
    version: 2,
    settings: { sfxVolume, musicVolume, quality, theme, skin, reducedMotion, mute, vibration, gravityGuide, difficulty, language, nickname, analytics },
    campaign: { maxLevel, stars: {1: 0, 2: 0, ...}, selected },
    stats: { bestScore, bestCombo, totalGames, totalDeaths, starsCollected, stormsSurvived, nearMisses, ghostPasses, longestGame, totalPlaytime, lastPlayed, dailyBest, dailyDate, dailyStreak, bestByMode: {...} },
    achievements: [],
    tutorialDone: false,
    hints: {}
}
```

### SafeStorage

`core/safe_storage.js` — обгортка над localStorage:
- **Fallback у пам'ять**, якщо localStorage заблокований (інкогніто, file://, приватний режим).
- **Overlay** для ключів, які не вдалося записати (QuotaExceeded посеред сесії).
- **Безпечний JSON-parse** з захистом від битих даних.

### Експорт / імпорт прогресу

Формат коду: `NGR1-<hash36>-<base64>`

```javascript
// Експорт
const code = State.exportProgress();  // "NGR1-abc123-eyJzdGF0ZSI6..."

// Імпорт
State.importProgress(code);  // true/false
```

- **Unicode-безпечний base64** — через `encodeURIComponent` + `btoa`.
- **Контрольна сума** — djb2-подібний хеш (`_hash36`) для перевірки цілісності payload.
- **Валідація** — будь-яка підміна символів у payload відхиляється.

### Злиття «тільки вгору» (`mergeRemote`)

Використовується при синхронізації з хмарою або імпорті:

| Поле | Стратегія злиття |
|------|------------------|
| `campaign.stars[id]` | `Math.max(local, remote)` |
| `campaign.maxLevel` | `Math.max(local, remote)` |
| `stats.bestScore`, `bestCombo`, `longestGame`, ... | `Math.max(local, remote)` |
| `stats.bestByMode[mode]` | `Math.max(local, remote)` |
| `achievements` | Об'єднання (union) |
| `settings` | Локальні значення мають пріоритет |
| `leaderboard` | Об'єднання + сортування + ТОП-5 |

**Захист від битих даних**: `campaign: null`, `settings: null`, `stats: null` відкидаються до злиття.

### Хмарна синхронізація (Supabase)

`core/cloud_storage.js`:
- Увімкнюється лише якщо в `index.html` задано `window.NGR_CLOUD_CONFIG`.
- Supabase SDK завантажується динамічно з CDN.
- **Push** після кожного забігу (`CloudStorage.pushProgress()`).
- **Pull + merge** на старті (`CloudStorage.pullFromCloud()` → `State.mergeRemote()`).
- Таблиця: `user_progress(device_id text pk, data jsonb, updated_at timestamptz)`.

---

## 7. Введення

### Клавіатура (`ui/input.js`)

| Клавіша | Дія |
|---------|-----|
| `Space` | Фліп гравітації / дія |
| `Escape` | Пауза |
| `R` | Швидкий рестарт (на екранах gameover/victory/pause) |
| `P` | Пауза (toggle) |
| `M` | Швидкий мут |
| `F` | Повний екран |

### Мишь і тач

- **Клік по canvas** → фліп гравітації.
- **Тап** → фліп гравітації.
- **Debouncing** — 50 мс між діями (захист від дублів).
- **Touch-Mouse Suppress** — 700 мс після тачу ігнорується синтетичний `mousedown`.

### Автопауза

```javascript
document.addEventListener('visibilitychange', () => {
    if (document.hidden && Game.isPlaying()) Game.pause();
});
window.addEventListener('blur', () => {
    if (Game.isPlaying()) Game.pause();
});
```

### Буфер флипа

У `gameplay/player.js`:
- `_flipBuffered` — якщо гравець натиснув фліп під час кулдауну, він запам'ятовується.
- `_flipCooldown` — мінімальний інтервал між фліпами.
- `Config.GAME.FLIP_BUFFER = 0.15` — секунд буфера.

---

## 8. Тести

### Смоук-тест логіки (`test_smoke.js`)

Запуск: `node test_smoke.js`

- **VM-песочниця** — створює стаби `window`, `document`, `localStorage`, `btoa`/`atob`.
- **Завантаження модулів** у правильному порядку (як у `index.html`).
- **Понад 100 перевірок** у 7 категоріях:
  1. Парність ключів i18n (uk/ru/en)
  2. Експорт/імпорт/скидання прогресу
  3. Чексума експорт-коду
  4. Множник очок режимів
  5. Режими (timeattack/survival/zen)
  6. Геометрія спавну бонусів
  7. Колізії, детермінізм, шторми, безпека

### E2E-тести (Playwright)

Запуск: `npm run test:e2e` (перед першим запуском — `npx playwright install chromium`).

- `playwright.config.js` — `testDir: e2e/`, headless Chromium, viewport 1280×720, `serviceWorkers: 'block'`, retries лише в CI, `webServer` сам піднімає статичний сервер.
- `e2e/server.js` — мінімальний статичний сервер на вбудованому `http` (без залежностей), порт 4173.
- `e2e/game.spec.js` — 3 сценарії: завантаження до меню (без неперехоплених помилок), запуск endless-забігу (рахунок не спадає і canvas реально малює), запуск рівня 1 кампанії.

Тести не залежать від мережі: перевіряється відсутність `pageerror`, а не помилок у консолі.

---

## 9. Точки розширення

### Як додати новий тип перешкоди

1. **`core/config.js`** — додати тип у `Config.SPAWN.OBSTACLE_TYPES` (рядок 37).
2. **`gameplay/obstacle.js`** — додати `case '<type>'` у `create()` (рядок 92), `update()` (рядок 212), `getRects()` (рядок 256), `draw()` (рядок 409).
3. **`gameplay/obstacles.js`** — додати тип у `PATTERNS` (рядок 135), якщо потрібні структури.
4. **`core/config.js`** — додати тип у `obstacles` потрібних рівнів (масив `LEVELS`).

### Як додати новий бонус

1. **`core/config.js`** — додати тип у `Config.SPAWN.BONUS_TYPES` (рядок 38) і `Config.COLORS` (рядок 533).
2. **`gameplay/bonus.js`** — додати `case '<type>'` у `create()` (рядок 48).
3. **`gameplay/bonuses.js`** — додати тип у `types` і `weights` у `_spawn()` (рядок 48).
4. **`gameplay/player.js`** — додати ефект у `hit()` або `update()`.

### Як додати новий рівень кампанії

1. **`core/config.js`** — додати об'єкт у масив `Config.LEVELS` (рядок 133):
   ```javascript
   { id: 36, name: 'Новий рівень', duration: 60, speedMult: 1.0, obstacles: ['wall', 'gate'], density: 1.0, storm: false, theme: 0, starScore: 500 }
   ```
2. `Config.MAX_LEVEL` автоматично оновиться (рядок 558).

### Як додати новий скін

1. **`core/config.js`** — додати об'єкт у `Config.SKINS` (рядок 57):
   ```javascript
   { id: 'new_skin', name: 'Новий скін', color: '#ff0000', trailShape: 'circle', unlock: { stats: 'bestScore', value: 500 } }
   ```
2. **`ui/skins.js`** — нічого не потрібно, система автоматично підхопить новий скін.

### Як додати нову тему

1. **`core/config.js`** — додати об'єкт у `Config.THEMES` (рядок 48):
   ```javascript
   { id: 6, i18n: 'new_theme', name: 'Нова тема', bg1: '#000000', bg2: '#111111', grid: '#ffffff', accent: '#ff0000' }
   ```
2. **`fx/background.js`** — тема автоматично застосовується через `Background.setTheme(id)`.

### Як додати нове досягнення

1. **`core/config.js`** — додати об'єкт у `Config.ACHIEVEMENTS` (рядок 68):
   ```javascript
   { id: 'new_ach', name: 'Нова досягнення', desc: 'Опис', check: function (s) { return s.bestScore >= 1000; } }
   ```
2. **`ui/achievements.js`** — система автоматично перевірить нове досягнення.

---

## 10. Відомі обмеження і компромисси

| Обмеження | Причина | Компромисс |
|-----------|---------|------------|
| **Глобальний namespace** | Всі модулі експортують у `window.*` | Простота без бандлера, але ризик конфліктів імен |
| **Порядок скриптів критичний** | Модулі залежать від наявності попередніх | Легко зламати при перестановці; `boot.js` перевіряє наявність |
| **Клієнтський подрахунок очок** | Немає серверної валідації в локальній грі | Світовий лідерборд валідує через RPC `submit_score` (межі, темп, частота) |
| **localStorage як сховище** | Простота, але обмежений об'ім (~5 МБ) | SafeStorage має fallback у пам'ять |
| **Canvas 2D** | Без залежностей, але обмежена продуктивність | Об'єктний пул частинок, якість налаштовується (LOW/MED/HIGH/ULTRA) |
| **Web Audio API** | Потребує користувацької взаємодії для старту | `AudioSys.ensure()` викликається при першій дії гравця |
| **IIFE-модулі** | Ізоляція скоупу, але немає tree-shaking | Розмір коду більший, ніж при використанні бандлера |
| **Без ES-модулів** | Класичні скрипти та `window.*` замість `import`/`export` | Працює навіть через `file://`, але немає tree-shaking і явних залежностей |
| **Один canvas** | Усі шари рендеряться в одному canvas | Немає апаратного прискорення для окремих шарів |
| **Wake Lock** | Не підтримується в усіх браузерах | Тихо ігнорується, якщо API недоступний |
| **Service Worker** | Тільки https/localhost | Офлайн-режим не працює через `file://` |
| **Supabase SDK** | Завантажується з CDN | Гра не ламається без мережі, але хмарна синхронізація недоступна |
