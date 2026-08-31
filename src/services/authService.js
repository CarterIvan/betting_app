// Real Supabase Auth. A player's login identity is their account email;
// the friendly display name shown throughout the app comes from their
// `players` profile row, not from Auth itself.

import { supabase } from '../lib/supabase'

function mapProfile(row) {
  return {
    id: row.id,
    name: row.name,
    isAdmin: row.is_admin,
    points: row.points,
    avatarUrl: row.avatar_url,
    isPaid: row.is_paid,
  }
}

async function fetchProfile(userId) {
  // A player can always read their OWN row regardless of payment status
  // (see players_select in migration 0004) — specifically so this can
  // determine "is this account paid yet" and the app can show the right
  // screen, even before access to anything else is granted.
  const { data, error } = await supabase
    .from('players')
    .select('id, name, is_admin, points, avatar_url, is_paid')
    .eq('id', userId)
    .single()
  if (error) throw error
  return mapProfile(data)
}

async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(mapAuthError(error))
  return fetchProfile(data.user.id)
}

async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

async function getCurrentUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null
  return fetchProfile(session.user.id)
}

/** Fires immediately with the current session, then again on every
 * sign-in/sign-out/token-refresh. Returns an unsubscribe function. */
function onAuthStateChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      callback(null)
      return
    }
    fetchProfile(session.user.id)
      .then(callback)
      .catch(() => callback(null))
  })
  return () => subscription.unsubscribe()
}

// Returns an i18n KEY (see src/i18n/locales/*.js), never translated text —
// this is a service file with no access to the current UI language; the
// component displaying the error resolves it via t(err.message).
function mapAuthError(error) {
  if (error.message?.toLowerCase().includes('invalid login credentials')) {
    return 'login.invalidCredentials'
  }
  if (error.message?.toLowerCase().includes('email not confirmed')) {
    return 'login.emailNotConfirmed'
  }
  return 'login.loginFailed'
}

const authService = { login, logout, getCurrentUser, onAuthStateChange, fetchProfile }

export default authService
