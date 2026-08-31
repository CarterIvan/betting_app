-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — admin player creation + league reset
-- ============================================================================
-- Two pieces:
--   1. A case-insensitive unique constraint on players.name, so "Ivan" and
--      "ivan" can't both exist — enforced here as the authoritative check;
--      the admin-create-player Edge Function also pre-checks for a fast,
--      friendly error, but this is what actually prevents a race.
--   2. reset_league_data() — a SECURITY DEFINER RPC, same pattern as
--      finish_match()/recalculate_all_points() (0001/0002): re-checks admin
--      status itself, so calling it is never enough on its own, you also
--      have to *be* an admin. This does everything a plain SQL function
--      safely can. It deliberately does NOT delete player accounts —
--      removing an actual Supabase Auth user requires the Admin API
--      (service_role), which no Postgres function can safely do; that part
--      is handled by the admin-reset-league Edge Function, which calls
--      this RPC first and then deletes each non-admin auth user.
--
-- Idempotent / safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Case-insensitive unique player names
-- ----------------------------------------------------------------------------
drop index if exists players_name_unique_ci;
create unique index players_name_unique_ci on public.players (lower(name));

-- ----------------------------------------------------------------------------
-- 2. reset_league_data() — wipes everything league-specific except player
-- accounts themselves and non-league config (teams).
-- ----------------------------------------------------------------------------
create or replace function public.reset_league_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.players where id = auth.uid() and is_admin) then
    raise exception 'Iba administrátor môže resetovať ligu.' using errcode = '42501';
  end if;

  -- Children before parents, even though the FKs already cascade this —
  -- explicit and auditable rather than relied-upon-implicitly.
  delete from public.chat_messages;
  delete from public.predictions;
  delete from public.matches;

  -- Whoever remains after the Edge Function removes non-admin accounts
  -- (i.e. the admin) starts from a clean slate too — points are a cache
  -- derived from predictions, which no longer exist.
  update public.players set points = 0;

  -- Prize distribution is league-specific, not app-wide config.
  update public.settings
  set first_place_prize = 0,
      second_place_prize = 0,
      third_place_prize = 0,
      updated_at = now();
end;
$$;

revoke all on function public.reset_league_data() from public;
grant execute on function public.reset_league_data() to authenticated;
