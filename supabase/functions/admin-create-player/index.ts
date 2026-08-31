// Admin-only: creates a real Supabase Auth user for a new player. This is
// the one part of "add player" that a Postgres function can't safely do —
// creating an auth.users row correctly (password hashing, GoTrue's
// internal invariants) requires the Admin API, which requires
// service_role, which must never run in the browser. See _shared/admin.ts
// for how the caller's admin status is verified first.
//
// The existing handle_new_user trigger (migration 0001) auto-creates the
// matching `players` profile row from user_metadata.name — nothing else
// to do on success.
import { corsHeaders } from '../_shared/cors.ts'
import { requireAdmin, HttpError, jsonResponse } from '../_shared/admin.ts'

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

    if (!name || !email || !password) {
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

    return jsonResponse({ id: data.user?.id }, 200, corsHeaders)
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    const message = err instanceof HttpError ? err.message : 'errors.unexpected'
    return jsonResponse({ error: message }, status, corsHeaders)
  }
})
