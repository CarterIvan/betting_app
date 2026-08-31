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

const playersService = { getAll, setPaymentStatus }

export default playersService
