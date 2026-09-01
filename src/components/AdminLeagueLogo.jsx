import { useRef, useState } from 'react'
import { Upload, Trash2, Check, AlertCircle } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/** Admin > Nastavenia ("League Settings") — the one, app-wide custom logo
 * (see migration 0008). Security lives server-side (Storage RLS + a
 * settings column grant, both admin-only); this is just the UI around it. */
export default function AdminLeagueLogo() {
  const { leagueLogoUrl, updateLeagueLogo, removeLeagueLogo } = useAppData()
  const { t } = useLanguage()
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', text }
  const fileInputRef = useRef(null)

  const handlePick = () => fileInputRef.current?.click()

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file again later
    if (!file) return

    const localPreviewUrl = URL.createObjectURL(file)
    setPreview(localPreviewUrl)
    setUploading(true)
    setFeedback(null)
    try {
      await updateLeagueLogo(file)
      setFeedback({ type: 'success', text: t('admin.logoUploaded') })
    } catch (err) {
      const message = t(err.message)
      setFeedback({ type: 'error', text: message !== err.message ? message : t('admin.logoUploadFailed') })
    } finally {
      setUploading(false)
      URL.revokeObjectURL(localPreviewUrl)
      setPreview(null)
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    setFeedback(null)
    try {
      await removeLeagueLogo()
      setFeedback({ type: 'success', text: t('admin.logoRemoved') })
    } catch {
      setFeedback({ type: 'error', text: t('admin.logoRemoveFailed') })
    } finally {
      setRemoving(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  const displaySrc = preview || leagueLogoUrl || '/tipovacka-logo.png'

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="admin-menu-sub" style={{ marginBottom: 12, fontWeight: 800, color: 'var(--navy)', fontSize: 13 }}>
        {t('admin.leagueLogoTitle')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <img
          src={displaySrc}
          alt={t('admin.leagueLogoTitle')}
          style={{
            width: 60, height: 60, objectFit: 'contain', borderRadius: 12,
            background: '#f4f6fa', padding: 6, flexShrink: 0,
          }}
        />
        <div style={{ fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 }}>
          {leagueLogoUrl ? t('admin.leagueLogoCustomNote') : t('admin.leagueLogoDefaultNote')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-outline btn-sm" onClick={handlePick} disabled={uploading || removing} type="button">
          <Upload size={14} />
          {uploading ? t('admin.logoUploading') : leagueLogoUrl ? t('admin.changeLogoButton') : t('admin.uploadLogoButton')}
        </button>
        {leagueLogoUrl && (
          <button className="btn btn-outline btn-sm" onClick={handleRemove} disabled={uploading || removing} type="button">
            <Trash2 size={14} />
            {removing ? t('admin.logoRemoving') : t('admin.removeLogoButton')}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {feedback && (
        <div className={feedback.type === 'error' ? 'login-error' : 'saved-note'} style={{ marginTop: 10 }}>
          {feedback.type === 'success' && <Check size={13} />}
          {feedback.type === 'error' && <AlertCircle size={13} style={{ marginRight: 5, verticalAlign: -2 }} />}
          {feedback.text}
        </div>
      )}
    </div>
  )
}
