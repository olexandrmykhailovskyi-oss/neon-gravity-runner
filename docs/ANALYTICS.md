# Аналітика — Neon Gravity Runner

Гайд «як читати телеметрію та приймати рішення». Описує **реальні** події, які надсилає гра, та як інтерпретувати накопичені дані.

---

## 1. Що збирається

Усі події потрапляють у таблицю `analytics_events` (схема `public`). Кожен рядок містить:

| Поле | Тип | Опис |
|---|---|---|
| `anon_id` | `text` | Анонімний ідентифікатор пристрою (`an_<random>`), генерується локально |
| `user_id` | `uuid` | Технічний ID анонімного аккаунта Supabase Auth (заповнюється, якщо включено anonymous sign-in) |
| `event` | `text` | Назва події |
| `props` | `jsonb` | Додаткові параметри події |
| `ts` | `timestamptz` | Час події |

Події надсилаються **батчами** кожні 15 секунд, а також при закритті/згортанні вкладки (через `fetch` з `keepalive`). Черга обмежена 50 подіями.

### Події, які реально надсилаються

| Подія | Параметри (`props`) | Коли надсилається |
|---|---|---|
| `session_start` | `{}` | На старті сесії (виклик `Analytics.sessionStart()`) |
| `game_start` | `{ mode: string }` | На початку кожного забігу (у режимах: `campaign`, `endless`, `daily`, `timeattack`, `survival`, `zen`, `custom`) |
| `run_end` | `{ mode: string, score: number, dur: number }` | При завершенні забігу (смерть або завершение Time Attack). **Увага: `level` НЕ передається** — це важливо для аналізу провалів у кампанії |
| `level_complete` | `{ level: number, stars: number }` | При перемозі в рівні кампанії або кастомному рівні |
| `lb_submit` | `{ mode: string }` | Після успішного надсилання результату у світовий лідерборд |

### Як вимикати

Тумблер **«Анонімна статистика»** у налаштуваннях (екран «Налаштування») відповідає за параметр `State.settings.analytics`. Коли вимкнено — жодна подія не надсилається взагалі.

---

## 2. Приватність

- **Жодних персональних даних.** Телеметрія не збирає імена, email-адреси, IP-адреси або будь-які інші ідентифікатори, за якими можна встановити особу.
- **`anon_id`** — випадковий рядок типу `an_abc123...`, який генерується локально на пристрої і не пов'язаний з конкретною людиною.
- **`user_id`** — технічний UUID анонімного аккаунта Supabase Auth. Використовується для розрізнення гравців, але не містить жодної інформації про особу.
- **Ліміти:** не більше 120 подій за 60 секунд на одного користувача (тригер `analytics_rate_limit`).

---

## 3. Отчётні вью

Вю знаходяться в схемі **`reporting`**. Вона **не публікується через PostgREST** — доступ тільки з **SQL Editor** або через `service_role` (наприклад, для внутрішніх дашбордів).

| Вю | Що показує | На яке питання відповідає |
|---|---|---|
| `reporting.mode_popularity` | Кількість запусків по режимах за днями | Які режими найпопулярніші? |
| `reporting.funnel` | Воронка: дні → сесії → старты → завершёні забіги → пройдені рівні | Де ми втрачаємо гравців? |
| `reporting.daily_players` | Унікальні гравці та сесії за день | Скільки людей грає щодня? |
| `reporting.level_stars` | По рівнях кампанії: кількість проходжень та середні зірки | Які рівні найлегші/найважчі? |
| `reporting.level_failures` | По рівнях кампанії: скільки забігів завершилися смертю | Де гравці найчастіше помирають? |

> **Важливо:** Вю `reporting.level_failures` потребує наявності поля `level` у події `run_end`. Наразі гра **не передає** `level` у `run_end` (див. розділ 1). Щоб отримувати цей показник, необхідно додати `level` у виклик `Analytics.track('run_end', ...)` у `gameplay/game.js`.

---

## 4. Приклади запитів

Усі запти виконуються в **SQL Editor** або через `psql` з підключенням `service_role`.

### 4.1 `reporting.mode_popularity` — популярність режимів за останні 7 днів

```sql
SELECT
    ts::date AS day,
    props->>'mode' AS mode,
    COUNT(*) AS runs
FROM reporting.mode_popularity
WHERE ts::date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY ts::date, props->>'mode'
ORDER BY day DESC, runs DESC;
```

### 4.2 `reporting.funnel` — воронка за сьогодні

```sql
SELECT
    day,
    sessions,
    game_starts,
    run_ends,
    level_completes,
    ROUND(100.0 * run_ends / NULLIF(game_starts, 0), 1) AS run_end_pct,
    ROUND(100.0 * level_completes / NULLIF(game_starts, 0), 1) AS level_complete_pct
FROM reporting.funnel
WHERE day = CURRENT_DATE;
```

### 4.3 `reporting.daily_players` — унікальні гравці за тиждень

```sql
SELECT
    day,
    unique_players,
    sessions,
    ROUND(1.0 * sessions / NULLIF(unique_players, 0), 1) AS sessions_per_player
FROM reporting.daily_players
WHERE day >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY day DESC;
```

### 4.4 `reporting.level_stars` — середні зірки по рівнях

```sql
SELECT
    level,
    attempts,
    ROUND(avg_stars, 2) AS avg_stars
FROM reporting.level_stars
ORDER BY level;
```

### 4.5 `reporting.level_failures` — топ-5 рівнів за провалами

```sql
SELECT
    level,
    failures,
    attempts,
    ROUND(100.0 * failures / NULLIF(attempts, 0), 1) AS fail_pct
FROM reporting.level_failures
ORDER BY failures DESC
LIMIT 5;
```

### 4.6 Ad-hoc: середня тривалість забігу по режимах

```sql
SELECT
    props->>'mode' AS mode,
    COUNT(*) AS runs,
    ROUND(AVG((props->>'dur')::numeric), 1) AS avg_duration_sec,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (props->>'dur')::numeric), 1) AS median_duration_sec
FROM analytics_events
WHERE event = 'run_end'
  AND ts >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY props->>'mode'
ORDER BY runs DESC;
```

### 4.7 Ad-hoc: розподіл зірок по рівнях кампанії

```sql
SELECT
    props->>'level' AS level,
    props->>'stars' AS stars,
    COUNT(*) AS completions
FROM analytics_events
WHERE event = 'level_complete'
  AND ts >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY props->>'level', props->>'stars'
ORDER BY level, stars;
```

### 4.8 Ad-hoc: конверсія сесія → старт гри

```sql
SELECT
    ts::date AS day,
    COUNT(*) FILTER (WHERE event = 'session_start') AS sessions,
    COUNT(*) FILTER (WHERE event = 'game_start') AS game_starts,
    ROUND(100.0 * COUNT(*) FILTER (WHERE event = 'game_start') / NULLIF(COUNT(*) FILTER (WHERE event = 'session_start'), 0), 1) AS start_rate_pct
FROM analytics_events
WHERE ts::date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY ts::date
ORDER BY day DESC;
```

---

## 5. Як приймати рішення

Короткі практичні правила для інтерпретації:

| Симптом | Що це означає | Що робити |
|---|---|---|
| На рівні багато провалів і низькі зірки | Рівень переусложнений | Зменшити щільність перешкод, низити швидкість аб збільшити час |
| `run_end` набагато менше `game_start` | Гравці відразу після стартоу розходяться | Перевірити перші 5–10 секунд гри: можливо, складно аб не зрозуміло |
| Є сесії, немає `game_start` | Проблема з меню або завантаженням | Подивитися логи помилок, перевірити доступність кнопок |
| Популярність одного режому домінує | Інші режими можуть бути нецікавіми аб не видними | Перевірити баланс, додати бонуси аб покращити видимість |
| Середня тривалість забігу < 10 секунд | Можливо, гра занадто складна на старті | Додаткові об'єснити механіку аб додати туторіал |

---

## 6. Чесна оговорка

- **Даних поки що мало.** Таблиця `analytics_events` майже порожня — гра щопочала збирати телеметрію. Висновки з'являться з трафіком.
- **Вю — інструмент, а не готовий звіт.** Вони агрегують дані, але інтерпретація залишається за вами.
- **Не всі метрики доступні зараз.** Наприклад, `reporting.level_failures` не працює без додання `level` у `run_end` (див. розділ 3).

---

## 7. Як вимкнути / почистити

### Вимкнення телеметрії

Відкрийте **Налаштування** → вимкніть тумблер **«Анонімна статистика»**. Після цього жодна подія не надсилається.

### Видалення даних

На даний момент **політики `delete` для `analytics_events` не існує**. Видалення даних можливе тільки вручну через **Dashboard → Table Editor** або **SQL Editor**:

```sql
-- УВАГА: незворотна операція!
DELETE FROM analytics_events
WHERE anon_id = 'an_abc123...';  -- замініть на свій anon_id
```

Або для повного очищення:

```sql
-- УВАГА: видаляє ВСІ події для всіх гравців!
TRUNCATE analytics_events;
```

---

## 8. Пов'язані документи

- [`docs/SUPABASE.md`](SUPABASE.md) — схема БД, політики безпеки, Edge Functions
- [`core/analytics.js`](../core/analytics.js) — клієнтський код телеметрії
- [`gameplay/game.js`](../gameplay/game.js) — логіка надсилання подій
