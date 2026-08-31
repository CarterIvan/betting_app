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

/** Rough "minute" display for a live match, purely cosmetic — derived from
 * elapsed time since kickoff, capped at 90'. */
export function getElapsedMinutes(match) {
  const elapsedMs = Date.now() - getKickoffTimestamp(match)
  const minutes = Math.max(1, Math.floor(elapsedMs / 60000))
  return Math.min(minutes, 90)
}
