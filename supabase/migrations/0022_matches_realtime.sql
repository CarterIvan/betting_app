-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 (PickMates) — realtime for matches
-- ============================================================================
-- Enables Supabase Realtime on `matches`, same mechanism chat_messages
-- (migration 0001) and chat_read_receipts (migration 0021) already use.
-- Needed so the admin's quick live-score +/- controls (migration 0020)
-- propagate to every other viewer of the Live page immediately, without a
-- manual refresh — and, as a natural side effect of subscribing to the
-- whole table rather than inventing a live-score-only channel, any other
-- match UPDATE (edited kickoff/teams/round, or finish_match() setting the
-- final result) now also reaches other viewers live, exactly the same way
-- it already did for the player who made the change.
--
-- This does NOT change what can be updated or by whom — RLS/grants on
-- `matches` (migration 0001 and its later revisions) are completely
-- untouched. Realtime only decides who gets NOTIFIED of a change already
-- permitted by those policies; it can't itself grant, bypass, or widen
-- any permission. finish_match()/apply_match_result()/calculate_points()
-- are not touched at all.
--
-- No table is created, altered, or dropped, and no row is modified.
-- Idempotent / safe to re-run — ADD TABLE errors if the table is already a
-- publication member, so this is guarded the same way 0001 and 0021 are.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
