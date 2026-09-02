import { useEffect, useState } from 'react'
import { Megaphone, Check } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { formatDate } from '../utils/formatters'

/** Admin > Podešavanja lige — publishing always creates a brand new
 * announcement (see migration 0014 / announcementService), never edits
 * one in place, so every republish is a fresh, unacknowledged notification
 * for every member — even ones who already dismissed a previous version.
 * The form starts pre-filled with whatever's currently published, so
 * "edit and republish" starts from the real current text. */
export default function AdminAnnouncementForm() {
  const { latestAnnouncement, publishAnnouncement } = useAppData()
  const { t, language } = useLanguage()
  const [title, setTitle] = useState(latestAnnouncement?.title ?? '')
  const [message, setMessage] = useState(latestAnnouncement?.message ?? '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Only syncs in from a freshly-fetched announcement (by id), never
  // overwrites text the admin is actively typing.
  useEffect(() => {
    if (latestAnnouncement) {
      setTitle(latestAnnouncement.title)
      setMessage(latestAnnouncement.message)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestAnnouncement?.id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      setError(t('admin.fillAllFields'))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await publishAnnouncement(title.trim(), message.trim())
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      const msg = t(err.message)
      setError(msg !== err.message ? msg : t('admin.announcementPublishFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
      <div className="admin-menu-sub" style={{ marginBottom: 4, fontWeight: 800, color: 'var(--navy)', fontSize: 13 }}>
        {t('admin.announcementSectionTitle')}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-soft)', margin: '0 0 6px', fontWeight: 600 }}>
        {t('admin.announcementSectionHint')}
      </p>
      {latestAnnouncement && (
        <p className="admin-announcement-current-note">
          {t('admin.announcementLastPublished', { date: formatDate(latestAnnouncement.createdAt.slice(0, 10), language) })}
        </p>
      )}
      {error && <div className="login-error">{error}</div>}

      <div className="field">
        <label>{t('admin.announcementTitleLabel')}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('admin.announcementTitlePlaceholder')}
        />
      </div>
      <div className="field">
        <label>{t('admin.announcementMessageLabel')}</label>
        <textarea
          className="correction-reason-input"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('admin.announcementMessagePlaceholder')}
        />
      </div>

      <button className="btn btn-gold btn-block" type="submit" disabled={submitting}>
        <Megaphone size={16} />
        {submitting ? t('common.saving') : t('admin.publishAnnouncementButton')}
      </button>

      {success && (
        <div className="saved-note" style={{ justifyContent: 'center', marginTop: 10 }}>
          <Check size={13} /> {t('admin.announcementPublished')}
        </div>
      )}
    </form>
  )
}
