// ============================================================================
// PickMates — installation copy of the "admin-reset-league" Edge Function
// ============================================================================
// SELF-CONTAINED version for pasting directly into the Supabase Dashboard's
// Edge Function editor (Dashboard > Edge Functions > Create Function). The
// Dashboard editor doesn't support this repo's multi-file `_shared/` import
// structure, so the shared helpers it needs (from
// supabase/functions/_shared/admin.ts and _shared/cors.ts) are inlined
// below instead. Behavior is byte-for-byte identical to the real function
// at supabase/functions/admin-reset-league/index.ts — nothing about what
// it does was changed, only how its shared code is packaged.
//
// IMPORTANT: when creating this function in the Dashboard, name it exactly
//   admin-reset-league
// The frontend calls it by that exact name — a different name will 404.
//
// This file is not deployed by the Supabase CLI (it lives outside
// supabase/functions/ on purpose, so `supabase functions deploy` never
// picks it up) — it exists only to be copy/pasted through the Dashboard.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'

// ---- inlined from supabase/functions/_shared/cors.ts ----------------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ---- inlined from supabase/functions/_shared/admin.ts ---------------------
class HttpError extends Error {
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

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new HttpError(401, 'errors.unauthorized')
  }

  const supabaseUrl = requiredEnv('SUPABASE_URL')
  const anonKey = requiredEnv('SUPABASE_ANON_KEY')
  const serviceRoleKey = requiredServiceRoleKey()

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

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  return { callerClient, adminClient, adminId: userData.user.id }
}

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function logSupabaseError(context: string, error: unknown) {
  const e = (error ?? {}) as { message?: string; code?: string; details?: string; hint?: string }
  console.error(`[${context}]`, {
    message: e.message ?? String(error),
    code: e.code,
    details: e.details,
    hint: e.hint,
  })
}

function classifyRpcError(error: unknown): string {
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

// ---- admin-reset-league/index.ts body, unchanged ---------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'errors.unexpected')
    }

    const { callerClient, adminClient } = await requireAdmin(req)

    // result_correction_votes/requests and league_announcement_reads/
    // announcements (migrations 0012/0014) reference players with ON
    // DELETE NO ACTION — deliberately, to stop a targeted
    // admin_delete_player() call from removing an inconvenient voter. A
    // full reset is a different, all-encompassing operation, so those
    // rows have to be cleared explicitly before any non-admin player can
    // be removed below. See migration 0015.
    const { error: clearEngagementError } = await callerClient.rpc(
      'clear_result_correction_and_announcement_data'
    )
    if (clearEngagementError) {
      logSupabaseError('clear_result_correction_and_announcement_data RPC', clearEngagementError)
      throw new HttpError(500, classifyRpcError(clearEngagementError))
    }

    const { data: playersToRemove, error: listError } = await adminClient
      .from('players')
      .select('id')
      .eq('is_admin', false)

    if (listError) {
      logSupabaseError('list non-admin players', listError)
      throw new HttpError(500, 'errors.resetFailed')
    }

    const failures: string[] = []
    for (const player of playersToRemove ?? []) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(player.id)
      if (deleteError) {
        failures.push(player.id)
        logSupabaseError(`delete auth user ${player.id}`, deleteError)
      }
    }

    if (failures.length > 0) {
      // Do NOT proceed to the league-wide wipe — some accounts still
      // exist, so the reset is incomplete either way, and running the RPC
      // now would additionally destroy every match/prediction/chat message
      // for no benefit. Nothing beyond the already-deleted accounts (if
      // any partial progress happened) has changed at this point.
      throw new HttpError(500, 'errors.resetFailed')
    }

    const { error: rpcError } = await callerClient.rpc('reset_league_data')
    if (rpcError) {
      logSupabaseError('reset_league_data RPC', rpcError)
      throw new HttpError(500, classifyRpcError(rpcError))
    }

    return jsonResponse({ success: true, removedPlayers: playersToRemove?.length ?? 0 }, 200, corsHeaders)
  } catch (err) {
    if (!(err instanceof HttpError)) {
      logSupabaseError('admin-reset-league unexpected error', err)
    }
    const status = err instanceof HttpError ? err.status : 500
    const message = err instanceof HttpError ? err.message : 'errors.unexpected'
    return jsonResponse({ error: message }, status, corsHeaders)
  }
})
