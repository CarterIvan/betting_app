import { AlarmClockCheck } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/** Shown once, right after a player's FIRST save on a match — purely
 * informational, both buttons just dismiss it (the prediction is already
 * saved either way). */
export default function PredictionLimitModal({ onClose }) {
  const { t } = useLanguage()
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">
          <AlarmClockCheck size={22} />
        </div>
        <div className="modal-title">{t('matches.oneChangeLeftTitle')}</div>
        <p className="modal-text">{t('matches.oneChangeLeftText')}</p>
        <div className="modal-actions">
          <button className="btn btn-primary btn-block" onClick={onClose}>{t('matches.understood')}</button>
          <button className="btn btn-outline btn-block" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  )
}
