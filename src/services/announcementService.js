import { supabase } from '../lib/supabase'

function mapAnnouncement(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }
}

/** The current announcement is simply the most recently published one —
 * republishing always creates a new row (see migration 0014), never
 * updates an old one, so "latest" and "current" are the same thing. Null
 * if none has ever been published. */
async function getLatest() {
  const { data, error } = await supabase
    .from('league_announcements')
    .select('id, title, message, created_at, created_by')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? mapAnnouncement(data) : null
}

/** RLS already scopes this to the caller's own rows (player_id = auth.uid()
 * — see migration 0014), so no explicit filter is needed here; this is
 * simply "every announcement I've acknowledged". */
async function getMyReadIds() {
  const { data, error } = await supabase.from('league_announcement_reads').select('announcement_id')
  if (error) throw error
  return data.map((row) => row.announcement_id)
}

/** Admin-only (RLS — see migration 0014). Always creates a brand new
 * announcement row — there is no "edit in place"; republishing is what
 * gives every member a fresh, unacknowledged notification even if they'd
 * already dismissed a previous one. Also immediately self-acknowledges it
 * for the publishing admin, so they never see their own announcement as a
 * member popup — best-effort: if this second insert fails, the
 * announcement itself is still published successfully. */
async function publish(title, message, creatorId) {
  const { data, error } = await supabase
    .from('league_announcements')
    .insert({ title, message, created_by: creatorId })
    .select('id, title, message, created_at, created_by')
    .single()
  if (error) throw error

  const { error: ackError } = await supabase
    .from('league_announcement_reads')
    .insert({ announcement_id: data.id, player_id: creatorId })
  if (ackError) {
    // eslint-disable-next-line no-console
    console.error('[publish announcement] self-acknowledge failed', ackError)
  }

  return mapAnnouncement(data)
}

/** RLS re-checks independently that a player can only acknowledge on their
 * own behalf (see migration 0014). */
async function acknowledge(announcementId, playerId) {
  const { error } = await supabase
    .from('league_announcement_reads')
    .insert({ announcement_id: announcementId, player_id: playerId })
  if (error) throw error
}

const announcementService = { getLatest, getMyReadIds, publish, acknowledge }

export default announcementService
