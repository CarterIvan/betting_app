import { supabase } from '../lib/supabase'

function mapSettings(row) {
  return {
    firstPlacePrize: Number(row.first_place_prize),
    secondPlacePrize: Number(row.second_place_prize),
    thirdPlacePrize: Number(row.third_place_prize),
  }
}

/** Single source of truth for the prize distribution — one row, read by
 * every player on the Banka page, writable only by Admin. */
async function get() {
  const { data, error } = await supabase
    .from('settings')
    .select('first_place_prize, second_place_prize, third_place_prize')
    .eq('id', true)
    .single()
  if (error) throw error
  return mapSettings(data)
}

/** Admin-only (enforced by RLS). */
async function update({ firstPlacePrize, secondPlacePrize, thirdPlacePrize }) {
  const { error } = await supabase
    .from('settings')
    .update({
      first_place_prize: firstPlacePrize,
      second_place_prize: secondPlacePrize,
      third_place_prize: thirdPlacePrize,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true)
  if (error) throw error
}

const settingsService = { get, update }

export default settingsService
