-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 (PickMates) — payment IBAN setting
-- ============================================================================
-- New Admin "Platba" section: the admin sets one IBAN that unpaid players
-- see on the existing access-blocked screen. Reuses the existing `settings`
-- singleton table (migration 0004) rather than a new table — same pattern
-- already used for `logo_url` (migration 0008): one nullable column, plus a
-- narrow public accessor RPC.
--
-- Why a dedicated RPC instead of loosening settings' own SELECT policy
-- (`has_access()`, migration 0004): an unpaid player is exactly the
-- audience that needs to read this value, and has_access() is false for
-- them by definition — that's the one existing policy this feature cannot
-- go through. get_payment_iban() mirrors get_league_logo_url() exactly:
-- SECURITY DEFINER, reads only this one column, and is the ONLY new way to
-- reach the settings row without has_access(). Unlike the logo function
-- this is granted to `authenticated` only, not `anon` — the IBAN is only
-- ever shown after login (on the blocked screen), never on the pre-login
-- screen the logo needs to reach.
--
-- settings' own SELECT/UPDATE RLS policies (migration 0004) are untouched:
-- has_access() still gates the raw table read exactly as before, and the
-- existing admin-only UPDATE policy already covers this new column with no
-- change needed — it already applies to the whole row regardless of which
-- columns are in a given UPDATE's SET list.
--
-- Idempotent / safe to re-run. Does not modify or delete any existing row.
-- ============================================================================

alter table public.settings add column if not exists payment_iban text;

grant update (payment_iban) on public.settings to authenticated;

create or replace function public.get_payment_iban()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select payment_iban from public.settings where id = true;
$$;

grant execute on function public.get_payment_iban() to authenticated;
