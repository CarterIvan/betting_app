import { supabase } from '../lib/supabase'

const SELECT_COLUMNS =
  'id, player_id, match_id, predicted_home_score, predicted_away_score, points, save_count, created_at, updated_at'

function mapPrediction(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    matchId: row.match_id,
    predictedHome: row.predicted_home_score,
    predictedAway: row.predicted_away_score,
    points: row.points,
    saveCount: row.save_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Fetches whatever RLS allows the caller to see (see migration 0009): the
 * caller's own prediction for every match, plus everyone's predictions for
 * matches that have started or finished — never another player's pick for
 * a match that hasn't kicked off yet. Live/History/Admin Matches all fetch
 * through this same call; no separate "admin" or "own" fetch exists. */
async function getAll() {
  const { data, error } = await supabase.from('predictions').select(SELECT_COLUMNS)
  if (error) throw error
  return data.map(mapPrediction)
}

/** Create-or-update the caller's own prediction for one match. RLS enforces
 * player_id = auth.uid() AND the match hasn't kicked off yet; a database
 * trigger separately enforces the two-save cap (see migration 0002) by
 * incrementing `save_count` and rejecting a third attempt outright. Either
 * can reject the write — this throws rather than silently succeeding.
 *
 * Returns the saved row (including the post-save `saveCount`) so the UI
 * knows immediately whether this was the first save (→ show the "one
 * change left" popup) or the second (→ show the final-change confirmation
 * and lock), without waiting for a separate refetch. */
async function save(playerId, matchId, predictedHome, predictedAway) {
  const { data, error } = await supabase
    .from('predictions')
    .upsert(
      {
        player_id: playerId,
        match_id: matchId,
        predicted_home_score: predictedHome,
        predicted_away_score: predictedAway,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'player_id,match_id' }
    )
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return mapPrediction(data)
}

/** Aggregate-only completion count per non-finished match — "3 of 13
 * players have submitted", never who or what (see migration 0010's
 * get_predictions_completion, SECURITY DEFINER, returns counts only). This
 * is how the Dashboard's completion ring gets a real number for an
 * upcoming match without ever fetching other players' prediction rows. */
async function getCompletion() {
  const { data, error } = await supabase.rpc('get_predictions_completion')
  if (error) throw error
  return data.map((row) => ({
    matchId: row.match_id,
    submittedCount: Number(row.submitted_count),
    totalPlayers: Number(row.total_players),
  }))
}

const predictionsService = { getAll, save, getCompletion }

export default predictionsService
