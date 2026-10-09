# Серверна частина (Supabase / Postgres) — Neon Gravity Runner

Документ описує реальну схему БД, політики безпеки, серверну функцію та клієнтські потоки, що існують у коді проєкту. Усі ключі замінені на плейсхолдери — реальні секрети не публікуються.

---

## 1. Призначення та загальна схема

Гра опційно інтегрується з [Supabase](https://supabase.com) (Postgres + REST/PostgREST). Хмара вмикається, лише якщо в `index.html` задано `window.NGR_CLOUD_CONFIG`; інакше все працює суто локально.

Три таблиці:

| Таблиця | Призначення |
|---|---|
| `user_progress` | Хмарна синхронізація прогресу (один рядок на пристрій, `device_id` як PK, дані в `jsonb`). Pull на старті, push після кожного забігу, злиття «тільки вгору». |
| `scores` | Світовий лідерборд. **Запис тільки через функцію `submit_score`** — прямого `INSERT` для anon не існує. Читання топу вільне. |
| `analytics_events` | Анонімна телеметрія сесій (батчі подій, сирий `anon_id`, без прив'язки до користувача). |

---

## 2. Таблиці: колонки, типи, обмеження

### 2.1 `user_progress` — прогрес пристрою

| Колонка | Тип | Обмеження |
|---|---|---|
| `device_id` | `text` | **PRIMARY KEY** |
| `data` | `jsonb` | `NOT NULL` |
| `updated_at` | `timestamptz` | `NOT NULL`, default `now()` |

### 2.2 `scores` — світовий лідерборд

| Колонка | Тип | Обмеження |
|---|---|---|
| `id` | `bigint` | `GENERATED ALWAYS AS IDENTITY`, **PRIMARY KEY** |
| `player` | `text` | `NOT NULL`, default `'Пилот'` |
| `score` | `bigint` | `NOT NULL`, `CHECK (score >= 0 AND score < 100000000)` |
| `mode` | `text` | `NOT NULL`, default `'endless'` |
| `level` | `int` | nullable |
| `combo` | `int` | `NOT NULL`, default `0` |
| `device_id` | `text` | nullable (використовується для анти-спаму) |
| `created_at` | `timestamptz` | `NOT NULL`, default `now()` |

**Індекси** (створюються в `schema.sql`):

- `scores_mode_score_idx` на `(mode, score DESC)` — швидкий топ у різних режимах;
- `scores_device_created_idx` на `(device_id, created_at DESC)` — перевірка частоти надсилань та запити по пристрою.

### 2.3 `analytics_events` — телеметрія

| Колонка | Тип | Обмеження |
|---|---|---|
| `id` | `bigint` | `GENERATED ALWAYS AS IDENTITY`, **PRIMARY KEY** |
| `anon_id` | `text` | `NOT NULL` |
| `event` | `text` | `NOT NULL` |
| `props` | `jsonb` | `NOT NULL`, default `'{}'::jsonb` |
| `ts` | `timestamptz` | `NOT NULL`, default `now()` |

---

## 3. RLS-політики

RLS (Row Level Security) увімкнено на **всіх** таблицях. Політики:

| Таблиця | Політика | Дозволено anon | Чому |
|---|---|---|---|
| `user_progress` | `anon device progress` — `FOR ALL USING (true) WITH CHECK (true)` | будь-який читання/вставка/оновлення | прогрес не містить секретів; ключ один на пристрій (`device_id`) і генерується локально |
| `scores` | `scores_read` — `FOR SELECT USING (true)` | читання топу | лідерборд публічний |
| `scores` | — **політики на INSERT/UPDATE/DELETE НЕМАД** | ❌ **прямого INSERT немає** | запис лише через `submit_score` (SECURITY DEFINER) |
| `analytics_events` | `analytics_insert` — `FOR INSERT WITH CHECK (true)` | вставка подій | анонімна телеметрія без прив'язки до акаунта; політик на читання/видалення немає |

> ⚠ **Ключовий факт: у `scores` немає політики на запис.** PostgREST не надає прямих CRUD-операцій, якщо RLS їх не дозволяє — звичайний `INSERT INTO scores ...` з консолі браузера завершиться помилкою `42501 new row violates row-level security policy`.

---

## 4. Функція `submit_score`

Єдиний легальний шлях запису в `scores`. Визначена у `supabase/schema.sql`.

**Сигнатура:**

```sql
public.submit_score(
    p_player    text,
    p_score     bigint,
    p_mode      text,
    p_level     int,
    p_combo     int,
    p_device_id text,
    p_duration  numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
```

**Що саме валідує (порядок перевірок):**

1. **Нік** — `translate()` витягує HTML-небезпечні символи `< > & " ' \` \\`, обрізання до 24 символів; якщо нік порожній — підставляється `'Пилот'`. Захист від stored-XSS (нік рендериться іншим гравцям).
2. **Режим** — білий список: `endless, daily, campaign, timeattack, survival, custom`. Все інше → `'endless'`.
3. **Границі очок** — `score NOT NULL`, `1 ≤ score < 100000000`, інакше `RAISE EXCEPTION 'score_out_of_range'`.
4. **Границі комбо** — якщо задано: `0 ≤ combo ≤ 100000`, інакше `'combo_out_of_range'`.
5. **Границі рівня** — якщо задано: `1 ≤ level ≤ 9999`, інакше `'level_out_of_range'`.
6. **Правдоподібність темпу** — потолок `max(2000, ceil(duration * 3000))` очок. Тобто темп ~3000 очк/с — це «величезний запас» над честним темпом (десятки-сотні очок/с), який відсікає телепорт «99999999 за 3 секунди». Порушення → `'score_implausible'`.
7. **Анти-спам** — не більше **6 результатів за 60 секунд** з одного `device_id` (рахується через `SELECT count(*) FROM scores WHERE device_id = ... AND created_at > now() - interval '60 seconds'`). Перевищення → `'rate_limited'`.

**`SECURITY DEFINER` + фіксований `search_path`:**

- `SECURITY DEFINER` — функція виконується з правами власника (роль, що має права на `scores`), а не викликаючого anon. Без цього anon не зміг би вставити рядок через RLS-заборону.
- `SET search_path = public` — захист від атаки через підміну об'єктів (search_path injection). Умова є обов'язковою для `SECURITY DEFINER`-функцій.
- `REVOKE ALL ... FROM public` + `GRANT EXECUTE ... TO anon, authenticated` — явне обмеження виконання ролями гри.

**Права доступу до функції:**

```sql
revoke all on function public.submit_score(...) from public;
grant execute on function public.submit_score(...) to anon, authenticated;
```

---

## 5. Клієнтські потоки

### 5.1 Синхронізація прогресу (`core/cloud_storage.js`)

- SDK (`@supabase/supabase-js` UMD v2) завантажується динамічно з CDN (`cdn.jsdelivr.net`) — гра не ламається без мережі або заблокованого сховища.
- `device_id` генерується локально (`dev_<timestamp>_<random>`, зберігається у SafeStorage — fallback у пам'ять, якщо localStorage заблоковано).
- **Pull на старті** (`init()`): `SELECT data FROM user_progress WHERE device_id = ...` → `maybeSingle()` → передача в `State.mergeRemote(remote)` — злиття «тільки вгору» (зірки/рекорди/досягнення не відкочуються до старих значень).
- **Push після забігу** (`pushProgress()`): `UPSERT` об'єкта `{ device_id, data: State.data, updated_at: now() }`.
- При події `online` — послідовний `pullFromCloud().then(pushProgress)`: спочатку злиття, потім відправка, щоб не відкотити свіжий локальний прогрес старим хмарним.
- `getClient()` віддає спільний клієнт іншим модулям (GlobalScores, Analytics).

### 5.2 Відправка результату (`core/global_scores.js`)

- `submit(entry)` — fire-and-forget RPC: `client.rpc('submit_score', params)`.
- Параметри готуються на клієнті: нік чиститься від HTML-символів та обрізається до 24 символів, `score` клампиться до `[1, 99999999]`, `mode` — до 16 символів, `duration` — у секунди (потрібен для перевірки правдоподібності).
- `top(mode, limit)` — `SELECT player, score, mode, level, created_at ... ORDER BY score DESC LIMIT min(50, max(1, limit))` з опційним фільтром по `mode`.
- Graceful: без клієнта або таблиці повертає `false`/`null` і ніколи не кидає в UI.

### 5.3 Телеметрія (`core/analytics.js`)

- Черга подій (максимум 50), `anon_id` генерується локально (`an_<random>`) і зберігається у SafeStorage.
- **Батч-флеш** кожні **15 секунд** через SDK: `INSERT` одним масивом.
- **Keepalive-бікон** при закритті/згортанні вкладки: `visibilitychange` → `hidden` та `beforeunload` викликають `_beaconFlush()`, який шле `fetch(url, { keepalive: true })` напряму в REST API (заголовки `apikey`, `Authorization: Bearer <key>`, `Prefer: return=minimal`). Звичайний SDK-запит не переживає `unload`, тому використовується окремий raw fetch.
- Вимикається налаштуванням `State.settings.analytics = false`.

---

## 6. Встановлення

1. Виконайте в Supabase → **SQL Editor** вміст [`supabase/schema.sql`](supabase/schema.sql). Скрипт **ідемпотентний** (IF NOT EXISTS, drop policy if exists) — можна запускати повторно.
2. Скопіюйте з Settings → API:
   - `Project URL` → плейсхолдер `<SUPABASE_URL>`;
   - **anon / publishable** ключ (НЕ `service_role`!) → плейсхолдер `<SUPABASE_ANON_KEY>`.
3. Вставте в [`index.html`](index.html) у блок:

```html
<script>
    window.NGR_CLOUD_CONFIG = {
        supabaseUrl: '<SUPABASE_URL>',
        supabaseKey: '<SUPABASE_ANON_KEY>'
    };
</script>
```

Якщо блок порожній або відсутній — гра працює суто локально, хмарні функції не активуються.

---

## 7. Модель безпеки та ОБМЕЖЕННЯ

### Що реально захищено

- **Прямий `INSERT` у `scores` неможливий** — немає RLS-політики на запис, PostgREST не надає CRUD без політики.
- Усі результати валідуються на сервері (межі, білий список режимів, санитизація ніка, правдоподібність темпу, частота).
- `SECURITY DEFINER` + фіксований `search_path` — коректний патерн для Postgres.

### Чому це не повний анти-чит

- **Клієнт усе ще надсилає свої очки** — гра на чистому JS і гравець контролює клієнтський код. Анулі скрипт може дати собі «1000 очок за хвилину» — це вкладається в темп (1000 очк/хв ≈ 17 очк/с) і сервер його прийме. Захист від накрутки «99 млн», але не від м'якого читерства.
- **`user_progress` відкритий на запис для всіх** (`WITH CHECK (true)`) — будь-який може перезаписати прогрес будь-якого `device_id` (відомий декільком). Для гри це свідомий компроміс (прогрес не містить секретів).
- **`analytics_events` відкритий на вставку** — боти можуть засмітити телеметрію.
- Немає політик на видалення; чистити дані можна з дашборду або SQL.

### Що дало б повний анти-чит

- **Supabase Auth** — кожен результат прив'язується до `auth.uid()`, замість самозгенерованого `device_id`.
- **Edge Function / серверний підрахунок** — клієнт надсилає сирі події забігу (або нічого), сервер сам рахує очки та пише в `scores`. Тоді підробка результату вимагає злому сервера, а не JS.

---

## 8. Перевірка вручну (curl)

Замініть `<SUPABASE_URL>` та `<SUPABASE_ANON_KEY>` на реальні значення з налаштувань проєкту.

### 8.1 Валідний виклик RPC (очки в межах темпу)

```bash
curl -X POST '<SUPABASE_URL>/rest/v1/rpc/submit_score' \
  -H 'apikey: <SUPABASE_ANON_KEY>' \
  -H 'Authorization: Bearer <SUPABASE_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{
    "p_player": "Pilot",
    "p_score": 1500,
    "p_mode": "endless",
    "p_level": 5,
    "p_combo": 12,
    "p_device_id": "dev_manual_test_001",
    "p_duration": 30
  }'
```

Очікувана відповідь: `[true]` або `[{"ok": true}]` (PostgREST повертає JSON-масив).

### 8.2 Неправдоподібний результат (має бути відхилено)

```bash
curl -X POST '<SUPABASE_URL>/rest/v1/rpc/submit_score' \
  -H 'apikey: <SUPABASE_ANON_KEY>' \
  -H 'Authorization: Bearer <SUPABASE_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{
    "p_player": "Cheater",
    "p_score": 99999999,
    "p_mode": "endless",
    "p_level": null,
    "p_combo": 0,
    "p_device_id": "dev_manual_test_002",
    "p_duration": 3
  }'
```

Очікувана відповідь: `{"code": "P0001", "message": "score_implausible"}`.

### 8.3 Прямий INSERT в `scores` (має бути відхилено RLS)

```bash
curl -X POST '<SUPABASE_URL>/rest/v1/scores' \
  -H 'apikey: <SUPABASE_ANON_KEY>' \
  -H 'Authorization: Bearer <SUPABASE_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -H 'Prefer: return=minimal' \
  -d '{"player":"Hacker","score":99999999,"mode":"endless","combo":9999}'
```

Очікувана відповідь: `42501 new row violates row-level security policy for table "scores"` (HTTP 403/401 залежно від версії PostgREST).

### 8.4 Читання топу (має працювати для всіх)

```bash
curl '<SUPABASE_URL>/rest/v1/scores?select=player,score,mode,level,created_at&order=score.desc&limit=10' \
  -H 'apikey: <SUPABASE_ANON_KEY>' \
  -H 'Authorization: Bearer <SUPABASE_ANON_KEY>'
```

---

## 9. Troubleshooting

| Помилка / симптом | Причина | Вирішення |
|---|---|---|
| `function submit_score(...) does not exist` / «потрібна SQL-міграція submit_score» | Схема ще не застосована в проєкті | Виконати `supabase/schema.sql` у SQL Editor |
| `relation "public.scores" does not exist` / «потрібна SQL-міграція таблиці scores» | Схема не застосована | Виконати `supabase/schema.sql` |
| `relation "public.analytics_events" does not exist` | Схема не застосована | Виконати `supabase/schema.sql` |
| `42501 new row violates row-level security policy` при `submit` | Кліент намагається прямий `INSERT` (наприклад, старий код) | Використовувати лише RPC `submit_score` |
| `score_out_of_range` | `score < 100000000` або `NULL`/від'ємне | Перевірити межі: `1 ≤ score < 100000000` |
| `combo_out_of_range` / `level_out_of_range` | Комбо поза `[0, 100000]` або рівень поза `[1, 9999]` | Підготувати параметри клієнтом відповідно до меж |
| `score_implausible` | `score > max(2000, duration * 3000)` | Чесний темп не має перевищувати ~3000 очк/с; перевірити `duration` |
| `rate_limited` | > 6 результатів за 60 с з одного `device_id` | Зачекати 60 с або змінити `device_id` (не рекомендовано) |
| Події не потрапляють у `analytics_events` | Невірний формат батчу / помилка мережі | Перевірити чергу в консолі; батч має бути масивом об'єктів з полями `anon_id, event, props, ts` |
| Прогрес не синхронізується | `NGR_CLOUD_CONFIG` порожній, мережа недоступна, SDK не завантажився | Перевірити конфіг у `index.html`, статус онлайн, наявність `window.supabase` |
