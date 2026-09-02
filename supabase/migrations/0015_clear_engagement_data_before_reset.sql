-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — reset-league regression fix
-- ============================================================================
-- Result Correction (migration 0012) and League Announcements (migration
-- 0014) both added tables referencing players with ON DELETE NO ACTION —
-- deliberately: it stops a single, targeted admin_delete_player() call
-- from removing an inconvenient voter to manipulate a pending correction.
-- That protection is correct for THAT action, but it also unintentionally
-- blocks admin-reset-league's non-admin auth-user deletion (auth.users →
-- players cascades, but that cascade fails wherever these NO ACTION FKs
-- still point at the row being removed), since a full league reset is a
-- fundamentally different, all-encompassing operation.
--
-- Fix: one new function that explicitly clears exactly these four tables
-- — children before parents, same "explicit and auditable rather than
-- relied-upon-implicitly" philosophy reset_league_data() itself already
-- documents — called by admin-reset-league BEFORE it attempts to delete
-- any non-admin auth user. reset_league_data() itself is NOT modified —
-- it still only ever runs after every player deletion has already
-- succeeded, preserving that existing safest-failure-mode ordering for
-- matches/predictions/chat/points. admin_delete_player() and every
-- existing FK/RLS definition are untouched.
--
-- Idempotent / safe to re-run. Does not modify or delete any existing row
-- at migration-apply time — this only defines a function; it deletes
-- nothing until explicitly called later, by the reset flow itself.
-- ============================================================================

create or replace function public.clear_result_correction_and_announcement_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.players where id = auth.uid() and is_admin) then
    raise exception 'Iba administrátor môže resetovať ligu.' using errcode = '42501';
  end if;

  -- Children before parents: result_correction_votes.request_id and
  -- league_announcement_reads.announcement_id are themselves ON DELETE NO
  -- ACTION against their own parent table, so deleting requests/
  -- announcements first would fail the same way player deletion does.
  -- `where true` is required by Supabase's `safeupdate` extension, which
  -- rejects a bare DELETE with no WHERE clause; it does not change which
  -- rows are affected.
  delete from public.result_correction_votes where true;
  delete from public.result_correction_requests where true;
  delete from public.league_announcement_reads where true;
  delete from public.league_announcements where true;
end;
$$;

revoke all on function public.clear_result_correction_and_announcement_data() from public;
grant execute on function public.clear_result_correction_and_announcement_data() to authenticated;
