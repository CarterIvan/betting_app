-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — first-admin bootstrap for fresh installs
-- ============================================================================
-- players.is_admin can only ever be set at signup, from
-- raw_user_meta_data->>'is_admin' (handle_new_user(), migration 0001) — no
-- client write grant exists for it afterward (see 0001's own comment on
-- this, line ~296). That's correct for the running app, but it means a
-- brand-new installation has no admin at all until someone with direct
-- database access (the SQL Editor) sets one.
--
-- Previously that meant hand-copying a UUID from Authentication > Users and
-- running a raw `update players set is_admin = true where id = '<uuid>'`.
-- This function replaces that with something safer and easier for a
-- non-technical customer:
--   - looked up by EMAIL, not UUID — the customer just types the address
--     they signed up with.
--   - only works while NO admin exists yet — once the very first admin is
--     set, every later call fails outright, so this can never be reused as
--     a standing privilege-escalation path.
--   - SECURITY DEFINER, but deliberately granted to nobody (`revoke all
--     from public`, no grant to authenticated/anon) — reachable only from
--     a connection with owner/superuser-equivalent privileges, i.e. the
--     Supabase SQL Editor, exactly like running any other raw SQL there
--     already is. The application's own API surface can never call it.
--
-- Idempotent / safe to re-run. Does not modify or delete any existing row
-- at migration-apply time — this only defines a function.
-- ============================================================================

create or replace function public.bootstrap_first_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if exists (select 1 from public.players where is_admin) then
    raise exception 'Administrátor už existuje. Túto funkciu je možné použiť iba pri prvej inštalácii.' using errcode = '42501';
  end if;

  select id into v_user_id from auth.users where email = p_email;
  if v_user_id is null then
    raise exception 'Používateľ s týmto emailom neexistuje. Najprv ho vytvor v Supabase Dashboard (Authentication > Users).' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.players where id = v_user_id) then
    raise exception 'Pre tohto používateľa ešte neexistuje profil hráča. Skús to znova o chvíľu.' using errcode = 'P0002';
  end if;

  update public.players set is_admin = true where id = v_user_id;
end;
$$;

revoke all on function public.bootstrap_first_admin(text) from public;
