export const MATCH_STATUS = {
  UPCOMING: 'UPCOMING',
  LIVE: 'LIVE',
  FINISHED: 'FINISHED',
}

export function getKickoffTimestamp(match) {
  // `startTimestamp` is the real absolute instant (see matchesService's
  // mapMatch) — comparing it directly to Date.now() is correct regardless
  // of anyone's local timezone. Previously this re-parsed the decomposed
  // `date`/`startTime` display strings, which was fragile by construction
  // (see the date-shift bug fix) and unnecessary now that the authoritative
  // instant is carried through directly.
  return match.startTimestamp
}

export function getMatchStatus(match) {
  if (match.finished) return MATCH_STATUS.FINISHED
  if (Date.now() >= getKickoffTimestamp(match)) return MATCH_STATUS.LIVE
  return MATCH_STATUS.UPCOMING
}

function getRawElapsedMinutes(match) {
  const elapsedMs = Date.now() - getKickoffTimestamp(match)
  return Math.max(1, Math.floor(elapsedMs / 60000))
}

/** Rough "minute" display for a live match, purely cosmetic — derived from
 * elapsed time since kickoff, capped at 90'. */
export function getElapsedMinutes(match) {
  return Math.min(getRawElapsedMinutes(match), 90)
}

// Sentinel returned by getLiveMinuteDisplay while the simulated halftime
// break is shown instead of a minute — components check for this exact
// value to know to render the localized halftime label instead of "N'".
export const HALFTIME_DISPLAY = 'HALFTIME'

/** Same live-match display purpose as getElapsedMinutes above, but
 * simulates a 15-minute halftime break: real elapsed minutes 47 through
 * 61 pause the visible clock (HALFTIME_DISPLAY instead of a minute), then
 * it resumes at 47' for real elapsed minute 62 (raw minutes minus 15,
 * capped at 90 same as getElapsedMinutes). Display-only — start_time,
 * getMatchStatus(), and getElapsedMinutes() itself are all unaffected. */
export function getLiveMinuteDisplay(match) {
  const raw = getRawElapsedMinutes(match)
  if (raw >= 47 && raw < 62) return HALFTIME_DISPLAY
  const adjusted = raw >= 62 ? raw - 15 : raw
  return Math.min(adjusted, 90)
}

/** Admin-entered current score for the Live page (migration 0020) —
 * "– : –" until BOTH liveHomeScore and liveAwayScore are set. Explicit
 * null/undefined checks, not a truthy check: 0 is a fully valid live
 * score and must not be treated as "unset". Completely separate from
 * finalHomeScore/finalAwayScore — never read for scoring. */
export function getLiveScoreDisplay(match) {
  const { liveHomeScore, liveAwayScore } = match
  if (liveHomeScore === null || liveHomeScore === undefined) return '– : –'
  if (liveAwayScore === null || liveAwayScore === undefined) return '– : –'
  return `${liveHomeScore} : ${liveAwayScore}`
}
