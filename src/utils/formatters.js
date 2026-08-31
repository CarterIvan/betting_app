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
