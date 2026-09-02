import { useState } from 'react'
import { X } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/** Mounted once, app-wide (see Layout.jsx) — reuses the Result Correction
 * popup's exact CSS classes (.correction-popup-card/.correction-popup-close,
 * on top of the shared .modal-backdrop/.modal-card) so it's visually
 * identical without any new CSS. Closing with X only hides it for this
 * session/mount (never marks it read) — it reappears on the next login or
 * reload, since nothing about that dismissal is persisted anywhere. If the
 * member also has an unvoted pending result-correction request, this stays
 * hidden until that's resolved, rather than stacking two popups — deciding
 * that here means ResultCorrectionPopup itself needs no changes at all. */
export default function AnnouncementPopup() {
  const {
    currentUser,
    latestAnnouncement,
    myAnnouncementReadIds,
    correctionRequests,
    correctionVotes,
    acknowledgeAnnouncement,
  } = useAppData()
  const { t } = useLanguage()
  const [dismissed, setDismissed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const hasUnvotedCorrection = correctionRequests.some(
    (r) =>
      r.status === 'pending' &&
      correctionVotes.some((v) => v.requestId === r.id && v.playerId === currentUser?.id && v.vote === null)
  )

  const shouldShow =
    Boolean(currentUser) &&
    Boolean(latestAnnouncement) &&
    !myAnnouncementReadIds.includes(latestAnnouncement?.id) &&
    !dismissed &&
    !hasUnvotedCorrection

  if (!shouldShow) return null

  const handleOk = async () => {
    setError('')
    setSubmitting(true)
    try {
      await acknowledgeAnnouncement(latestAnnouncement.id)
    } catch (err) {
      const message = t(err.message)
      setError(message !== err.message ? message : t('admin.announcementAckFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card correction-popup-card">
        <button
          type="button"
          className="correction-popup-close"
          onClick={() => setDismissed(true)}
          aria-label={t('common.close')}
        >
          <X size={16} />
        </button>

        <div className="modal-title">{latestAnnouncement.title}</div>
        <p className="modal-text">{latestAnnouncement.message}</p>

        {error && <div className="login-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn btn-gold btn-block" type="button" onClick={handleOk} disabled={submitting}>
            {submitting ? t('common.saving') : t('common.ok')}
          </button>
        </div>
      </div>
    </div>
  )
}
