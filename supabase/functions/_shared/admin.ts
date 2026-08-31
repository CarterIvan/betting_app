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

export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new HttpError(401, 'errors.unauthorized')
  }

  const supabaseUrl = requiredEnv('SUPABASE_URL')
  const anonKey = requiredEnv('SUPABASE_ANON_KEY')
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

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
