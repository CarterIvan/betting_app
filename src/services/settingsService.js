import { supabase } from '../lib/supabase'

function mapSettings(row) {
  return {
    firstPlacePrize: Number(row.first_place_prize),
    secondPlacePrize: Number(row.second_place_prize),
    thirdPlacePrize: Number(row.third_place_prize),
    logoUrl: row.logo_url,
  }
}

/** Single source of truth for the prize distribution — one row, read by
 * every player on the Banka page, writable only by Admin. */
async function get() {
  const { data, error } = await supabase
    .from('settings')
    .select('first_place_prize, second_place_prize, third_place_prize, logo_url')
    .eq('id', true)
    .single()
  if (error) throw error
  return mapSettings(data)
}

/** Public — works even logged out (see migration 0008's
 * get_league_logo_url). Deliberately bypasses settings' own has_access()
 * RLS so the custom logo can show on the login screen too, before anyone
 * is authenticated; returns only the logo URL, nothing else on the row. */
async function getLogoUrl() {
  const { data, error } = await supabase.rpc('get_league_logo_url')
  if (error) throw error
  return data
}

/** Admin-only (RLS — see migration 0008). */
async function setLogoUrl(logoUrl) {
  const { error } = await supabase
    .from('settings')
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq('id', true)
  if (error) throw error
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

const settingsService = { get, update, getLogoUrl, setLogoUrl }

export default settingsService
