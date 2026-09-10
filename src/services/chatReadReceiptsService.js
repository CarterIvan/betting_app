import { supabase } from '../lib/supabase'

// This is the real, shared, server-side "who has read the chat" state (see
// migration 0021) — a completely different thing from
// src/services/dataService.js's read state, which is a per-device,
// localStorage-only cosmetic unread-badge tracker and is not touched by
// this file at all.

function mapReceipt(row) {
  return { playerId: row.player_id, lastReadAt: row.last_read_at }
}

/** One row per player who has ever opened the chat — small, bounded by
 * player count, never by message count. Fetched once and kept in sync via
 * realtime (see subscribe below), so "who has seen this message" is a
 * cheap in-memory filter per message, never a separate query per message. */
async function getAll() {
  const { data, error } = await supabase.from('chat_read_receipts').select('player_id, last_read_at')
  if (error) throw error
  return data.map(mapReceipt)
}

/** Upserts the CALLING player's own row — RLS only allows player_id =
 * auth.uid() (see migration 0021), so this can only ever mark the current
 * user's own read state, never anyone else's. */
async function markRead(playerId, lastReadAt) {
  const { error } = await supabase
    .from('chat_read_receipts')
    .upsert({ player_id: playerId, last_read_at: lastReadAt }, { onConflict: 'player_id' })
  if (error) throw error
}

/** Realtime: any player's read-state row changing (insert on their first
 * read, update on every read after) arrives here, so "seen by" avatars can
 * update live for everyone currently viewing the chat. Returns an
 * unsubscribe function, same shape as chatService.subscribe. */
function subscribe(onChange) {
  const channel = supabase
    .channel('public:chat_read_receipts')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_read_receipts' },
      (payload) => {
        const row = payload.new ?? payload.old
        if (row) onChange(mapReceipt(row))
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

const chatReadReceiptsService = { getAll, markRead, subscribe }

export default chatReadReceiptsService
