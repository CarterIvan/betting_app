-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 (PickMates) — match round/stage grouping
-- ============================================================================
-- Adds an optional, free-text round/stage label to matches (e.g. "1. kolo",
-- "Semifinále") so the History page can group finished matches by round
-- instead of showing one long flat list. Purely additive:
--
--   - `round_name` is nullable, no default — every existing match
--     (including the already-played first round) keeps round_name = NULL
--     and continues to work exactly as before. The frontend places NULL
--     matches into a fallback "other matches" group; nothing is ever
--     hidden because of a missing round_name.
--   - No existing column, constraint, foreign key, RLS policy, or function
--     is touched. finish_match() / apply_match_result() and every other
--     scoring/prediction code path are completely untouched — this column
--     carries no scoring meaning whatsoever, it's display grouping only.
--   - Column-level grants are extended the same way every other
--     admin-editable matches column already is (home_team_id/away_team_id/
--     start_time, migration 0001) — this is what lets the existing
--     matches_admin_insert/matches_admin_update ROW policies (unchanged)
--     actually reach this new column from the client. finished/
--     final_home_score/final_away_score remain ungranted, exactly as
--     before — this migration does not change who can touch match results.
--
-- This migration does NOT modify, delete, or touch any existing row. It
-- only defines the new column and its write grants — nothing here assigns
-- "1. kolo" (or anything else) to any already-finished match. That is a
-- deliberate, separate, manually-reviewed UPDATE statement, provided
-- alongside this migration for manual review — never run automatically.
--
-- Idempotent / safe to re-run.
-- ============================================================================

alter table public.matches add column if not exists round_name text;

grant insert (round_name) on public.matches to authenticated;
grant update (round_name) on public.matches to authenticated;
