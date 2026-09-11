import { supabase } from '../lib/supabase'

// Supabase is the ONLY source of truth for the Slot mini-game (see
// migration 0024) — no localStorage anywhere in this file. Every write
// (drawing a club, using up a spin) happens exclusively through the
// spin_slot() RPC; nothing here ever inserts/updates slot_collections or
// slot_daily_spins directly (those tables grant authenticated no
// INSERT/UPDATE at all — RLS/grants enforce this independent of the
// client code, not just this file's own discipline).

export const DAILY_SPIN_LIMIT = 3

function mapCollection(row) {
  return { playerId: row.player_id, teamId: row.team_id, collectedAt: row.collected_at }
}

/** Every player's collected clubs — small, bounded by players × teams,
 * never by spin history. Used for both the current player's own album and
 * the "Zberatelia" progress list for everyone else (see migration 0024's
 * open SELECT policy on slot_collections). */
async function getAllCollections() {
  const { data, error } = await supabase.from('slot_collections').select('player_id, team_id, collected_at')
  if (error) throw error
  return data.map(mapCollection)
}

/** Today's spin count for the CALLING player only — RLS restricts this to
 * their own row (see migration 0024). Used once when the Slot page loads,
 * to show "spins left" before any spin has actually been made this
 * session; every spin after that reads the authoritative, just-updated
 * count straight back from spin_slot()'s own response instead. */
async function getTodayStatus() {
  const today = new Date()
  const isoDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('slot_daily_spins')
    .select('spins_used')
    .eq('spin_date', isoDate)
    .maybeSingle()
  if (error) throw error
  const spinsUsed = data?.spins_used ?? 0
  return { spinsUsed, spinsRemaining: Math.max(0, DAILY_SPIN_LIMIT - spinsUsed) }
}

/** The ONLY way a club is ever drawn — entirely server-side (see migration
 * 0024's spin_slot()): one fair roll over (current team count + 10) equally
 * likely outcomes — a specific club, or one of 10 "no card" outcomes — the
 * 3-spins-per-day limit enforced with a row lock (safe even against two
 * simultaneous requests from the same player), and the result recorded
 * atomically in one transaction. `collectedCount`/`totalTeams`/
 * `justCompleted` are all computed server-side too — nothing about "is the
 * album now complete" is ever decided on the client. */
async function spin() {
  const { data, error } = await supabase.rpc('spin_slot')
  if (error) throw error
  return {
    teamId: data.teamId,
    isEmpty: data.isEmpty,
    isNew: data.isNew,
    collectedCount: data.collectedCount,
    totalTeams: data.totalTeams,
    justCompleted: data.justCompleted,
    spinsUsed: data.spinsUsed,
    spinsRemaining: data.spinsRemaining,
  }
}

/** Realtime: any player's newly-collected club arrives here (see migration
 * 0024 — slot_collections is the only Slot table in the realtime
 * publication), so the "Zberatelia" list updates live for everyone
 * watching, not just on next page load. Returns an unsubscribe function,
 * same shape as this app's other realtime services (chatService,
 * matchesService, settingsService). */
function subscribe(onInsert) {
  const channel = supabase
    .channel('public:slot_collections')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'slot_collections' },
      (payload) => onInsert(mapCollection(payload.new))
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

const slotService = { DAILY_SPIN_LIMIT, getAllCollections, getTodayStatus, spin, subscribe }

export default slotService
