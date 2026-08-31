import { supabase } from '../lib/supabase'

/** Invokes an admin-only Edge Function (see supabase/functions/) and
 * unwraps its `{ error: 'i18n.key' }` JSON body into a real thrown Error
 * carrying that key — matching how every other service in this app throws
 * i18n KEYS (not translated text) for the calling component to resolve
 * via t(err.message). supabase-js wraps a non-2xx response as a
 * FunctionsHttpError whose `.context` is the raw Response, hence the
 * awkward re-parse below. */
async function invoke(functionName, body) {
  const { data, error } = await supabase.functions.invoke(functionName, { body })
  if (error) {
    let key = 'errors.unexpected'
    try {
      const context = await error.context?.json?.()
      if (context?.error) key = context.error
    } catch {
      // no parseable body (network failure, function not deployed, etc.) —
      // fall back to the generic message set above
    }
    throw new Error(key)
  }
  return data
}

/** Admin-only. Creates a real Supabase Auth account for the player (via
 * the admin-create-player Edge Function, which is the only thing allowed
 * to touch service_role) — they can log in with `email`/`password`
 * immediately through the existing login screen. The trigger that already
 * creates the `players` profile row on signup handles the rest; the Edge
 * Function separately sets payment_amount to what was entered here. */
async function createPlayer({ name, email, password, paymentAmount }) {
  return invoke('admin-create-player', { name, email, password, paymentAmount })
}

/** Admin-only, extremely destructive. See admin-reset-league Edge
 * Function + reset_league_data() SQL RPC for what this actually deletes. */
async function resetLeague() {
  return invoke('admin-reset-league', {})
}

const adminActionsService = { createPlayer, resetLeague }

export default adminActionsService
