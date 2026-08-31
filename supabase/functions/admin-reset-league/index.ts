// Admin-only: permanently resets the league to a fresh, empty state.
//
// Two phases:
//   1. reset_league_data() (SQL RPC, migration 0005) wipes chat messages,
//      predictions, matches, resets cached points and the prize
//      distribution — everything a plain Postgres function can safely do.
//      Called via the CALLER's own client (not service_role), so the
//      RPC's own internal `auth.uid()` admin re-check resolves correctly —
//      belt and suspenders with the check this function already did.
//   2. Every non-admin player's actual Supabase Auth account is deleted.
//      This requires the Admin API (service_role) — a Postgres function
//      cannot safely do this itself. Deleting the auth user cascades
//      (players -> predictions/chat) to remove their profile too, but by
//      this point those are already empty from step 1.
//
// See _shared/admin.ts for how the caller's admin status is verified
// before any of this runs.
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

    const { callerClient, adminClient } = await requireAdmin(req)

    const { error: rpcError } = await callerClient.rpc('reset_league_data')
    if (rpcError) {
      throw new HttpError(500, 'errors.resetFailed')
    }

    const { data: playersToRemove, error: listError } = await adminClient
      .from('players')
      .select('id')
      .eq('is_admin', false)

    if (listError) {
      throw new HttpError(500, 'errors.resetFailed')
    }

    const failures: string[] = []
    for (const player of playersToRemove ?? []) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(player.id)
      if (deleteError) {
        // Best-effort: keep removing everyone else. Whatever's left behind
        // already has no predictions/chat/points (step 1 wiped those), so
        // a stray leftover account is a cleanup issue, not a data leak.
        failures.push(player.id)
        console.error(`Failed to delete auth user ${player.id}:`, deleteError.message)
      }
    }

    const totalToRemove = playersToRemove?.length ?? 0
    if (totalToRemove > 0 && failures.length === totalToRemove) {
      // Every single deletion failed — something is systemically wrong
      // (e.g. a bad service_role key), worth surfacing as an error rather
      // than a silent partial success.
      throw new HttpError(500, 'errors.resetFailed')
    }

    return jsonResponse({ success: true, removedPlayers: totalToRemove - failures.length }, 200, corsHeaders)
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    const message = err instanceof HttpError ? err.message : 'errors.unexpected'
    return jsonResponse({ error: message }, status, corsHeaders)
  }
})
