-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — profile photos
-- ============================================================================
-- Adds an avatar to each player, backed by Supabase Storage (never
-- base64/binary in the database — `players.avatar_url` is just a public
-- URL string). A player can only ever write to their own folder in the
-- bucket, and can only ever update their own `avatar_url` row — both
-- enforced server-side (Storage RLS + a narrow, avatar_url-only column
-- grant on `players`), not just by hiding the upload button in the UI.
--
-- Idempotent / safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. players.avatar_url
-- ----------------------------------------------------------------------------
alter table public.players
  add column if not exists avatar_url text;

-- players previously had NO update policy/grant at all for `authenticated`
-- (points/is_admin/name are intentionally client-immutable). This adds
-- exactly one narrow exception: a player may update their OWN avatar_url,
-- nothing else — points/is_admin/name remain just as untouchable as before.
drop policy if exists players_update_own_avatar on public.players;
create policy players_update_own_avatar on public.players for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant update (avatar_url) on public.players to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Storage bucket
-- ----------------------------------------------------------------------------
-- Public bucket (so avatars load as plain <img src> everywhere — Podium,
-- ranking, chat — without signed URLs), but WRITES are still fully
-- RLS-gated below. file_size_limit / allowed_mime_types are enforced by
-- Storage itself, server-side — not just by the frontend's own file-picker
-- `accept` attribute and pre-upload size check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 3. Storage RLS — a player may only write inside their own `{user_id}/...`
-- folder, determined from their auth token, never from anything the client
-- sends. Reads are open to any authenticated user (everyone needs to see
-- everyone else's avatar in the ranking/podium/chat); the bucket being
-- public additionally lets the plain <img> tags load without an auth
-- header at all.
-- ----------------------------------------------------------------------------
drop policy if exists profile_photos_select on storage.objects;
create policy profile_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos');

drop policy if exists profile_photos_insert_own on storage.objects;
create policy profile_photos_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists profile_photos_update_own on storage.objects;
create policy profile_photos_update_own on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists profile_photos_delete_own on storage.objects;
create policy profile_photos_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
