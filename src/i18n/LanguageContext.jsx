import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { LANGUAGE_CODES, DEFAULT_LANGUAGE } from './languages'
import en from './locales/en'
import sk from './locales/sk'
import sr from './locales/sr'
import de from './locales/de'
import es from './locales/es'

// One file per language, nothing else to touch to add a new one — see
// languages.js for the corresponding selector-metadata entry.
const DICTIONARIES = { en, sk, sr, de, es }

const STORAGE_KEY = 'tipovacka_language'

// Deliberately its own top-level provider (see main.jsx) — language is a
// device preference, not app data, so it must survive logout and even work
// on the Login page before any auth exists at all.
const LanguageContext = createContext(null)

function detectInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && LANGUAGE_CODES.includes(stored)) return stored
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through
  }

  // No explicit choice yet: browser language is only ever a suggestion,
  // never overrides an existing manual choice (see the check above, which
  // always wins first).
  const browserLang = (navigator.language || '').slice(0, 2).toLowerCase()
  if (LANGUAGE_CODES.includes(browserLang)) return browserLang

  return DEFAULT_LANGUAGE
}

function getByPath(dictionary, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), dictionary)
}

function interpolate(template, vars) {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? String(vars[key]) : match))
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(detectInitialLanguage)

  const setLanguage = useCallback((code) => {
    if (!LANGUAGE_CODES.includes(code)) return
    setLanguageState(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // best-effort persistence only
    }
  }, [])

  const t = useCallback(
    (key, vars) => {
      const dictionary = DICTIONARIES[language] || DICTIONARIES[DEFAULT_LANGUAGE]
      let value = getByPath(dictionary, key)
      if (value === undefined) {
        // Missing translation for the active language falls back to
        // English rather than showing a raw key to the user.
        value = getByPath(DICTIONARIES[DEFAULT_LANGUAGE], key)
      }
      if (typeof value !== 'string') return key
      return interpolate(value, vars)
    },
    [language]
  )

  const pluralPlayers = useCallback(
    (n) => {
      const dictionary = DICTIONARIES[language] || DICTIONARIES[DEFAULT_LANGUAGE]
      return dictionary.pluralPlayers(n)
    },
    [language]
  )

  const value = useMemo(
    () => ({ language, setLanguage, t, pluralPlayers }),
    [language, setLanguage, t, pluralPlayers]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
