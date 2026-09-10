import { supabase } from '../lib/supabase'
import { bratislavaWallClockToDate, formatBratislavaDate, formatBratislavaTime } from '../utils/timezone'

const SELECT_COLUMNS =
  'id, home_team_id, away_team_id, start_time, finished, final_home_score, final_away_score, round_name, live_home_score, live_away_score'

function mapMatch(row) {
  const start = new Date(row.start_time)
  return {
    id: row.id,
    homeTeam: row.home_team_id,
    awayTeam: row.away_team_id,
    // `startTimestamp` is the single source of truth for timing — the raw
    // absolute instant, straight off `start_time`, no reinterpretation at
    // all. Every LIVE/UPCOMING/FINISHED and elapsed-time calculation reads
    // this, so it's correct regardless of anyone's local timezone.
    startTimestamp: start.getTime(),
    // `date`/`startTime` are that SAME instant, both formatted through the
    // SAME Europe/Bratislava-aware helper — for the admin edit form's
    // plain date/time inputs and for display. (Previously `date` came from
    // `toISOString()` (UTC) while `startTime` came from `toTimeString()`
    // (browser-local) — two different frames that could disagree by a day;
    // that mismatch was the root cause of the date-shift bug.)
    date: formatBratislavaDate(start),
    startTime: formatBratislavaTime(start),
    finished: row.finished,
    finalHomeScore: row.final_home_score,
    finalAwayScore: row.final_away_score,
    // Optional, free-text round/stage label (e.g. "1. kolo", "Semifinále")
    // — see migration 0019. null for any match created before this
    // feature, or where the admin left it blank; the History page groups
    // those into a fallback "other matches" section.
    roundName: row.round_name,
    // Admin-entered, purely informational current score shown on the Live
    // page while the match is in progress — see migration 0020. Both null
    // for every match until the admin sets them; completely separate from
    // finalHomeScore/finalAwayScore above and never used for scoring.
    liveHomeScore: row.live_home_score,
    liveAwayScore: row.live_away_score,
  }
}

/** The admin form's <input type="date">/<input type="time"> values have no
 * timezone of their own — they're Europe/Bratislava wall-clock by
 * convention (every player is there), so they're converted to an absolute
 * instant explicitly against that zone, not via the browser's own ambient
 * timezone (which isn't guaranteed to be Bratislava). */
function toStartTimeIso(date, startTime) {
  return bratislavaWallClockToDate(date, startTime).toISOString()
}

async function getAll() {
  const { data, error } = await supabase.from('matches').select(SELECT_COLUMNS).order('start_time')
  if (error) throw error
  return data.map(mapMatch)
}

/** Optional round/stage label — blank means "not set" (stored as null, not
 * an empty string), same as leaving it out entirely. */
function toRoundNameOrNull(roundName) {
  const trimmed = typeof roundName === 'string' ? roundName.trim() : ''
  return trimmed || null
}

/** Admin-only (enforced by RLS): creates a new UPCOMING match. */
async function create({ homeTeam, awayTeam, date, startTime, roundName }) {
  const { error } = await supabase.from('matches').insert({
    home_team_id: homeTeam,
    away_team_id: awayTeam,
    start_time: toStartTimeIso(date, startTime),
    round_name: toRoundNameOrNull(roundName),
  })
  if (error) throw error
}

/** Admin-only (enforced by RLS): edits teams/kickoff/round. Cannot touch
 * finished/final scores — those columns aren't grantable to clients at all,
 * only finish_match() (server-side) can set them. */
async function update(matchId, { homeTeam, awayTeam, date, startTime, roundName }) {
  const { error } = await supabase
    .from('matches')
    .update({
      home_team_id: homeTeam,
      away_team_id: awayTeam,
      start_time: toStartTimeIso(date, startTime),
      round_name: toRoundNameOrNull(roundName),
    })
    .eq('id', matchId)
  if (error) throw error
}

/** Blank/empty input means "not set" — stored as null, not 0. Deliberately
 * distinct from a real 0, which is a fully valid live score. */
function toScoreOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Admin-only (enforced by RLS — see migration 0020). Sets ONLY the
 * informational live score shown on the Live page — deliberately separate
 * from update() above (teams/kickoff/round) and from finish() below (the
 * real result). Never touches final_home_score/final_away_score/finished,
 * never runs any scoring — those columns aren't even grantable to clients
 * (see migration 0001), only finish_match() can set them. */
async function updateLiveScore(matchId, { liveHomeScore, liveAwayScore }) {
  const { error } = await supabase
    .from('matches')
    .update({
      live_home_score: toScoreOrNull(liveHomeScore),
      live_away_score: toScoreOrNull(liveAwayScore),
    })
    .eq('id', matchId)
  if (error) throw error
}

/** Admin-only (enforced by RLS). Predictions for this match cascade-delete. */
async function remove(matchId) {
  const { error } = await supabase.from('matches').delete().eq('id', matchId)
  if (error) throw error
}

/** The entire "close match + score everyone" pipeline runs server-side in
 * one atomic Postgres function — see finish_match() in the SQL migration.
 * The RPC re-checks admin status itself, so this is safe even if a
 * non-admin somehow triggers it from a modified client. */
async function finish(matchId, finalHomeScore, finalAwayScore) {
  const { error } = await supabase.rpc('finish_match', {
    p_match_id: matchId,
    p_final_home_score: finalHomeScore,
    p_final_away_score: finalAwayScore,
  })
  if (error) throw error
}

/** Admin-only maintenance utility — re-derives all points from scratch. */
async function recalculateAllPoints() {
  const { error } = await supabase.rpc('recalculate_all_points')
  if (error) throw error
}

const matchesService = { getAll, create, update, updateLiveScore, remove, finish, recalculateAllPoints }

export default matchesService
