// ============================================================================
// PickMates — installation copy of the "admin-create-player" Edge Function
// ============================================================================
// SELF-CONTAINED version for pasting directly into the Supabase Dashboard's
// Edge Function editor (Dashboard > Edge Functions > Create Function). The
// Dashboard editor doesn't support this repo's multi-file `_shared/` import
// structure, so the two small shared helpers it needs (from
// supabase/functions/_shared/admin.ts and _shared/cors.ts) are inlined
// below instead. Behavior is byte-for-byte identical to the real function
// at supabase/functions/admin-create-player/index.ts — nothing about what
// it does was changed, only how its shared code is packaged.
//
// IMPORTANT: when creating this function in the Dashboard, name it exactly
//   admin-create-player
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

// ---- admin-create-player/index.ts body, unchanged --------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'errors.unexpected')
    }

    const { adminClient } = await requireAdmin(req)

    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    // No default here on purpose — the admin must explicitly enter what was
    // actually paid (0 is a valid, explicit answer; leaving it out is not).
    const paymentAmount = typeof body.paymentAmount === 'number' ? body.paymentAmount : Number(body.paymentAmount)

    if (!name || !email || !password || body.paymentAmount === undefined || body.paymentAmount === null || body.paymentAmount === '' || !Number.isFinite(paymentAmount) || paymentAmount < 0) {
      throw new HttpError(400, 'admin.fillAllFields')
    }
    if (password.length < 6) {
      throw new HttpError(400, 'errors.passwordTooShort')
    }

    // Fast, friendly duplicate-name check before ever touching Auth. The
    // case-insensitive unique index on players.name (migration 0005) is
    // the real backstop against a race between two simultaneous requests;
    // this is just what makes the common case return a clean error
    // instead of a generic "could not create user" failure.
    const escapedName = name.replace(/[%_]/g, (match) => `\\${match}`)
    const { data: existingByName } = await adminClient
      .from('players')
      .select('id')
      .ilike('name', escapedName)
      .maybeSingle()

    if (existingByName) {
      throw new HttpError(409, 'errors.duplicateName')
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })

    if (error) {
      const message = (error.message || '').toLowerCase()
      if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
        throw new HttpError(409, 'errors.duplicateEmail')
      }
      throw new HttpError(400, 'errors.createFailed')
    }

    // handle_new_user() (migration 0001) already created the players row
    // with payment_amount at its column default — this sets it to what the
    // admin actually entered. The account itself is already created and
    // usable at this point, so a failure here is logged but doesn't fail
    // the whole request; the admin can still correct it from the Players
    // list same as any other payment edit.
    if (data.user?.id) {
      const { error: paymentUpdateError } = await adminClient
        .from('players')
        .update({ payment_amount: paymentAmount })
        .eq('id', data.user.id)
      if (paymentUpdateError) {
        logSupabaseError('set payment_amount on new player', paymentUpdateError)
      }
    }

    return jsonResponse({ id: data.user?.id }, 200, corsHeaders)
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    const message = err instanceof HttpError ? err.message : 'errors.unexpected'
    return jsonResponse({ error: message }, status, corsHeaders)
  }
})
