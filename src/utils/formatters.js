import { INTL_LOCALE_TAGS } from '../i18n/languages'

function localeTag(language) {
  return INTL_LOCALE_TAGS[language] || INTL_LOCALE_TAGS.en
}

/** Short weekday + day.month, in the given UI language — e.g. "Mon 31.8"
 * in English, "Po 31.8" in Slovak. Native `Intl` formatting, so adding a
 * new language never means hand-writing another weekday-name table. */
export function formatDate(dateStr, language) {
  const d = new Date(`${dateStr}T00:00:00`)
  return new Intl.DateTimeFormat(localeTag(language), { weekday: 'short', day: 'numeric', month: 'numeric' }).format(d)
}

export function formatTime(timeStr) {
  return timeStr
}

export function formatClock(timestamp) {
  const d = new Date(timestamp)
  return d.toTimeString().slice(0, 5)
}

export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

/** Picks navy or white text for readability against one or more background
 * colors (relative-luminance approximation, averaged across all of them) —
 * used by TeamBadge's generated crest fallback, where a custom team's
 * primary/secondary colors are chosen freely by the admin and could be
 * anything, including light ones a fixed white fill would disappear on. */
export function getReadableTextColor(...hexColors) {
  const luminances = hexColors.map((hex) => {
    const clean = (hex || '').replace('#', '')
    const r = parseInt(clean.slice(0, 2), 16) || 0
    const g = parseInt(clean.slice(2, 4), 16) || 0
    const b = parseInt(clean.slice(4, 6), 16) || 0
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  })
  const avgLuminance = luminances.reduce((sum, l) => sum + l, 0) / luminances.length
  return avgLuminance > 150 ? '#0B1E3D' : '#FFFFFF'
}

/** Currency is deliberately independent of language (always EUR) — only
 * the number formatting (decimal separator, grouping) follows the UI
 * language. */
export function formatEuro(amount, language) {
  const n = Number(amount) || 0
  const formatted = new Intl.NumberFormat(localeTag(language), {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n)
  return `${formatted} €`
}
