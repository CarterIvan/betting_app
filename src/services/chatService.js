import { supabase } from '../lib/supabase'

function mapMessage(row, playerInfo) {
  return {
    id: row.id,
    playerId: row.player_id,
    // null (not a hard-coded fallback string) when the player record can't
    // be resolved — this is a service file with no access to the current
    // UI language, so the display fallback text lives in ChatMessage.jsx.
    playerName: playerInfo?.name ?? row.players?.name ?? null,
    playerAvatarUrl: playerInfo?.avatarUrl ?? row.players?.avatar_url ?? null,
    playerIsAdmin: playerInfo?.isAdmin ?? row.players?.is_admin ?? false,
    text: row.message,
    createdAt: row.created_at,
  }
}

async function getAll() {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, player_id, message, created_at, players(name, avatar_url, is_admin)')
    .order('created_at')
  if (error) throw error
  return data.map((row) => mapMessage(row))
}

async function send(playerId, text) {
  const { error } = await supabase.from('chat_messages').insert({ player_id: playerId, message: text.trim() })
  if (error) throw error
}

/** Realtime: new messages from ANY player (including the sender's own)
 * arrive here, so the UI never needs an optimistic local append. Returns an
 * unsubscribe function. */
function subscribe(onInsert) {
  const channel = supabase
    .channel('public:chat_messages')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      async (payload) => {
        const { data } = await supabase
          .from('players')
          .select('name, avatar_url, is_admin')
          .eq('id', payload.new.player_id)
          .single()
        onInsert(mapMessage(payload.new, { name: data?.name, avatarUrl: data?.avatar_url, isAdmin: data?.is_admin }))
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

const chatService = { getAll, send, subscribe }

export default chatService
