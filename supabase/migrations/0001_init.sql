-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — initial schema
-- ============================================================================
-- Safe to run once against a fresh Supabase project (SQL Editor, or
-- `supabase db push` / `supabase migration up` with the CLI). Every
-- statement is idempotent (IF NOT EXISTS / OR REPLACE / DROP POLICY IF
-- EXISTS) so re-running this file is harmless, but it is NOT written to
-- migrate or preserve data from an existing production schema — review
-- before running against a database that already holds real data.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. TEAMS
-- ============================================================================
-- id is a readable slug (e.g. 'real-madrid') rather than a uuid: it is the
-- exact value already used throughout the frontend (team <select> options,
-- TeamBadge lookups), so keeping it as the primary key avoids an extra
-- id-translation layer between the UI and the database.
--
-- primary_color / secondary_color back the crest-placeholder badge the UI
-- already renders whenever a real crest image isn't available yet (see
-- `logo`) — an addition beyond the four columns requested, kept so the
-- current approved visual design doesn't regress.
create table if not exists public.teams (
  id              text primary key,
  name            text not null,
  short_name      text not null,
  country         text,
  logo            text,
  primary_color   text not null default '#0B1E3D',
  secondary_color text not null default '#1D4FD7',
  created_at      timestamptz not null default now()
);

-- ============================================================================
-- 2. PLAYERS
-- ============================================================================
-- id is a 1:1 reference to auth.users(id) — there is no password column
-- here on purpose. Authentication (and the password itself) is entirely
-- owned by Supabase Auth; this table only holds the public profile Supabase
-- Auth doesn't: display name, admin flag, cached point total.
create table if not exists public.players (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  is_admin   boolean not null default false,
  points     integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_players_points on public.players (points desc);

-- ============================================================================
-- 3. MATCHES
-- ============================================================================
-- Status (UPCOMING / LIVE / FINISHED) is deliberately NOT a stored column.
-- It is fully determined by `start_time` + `finished`, and the frontend
-- already derives it that way (utils/matchState.js) — storing it separately
-- would just be a second source of truth that can drift out of sync with
-- the two real facts. See the `matches_with_status` view below for a
-- server-side equivalent, useful for ad-hoc SQL/reporting.
create table if not exists public.matches (
  id                uuid primary key default gen_random_uuid(),
  home_team_id      text not null references public.teams (id),
  away_team_id      text not null references public.teams (id),
  start_time        timestamptz not null,
  finished          boolean not null default false,
  final_home_score  smallint,
  final_away_score  smallint,
  created_at        timestamptz not null default now(),
  constraint matches_teams_differ check (home_team_id <> away_team_id),
  constraint matches_scores_present_iff_finished check (
    (finished = false and final_home_score is null and final_away_score is null)
    or (finished = true and final_home_score is not null and final_away_score is not null)
  ),
  constraint matches_scores_non_negative check (
    (final_home_score is null or final_home_score >= 0)
    and (final_away_score is null or final_away_score >= 0)
  )
);

create index if not exists idx_matches_start_time on public.matches (start_time);
create index if not exists idx_matches_finished on public.matches (finished);

create or replace view public.matches_with_status as
select
  m.*,
  case
    when m.finished then 'FINISHED'
    when m.start_time <= now() then 'LIVE'
    else 'UPCOMING'
  end as status
from public.matches m;

-- ============================================================================
-- 4. PREDICTIONS
-- ============================================================================
create table if not exists public.predictions (
  id                    uuid primary key default gen_random_uuid(),
  player_id             uuid not null references public.players (id) on delete cascade,
  match_id              uuid not null references public.matches (id) on delete cascade,
  predicted_home_score  smallint not null,
  predicted_away_score  smallint not null,
  points                smallint,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint predictions_unique_per_player_match unique (player_id, match_id),
  constraint predictions_scores_non_negative check (
    predicted_home_score >= 0 and predicted_away_score >= 0
  ),
  constraint predictions_points_valid check (points is null or points in (0, 1, 3))
);

create index if not exists idx_predictions_match on public.predictions (match_id);
create index if not exists idx_predictions_player on public.predictions (player_id);

-- ============================================================================
-- 5. CHAT MESSAGES
-- ============================================================================
-- Global chat — intentionally has no match_id. Player display name is
-- joined from `players` at read time rather than duplicated here.
create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  message    text not null check (char_length(btrim(message)) > 0 and char_length(message) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_created_at on public.chat_messages (created_at);

-- ============================================================================
-- 6. NEW-USER TRIGGER
-- ============================================================================
-- Every Supabase Auth user needs a matching `players` profile row. Rather
-- than trusting the client to create one (which would mean trusting the
-- client with its own is_admin flag), a SECURITY DEFINER trigger creates it
-- server-side the moment the auth user is created. Set the display name
-- (and, for the one admin account, is_admin) via the "User Metadata" JSON
-- when creating the user in the Supabase dashboard — see the setup notes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.players (id, name, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'is_admin')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 7. SCORING — the single source of truth for points, run server-side
-- ============================================================================
-- calculate_points mirrors src/services/scoringService.js#calculatePoints
-- exactly (3 / 1 / 0). Comparing the *sign* of (home - away) is equivalent
-- to comparing HOME/AWAY/DRAW outcome, including the "any draw vs any draw"
-- case: sign(0) = 0 for every draw, predicted or actual.
create or replace function public.calculate_points(
  p_predicted_home smallint,
  p_predicted_away smallint,
  p_final_home smallint,
  p_final_away smallint
)
returns smallint
language sql
immutable
as $$
  select case
    when p_predicted_home = p_final_home and p_predicted_away = p_final_away then 3
    when sign(p_predicted_home - p_predicted_away) = sign(p_final_home - p_final_away) then 1
    else 0
  end::smallint
$$;

-- finish_match: the ONLY way `finished`, `final_home_score`,
-- `final_away_score` and `predictions.points` ever change. SECURITY DEFINER
-- so it can write those (grant-restricted, see section 9) columns on the
-- caller's behalf — but only after re-checking admin status itself, so
-- calling it is never enough on its own; you also have to *be* an admin.
create or replace function public.finish_match(
  p_match_id uuid,
  p_final_home_score smallint,
  p_final_away_score smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.players where id = auth.uid() and is_admin) then
    raise exception 'Iba administrátor môže ukončiť zápas.' using errcode = '42501';
  end if;

  if p_final_home_score is null or p_final_away_score is null
     or p_final_home_score < 0 or p_final_away_score < 0 then
    raise exception 'Neplatný výsledok zápasu.' using errcode = '22023';
  end if;

  update public.matches
  set finished = true,
      final_home_score = p_final_home_score,
      final_away_score = p_final_away_score
  where id = p_match_id;

  if not found then
    raise exception 'Zápas sa nenašiel.' using errcode = 'P0002';
  end if;

  update public.predictions
  set points = public.calculate_points(
        predicted_home_score, predicted_away_score, p_final_home_score, p_final_away_score
      ),
      updated_at = now()
  where match_id = p_match_id;

  update public.players pl
  set points = coalesce((
    select sum(pr.points) from public.predictions pr
    where pr.player_id = pl.id and pr.points is not null
  ), 0)
  where pl.id in (select player_id from public.predictions where match_id = p_match_id);
end;
$$;

revoke all on function public.finish_match(uuid, smallint, smallint) from public;
grant execute on function public.finish_match(uuid, smallint, smallint) to authenticated;

-- recalculate_all_points: admin-only maintenance utility (surfaced in the
-- Admin > Nastavenia screen) — re-derives every finished match's points and
-- every player's total from scratch. Useful after correcting a final score
-- via edit; never increments anything, always recomputes.
create or replace function public.recalculate_all_points()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.players where id = auth.uid() and is_admin) then
    raise exception 'Iba administrátor môže prepočítať body.' using errcode = '42501';
  end if;

  update public.predictions p
  set points = public.calculate_points(
        p.predicted_home_score, p.predicted_away_score, m.final_home_score, m.final_away_score
      ),
      updated_at = now()
  from public.matches m
  where p.match_id = m.id and m.finished = true;

  update public.predictions p
  set points = null
  from public.matches m
  where p.match_id = m.id and m.finished = false and p.points is not null;

  update public.players pl
  set points = coalesce((
    select sum(pr.points) from public.predictions pr
    where pr.player_id = pl.id and pr.points is not null
  ), 0);
end;
$$;

revoke all on function public.recalculate_all_points() from public;
grant execute on function public.recalculate_all_points() to authenticated;

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.chat_messages enable row level security;

-- ---- teams: read-only for logged-in users; writes are seed/admin-SQL only.
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select to authenticated using (true);

-- ---- players: everyone can read the public leaderboard/profile columns.
-- No insert/update/delete policy exists for `authenticated` at all, so
-- points/is_admin/name can never be changed by a client request — points
-- only move via finish_match / recalculate_all_points (SECURITY DEFINER,
-- bypasses RLS), and is_admin/name only via the dashboard or direct SQL.
drop policy if exists players_select on public.players;
create policy players_select on public.players for select to authenticated using (true);

-- ---- matches: everyone can read; only admins can write. `finished`,
-- `final_home_score`, `final_away_score` are excluded from the column grant
-- below on purpose — even an admin cannot set them directly, only through
-- finish_match().
drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches for select to authenticated using (true);

drop policy if exists matches_admin_insert on public.matches;
create policy matches_admin_insert on public.matches for insert to authenticated
  with check (exists (select 1 from public.players where id = auth.uid() and is_admin));

drop policy if exists matches_admin_update on public.matches;
create policy matches_admin_update on public.matches for update to authenticated
  using (exists (select 1 from public.players where id = auth.uid() and is_admin))
  with check (exists (select 1 from public.players where id = auth.uid() and is_admin));

drop policy if exists matches_admin_delete on public.matches;
create policy matches_admin_delete on public.matches for delete to authenticated
  using (exists (select 1 from public.players where id = auth.uid() and is_admin));

-- ---- predictions: visible to everyone (Live/History/Admin all show every
-- player's tips), but a player can only create/edit their OWN prediction,
-- and only while the match hasn't kicked off yet. This is enforced here —
-- not just by disabling the input in the UI — so it holds even against a
-- modified/malicious client.
drop policy if exists predictions_select on public.predictions;
create policy predictions_select on public.predictions for select to authenticated using (true);

drop policy if exists predictions_insert_own on public.predictions;
create policy predictions_insert_own on public.predictions for insert to authenticated
  with check (
    player_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.finished = false and m.start_time > now()
    )
  );

drop policy if exists predictions_update_own on public.predictions;
create policy predictions_update_own on public.predictions for update to authenticated
  using (player_id = auth.uid())
  with check (
    player_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.finished = false and m.start_time > now()
    )
  );

-- ---- chat_messages: everyone can read; a player can only post as themselves.
drop policy if exists chat_select on public.chat_messages;
create policy chat_select on public.chat_messages for select to authenticated using (true);

drop policy if exists chat_insert_own on public.chat_messages;
create policy chat_insert_own on public.chat_messages for insert to authenticated
  with check (player_id = auth.uid());

-- ============================================================================
-- 9. TABLE / COLUMN GRANTS
-- ============================================================================
-- RLS decides WHICH ROWS; these grants decide WHICH COLUMNS. In particular:
-- authenticated users get no write grant at all on players (points/is_admin
-- untouchable by clients), no write grant on predictions.points, and no
-- write grant on matches.finished/final_home_score/final_away_score.
grant usage on schema public to authenticated;

grant select on public.teams to authenticated;
grant select on public.players to authenticated;

grant select on public.matches to authenticated;
grant insert (home_team_id, away_team_id, start_time) on public.matches to authenticated;
grant update (home_team_id, away_team_id, start_time) on public.matches to authenticated;
grant delete on public.matches to authenticated;

-- Both INSERT and UPDATE grant the same value columns (including the
-- conflict-target player_id/match_id): the client's save() does a single
-- upsert(), and PostgREST's merge-duplicates resolution re-applies every
-- payload column — including unchanged conflict-key columns — in the DO
-- UPDATE SET clause, not just the "changed" ones. `points` is excluded from
-- both lists (the client payload never includes it either way), and the
-- predictions_update_own / predictions_insert_own RLS policies above are
-- the actual security boundary for player_id, not these column grants — a
-- user still cannot write a row with someone else's player_id because
-- WITH CHECK rejects it regardless of what columns are grantable.
grant select on public.predictions to authenticated;
grant insert (player_id, match_id, predicted_home_score, predicted_away_score, updated_at) on public.predictions to authenticated;
grant update (player_id, match_id, predicted_home_score, predicted_away_score, updated_at) on public.predictions to authenticated;

grant select on public.chat_messages to authenticated;
grant insert (player_id, message) on public.chat_messages to authenticated;

-- ============================================================================
-- 10. REALTIME
-- ============================================================================
-- Chat is the one feature that explicitly asked for live updates. Matches /
-- predictions realtime can be added the same way later if wanted.
-- (ALTER PUBLICATION ... ADD TABLE errors if the table is already a member,
-- so this is guarded to keep the whole migration safely re-runnable.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
