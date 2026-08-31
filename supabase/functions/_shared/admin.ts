// Shared "is this caller actually an admin" check, used by every
// privileged Edge Function in this project. Never trusts a client-supplied
// isAdmin flag — always re-verifies against the database using the
// caller's OWN JWT (so it goes through RLS exactly like any other request
// from that player would), then only escalates to a service_role client
// for the specific operations that genuinely need it (the Auth Admin API).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

// Reads the platform-managed service-role-equivalent key from the new key
// system (SUPABASE_SECRET_KEYS, a JSON object keyed by key name — the
// project's key is under "default") instead of the legacy JWT-format
// SUPABASE_SERVICE_ROLE_KEY. Both are auto-injected by Supabase; this just
// points the function at the non-legacy one so nothing in this project
// depends on the legacy key anymore.
function requiredServiceRoleKey(): string {
  const raw = requiredEnv('SUPABASE_SECRET_KEYS')
  let parsed: Record<string, string>
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('SUPABASE_SECRET_KEYS is not valid JSON')
  }
  const key = parsed.default
  if (!key) throw new Error('SUPABASE_SECRET_KEYS has no "default" entry')
  return key
}

export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new HttpError(401, 'errors.unauthorized')
  }

  const supabaseUrl = requiredEnv('SUPABASE_URL')
  const anonKey = requiredEnv('SUPABASE_ANON_KEY')
  const serviceRoleKey = requiredServiceRoleKey()

  // Authenticated AS THE CALLER (their JWT, not service_role) — subject to
  // RLS exactly like a normal request from the app would be.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData?.user) {
    throw new HttpError(401, 'errors.unauthorized')
  }

  const { data: profile, error: profileError } = await callerClient
    .from('players')
    .select('id, is_admin')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile?.is_admin) {
    throw new HttpError(403, 'errors.unauthorized')
  }

  // Only reachable once the caller is confirmed admin — used exclusively
  // for the operations that require it (Admin Auth API calls).
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  return { callerClient, adminClient, adminId: userData.user.id }
}

export function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Logs the FULL Postgres/PostgREST error (message/code/details/hint) with
 * a labeled context, so it actually shows up in `supabase functions logs`.
 * Nothing upstream of this was doing that before — a query failing just
 * turned into a generic message with zero trace of why. */
export function logSupabaseError(context: string, error: unknown) {
  const e = (error ?? {}) as { message?: string; code?: string; details?: string; hint?: string }
  console.error(`[${context}]`, {
    message: e.message ?? String(error),
    code: e.code,
    details: e.details,
    hint: e.hint,
  })
}

/** Turns a PostgREST/Postgres error from a failed RPC call into a specific,
 * actionable i18n key instead of one generic catch-all — so "the function
 * doesn't exist yet" (a migration that hasn't been applied) is reported as
 * exactly that, not confused with an actual runtime failure inside the
 * function. PGRST202 is PostgREST's code for "could not find the function
 * in the schema cache"; 42501 is Postgres' own insufficient_privilege,
 * which reset_league_data() raises itself if its own admin re-check ever
 * fails despite this Edge Function's own check having just passed. */
export function classifyRpcError(error: unknown): string {
  const e = (error ?? {}) as { message?: string; code?: string }
  const message = (e.message ?? '').toLowerCase()

  if (e.code === 'PGRST202' || message.includes('could not find the function')) {
    return 'errors.resetFunctionMissing'
  }
  if (e.code === '42501') {
    return 'errors.unauthorized'
  }
  return 'errors.resetFailed'
}
