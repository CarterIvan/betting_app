// Supported languages, in display order. `nativeName` is what the selector
// shows (never the English name of the language). Adding a new language
// later is exactly: one entry here + one file in ./locales — nothing else
// in the app needs to change (see LanguageContext.jsx).
export const LANGUAGES = [
  { code: 'en', nativeName: 'English', flag: '🇬🇧' },
  { code: 'sk', nativeName: 'Slovenčina', flag: '🇸🇰' },
  { code: 'sr', nativeName: 'Srpski', flag: '🇷🇸' },
  { code: 'de', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', nativeName: 'Español', flag: '🇪🇸' },
]

export const DEFAULT_LANGUAGE = 'en'

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code)

// BCP-47 tags for Intl.DateTimeFormat / Intl.NumberFormat — separate from
// the app-internal `code` above since a locale-aware Intl tag and a short
// i18n key don't always coincide.
export const INTL_LOCALE_TAGS = {
  en: 'en-GB',
  sk: 'sk-SK',
  sr: 'sr-RS',
  de: 'de-DE',
  es: 'es-ES',
}
