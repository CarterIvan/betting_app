import { supabase } from '../lib/supabase'

function mapRequest(row) {
  return {
    id: row.id,
    matchId: row.match_id,
    requestedBy: row.requested_by,
    oldHomeScore: row.old_home_score,
    oldAwayScore: row.old_away_score,
    newHomeScore: row.new_home_score,
    newAwayScore: row.new_away_score,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

function mapVote(row) {
  return {
    id: row.id,
    requestId: row.request_id,
    playerId: row.player_id,
    vote: row.vote,
    votedAt: row.voted_at,
  }
}

const REQUEST_COLUMNS =
  'id, match_id, requested_by, old_home_score, old_away_score, new_home_score, new_away_score, reason, status, created_at, resolved_at'
const VOTE_COLUMNS = 'id, request_id, player_id, vote, voted_at'

/** Every request, pending and resolved alike — this IS the permanent audit
 * trail (see migration 0012), so nothing is filtered out here; the caller
 * decides what to show where. */
async function getAllRequests() {
  const { data, error } = await supabase
    .from('result_correction_requests')
    .select(REQUEST_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(mapRequest)
}

/** One row per (request, eligible voter) — a row's mere existence is the
 * eligibility snapshot from request creation time; `vote` is null until
 * cast. Used to compute "X/Y confirmed" and "have I already voted". */
async function getAllVotes() {
  const { data, error } = await supabase.from('result_correction_votes').select(VOTE_COLUMNS)
  if (error) throw error
  return data.map(mapVote)
}

/** Admin-only (RPC re-checks independently — see migration 0012's
 * request_result_correction). Snapshots eligible voters server-side in the
 * same transaction as the request itself. */
async function request(matchId, newHomeScore, newAwayScore, reason) {
  const { data, error } = await supabase.rpc('request_result_correction', {
    p_match_id: matchId,
    p_new_home_score: newHomeScore,
    p_new_away_score: newAwayScore,
    p_reason: reason,
  })
  if (error) throw error
  return data
}

/** RPC re-checks the caller actually holds an unvoted seat on this request
 * (see migration 0012's vote_on_result_correction) — a single rejection
 * resolves the request immediately; unanimous approval atomically applies
 * the new score and recalculates points via the same logic finish_match()
 * already uses. */
async function vote(requestId, approve) {
  const { error } = await supabase.rpc('vote_on_result_correction', {
    p_request_id: requestId,
    p_approve: approve,
  })
  if (error) throw error
}

const resultCorrectionService = { getAllRequests, getAllVotes, request, vote }

export default resultCorrectionService
