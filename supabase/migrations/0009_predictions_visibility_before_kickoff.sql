-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — real, RLS-enforced prediction privacy
-- ============================================================================
-- predictions_select has never been time-scoped (migration 0001: `using
-- (true)`; migration 0004: `using (has_access())`) — any authenticated,
-- paying caller could always SELECT every player's prediction for every
-- match, including ones that haven't kicked off yet. "You can't see other
-- players' picks before kickoff" has only ever been a client-side
-- rendering convention (Live/History/Admin Matches all fetch the full
-- predictions table and just choose what to render) — never actually
-- enforced by Postgres.
--
-- This closes that gap for real, for EVERY caller (players and Admin
-- alike — no special-casing): you can always read your OWN prediction
-- (needed to see/edit "my tip" before a match starts), and you can read
-- ANYONE's prediction once their match has started or finished. This is
-- exactly the rule the rest of the app already assumes is true — Live only
-- ever renders LIVE matches, History only ever renders FINISHED ones, and
-- points (computePlayerStats) only ever count predictions with a non-null
-- `points`, which only exists after a match finishes — so nothing that
-- currently works starts receiving fewer rows than it already relied on.
--
-- Idempotent / safe to re-run.
-- ============================================================================

drop policy if exists predictions_select on public.predictions;
create policy predictions_select on public.predictions for select to authenticated
  using (
    player_id = auth.uid()
    or (
      public.has_access()
      and exists (
        select 1 from public.matches m
        where m.id = match_id and (m.finished or m.start_time <= now())
      )
    )
  );
