// Admin-only: permanently resets the league to a fresh, empty state.
//
// Three phases, ordered to minimize damage if something fails partway:
//   1. clear_result_correction_and_announcement_data() (SQL RPC, migration
//      0015) wipes the Result Correction and League Announcements tables.
//      This has to run FIRST — those tables reference players with ON
//      DELETE NO ACTION (deliberately, to protect a single targeted
//      admin_delete_player() call — see that migration), so step 2 below
//      cannot remove a player who still has any row in them.
//   2. Every non-admin player's actual Supabase Auth account is deleted.
//      This requires the Admin API (service_role) — a Postgres function
//      cannot safely do this itself.
//   3. Only once every account removal has succeeded (or there was
//      nothing to remove) does reset_league_data() (SQL RPC, migration
//      0005/0006) run, wiping chat messages, predictions, matches, and
//      resetting cached points and the prize distribution. That RPC's own
//      body is a single implicit transaction — it is all-or-nothing on its
//      own — and it's called via the CALLER's own client (not
//      service_role), so its internal `auth.uid()` admin re-check resolves
//      correctly, belt and suspenders with the check this function already
//      did.
//
// Running account removal BEFORE the league-wide wipe (rather than after,
// as this originally did) means: if account removal fails partway, the
// competition's matches/predictions/chat/points are untouched — the
// smaller, more recoverable side effect is the one left behind on failure,
// never the larger one. Step 1 is a genuine prerequisite for step 2 (not
// optional), so it's the one thing here that necessarily commits before
// player removal is even attempted.
//
// See _shared/admin.ts for how the caller's admin status is verified
// before any of this runs.
import { corsHeaders } from '../_shared/cors.ts'
import { requireAdmin, HttpError, jsonResponse, logSupabaseError, classifyRpcError } from '../_shared/admin.ts'

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
