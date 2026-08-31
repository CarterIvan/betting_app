-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — prediction two-save limit
-- ============================================================================
-- Each player may save/change their prediction for a given match at most
-- TWICE (1 initial save + 1 change). Enforced by a BEFORE UPDATE trigger —
-- not just RLS, not just the frontend — so a third attempt is rejected by
-- Postgres itself regardless of how it's sent (refresh, another browser,
-- devtools, a raw REST call). Reuses the existing `predictions` row per
-- player+match rather than a new table: one extra counter column is enough.
--
-- IMPORTANT: finish_match() and recalculate_all_points() (see 0001) also
-- UPDATE predictions.points for every prediction on a match — that is
-- scoring, not a player edit, and must never be constrained by (or consume)
-- the two-save limit. Both are redefined here to flag that transaction so
-- the trigger below can tell the two apart.
--
-- Idempotent / safe to re-run.
-- ============================================================================

alter table public.predictions
  add column if not exists save_count smallint not null default 1;

alter table public.predictions
  drop constraint if exists predictions_save_count_valid;
alter table public.predictions
  add constraint predictions_save_count_valid check (save_count between 1 and 2);

-- The trigger — not the client — decides the new save_count, so no column
-- grant for it is needed at all (a trigger can set any column of NEW
-- regardless of what the invoking UPDATE's own column privileges are).
-- This runs in addition to, not instead of, the existing
-- predictions_update_own RLS policy (still enforcing "own row" + "before
-- kickoff"): both must pass for a player-initiated update to succeed.
create or replace function public.enforce_prediction_change_limit()
returns trigger
language plpgsql
as $$
begin
  -- Set (transaction-locally) by finish_match() / recalculate_all_points()
  -- right before they bulk-update `points` — that is server-side scoring,
  -- not a player save, and must pass through untouched. A normal
  -- player-initiated upsert never sets this, so the limit still applies.
  if coalesce(current_setting('app.bypass_prediction_limit', true), 'false') = 'true' then
    return NEW;
  end if;

  if OLD.save_count >= 2 then
    raise exception 'Tip je uzamknutý — vyčerpali ste obe možnosti zmeny.' using errcode = '42501';
  end if;
  NEW.save_count := OLD.save_count + 1;
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists trg_prediction_change_limit on public.predictions;
create trigger trg_prediction_change_limit
  before update on public.predictions
  for each row execute function public.enforce_prediction_change_limit();

-- ----------------------------------------------------------------------------
-- Redefine finish_match() / recalculate_all_points() to set the bypass flag
-- before their bulk predictions.points update. Bodies are otherwise
-- unchanged from 0001_init.sql; grants (already applied there) are
-- untouched by CREATE OR REPLACE as long as the signature stays the same.
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

  perform set_config('app.bypass_prediction_limit', 'true', true);

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
