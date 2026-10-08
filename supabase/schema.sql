-- ============================================================================
-- Neon Gravity Runner — схема Supabase (Postgres)
-- ============================================================================
-- Выполните этот файл целиком в Supabase → SQL Editor.
-- Скрипт идемпотентен: его можно запускать повторно без ошибок.
--
-- Что создаётся:
--   1. user_progress      — облачная синхронизация прогресса (по device_id)
--   2. scores             — мировой лидерборд (запись ТОЛЬКО через submit_score)
--   3. analytics_events   — анонимная телеметрия сессий
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Прогресс (облачная синхронизация)
-- ----------------------------------------------------------------------------
create table if not exists public.user_progress (
    device_id  text primary key,
    data       jsonb not null,
    updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

drop policy if exists "anon device progress" on public.user_progress;
create policy "anon device progress" on public.user_progress
    for all using (true) with check (true);


-- ----------------------------------------------------------------------------
-- 2. Мировой лидерборд (защищённый)
-- ----------------------------------------------------------------------------
-- Ключевая идея: у anon НЕТ права прямого INSERT в scores. Клиент не может
-- вставить произвольную строку — он вызывает функцию submit_score, которая
-- сама проверяет данные и пишет от имени владельца (SECURITY DEFINER).
-- Сломать рейтинг одним `insert` из консоли браузера больше нельзя.
-- ----------------------------------------------------------------------------
create table if not exists public.scores (
    id         bigint generated always as identity primary key,
    player     text not null default 'Пилот',
    score      bigint not null check (score >= 0 and score < 100000000),
    mode       text not null default 'endless',
    level      int,
    combo      int not null default 0,
    device_id  text,
    created_at timestamptz not null default now()
);

alter table public.scores enable row level security;

-- Читать топ может кто угодно, писать напрямую — никто.
drop policy if exists "scores_insert" on public.scores;
drop policy if exists "scores_read" on public.scores;
create policy "scores_read" on public.scores
    for select using (true);

-- Валидирующий вход. Проверяет границы, режим, ник, правдоподобность темпа
-- набора очков и частоту отправки с одного устройства.
create or replace function public.submit_score(
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
as $$
declare
    v_player text;
    v_mode   text;
    v_recent int;
    v_cap    bigint;
begin
    -- Ник: вырезаем HTML-опасные символы (ник показывается другим игрокам)
    v_player := left(
        translate(coalesce(p_player, ''),
                  '<>&"' || chr(96) || chr(92) || chr(39), ''),
        24);
    if v_player = '' then
        v_player := 'Пилот';
    end if;

    -- Режим — только из белого списка
    v_mode := case
        when p_mode in ('endless','daily','campaign','timeattack','survival','zen','custom')
        then p_mode
        else 'endless'
    end;

    -- Базовые границы
    if p_score is null or p_score < 1 or p_score >= 100000000 then
        raise exception 'score_out_of_range';
    end if;
    if p_combo is not null and (p_combo < 0 or p_combo > 100000) then
        raise exception 'combo_out_of_range';
    end if;
    if p_level is not null and (p_level < 1 or p_level > 9999) then
        raise exception 'level_out_of_range';
    end if;

    -- Правдоподобность: реальный темп — десятки-сотни очков в секунду,
    -- поэтому потолок 3000 очк/с (с огромным запасом) отсекает телепорт
    -- «99999999 за 3 секунды», но не мешает честной игре.
    v_cap := greatest(2000::bigint, ceil(coalesce(p_duration, 0)::numeric * 3000)::bigint);
    if p_score > v_cap then
        raise exception 'score_implausible';
    end if;

    -- Анти-спам: не более 6 результатов за 60 секунд с одного устройства
    if p_device_id is not null and p_device_id <> '' then
        select count(*) into v_recent
          from public.scores
         where device_id = p_device_id
           and created_at > now() - interval '60 seconds';
        if v_recent >= 6 then
            raise exception 'rate_limited';
        end if;
    end if;

    insert into public.scores (player, score, mode, level, combo, device_id)
    values (
        v_player,
        p_score,
        v_mode,
        p_level,
        greatest(coalesce(p_combo, 0), 0),
        nullif(left(coalesce(p_device_id, ''), 64), '')
    );

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_score(text, bigint, text, int, int, text, numeric) from public;
grant execute on function public.submit_score(text, bigint, text, int, int, text, numeric)
    to anon, authenticated;

-- Индекс под анти-спам и выборки по режиму
create index if not exists scores_mode_score_idx on public.scores (mode, score desc);
create index if not exists scores_device_created_idx on public.scores (device_id, created_at desc);


-- ----------------------------------------------------------------------------
-- 3. Анонимная телеметрия
-- ----------------------------------------------------------------------------
create table if not exists public.analytics_events (
    id      bigint generated always as identity primary key,
    anon_id text not null,
    event   text not null,
    props   jsonb not null default '{}'::jsonb,
    ts      timestamptz not null default now()
);

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_insert" on public.analytics_events;
create policy "analytics_insert" on public.analytics_events
    for insert with check (true);
