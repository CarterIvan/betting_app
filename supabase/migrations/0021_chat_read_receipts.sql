-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 (PickMates) — chat read receipts ("seen by")
-- ============================================================================
-- A Messenger-style "seen by" system for the existing group chat. This is
-- intentionally NOT the same thing as the existing local unread-badge
-- tracker (src/services/dataService.js) — that one is explicitly
-- per-device, localStorage-only, cosmetic ("Chat (N)" nav badge), and is
-- left completely untouched by this migration. This is real, shared,
-- server-side state: who has actually read the chat, visible to every
-- other player.
--
-- One row per player, holding only the timestamp of the latest message
-- they've seen — NOT a row per (message, player) pair. A message is
-- considered "seen by" player P if P has a row here with
-- last_read_at >= that message's created_at. This is the scalable
-- approach requested: reading "who saw message X" is an O(players) scan
-- of one small table, regardless of how many thousands of messages exist,
-- and marking "I've read the chat" is a single upsert, not one row per
-- message.
--
-- `player_id` is the PRIMARY KEY (not just a unique constraint) — this
-- project's own established convention for a strict one-row-per-key table
-- (see `settings`, migration 0004: `id boolean primary key`). It also
-- means an upsert can target `on conflict (player_id)` directly.
--
-- `last_read_at` is NOT NULL: a row only ever exists once a player has
-- actually opened the chat at least once (created by their first read,
-- via an upsert — never pre-populated for every player). A player who has
-- never opened the chat simply has no row at all, which is exactly what
-- naturally excludes them from every message's "seen by" list — no NULL
-- handling needed anywhere that reads this table.
--
-- RLS mirrors this project's existing chat_messages policies exactly
-- (migration 0004): has_access() gates everything, a player can only ever
-- write their OWN row. SELECT is open to every player with access (not
-- just "your own row") because everyone needs to see WHO ELSE has read a
-- message — that's the entire point of a group-chat read receipt. No
-- existing RLS policy on chat_messages, players, or anything else is
-- touched.
--
-- Does not modify, delete, or touch any existing row in any table.
-- Idempotent / safe to re-run.
-- ============================================================================

create table if not exists public.chat_read_receipts (
  player_id     uuid primary key references public.players (id) on delete cascade,
  last_read_at  timestamptz not null
);

alter table public.chat_read_receipts enable row level security;

-- Everyone with chat access can see everyone's read state (needed to know
-- who has seen a given message) — same audience as chat_messages itself.
drop policy if exists chat_read_receipts_select on public.chat_read_receipts;
create policy chat_read_receipts_select on public.chat_read_receipts for select to authenticated
  using (public.has_access());

-- A player can only ever create/update THEIR OWN row — same shape as
-- chat_insert_own (migration 0004). Both insert and update are needed
-- since marking the chat read is an upsert (first read = insert,
-- every read after = update).
drop policy if exists chat_read_receipts_insert_own on public.chat_read_receipts;
create policy chat_read_receipts_insert_own on public.chat_read_receipts for insert to authenticated
  with check (public.has_access() and player_id = auth.uid());

drop policy if exists chat_read_receipts_update_own on public.chat_read_receipts;
create policy chat_read_receipts_update_own on public.chat_read_receipts for update to authenticated
  using (public.has_access() and player_id = auth.uid())
  with check (public.has_access() and player_id = auth.uid());

grant select on public.chat_read_receipts to authenticated;
grant insert (player_id, last_read_at) on public.chat_read_receipts to authenticated;
grant update (last_read_at) on public.chat_read_receipts to authenticated;

-- Realtime, same pattern as chat_messages itself (migration 0001): so a
-- player who's actively viewing the chat sees "seen by" avatars appear on
-- their screen the moment someone else reads a message, without needing
-- to refresh. Guarded the same way — ADD TABLE errors if already a
-- member, so this stays safely re-runnable.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_read_receipts'
  ) then
    alter publication supabase_realtime add table public.chat_read_receipts;
  end if;
end $$;
