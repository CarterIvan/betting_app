-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — prediction completion counter (aggregate only)
-- ============================================================================
-- Dashboard match cards show "3/13 players have submitted" — a pure
-- completion count, never who submitted or what they predicted. The
-- existing predictions_select policy (migration 0009) already blocks a
-- player from reading OTHER players' prediction rows before kickoff, so
-- the frontend genuinely cannot compute this count itself from already
-- -fetched data for an upcoming match — it has to come from a dedicated
-- aggregate RPC that returns counts only, never rows.
--
-- One SECURITY DEFINER function, callable by anyone with app access,
-- returning ONE row per non-finished match: `match_id`, `submitted_count`,
-- `total_players`. No player_id, no name, no predicted score — just two
-- numbers. `total_players` is "active" players — the same is_paid/is_admin
-- set that has_access() itself is built from, i.e. everyone who's actually
-- eligible to submit a prediction at all.
--
-- Idempotent / safe to re-run.
-- ============================================================================

create or replace function public.get_predictions_completion()
returns table (match_id uuid, submitted_count bigint, total_players bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id as match_id,
    (
      select count(*)
      from public.predictions pr
      join public.players p on p.id = pr.player_id
      where pr.match_id = m.id and (p.is_paid or p.is_admin)
    ) as submitted_count,
    (select count(*) from public.players p where p.is_paid or p.is_admin) as total_players
  from public.matches m
  where m.finished = false and public.has_access();
$$;

grant execute on function public.get_predictions_completion() to authenticated;
