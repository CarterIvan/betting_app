-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — Team Library (predefined + custom teams)
-- ============================================================================
-- Reuses the existing public.teams table as-is (id/name/short_name/logo/
-- primary_color/secondary_color already there since migration 0001) rather
-- than creating a second table. Adds exactly one column to distinguish the
-- 36 already-seeded Champions League teams (is_custom = false, the
-- default — so every existing row is classified correctly with no backfill
-- needed) from teams an Admin creates through the app (is_custom = true).
--
-- teams currently has SELECT-only grants/RLS (writes were "seed/admin-SQL
-- only" per its own migration 0001 comment) — this adds real INSERT/UPDATE/
-- DELETE for admins, scoped so:
--   - Column grants cover exactly what the custom-team form needs: name,
--     short_name, logo, primary_color, secondary_color (already-existing
--     columns since migration 0001, used by TeamBadge's generated-crest
--     fallback for a team with no logo — nothing new added here).
--   - INSERT must self-declare is_custom = true — the app can never create
--     a "predefined" row.
--   - DELETE requires is_custom = true on the EXISTING row — a predefined
--     team can never be deleted, regardless of what the client sends.
--   - UPDATE is allowed on ANY row (predefined or custom) for logo/colors —
--     "change the badge of a default team" needs that — but a BEFORE
--     UPDATE trigger (enforce_predefined_team_identity, below) rejects any
--     attempt to change name/short_name/country/is_custom on a predefined
--     row specifically. A custom row has no such restriction. is_custom
--     itself is also simply not in the UPDATE column grant, so a custom
--     team can't be "promoted" to predefined either way.
--
-- Deleting a custom team still relies on the FK that already exists
-- (matches.home_team_id/away_team_id → teams.id, no ON DELETE clause —
-- i.e. RESTRICT): if any match references the team, Postgres itself
-- rejects the delete with a foreign_key_violation rather than the app
-- cascading anything. No new logic needed for that — it was already safe.
--
-- Also adds a `team-logos` Storage bucket (admin-write-only, public read —
-- same pattern as `league-logo` in migration 0008) for custom teams'
-- optional uploaded crest; predefined teams' logo column is untouched
-- (currently NULL for all 36 — they render via the generated SVG crest
-- fallback already built into TeamBadge.jsx).
--
-- Idempotent / safe to re-run. Does not modify or delete any existing row.
-- ============================================================================

alter table public.teams
  add column if not exists is_custom boolean not null default false;

grant insert (id, name, short_name, logo, is_custom, primary_color, secondary_color) on public.teams to authenticated;
grant update (name, short_name, logo, primary_color, secondary_color) on public.teams to authenticated;
grant delete on public.teams to authenticated;

drop policy if exists teams_admin_insert on public.teams;
create policy teams_admin_insert on public.teams for insert to authenticated
  with check (
    is_custom = true
    and exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin)
  );

-- Predefined teams' name/short_name/country/is_custom stay locked via the
-- trigger below, not via this policy — this policy itself just re-checks
-- admin status, same as everywhere else.
create or replace function public.enforce_predefined_team_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not OLD.is_custom then
    if NEW.name is distinct from OLD.name
       or NEW.short_name is distinct from OLD.short_name
       or NEW.country is distinct from OLD.country
       or NEW.is_custom is distinct from OLD.is_custom then
      raise exception 'Predvolený tím je možné upraviť iba v logu a farbách.' using errcode = '42501';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_predefined_team_identity on public.teams;
create trigger trg_enforce_predefined_team_identity
  before update on public.teams
  for each row execute function public.enforce_predefined_team_identity();

drop policy if exists teams_admin_update on public.teams;
create policy teams_admin_update on public.teams for update to authenticated
  using (exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin));

drop policy if exists teams_admin_delete on public.teams;
create policy teams_admin_delete on public.teams for delete to authenticated
  using (
    is_custom = true
    and exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin)
  );

-- ----------------------------------------------------------------------------
-- team-logos Storage bucket — one object per custom team, keyed by the
-- team's own id (a client-generated uuid, so it's known before upload).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-logos',
  'team-logos',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists team_logos_select on storage.objects;
create policy team_logos_select on storage.objects for select to authenticated
  using (bucket_id = 'team-logos');

drop policy if exists team_logos_admin_insert on storage.objects;
create policy team_logos_admin_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'team-logos'
    and exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists team_logos_admin_update on storage.objects;
create policy team_logos_admin_update on storage.objects for update to authenticated
  using (
    bucket_id = 'team-logos'
    and exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin)
  )
  with check (
    bucket_id = 'team-logos'
    and exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists team_logos_admin_delete on storage.objects;
create policy team_logos_admin_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'team-logos'
    and exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin)
  );
