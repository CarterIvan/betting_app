import { useEffect, useRef, useState } from 'react'
import { User, ChevronDown, Check, AlertCircle } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { LANGUAGES } from '../i18n/languages'
import { cx } from '../utils/formatters'

export default function ProfileMenu() {
  const { logout, uploadAvatar } = useAppData()
  const { t, language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', text }
  const wrapRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handlePickPhoto = () => {
    setOpen(false)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file again later
    if (!file) return
    setUploading(true)
    setFeedback(null)
    try {
      await uploadAvatar(file)
      setFeedback({ type: 'success', text: t('profile.photoUploaded') })
    } catch (err) {
      const message = t(err.message)
      setFeedback({ type: 'error', text: message !== err.message ? message : t('profile.photoUploadFailed') })
    } finally {
      setUploading(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  const handleLogout = () => {
    setOpen(false)
    logout()
  }

  return (
    <div className="profile-menu-wrap" ref={wrapRef}>
      <button className="logout-link" onClick={() => setOpen((v) => !v)}>
        <User size={13} />
        {t('profile.trigger')}
        <ChevronDown size={12} className={cx('profile-menu-chevron', open && 'open')} />
      </button>

      {open && (
        <div className="profile-menu">
          <button className="profile-menu-item" onClick={handlePickPhoto} disabled={uploading}>
            <span>📷</span> {uploading ? t('profile.uploading') : t('profile.uploadPhoto')}
          </button>

          <div className="profile-menu-divider" />
          <div className="profile-lang-section">
            <span className="profile-lang-label">🌐 {t('profile.language')}</span>
            <div className="profile-lang-flags">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={cx('profile-lang-flag-btn', lang.code === language && 'active')}
                  onClick={() => setLanguage(lang.code)}
                  title={lang.nativeName}
                >
                  {lang.flag}
                </button>
              ))}
            </div>
          </div>
          <div className="profile-menu-divider" />

          <button className="profile-menu-item" onClick={handleLogout}>
            <span>🚪</span> {t('profile.logout')}
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {feedback && (
        <div className="toast">
          {feedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {feedback.text}
        </div>
      )}
    </div>
  )
}
