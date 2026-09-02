-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — Result Correction Requests
-- ============================================================================
-- Closes the one real gap in the existing "finished results are locked"
-- story: matches.finished/final_home_score/final_away_score were already
-- excluded from the direct UPDATE grant on `matches` (migration 0001) — no
-- client, admin included, could ever touch them with a plain update. But
-- finish_match() is SECURITY DEFINER, so it's exempt from that grant by
-- design, and its body had no guard against being called again on an
-- already-finished match. That was the actual backdoor: any admin could
-- silently re-finish a match at any time (exactly what the Dokončené tab's
-- "Update Result" button — now removed — relied on).
--
-- This migration:
--   1. Factors finish_match()'s "apply score + recalc predictions + recalc
--      players" body out into apply_match_result() — a private helper
--      (no grant to authenticated; only reachable from inside another
--      SECURITY DEFINER function, which runs as the owner regardless of
--      grants). Both finish_match() and an approved correction call this
--      SAME function — there is exactly one scoring code path.
--   2. Replaces finish_match() with a version that rejects outright if the
--      match is already finished. This alone makes every existing
--      finished match locked immediately on deploy — finished already
--      meant "has a result"; this migration is what makes it also mean
--      "can't be silently changed". No data is touched, no backfill, no
--      new column needed for "locked" — finished IS the lock.
--   3. Adds the only legal way to change a finished result: a request +
--      unanimous-vote workflow, in two new tables. Both are append-only in
--      practice (nothing is ever deleted or overwritten by the app) — that
--      makes them the permanent audit trail on their own; no separate
--      history table needed.
--
-- Idempotent / safe to re-run. Does not modify or delete any existing row.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. result_correction_requests — one row per correction request.
-- ----------------------------------------------------------------------------
create table if not exists public.result_correction_requests (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references public.matches (id),
  requested_by      uuid not null references public.players (id),
  old_home_score    smallint not null,
  old_away_score    smallint not null,
  new_home_score    smallint not null,
  new_away_score    smallint not null,
  reason            text not null,
  status            text not null default 'pending',
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  constraint result_correction_requests_status_valid check (status in ('pending', 'approved', 'rejected')),
  constraint result_correction_requests_scores_non_negative check (
    old_home_score >= 0 and old_away_score >= 0 and new_home_score >= 0 and new_away_score >= 0
  ),
  constraint result_correction_requests_scores_differ check (
    old_home_score <> new_home_score or old_away_score <> new_away_score
  ),
  constraint result_correction_requests_reason_present check (length(trim(reason)) > 0)
);

-- The real guard against two simultaneous pending requests for the same
-- match — a partial unique index, not just a friendly pre-check in the
-- RPC. Multiple RESOLVED requests for the same match over time are fine
-- and expected (that's the audit history); only concurrent PENDING ones
-- are blocked.
create unique index if not exists result_correction_requests_one_pending_per_match
  on public.result_correction_requests (match_id)
  where status = 'pending';

create index if not exists idx_result_correction_requests_match_id
  on public.result_correction_requests (match_id);

-- ----------------------------------------------------------------------------
-- 2. result_correction_votes — one row per (request, eligible voter),
-- pre-populated at request-creation time. This single table is
-- simultaneously the eligibility snapshot (a row existing at all = was
-- eligible when the request was created), the live vote record (vote is
-- null until cast), and the audit trail of who voted what and when.
-- ----------------------------------------------------------------------------
create table if not exists public.result_correction_votes (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.result_correction_requests (id),
  player_id   uuid not null references public.players (id),
  vote        boolean, -- null = not yet voted, true = agree, false = disagree
  voted_at    timestamptz,
  unique (request_id, player_id)
);

create index if not exists idx_result_correction_votes_request_id
  on public.result_correction_votes (request_id);

-- ----------------------------------------------------------------------------
-- 3. RLS — read is open to anyone with app access (the whole point of a
-- democratic process is that it's visible), writes are RPC-only. No
-- INSERT/UPDATE/DELETE grant is given to `authenticated` on either table —
-- exactly the same pattern matches.finished already relies on — so a
-- client calling these tables directly is rejected at the grant level,
-- before RLS is even evaluated.
-- ----------------------------------------------------------------------------
alter table public.result_correction_requests enable row level security;
alter table public.result_correction_votes enable row level security;

drop policy if exists result_correction_requests_select on public.result_correction_requests;
create policy result_correction_requests_select on public.result_correction_requests for select to authenticated
  using (public.has_access());

drop policy if exists result_correction_votes_select on public.result_correction_votes;
create policy result_correction_votes_select on public.result_correction_votes for select to authenticated
  using (public.has_access());

grant select on public.result_correction_requests to authenticated;
grant select on public.result_correction_votes to authenticated;

-- ----------------------------------------------------------------------------
-- 4. apply_match_result — private helper, not exposed to `authenticated`
-- at all. The one place a result is ever written and points ever
-- recalculated, called from finish_match() (first close) and from
-- vote_on_result_correction() (an approved correction) — never a second,
-- separate implementation of scoring.
-- ----------------------------------------------------------------------------
create or replace function public.apply_match_result(
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
  update public.matches
  set finished = true,
      final_home_score = p_final_home_score,
      final_away_score = p_final_away_score
  where id = p_match_id;

  -- Same bypass finish_match()/recalculate_all_points() already used before
  -- this logic was factored out into this function (see migration 0002) —
  -- without it, enforce_prediction_change_limit() mistakes this system
  -- recalculation for a player's own (already-exhausted) manual save and
  -- rejects it. `true` as the third argument scopes it to the current
  -- transaction only, exactly as before — it can never leak into or affect
  -- a player's own subsequent prediction save in a separate request.
  perform set_config('app.bypass_prediction_limit', 'true', true);

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

revoke all on function public.apply_match_result(uuid, smallint, smallint) from public;
-- Deliberately no grant to authenticated — only reachable from inside
-- another SECURITY DEFINER function (which runs as the owner regardless
-- of the caller's own grants), never directly.

-- ----------------------------------------------------------------------------
-- 5. finish_match — same signature, same admin re-check as before, but now
-- rejects outright if the match is already finished. This is the actual
-- fix: it closes the backdoor that let an admin silently re-finish an
-- already-finished match, which is what "locks" every match (existing and
-- future) the moment this migration is applied.
-- ----------------------------------------------------------------------------
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
declare
  v_finished boolean;
begin
  if not exists (select 1 from public.players where id = auth.uid() and is_admin) then
    raise exception 'Iba administrátor môže ukončiť zápas.' using errcode = '42501';
  end if;

  if p_final_home_score is null or p_final_away_score is null
     or p_final_home_score < 0 or p_final_away_score < 0 then
    raise exception 'Neplatný výsledok zápasu.' using errcode = '22023';
  end if;

  select finished into v_finished from public.matches where id = p_match_id for update;

  if v_finished is null then
    raise exception 'Zápas sa nenašiel.' using errcode = 'P0002';
  end if;

  if v_finished then
    raise exception 'Zápas je už ukončený a uzamknutý. Na zmenu výsledku použi žiadosť o opravu.' using errcode = '42501';
  end if;

  perform public.apply_match_result(p_match_id, p_final_home_score, p_final_away_score);
end;
$$;
-- Grant unchanged from migration 0001 (same function signature, CREATE OR
-- REPLACE preserves it): grant execute on finish_match(...) to authenticated.

-- ----------------------------------------------------------------------------
-- 6. request_result_correction — admin-only entry point. Snapshots the
-- eligible-voter set (has_access(), excluding the requester) atomically in
-- the same transaction as the request itself, so no concurrent membership
-- change can affect who's eligible for THIS request.
-- ----------------------------------------------------------------------------
create or replace function public.request_result_correction(
  p_match_id uuid,
  p_new_home_score smallint,
  p_new_away_score smallint,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
  v_request_id uuid;
  v_reason text;
begin
  if not exists (select 1 from public.players where id = auth.uid() and is_admin) then
    raise exception 'Iba administrátor môže požiadať o opravu výsledku.' using errcode = '42501';
  end if;

  -- Locks the match row so a concurrent finish/correction can't race this
  -- request's "old score" snapshot.
  select id, finished, final_home_score, final_away_score
    into v_match
    from public.matches
    where id = p_match_id
    for update;

  if v_match.id is null then
    raise exception 'Zápas sa nenašiel.' using errcode = 'P0002';
  end if;

  if not v_match.finished then
    raise exception 'Zápas ešte nie je ukončený.' using errcode = '22023';
  end if;

  if p_new_home_score is null or p_new_away_score is null
     or p_new_home_score < 0 or p_new_away_score < 0 then
    raise exception 'Neplatný výsledok zápasu.' using errcode = '22023';
  end if;

  if p_new_home_score = v_match.final_home_score and p_new_away_score = v_match.final_away_score then
    raise exception 'Nový výsledok je rovnaký ako súčasný.' using errcode = '22023';
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  if v_reason = '' then
    raise exception 'Uveď dôvod opravy.' using errcode = '22023';
  end if;

  -- Fast, friendly failure before ever touching the table — the partial
  -- unique index above is the real backstop against a race between two
  -- simultaneous requests, same "pre-check + real constraint" pattern
  -- already used elsewhere in this schema (e.g. duplicate player names).
  if exists (select 1 from public.result_correction_requests where match_id = p_match_id and status = 'pending') then
    raise exception 'Pre tento zápas už existuje čakajúca žiadosť o opravu.' using errcode = '23505';
  end if;

  insert into public.result_correction_requests (
    match_id, requested_by, old_home_score, old_away_score, new_home_score, new_away_score, reason
  ) values (
    p_match_id, auth.uid(), v_match.final_home_score, v_match.final_away_score,
    p_new_home_score, p_new_away_score, v_reason
  )
  returning id into v_request_id;

  insert into public.result_correction_votes (request_id, player_id)
  select v_request_id, p.id
  from public.players p
  where (p.is_paid or p.is_admin) and p.id <> auth.uid();

  return v_request_id;
end;
$$;

revoke all on function public.request_result_correction(uuid, smallint, smallint, text) from public;
grant execute on function public.request_result_correction(uuid, smallint, smallint, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 7. vote_on_result_correction — the only way a vote (or the resulting
-- approval/rejection, or the score change itself) is ever written.
--
-- The `for update` lock on the request row is what makes unanimous-
-- approval detection race-safe: if the last two required voters vote at
-- the same instant, the second call's lock acquisition blocks until the
-- first call's transaction (vote write + approval check + apply, if it
-- was the final vote) has fully committed — so the second call always
-- sees an up-to-date, consistent vote count, never a stale one that could
-- leave a fully-approved request stuck un-applied.
-- ----------------------------------------------------------------------------
create or replace function public.vote_on_result_correction(
  p_request_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_seat record;
  v_all_approved boolean;
begin
  select id, match_id, status, new_home_score, new_away_score
    into v_request
    from public.result_correction_requests
    where id = p_request_id
    for update;

  if v_request.id is null then
    raise exception 'Žiadosť o opravu sa nenašla.' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'O tejto žiadosti sa už rozhodlo.' using errcode = '22023';
  end if;

  select id, vote into v_seat
    from public.result_correction_votes
    where request_id = p_request_id and player_id = auth.uid()
    for update;

  if v_seat.id is null then
    raise exception 'Nemáš právo hlasovať o tejto žiadosti.' using errcode = '42501';
  end if;

  if v_seat.vote is not null then
    raise exception 'O tejto žiadosti si už hlasoval.' using errcode = '22023';
  end if;

  update public.result_correction_votes
  set vote = p_approve, voted_at = now()
  where id = v_seat.id;

  if not p_approve then
    -- First rejection wins immediately — not a wait-for-everyone model.
    update public.result_correction_requests
    set status = 'rejected', resolved_at = now()
    where id = p_request_id;
    return;
  end if;

  select not exists (
    select 1 from public.result_correction_votes
    where request_id = p_request_id and (vote is distinct from true)
  ) into v_all_approved;

  if v_all_approved then
    update public.result_correction_requests
    set status = 'approved', resolved_at = now()
    where id = p_request_id;

    perform public.apply_match_result(v_request.match_id, v_request.new_home_score, v_request.new_away_score);
  end if;
end;
$$;

revoke all on function public.vote_on_result_correction(uuid, boolean) from public;
grant execute on function public.vote_on_result_correction(uuid, boolean) to authenticated;
