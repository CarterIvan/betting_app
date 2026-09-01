-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — admin-editable league logo + player mgmt
-- ============================================================================
-- Three independent pieces, all reusing the existing single-competition
-- structure (no new tables, no multi-league/membership model):
--
--   1. settings.logo_url — one nullable column on the existing settings
--      singleton row. NULL means "no custom logo, use the default
--      /tipovacka-logo.png"; non-null is a public Storage URL. A new
--      public, read-only RPC (get_league_logo_url) exposes just this one
--      column to EVERYONE, including logged-out visitors — settings' own
--      RLS (has_access()) intentionally still protects the prize columns,
--      but the logo has to be visible on the login screen too, before
--      anyone is authenticated at all.
--
--   2. A new `league-logo` Storage bucket, admin-write-only, holding a
--      single fixed object (`current-logo`) that every upload overwrites —
--      "replace" never orphans a file, "remove" deletes that one known
--      object.
--
--   3. Two admin-only SECURITY DEFINER RPCs for the Players management
--      panel:
--        - admin_get_player_email: auth.users.email isn't exposed by any
--          existing table/view; this reads it narrowly, admin-only.
--        - admin_delete_player: deletes ONLY the public.players row (never
--          auth.users) — predictions/chat_messages cascade via their
--          existing FK to players.id (migration 0001), exactly as
--          today. The person's login account is untouched; they simply no
--          longer have a player profile in this competition, which the
--          app already treats as "not logged in" (see
--          authService.fetchProfile).
--
-- Idempotent / safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. settings.logo_url
-- ----------------------------------------------------------------------------
alter table public.settings
  add column if not exists logo_url text;

grant update (logo_url) on public.settings to authenticated;

-- Public — deliberately bypasses settings' own has_access()-gated RLS.
-- Returns ONLY the logo URL, nothing else on the row (prize amounts stay
-- exactly as gated as before).
create or replace function public.get_league_logo_url()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select logo_url from public.settings where id = true;
$$;

grant execute on function public.get_league_logo_url() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. league-logo Storage bucket — single shared object, admin-write-only
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'league-logo',
  'league-logo',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists league_logo_select on storage.objects;
create policy league_logo_select on storage.objects for select to authenticated
  using (bucket_id = 'league-logo');

drop policy if exists league_logo_admin_insert on storage.objects;
create policy league_logo_admin_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'league-logo'
    and exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists league_logo_admin_update on storage.objects;
create policy league_logo_admin_update on storage.objects for update to authenticated
  using (
    bucket_id = 'league-logo'
    and exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin)
  )
  with check (
    bucket_id = 'league-logo'
    and exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists league_logo_admin_delete on storage.objects;
create policy league_logo_admin_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'league-logo'
    and exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin)
  );

-- ----------------------------------------------------------------------------
-- 3. Player management RPCs (admin-only, re-checked independently of RLS —
-- same pattern as reset_league_data() in 0005)
-- ----------------------------------------------------------------------------
create or replace function public.admin_get_player_email(p_player_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if not exists (select 1 from public.players where id = auth.uid() and is_admin) then
    raise exception 'Iba administrátor môže zobraziť email hráča.' using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = p_player_id;
  return v_email;
end;
$$;

revoke all on function public.admin_get_player_email(uuid) from public;
grant execute on function public.admin_get_player_email(uuid) to authenticated;

create or replace function public.admin_delete_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.players where id = auth.uid() and is_admin) then
    raise exception 'Iba administrátor môže odstrániť hráča.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'Hráč neexistuje.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.players where id = p_player_id and is_admin) then
    raise exception 'Administrátorský účet nie je možné odstrániť.' using errcode = '42501';
  end if;

  -- Only the players row — predictions/chat_messages cascade via their
  -- existing FK to players.id. auth.users is never touched, so the
  -- person's account (and ability to log in elsewhere) is unaffected;
  -- they simply have no profile in this competition anymore.
  delete from public.players where id = p_player_id;
end;
$$;

revoke all on function public.admin_delete_player(uuid) from public;
grant execute on function public.admin_delete_player(uuid) to authenticated;
