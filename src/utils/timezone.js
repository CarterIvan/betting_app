// All match kickoff times are entered and displayed as Europe/Bratislava
// wall-clock time — every player is there. `<input type="date">` /
// `<input type="time">` carry no timezone info of their own, so we can't
// just hand them to `new Date()` and trust the result: that would use
// whatever timezone the *browser's own OS* happens to be set to, which is
// usually Bratislava for these users but is never guaranteed to be, and
// mixing that assumption inconsistently across write/read paths is exactly
// what caused the original date-shift bug. Converting explicitly via this
// named IANA zone (DST-aware, no manual hour math) is correct regardless of
// the viewer's own machine.

export const MATCH_TIME_ZONE = 'Europe/Bratislava'

const zonedParts = new Intl.DateTimeFormat('en-US', {
  timeZone: MATCH_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function partsOf(date) {
  const parts = {}
  for (const { type, value } of zonedParts.formatToParts(date)) {
    parts[type] = value
  }
  return parts
}

/** The UTC offset (minutes, positive = ahead of UTC) Europe/Bratislava has
 * at the given absolute instant — 60 in winter (CET), 120 in summer (CEST).
 * Determined from the real IANA rules via Intl, not a fixed constant, so
 * the DST transition dates are always correct. */
function offsetMinutesAt(instant) {
  const p = partsOf(instant)
  const asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return Math.round((asIfUtc - instant.getTime()) / 60000)
}

/** Converts a Europe/Bratislava wall-clock date + time (from the admin
 * form) into the actual absolute instant it represents. */
export function bratislavaWallClockToDate(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offset = offsetMinutesAt(new Date(naiveUtcMs))
  return new Date(naiveUtcMs - offset * 60000)
}

/** Formats an absolute instant as the 'YYYY-MM-DD' it falls on in
 * Europe/Bratislava — for `<input type="date">` values and display. */
export function formatBratislavaDate(date) {
  const p = partsOf(date)
  return `${p.year}-${p.month}-${p.day}`
}

/** Formats an absolute instant as the 'HH:MM' it falls on in
 * Europe/Bratislava — for `<input type="time">` values and display. */
export function formatBratislavaTime(date) {
  const p = partsOf(date)
  return `${p.hour}:${p.minute}`
}
