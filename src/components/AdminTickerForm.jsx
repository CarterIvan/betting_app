import { useEffect, useState } from 'react'
import { Megaphone, Check, Trash2 } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/** Admin > Nastavenia — a single mutable Dashboard ticker message (see
 * migration 0023, settings.ticker_message). Deliberately edit-in-place,
 * unlike the member announcement above it: publishing here REPLACES the
 * current ticker rather than creating a new notification, since the
 * ticker has no acknowledgment concept — it's just "what's currently
 * shown", same shape as the league logo / payment IBAN forms elsewhere on
 * this page. The input starts pre-filled with whatever's currently
 * active, so editing and re-publishing is how the admin changes it —
 * there's no separate "edit mode" to switch into. */
export default function AdminTickerForm() {
  const { settings, updateTickerMessage } = useAppData()
  const { t } = useLanguage()
  const [message, setMessage] = useState(settings?.tickerMessage ?? '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [removing, setRemoving] = useState(false)

  // Only syncs in when the ACTIVE ticker actually changes (e.g. another
  // admin changed it, or after this admin's own save/remove completes),
  // never overwrites text being actively typed.
  useEffect(() => {
    setMessage(settings?.tickerMessage ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.tickerMessage])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim()) {
      setError(t('admin.fillAllFields'))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await updateTickerMessage(message.trim())
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      const msg = t(err.message)
      setError(msg !== err.message ? msg : t('admin.tickerSaveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async () => {
    setError('')
    setRemoving(true)
    try {
      await updateTickerMessage(null)
    } catch (err) {
      const msg = t(err.message)
      setError(msg !== err.message ? msg : t('admin.tickerSaveFailed'))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
      <div className="admin-menu-sub" style={{ marginBottom: 4, fontWeight: 800, color: 'var(--navy)', fontSize: 13 }}>
        {t('admin.tickerSectionTitle')}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-soft)', margin: '0 0 6px', fontWeight: 600 }}>
        {t('admin.tickerSectionHint')}
      </p>
      {settings?.tickerMessage && (
        <p className="admin-announcement-current-note">
          {t('admin.tickerCurrentLabel')} „{settings.tickerMessage}“
        </p>
      )}
      {error && <div className="login-error">{error}</div>}

      <div className="field">
        <label>{t('admin.tickerMessageLabel')}</label>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('admin.tickerMessagePlaceholder')}
        />
      </div>

      <button className="btn btn-gold btn-block" type="submit" disabled={submitting || removing}>
        <Megaphone size={16} />
        {submitting ? t('common.saving') : t('admin.publishTickerButton')}
      </button>

      {settings?.tickerMessage && (
        <button
          type="button"
          className="btn btn-outline btn-sm btn-block"
          style={{ marginTop: 8 }}
          onClick={handleRemove}
          disabled={submitting || removing}
        >
          <Trash2 size={14} /> {removing ? t('common.saving') : t('admin.removeTickerButton')}
        </button>
      )}

      {success && (
        <div className="saved-note" style={{ justifyContent: 'center', marginTop: 10 }}>
          <Check size={13} /> {t('admin.tickerPublished')}
        </div>
      )}
    </form>
  )
}
