import { supabase } from '../lib/supabase'

function mapPlayer(row) {
  return {
    id: row.id,
    name: row.name,
    isAdmin: row.is_admin,
    points: row.points,
    avatarUrl: row.avatar_url,
    isPaid: row.is_paid,
    paymentAmount: Number(row.payment_amount),
    paidAt: row.paid_at,
  }
}

const SELECT_COLUMNS = 'id, name, is_admin, points, avatar_url, is_paid, payment_amount, paid_at'

async function getAll() {
  const { data, error } = await supabase.from('players').select(SELECT_COLUMNS).order('name')
  if (error) throw error
  return data.map(mapPlayer)
}

/** Admin-only (enforced by RLS + a trigger that rejects this exact change
 * from anyone else — see migration 0004). Flips a player's paid status;
 * `paid_at` is stamped/cleared to match. */
async function setPaymentStatus(playerId, isPaid) {
  const { error } = await supabase
    .from('players')
    .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
    .eq('id', playerId)
  if (error) throw error
}

/** Admin-only (RLS + trigger, same grant as is_paid/paid_at — see
 * migration 0004). Manually corrects what a player actually paid — the
 * one existing money field on a player, also shown on the Banka page. */
async function setPaymentAmount(playerId, paymentAmount) {
  const { error } = await supabase
    .from('players')
    .update({ payment_amount: paymentAmount })
    .eq('id', playerId)
  if (error) throw error
}

/** Admin-only (RPC re-checks independently — see migration 0008).
 * auth.users.email isn't exposed by any table, so this is the only way to
 * show it in the player management panel. */
async function getEmail(playerId) {
  const { data, error } = await supabase.rpc('admin_get_player_email', { p_player_id: playerId })
  if (error) throw error
  return data
}

/** Admin-only, permanent (RPC re-checks independently — see migrations
 * 0008/0016). Removes ONLY this player's profile/predictions/chat from
 * this competition — never their Supabase Auth account. Blocked (22023)
 * while the player is the requester of, or an eligible voter on, a
 * still-pending result correction request — see migration 0016. */
async function deletePlayer(playerId) {
  const { error } = await supabase.rpc('admin_delete_player', { p_player_id: playerId })
  if (error) {
    if (error.code === '22023') {
      throw new Error('admin.deletePlayerCorrectionInProgress')
    }
    throw error
  }
}

const playersService = { getAll, setPaymentStatus, setPaymentAmount, getEmail, deletePlayer }

export default playersService
