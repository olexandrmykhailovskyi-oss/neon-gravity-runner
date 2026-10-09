# Changelog

Усі помітні зміни **Neon Gravity Runner**.
Формат — [Keep a Changelog](https://keepachangelog.com/uk/1.1.0/), версіонування — [SemVer](https://semver.org/lang/uk/).

## [Unreleased]

### Added
- E2E-тести на Playwright (`e2e/`, `playwright.config.js`) та окрема джоба в CI; власний статичний сервер для тестів без залежностей.
- `docs/ARCHITECTURE.md` — карта модулів, порядок завантаження скриптів, ігровий цикл, точки розширення.
- `docs/SUPABASE.md` — таблиці, RLS, розбір `submit_score`, приклади перевірки через REST.
- JSDoc на публічних API (`State`, `Game`, `Obstacles`, `Editor`, `GlobalScores`) + `jsconfig.json` для IntelliSense.
- GIF-демо геймплею в README (`docs/media/demo.gif`) і скрипт запису `scripts/record-demo.mjs` (`npm run demo:record`).

### Changed
- ESLint-конфіг покриває `e2e/`, `playwright.config.js` і `scripts/` (Node + browser globals).
- README: посилання на docs, оновлене дерево проєкту.

## [1.1.0] — 2026-10-08

### Added
- Демо-медіа та галерея скриншотів у README, кнопка «Грати онлайн».
- `og:image` (1200×630) і `twitter:large_image` — коректні прев'ю при шерингі посилання.
- Таймер виживання в HUD для нескінченного режиму.
- `CHANGELOG.md` та файл-джерело `docs/media/og-card.html`.

### Security
- **Захищений світовий лідерборд**: прямий `INSERT` у `scores` для anon заборонено (RLS лишає тільки `SELECT`); запис іде через функцію `submit_score` (`SECURITY DEFINER`) з перевіркою меж очок/комбо/рівня, режиму, ніка та частоти (≤6/хв з пристрою).
- Екранування користувацьких і хмарних даних перед `innerHTML`; санітизація рекордів та ніків.
- Валідація секцій імпортованого й злитого стану.

### Changed
- `SafeStorage` замість прямого `localStorage` (не падає, коли сховище заблоковано).
- Телеметрія відправляється `keepalive`-біконом при закритті вкладки; хмара робить pull перед push.
- Service Worker прекешує всі файли — надійний офлайн з першого візиту.
- Коректний фон на HiDPI; детермінований RNG для Daily; чесніший хітбокс шипів; sweep-колізія лазерів.
- Тосты з `aria-live` для скрін-рідерів; прибрано застарілий meta-warning.

## [1.0.0] — 2026-08-24

Перший публічний реліз.

### Added
- 35 рівнів кампанії з оцінкою у 1–3 зірки.
- Режими: Endless, Daily Challenge (фіксований сід), Time Attack, Survival, Zen.
- 8 типів перешкод, 8 бонусів, Neon Storm, комбо та near-miss.
- Редактор рівнів із шаринг-кодами `NGRL1`.
- Світовий і локальний лідерборди; хмарна синхронізація прогресу (Supabase).
- PWA: встановлення та офлайн-режим.
- Три мови інтерфейсу (uk/ru/en), 8 скінів, 6 тем, налаштування доступності.
