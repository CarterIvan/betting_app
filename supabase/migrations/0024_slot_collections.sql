-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 (PickMates) — Slot club-collecting mini-game
-- ============================================================================
-- Moves the Slot mini-game from localStorage to Supabase, as requested:
-- Supabase becomes the source of truth for both a player's collected clubs
-- and their daily spin count. This is a completely independent system —
-- nothing here is read by, written by, or referenced from predictions,
-- matches, scoring, or the leaderboard. It exists purely so a player's
-- club album (and, via slot_collections' open SELECT policy, everyone
-- else's collecting progress for the "Zberatelia" list) survives across
-- devices instead of living only in one browser's localStorage.
--
-- Two new tables, both intentionally minimal:
--
--   slot_collections — one row per (player, team) a player has ever drawn
--   at least once. `unique (player_id, team_id)` is the actual guarantee
--   against duplicates — a repeat draw of an already-owned club can never
--   produce a second row, by constraint, not just by application logic.
--
--   slot_daily_spins — one row per (player, date), holding how many spins
--   that player has used today. A composite primary key (player_id,
--   spin_date) means "today's row" is always a single, unambiguous
--   upsert target — no separate id column needed. The 3-per-day limit is
--   enforced twice: by spin_slot() below (the real gate) and by a CHECK
--   constraint (spins_used <= 3) as a second, independent backstop against
--   the column ever holding an invalid value by any path.
--
-- ----------------------------------------------------------------------------
-- Why a SECURITY DEFINER RPC (spin_slot()) instead of direct table access
-- ----------------------------------------------------------------------------
-- Neither table grants authenticated INSERT or UPDATE at all — the ONLY
-- way any row is ever created or changed is by calling spin_slot(), which:
--   1. Confirms the caller is authenticated and has_access() (same access
--      gate every other engagement feature in this app already uses).
--   2. Row-locks (`for update`) today's spin-count row for that player,
--      so two concurrent spin requests from the same player can never
--      both slip past the check — the second one waits for the lock,
--      then sees the incremented count.
--   3. Rejects the spin outright once spins_used has reached 3.
--   4. Picks ONE of exactly (current team count + 10) equally likely
--      outcomes: one outcome per row currently in `teams` (each a
--      1-in-total chance), plus 10 separate "no card" outcomes (a
--      combined 10-in-total chance). With the 36 clubs this project
--      currently seeds, that's the requested 46 total outcomes — 36 for
--      a specific club, 10 for nothing — expressed as `team_count + 10`
--      rather than a hardcoded 46, so it stays exactly this proportion
--      if the number of teams ever changes. Both the empty-vs-club coin
--      flip and the specific-club pick use plain `random()` — uniform,
--      unweighted, nothing admin-influenceable, no new column/table for
--      "rarity".
--   5. If the outcome is a club: inserts into slot_collections with
--      `on conflict (player_id, team_id) do nothing` and reads `FOUND`
--      immediately after to know whether that specific insert actually
--      happened — this is exactly how "was this club new" is determined;
--      a repeat draw simply hits the conflict and FOUND is false, no
--      separate lookup needed. If the outcome is "no card": nothing is
--      inserted anywhere — the album is simply left untouched.
--   6. Increments spins_used for today — unconditionally, including for
--      a "no card" outcome, which is a normal, valid spin result, not an
--      error.
--   7. Re-counts this player's total collected clubs (after the possible
--      insert above) and computes just_completed itself, server-side:
--      true only when this exact spin (a) drew a club, (b) that club was
--      new, and (c) the player's collected count now equals the current
--      team count. The client never computes or guesses this.
--   8. Returns the full outcome — team, whether it was empty/new,
--      collected/total counts, just_completed, and spins used/left — as
--      one jsonb value. The client treats every one of these as
--      authoritative and computes none of them itself.
--
-- This is the same SECURITY DEFINER pattern already used everywhere else
-- privileged multi-step logic exists in this project (finish_match(),
-- admin_delete_player(), bootstrap_first_admin()) — nothing new invented.
-- A player can never add a club to their own or anyone else's album, and
-- can never touch their own or anyone else's spin count, except through
-- this one function, which enforces every rule itself, server-side. The
-- whole function is one Postgres call, hence one implicit transaction —
-- if anything inside it raises, nothing it already did (the spin-count
-- upsert, the collection insert) is kept; a "no card" outcome is never an
-- error, so it always commits its spin normally.
--
-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
-- slot_collections: SELECT open to has_access() — same reasoning as
-- chat_read_receipts (migration 0021): everyone needs to see everyone
-- else's collecting progress for the "Zberatelia" list, not just their
-- own row. No INSERT/UPDATE/DELETE grant to authenticated at all.
--
-- slot_daily_spins: SELECT restricted to the caller's own row
-- (player_id = auth.uid()) — nobody else's spin count is anyone else's
-- business. No INSERT/UPDATE/DELETE grant to authenticated at all.
--
-- Realtime is enabled on slot_collections only (same guarded pattern as
-- chat_messages/chat_read_receipts/matches/settings) so the "Zberatelia"
-- list updates live when anyone draws a new club. slot_daily_spins is
-- deliberately NOT added to realtime — nobody but the owning player can
-- even read it, and only that player's own client needs it, from the
-- spin_slot() response it already just received.
--
-- Does not modify, delete, or touch any existing row in any table, and
-- does not change any existing RLS policy. Idempotent / safe to re-run.
-- ============================================================================

create table if not exists public.slot_collections (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players (id) on delete cascade,
  team_id       text not null references public.teams (id),
  collected_at  timestamptz not null default now(),
  unique (player_id, team_id)
);

create index if not exists idx_slot_collections_player_id on public.slot_collections (player_id);

create table if not exists public.slot_daily_spins (
  player_id   uuid not null references public.players (id) on delete cascade,
  spin_date   date not null default current_date,
  spins_used  smallint not null default 0,
  primary key (player_id, spin_date),
  constraint slot_daily_spins_used_range check (spins_used >= 0 and spins_used <= 3)
);

alter table public.slot_collections enable row level security;
alter table public.slot_daily_spins enable row level security;

drop policy if exists slot_collections_select on public.slot_collections;
create policy slot_collections_select on public.slot_collections for select to authenticated
  using (public.has_access());

drop policy if exists slot_daily_spins_select_own on public.slot_daily_spins;
create policy slot_daily_spins_select_own on public.slot_daily_spins for select to authenticated
  using (player_id = auth.uid());

grant select on public.slot_collections to authenticated;
grant select on public.slot_daily_spins to authenticated;

-- ----------------------------------------------------------------------------
-- spin_slot() — the only way a spin ever happens. See the long comment
-- above for the full reasoning behind each step.
-- ----------------------------------------------------------------------------
create or replace function public.spin_slot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id        uuid := auth.uid();
  v_today            date := current_date;
  v_spins_used       smallint;
  v_total_teams      int;
  v_empty_outcomes   constant int := 10;
  v_roll             int;
  v_team_id          text;
  v_is_empty         boolean;
  v_is_new           boolean;
  v_collected_count  int;
  v_just_completed   boolean := false;
begin
  if v_player_id is null or not public.has_access() then
    raise exception 'Nemáš oprávnenie hrať Slot.' using errcode = '42501';
  end if;

  insert into public.slot_daily_spins (player_id, spin_date, spins_used)
  values (v_player_id, v_today, 0)
  on conflict (player_id, spin_date) do nothing;

  select spins_used into v_spins_used
  from public.slot_daily_spins
  where player_id = v_player_id and spin_date = v_today
  for update;

  if v_spins_used >= 3 then
    raise exception 'Dnes už nemáš žiadne spiny. Skús to zajtra.' using errcode = '42501';
  end if;

  select count(*) into v_total_teams from public.teams;

  if v_total_teams = 0 then
    raise exception 'Zoznam klubov je prázdny.' using errcode = 'P0002';
  end if;

  -- One fair roll over exactly (v_total_teams + 10) equally likely
  -- outcomes: the first `v_empty_outcomes` are "no card" (combined
  -- 10-in-total chance), everything after that is "a club" (combined
  -- v_total_teams-in-total chance, i.e. exactly 1-in-total for any one
  -- specific club once picked uniformly among them below).
  v_roll := floor(random() * (v_total_teams + v_empty_outcomes))::int;

  if v_roll < v_empty_outcomes then
    v_is_empty := true;
    v_team_id := null;
    v_is_new := false;
  else
    v_is_empty := false;
    select id into v_team_id from public.teams order by random() limit 1;

    insert into public.slot_collections (player_id, team_id)
    values (v_player_id, v_team_id)
    on conflict (player_id, team_id) do nothing;

    v_is_new := found;
  end if;

  -- A "no card" outcome is a normal, valid result — the spin is still
  -- spent, unconditionally, exactly the same as a club outcome.
  update public.slot_daily_spins
  set spins_used = spins_used + 1
  where player_id = v_player_id and spin_date = v_today;

  select count(*) into v_collected_count
  from public.slot_collections
  where player_id = v_player_id;

  -- Server-computed, never left to the client: true only when this exact
  -- spin drew a NEW club (not empty, not a duplicate) that brings the
  -- player's own collected count up to the current total team count.
  v_just_completed := (not v_is_empty) and v_is_new and v_collected_count = v_total_teams;

  return jsonb_build_object(
    'teamId', v_team_id,
    'isEmpty', v_is_empty,
    'isNew', v_is_new,
    'collectedCount', v_collected_count,
    'totalTeams', v_total_teams,
    'justCompleted', v_just_completed,
    'spinsUsed', v_spins_used + 1,
    'spinsRemaining', 3 - (v_spins_used + 1)
  );
end;
$$;

revoke all on function public.spin_slot() from public;
grant execute on function public.spin_slot() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'slot_collections'
  ) then
    alter publication supabase_realtime add table public.slot_collections;
  end if;
end $$;
