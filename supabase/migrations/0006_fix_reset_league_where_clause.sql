-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — fix reset_league_data() "requires a WHERE
-- clause" failure
-- ============================================================================
-- Production error from the admin-reset-league Edge Function's logs:
--   { message: "DELETE requires a WHERE clause", code: "21000" }
--
-- Root cause: Supabase enables the `safeupdate` extension on every project
-- by default, which rejects any bare UPDATE/DELETE with no WHERE clause —
-- exactly to stop an accidental full-table wipe. reset_league_data() (see
-- 0005) has 3 DELETEs and 2 UPDATEs with no WHERE clause at all, so the
-- very first statement (`delete from chat_messages;`) always raised this
-- error before anything else ran. Because the whole function body executes
-- as one statement-level transaction, that failure already rolled back
-- cleanly on its own — nothing was ever partially wiped by this bug.
--
-- Fix: add `where true` to each statement. `safeupdate` only checks for the
-- syntactic presence of a WHERE clause, not what it restricts, so `where
-- true` deletes/updates every row exactly as before — behavior is
-- unchanged, only now it's valid under `safeupdate`.
--
-- Idempotent / safe to re-run.
-- ============================================================================

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
  -- `where true` is required by Supabase's `safeupdate` extension, which
  -- rejects a bare DELETE/UPDATE with no WHERE clause; it does not change
  -- which rows are affected.
  delete from public.chat_messages where true;
  delete from public.predictions where true;
  delete from public.matches where true;

  -- Whoever remains after the Edge Function removes non-admin accounts
  -- (i.e. the admin) starts from a clean slate too — points are a cache
  -- derived from predictions, which no longer exist.
  update public.players set points = 0 where true;

  -- Prize distribution is league-specific, not app-wide config.
  update public.settings
  set first_place_prize = 0,
      second_place_prize = 0,
      third_place_prize = 0,
      updated_at = now()
  where true;
end;
$$;

revoke all on function public.reset_league_data() from public;
grant execute on function public.reset_league_data() to authenticated;
