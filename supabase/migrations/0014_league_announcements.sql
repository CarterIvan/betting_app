-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — league announcements
-- ============================================================================
-- This app is a single competition — no `leagues` table exists (same
-- architecture decision already made for the Team Library / league logo
-- features) — so "the league" an announcement belongs to is simply this
-- whole app; no league_id column is needed. Reuses `players`/`has_access()`
-- exactly like every other feature.
--
-- Two tables:
--   - league_announcements: one row per PUBLISH. Editing the admin form
--     and republishing is a NEW row (a new id), never an UPDATE to an
--     existing one — that's what gives every republish a fresh identity
--     members who already acknowledged the previous version still need to
--     see. "Current" (order by created_at desc limit 1) is simply the
--     latest row; there is no separate draft/unpublished state to protect
--     since a row only ever exists once actually published.
--   - league_announcement_reads: one row per (announcement, player) once
--     they've acknowledged it. No RPC needed for either table — both are
--     simple, single-row, ownership-scoped inserts, fully expressible with
--     plain RLS (same pattern as matches_admin_insert / chat_insert_own),
--     unlike the correction-request workflow's multi-step, transactional
--     approval logic.
--
-- Idempotent / safe to re-run. Does not modify or delete any existing row.
-- ============================================================================

create table if not exists public.league_announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  message     text not null,
  created_at  timestamptz not null default now(),
  created_by  uuid not null references public.players (id),
  constraint league_announcements_title_present check (length(trim(title)) > 0),
  constraint league_announcements_message_present check (length(trim(message)) > 0)
);

create index if not exists idx_league_announcements_created_at
  on public.league_announcements (created_at desc);

create table if not exists public.league_announcement_reads (
  announcement_id  uuid not null references public.league_announcements (id),
  player_id        uuid not null references public.players (id),
  acknowledged_at  timestamptz not null default now(),
  primary key (announcement_id, player_id)
);

-- ----------------------------------------------------------------------------
-- RLS — read is has_access()-gated (same as everything else); writes are
-- narrowly scoped: only an admin can create an announcement (and only ever
-- under their own id), only a player can acknowledge on their own behalf.
-- Nothing here is ever updated or deleted by the app.
-- ----------------------------------------------------------------------------
alter table public.league_announcements enable row level security;
alter table public.league_announcement_reads enable row level security;

drop policy if exists league_announcements_select on public.league_announcements;
create policy league_announcements_select on public.league_announcements for select to authenticated
  using (public.has_access());

drop policy if exists league_announcements_admin_insert on public.league_announcements;
create policy league_announcements_admin_insert on public.league_announcements for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin)
  );

grant select on public.league_announcements to authenticated;
grant insert (title, message, created_by) on public.league_announcements to authenticated;

drop policy if exists league_announcement_reads_select on public.league_announcement_reads;
create policy league_announcement_reads_select on public.league_announcement_reads for select to authenticated
  using (player_id = auth.uid());

drop policy if exists league_announcement_reads_insert_own on public.league_announcement_reads;
create policy league_announcement_reads_insert_own on public.league_announcement_reads for insert to authenticated
  with check (
    player_id = auth.uid()
    and public.has_access()
  );

grant select on public.league_announcement_reads to authenticated;
grant insert (announcement_id, player_id) on public.league_announcement_reads to authenticated;
