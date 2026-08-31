import { useEffect, useRef, useState } from 'react'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { LANGUAGES } from '../i18n/languages'
import { cx } from '../utils/formatters'

/** Premium/minimal language dropdown — used on the Login page. Reused
 * anywhere else a full picker (not just a quick flag row) makes sense. */
export default function LanguageSelector({ className }) {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className={cx('language-selector', className)} ref={wrapRef}>
      <button type="button" className="language-selector-trigger" onClick={() => setOpen((v) => !v)}>
        <Globe size={13} />
        <span>{current.flag} {current.nativeName}</span>
        <ChevronDown size={12} className={cx('language-selector-chevron', open && 'open')} />
      </button>

      {open && (
        <div className="language-selector-menu">
          {LANGUAGES.map((lang) => (
            <button
              type="button"
              key={lang.code}
              className={cx('language-selector-option', lang.code === language && 'active')}
              onClick={() => {
                setLanguage(lang.code)
                setOpen(false)
              }}
            >
              <span className="language-selector-flag">{lang.flag}</span>
              <span className="language-selector-name">{lang.nativeName}</span>
              {lang.code === language && <Check size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
