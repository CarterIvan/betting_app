-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 (PickMates) — manual live score display
-- ============================================================================
-- Adds two optional columns so the admin can manually post a current score
-- while a match is being played, shown on the Live page. Completely
-- separate from the match's real result:
--
--   - `live_home_score` / `live_away_score` are purely informational
--     display fields. Nothing reads them for scoring — calculate_points(),
--     apply_match_result(), finish_match() and every prediction/ranking
--     code path only ever look at final_home_score/final_away_score
--     (untouched, unchanged) and are not modified by this migration at
--     all.
--   - Nullable, no default — every existing match keeps both as NULL and
--     the Live page falls back to "- : -" exactly as it already does
--     today for a still-scoreless live match. No existing row needs any
--     change for this to be safe.
--   - `smallint`, matching final_home_score/final_away_score's existing
--     type (the project's own convention for a match score column), with
--     the same non-negative check those two already have — admin free
--     text was never the input method here (numeric inputs on the admin
--     form), so this is a trivial, low-risk guard, not new behavior.
--   - Column-level UPDATE grant only (no INSERT) — the admin sets these
--     while editing an already-created match (see AdminMatchList's edit
--     form), never at match-creation time, so that's the only grant this
--     feature actually needs. The existing matches_admin_update ROW policy
--     (migration 0001, unchanged) already restricts this to admins only;
--     this migration does not touch that policy or any other RLS policy.
--
-- Does not modify, delete, or touch any existing row. Idempotent / safe to
-- re-run.
-- ============================================================================

alter table public.matches add column if not exists live_home_score smallint;
alter table public.matches add column if not exists live_away_score smallint;

alter table public.matches
  add constraint if not exists matches_live_scores_non_negative check (
    (live_home_score is null or live_home_score >= 0)
    and (live_away_score is null or live_away_score >= 0)
  );

grant update (live_home_score, live_away_score) on public.matches to authenticated;
