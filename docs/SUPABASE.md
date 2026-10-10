# Серверна частина (Supabase / Postgres) — Neon Gravity Runner

Документ описує реальну схему БД, політики безпеки, серверну функцію та клієнтські потоки, що існують у коді проєкту. Усі ключі замінені на плейсхолдери — реальні секрети не публікуються.

> **Фаза 1 (A5-lite):** проєкт перейшов на серверну архітектуру з anonymous auth, Edge Function `verify-run` та розширеною аналітикою. Деталі — у відповідних розділах нижче.

---

## 1. Призначення та загальна схема

Гра опційно інтегрується з [Supabase](https://supabase.com) (Postgres + REST/PostgREST + Edge Functions + Auth). Хмара вмикається, лише якщо в `index.html` задано `window.NGR_CLOUD_CONFIG`; інакше все працює суто локально.

Три таблиці:

| Таблиця | Призначення |
|---|---|
| `user_progress` | Хмарна синхронізація прогресу. Підтримує два режими: **переходний** (один рядок на пристрій, `device_id` як PK) та **auth** (один рядок на користувача, `user_id` як PK). Pull на старті, push після кожного забігу, злиття «тільки вгору». |
| `scores` | Світовий лідерборд. **Запис тільки через функцію `submit_score`** — прямого `INSERT` для anon не існує. Читання топу вільне. |
| `analytics_events` | Телеметрія сесій (батчі подій). Підтримує два режими: **переходний** (сирий `anon_id`, без прив'язки до користувача) та **auth** (`user_id` для опознаних користувачів). |

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
| `user_id` | `uuid` | nullable, `REFERENCES auth.users(id)` — прив'язка до anonymous-користувача (Фаза 1) |

### 2.4 Ідентичність та перехідний режим (Фаза 1)

Гра підтримує два режими ідентичності, які можуть працювати одночасно:

| Режим | Ключ | Політики | Коли використовується |
|---|---|---|---|
| **Auth** (нова) | `user_id` (uuid) | `"user progress own"` (user_progress), `analytics_insert_own` (analytics) | Коли в проєкті включено **Anonymous sign-ins** (Supabase → Authentication → Sign In / Providers → Anonymous) |
| **Перехідний** (старий) | `device_id` (text) | `"anon device progress"` (user_progress), `analytics_insert` (analytics) | Коли anonymous sign-in **вимкнений** або ще не активний |

**Клієнтська логіка (`core/cloud_storage.js`):**

- При старті гра перевіряє наявність сесії. Якщо її немає — викликає `supabase.auth.signInAnonymously()`. Це створює анонімного користувача в Supabase Auth, і його `user_id` зберігається локально.
- Якщо anonymous sign-in **вимкнений** у налаштуваннях проєкту (або запит завершився помилкою `anonymous_provider_disabled`), гра **тихо падає на перехідний режим** — працє зі схемою по `device_id`, як раніше. Гравець не помічає різниці.
- Після успішного anonymous sign-in гра може викликати `claim_device_progress(p_device_id)` — одноразову функцію, яка переносить невипокуплений прогрес із перехідного режиму в auth-режим (деталі — у розділі 2.4).

**Функція `claim_device_progress` (SECURITY DEFINER):**

```sql
public.claim_device_progress(p_device_id text) returns jsonb
language plpgsql
security definer
set search_path = public
```

- Доступна **тільки ролі `authenticated`** (анонімні користувачі не можуть нічого випустити).
- Шукає рядок у `user_progress` за `device_id` і повертає його `data` (jsonb).
- Якщо рядок знайдено — він видаляється з перехідної таблиці (щоб уникнути дублювання).
- Призначення: гравець, який грав до включення auth, не втрачає прогрес після активації anonymous sign-in.

---

## 3. RLS-політики

RLS (Row Level Security) увімкнено на **всіх** таблицях. Політики:

| Таблиця | Політика | Роль | Дозволено | Чому |
|---|---|---|---|---|
| `user_progress` | `anon device progress` — `FOR ALL USING (true) WITH CHECK (true)` | anon | будь-який читання/вставка/оновлення | **Перехідний режим:** прогрес не містить секретів; ключ один на пристрій (`device_id`) і генерується локально |
| `user_progress` | `user progress own` — `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` | authenticated | читання/вставка/оновлення **тільки свого рядка** | **Auth-режим:** кожен користувач бачить і змінює лише свій прогрес |
| `scores` | `scores_read` — `FOR SELECT USING (true)` | anon, authenticated | читання топу | лідерборд публічний |
| `scores` | — **політики на INSERT/UPDATE/DELETE НЕМАД** | — | ❌ **прямого INSERT немає** | запис лише через `submit_score` (SECURITY DEFINER) |
| `analytics_events` | `analytics_insert` — `FOR INSERT WITH CHECK (true)` | anon | вставка подій | **Перехідний режим:** анонімна телеметрія без прив'язки до акаунта |
| `analytics_events` | `analytics_insert_own` — `FOR INSERT WITH CHECK (auth.uid() = user_id)` | authenticated | вставка подій **тільки з своїм `user_id`** | **Auth-режим:** події прив'язуються до користувача |

> ⚠ **Ключовий факт: у `scores` немає політики на запис.** PostgREST не надає прямих CRUD-операцій, якщо RLS їх не дозволяє — звичайний `INSERT INTO scores ...` з консолі браузера завершиться помилкою `42501 new row violates row-level security policy`.

### 3.1 Тригер `analytics_rate_limit` (Фаза 1)

Для захисту від спаму в аналітиці додано тригер `analytics_rate_limit`:

- **Ліміт:** не більше **120 подій за 60 секунд** на одного користувача.
- **Auth-режим:** ліміт рахується по `user_id`.
- **Перехідний режим:** ліміт рахується по `anon_id`.
- Якщо ліміт перевищено — вставка відхиляється з помилкою `analytics_rate_limited`.

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

## 5. Edge Function `verify-run` (нова точка запису результату)

**Эндпоинт:** `POST <SUPABASE_URL>/functions/v1/verify-run`

Це нова серверна точка запису результатів забігу, яка замінює прямий виклик `submit_score` для нових клієнтів. Функція виконується на платформі Supabase Edge Functions (Deno) і працює з базою даних від імені `service_role` (обхід RLS).

### 5.1 Чому `verify_jwt = false`?

Функція налаштована з `verify_jwt = false`, тобто Supabase автоматично не перевіряє JWT перед викликом. Це **свідомий компроміс**:

- У перехідний период клієнт може надсилати результати **без пользовательской сесії** (коли anonymous sign-in еще не активний или вимкнений).
- Функція самостійно перевіряє JWT через `auth.getUser(token)` (якщо токен передан) і витягує `user_id`.
- Навіть без JWT функія валидиє дані, перевіряє ліміти частоти та відхиляє неправдоподібні результати.

### 5.2 Payload

```json
{
  "seed": "abc123",
  "mode": "endless",
  "level": 5,
  "duration": 120,
  "score": 15000,
  "combo": 45,
  "stars": 3,
  "obstaclesPassed": 120,
  "nearMisses": 8,
  "inputs": ["left", "right", "jump"],
  "player": "Pilot",
  "deviceId": "dev_abc123",
  "clientVersion": "1.2.0"
}
```

| Поле | Тип | Опис |
|---|---|---|
| `seed` | string | Сід генератора рівня (для майбутньої перевірки) |
| `mode` | string | Режим гри (має бути в allowlist) |
| `level` | int | Рівень (1–9999) |
| `duration` | number | Тривалість забігу в секундах (0–7200) |
| `score` | int | Очки (1–99999999) |
| `combo` | int | Максимальне комбо |
| `stars` | int | Кількість зірочок (0–5) |
| `obstaclesPassed` | int | Кількість уникання перешкод |
| `nearMisses` | int | Кількість «майже зіткнень» |
| `inputs` | array | Масив введення гравця (кнопки/дії) |
| `player` | string | Нік гравця (буде від santized) |
| `deviceId` | string | ID пристрою (для переходного режиму) |
| `clientVersion` | string | Версія клієнта |

### 5.3 Що перевіряє функція

**Порядок перевірок:**

1. **Allowlist режимів** — `mode` має бути в списку: `endless, daily, campaign, timeattack, survival, custom`.
2. **Границі тривалості** — `duration` має бути в межах **0–7200 секунд**. Інакше → `duration_out_of_range`.
3. **Границі очок** — `score` має бути в межах **1–99999999**. Інакше → `score_implausible`.
4. **Границі рівня** — `level` має бути в межах **1–9999**. Інакше → `level_out_of_range`.
5. **Правдоподібність темпу** — `score <= 2000 + duration * 3000`. Інакше → `score_implausible`.
6. **Согласованность комбо** — `combo <= obstaclesPassed + nearMisses + stars + 5`. Інакше → `combo_inconsistent`.
7. **Ліміт зірок** — `stars` має бути в межах **0–5**. Інакше → `stars_implausible`.
8. **Ліміт перешкод** — `obstaclesPassed` має бути в межах **0–10000**. Інакше → `obstacles_implausible`.
9. **Ліміт введення** — кількість елементів в `inputs` має бути в межах **0–5000**. Інакше → `inputs_implausible`.
10. **Rate-limit** — не більше **10 запитів за 60 секунд** на `user_id` (в auth-режимі) або на `device_id` (в перехідному режимі). Інакше → `rate_limited`.
11. **Наявність ідентичності** — якщо немає ні `user_id`, ні `device_id` → `no_identity`.

### 5.4 Відповіді

**Успіх (200):**

```json
{
  "ok": true,
  "id": 12345,
  "verified": true
}
```

| Поле | Тип | Опис |
|---|---|---|
| `ok` | boolean | Завжди `true` при успіху |
| `id` | int | ID нового рядка в таблиці `scores` |
| `verified` | boolean | `true` якщо результат пройшов перевірки |

**Помилки (400):**

```json
{
  "ok": false,
  "code": "score_implausible",
  "message": "Score exceeds plausible limit for duration"
}
```

| Код помилки | Опис |
|---|---|
| `score_implausible` | Очки перевищують правдоподібний ліміт для даної тривалості |
| `combo_inconsistent` | Комбо не відповідає кількості уникань/майже зіткнень/зірок |
| `duration_out_of_range` | Тривалість поза межами 0–7200 секунд |
| `inputs_implausible` | Занадто багато елементів в масиві `inputs` |
| `stars_implausible` | Кількість зірок поза межами 0–5 |
| `obstacles_implausible` | Кількість перешкод поза межами 0–10000 |
| `level_out_of_range` | Рівень поза межами 1–9999 |
| `no_identity` | Не передано ні `user_id`, ні `device_id` |

**Rate-limit (429):**

```json
{
  "ok": false,
  "code": "rate_limited",
  "message": "Too many requests"
}
```

### 5.5 Приклад curl

```bash
curl -X POST '<SUPABASE_URL>/functions/v1/verify-run' \
  -H 'apikey: <SUPABASE_ANON_KEY>' \
  -H 'Authorization: Bearer <SUPABASE_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{
    "seed": "abc123",
    "mode": "endless",
    "level": 5,
    "duration": 120,
    "score": 15000,
    "combo": 45,
    "stars": 3,
    "obstaclesPassed": 120,
    "nearMisses": 8,
    "inputs": ["left", "right", "jump"],
    "player": "Pilot",
    "deviceId": "dev_abc123",
    "clientVersion": "1.2.0"
  }'
```

**Очікувана відповідь:**

```json
{"ok": true, "id": 12345, "verified": true}
```

---

## 6. Клієнтські потоки

### 6.1 Синхронізація прогресу (`core/cloud_storage.js`)

- SDK (`@supabase/supabase-js` UMD v2) завантажується динамічно з CDN (`cdn.jsdelivr.net`) — гра не ламається без мережі або заблокованого сховища.
- `device_id` генерується локально (`dev_<timestamp>_<random>`, зберігається у SafeStorage — fallback у пам'ять, якщо localStorage заблоковано).
- **Pull на старті** (`init()`): `SELECT data FROM user_progress WHERE device_id = ...` → `maybeSingle()` → передача в `State.mergeRemote(remote)` — злиття «тільки вгору» (зірки/рекорди/досягнення не відкочуються до старих значень).
- **Push після забігу** (`pushProgress()`): `UPSERT` об'єкта `{ device_id, data: State.data, updated_at: now() }`.
- При події `online` — послідовний `pullFromCloud().then(pushProgress)`: спочатку злиття, потім відправка, щоб не відкотити свіжий локальний прогрес старим хмарним.
- `getClient()` віддає спільний клієнт іншим модулям (GlobalScores, Analytics).

### 6.2 Відправка результату (`core/global_scores.js`)

- `submit(entry)` — fire-and-forget RPC: `client.rpc('submit_score', params)`.
- Параметри готуються на клієнті: нік чиститься від HTML-символів та обрізається до 24 символів, `score` клампиться до `[1, 99999999]`, `mode` — до 16 символів, `duration` — у секунди (потрібен для перевірки правдоподібності).
- `top(mode, limit)` — `SELECT player, score, mode, level, created_at ... ORDER BY score DESC LIMIT min(50, max(1, limit))` з опційним фільтром по `mode`.
- Graceful: без клієнта або таблиці повертає `false`/`null` і ніколи не кидає в UI.

### 6.3 Телеметрія (`core/analytics.js`)

- Черга подій (максимум 50), `anon_id` генерується локально (`an_<random>`) і зберігається у SafeStorage.
- **Батч-флеш** кожні **15 секунд** через SDK: `INSERT` одним масивом.
- **Keepalive-бікон** при закритті/згортанні вкладки: `visibilitychange` → `hidden` та `beforeunload` викликають `_beaconFlush()`, який шле `fetch(url, { keepalive: true })` напряму в REST API (заголовки `apikey`, `Authorization: Bearer <key>`, `Prefer: return=minimal`). Звичайний SDK-запит не переживає `unload`, тому використовується окремий raw fetch.
- Вимикається налаштуванням `State.settings.analytics = false`.

---

## 7. Встановлення

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

4. **Увімкніть Anonymous sign-ins** (Фаза 1):
   - Supabase Dashboard → **Authentication** → **Sign In / Providers**;
   - Знайдіть секцію **Anonymous** і увімкніть перемикач;
   - Збережіть налаштування.
5. **Разгорніть Edge Function `verify-run`**:
   - Supabase Dashboard → **Edge Functions** → **Create Function**;
   - Назва: `verify-run`;
   - Завантажте код функції (файл знаходиться в `supabase/functions/verify-run/index.ts`);
   - Увімкніть `verify_jwt = false` (функція самостійно перевіряє JWT через `auth.getUser`);
   - Разгорніть функцію.

Якщо блок порожній або відсутній — гра працює суто локально, хмарні функції не активуються.

---

## 8. Модель безпеки та ОБМЕЖЕННЯ

### Що дає A5-lite (Фаза 1)

- **Серверна перевірка правдоподібності** — Edge Function `verify-run` перевіряє межі, темп, согласованность комбо та ліміти на сервері, а не на клієнті.
- **Прив'язка до користувача** — результати можуть зберігатися з `user_id` (через anonymous auth), що дозволяє розрізнити гравців навіть без явного логіну.
- **Ліміти частоти** — 10 запитів/хв на користувача (або пристрій в переходному режимі), 120 подій/хв в аналітиці.
- **Автоматичне визначення переходного режиму** — якщо anonymous sign-in недоступний, гра тихо падає на схему по `device_id`.

### Чого НЕ дає A5-lite

- **Це не детермінована переигра забігу** — функція не перевіряє чи дійсно гравець пройшов рівень з таким seed, а лише перевіряє правдоподібність результату. Це буде реалізовано в наступному плані (Фаза 2).
- **Клієнт усе ще контролює дані** — гравець може модифікувати JS і надіслати будь-які дані, які проходять перевірки правдоподібності. A5-lite відсікає явне читерство (накрутка мільйонів очок за секунду), але не захищає від м'якого читерства (підправлення результату в межах допустимого темпу).
- **`user_progress` у перехідному режимі залишається відкритим** — прогрес по `device_id` все ще може бути перезаписаний будь-яким. У auth-режимі це вирішується політикою `user progress own`.
- **`analytics_events` у перехідному режимі залишається відкритим** — боти можуть засмітити телеметрію, хоча тригер `analytics_rate_limit` обмежує частоту.

---

## 9. Перевірка вручну (curl)

Замініть `<SUPABASE_URL>` та `<SUPABASE_ANON_KEY>` на реальні значення з налаштувань проєкту.

### 9.1 Валідний виклик RPC (очки в межах темпу)

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

### 9.2 Неправдоподібний результат (має бути відхилено)

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

### 9.3 Прямий INSERT в `scores` (має бути відхилено RLS)

```bash
curl -X POST '<SUPABASE_URL>/rest/v1/scores' \
  -H 'apikey: <SUPABASE_ANON_KEY>' \
  -H 'Authorization: Bearer <SUPABASE_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -H 'Prefer: return=minimal' \
  -d '{"player":"Hacker","score":99999999,"mode":"endless","combo":9999}'
```

Очікувана відповідь: `42501 new row violates row-level security policy for table "scores"` (HTTP 403/401 залежно від версії PostgREST).

### 9.4 Читання топу (має працювати для всіх)

```bash
curl '<SUPABASE_URL>/rest/v1/scores?select=player,score,mode,level,created_at&order=score.desc&limit=10' \
  -H 'apikey: <SUPABASE_ANON_KEY>' \
  -H 'Authorization: Bearer <SUPABASE_ANON_KEY>'
```

---

## 10. Troubleshooting

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
| `anonymous_provider_disabled` | Провайдер anonymous sign-in вимкнений у налаштуваннях проєкту | Увімкнути його в Supabase → Authentication → Sign In / Providers → Anonymous. До цього гра працює в перехідному режимі (по `device_id`) |
| `analytics_rate_limited` | Перевищено ліміт 120 подій/хв на користувача (або `anon_id` в перехідному режимі) | Зачекати 60 с перед наступною спробою. Перевірити, чи не зациклений клієнтський флешер |
| `rate_limited` (в `verify-run`) | Перевищено ліміт 10 запитів/хв на `user_id` або `device_id` | Зачекати 60 с перед наступною спробою. Перевірити, чи не дублюються виклики |
| `verified: false` у відповіді `verify-run` | JWT не опознаний (перехідний режим) — результат збережено без `user_id` | Це не помилка: означає що працює перехідний режим. Для повної функціональності увімкніть anonymous sign-in |
