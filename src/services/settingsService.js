import { supabase } from '../lib/supabase'

function mapSettings(row) {
  return {
    firstPlacePrize: Number(row.first_place_prize),
    secondPlacePrize: Number(row.second_place_prize),
    thirdPlacePrize: Number(row.third_place_prize),
    logoUrl: row.logo_url,
    paymentIban: row.payment_iban,
    // Admin-entered, verbatim (never translated) Dashboard ticker text —
    // see migration 0023. null means no active ticker; the Dashboard
    // renders nothing in that case, never an empty container.
    tickerMessage: row.ticker_message,
  }
}

/** Single source of truth for the prize distribution — one row, read by
 * every player on the Banka page, writable only by Admin. */
async function get() {
  const { data, error } = await supabase
    .from('settings')
    .select('first_place_prize, second_place_prize, third_place_prize, logo_url, payment_iban, ticker_message')
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

/** Authenticated — works even for an unpaid, access-blocked player (see
 * migration 0018's get_payment_iban). Deliberately bypasses settings' own
 * has_access() RLS, same reasoning as getLogoUrl above, so the access-
 * blocked screen can show the admin-configured IBAN; returns only the
 * IBAN, nothing else on the row. */
async function getPaymentIban() {
  const { data, error } = await supabase.rpc('get_payment_iban')
  if (error) throw error
  return data
}

/** Admin-only (RLS — see migration 0018). */
async function setPaymentIban(paymentIban) {
  const { error } = await supabase
    .from('settings')
    .update({ payment_iban: paymentIban, updated_at: new Date().toISOString() })
    .eq('id', true)
  if (error) throw error
}

/** Admin-only (RLS — see migration 0023). Pass null to remove/disable the
 * ticker — the Dashboard then renders nothing, not an empty container. */
async function setTickerMessage(tickerMessage) {
  const { error } = await supabase
    .from('settings')
    .update({ ticker_message: tickerMessage, updated_at: new Date().toISOString() })
    .eq('id', true)
  if (error) throw error
}

/** Realtime: any change to the settings row (a ticker publish/edit/
 * removal, or any of prize/logo/IBAN) arrives here as the full new row,
 * mapped through the SAME mapSettings() used by get() — see migration
 * 0023. Returns an unsubscribe function, same shape as the other
 * services' subscribe(). */
function subscribe(onUpdate) {
  const channel = supabase
    .channel('public:settings')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'settings' },
      (payload) => onUpdate(mapSettings(payload.new))
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

const settingsService = {
  get,
  update,
  getLogoUrl,
  setLogoUrl,
  getPaymentIban,
  setPaymentIban,
  setTickerMessage,
  subscribe,
}

export default settingsService
