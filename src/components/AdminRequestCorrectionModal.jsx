import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/** Admin > Zápasy > Dokončené — the ONLY way to change a finished match's
 * result. finish_match() itself now rejects being called again once a
 * match is finished (see migration 0012) — this instead creates a
 * correction request that every other active member must unanimously
 * approve before the score actually changes. Security lives entirely
 * server-side (request_result_correction re-checks admin status, the
 * match's finished state, and snapshots eligible voters atomically); this
 * is just the UI around it. */
export default function AdminRequestCorrectionModal({ match, onClose }) {
  const { requestResultCorrection } = useAppData()
  const { t } = useLanguage()

  const [homeScore, setHomeScore] = useState(String(match.finalHomeScore))
  const [awayScore, setAwayScore] = useState(String(match.finalAwayScore))
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (homeScore === '' || awayScore === '' || reason.trim() === '') {
      setError(t('admin.fillAllFields'))
      return
    }

    setError('')
    setSubmitting(true)
    try {
      await requestResultCorrection(match.id, Number(homeScore), Number(awayScore), reason.trim())
      onClose()
    } catch (err) {
      const message = t(err.message)
      setError(message !== err.message ? message : t('admin.correctionRequestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !submitting && onClose()}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">
          <AlertTriangle size={22} />
        </div>
        <div className="modal-title">{t('admin.requestCorrectionTitle')}</div>
        {error && <div className="login-error">{error}</div>}

        <div className="correction-current-result">
          <span className="correction-current-result-label">{t('admin.currentResultLabel')}</span>
          <span className="correction-current-result-value">
            {match.finalHomeScore} : {match.finalAwayScore}
          </span>
        </div>

        <div className="admin-result-row" style={{ marginBottom: 14 }}>
          <input
            className="admin-result-input"
            inputMode="numeric"
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            placeholder="-"
          />
          <span className="score-sep">:</span>
          <input
            className="admin-result-input"
            inputMode="numeric"
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            placeholder="-"
          />
        </div>

        <div className="field" style={{ textAlign: 'left' }}>
          <label>{t('admin.correctionReasonLabel')}</label>
          <textarea
            className="correction-reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('admin.correctionReasonPlaceholder')}
            rows={3}
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-gold btn-block" type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('common.saving') : t('admin.submitCorrectionButton')}
          </button>
          <button className="btn btn-outline btn-block" type="button" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
