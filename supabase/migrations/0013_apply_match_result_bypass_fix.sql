-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — apply_match_result() bypass fix
-- ============================================================================
-- migration 0012 (already deployed to production) factored finish_match()'s
-- "apply score + recalc predictions + recalc players" body out into
-- apply_match_result() — but dropped the one thing that made that bulk
-- predictions.points update safe: the transaction-local bypass flag
-- finish_match()/recalculate_all_points() have set before it since
-- migration 0002. Without it, enforce_prediction_change_limit() (still
-- exactly as migration 0002 left it — untouched here) sees the system's
-- own score recalculation as if it were a player's own manual save, and
-- rejects it once that player has already used both saves on that match
-- (save_count = 2) — a normal, common state for any real finished match.
--
-- This migration does exactly one thing: CREATE OR REPLACE
-- public.apply_match_result(...) with that single missing line restored,
-- immediately before the predictions update it protects. The base for
-- this was the CURRENT production definition of the function, read
-- directly via pg_get_functiondef() before writing this file — every
-- other line is byte-for-byte identical to what's live today. Nothing
-- else — no other function, table, trigger, RLS policy, or column — is
-- touched, and no existing row is read or written by this migration
-- (CREATE OR REPLACE FUNCTION only redefines the function itself).
--
-- Idempotent / safe to re-run.
-- ============================================================================

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

  -- Same bypass finish_match()/recalculate_all_points() already use (see
  -- migration 0002) — without it, enforce_prediction_change_limit()
  -- mistakes this system recalculation for a player's own (already-
  -- exhausted) manual save and rejects it. `true` as the third argument
  -- scopes it to the current transaction only, exactly as before — it
  -- can never leak into or affect a player's own subsequent prediction
  -- save in a separate request.
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
