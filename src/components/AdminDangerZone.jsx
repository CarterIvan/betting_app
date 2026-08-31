import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/** Admin > Nastavenia (bottom) — permanently wipes the league. Real
 * enforcement lives server-side (admin-reset-league Edge Function +
 * reset_league_data() RPC, both independently re-check admin status); this
 * is just the confirm-before-you-do-it UI around it. */
export default function AdminDangerZone() {
  const { resetLeague } = useAppData()
  const { t } = useLanguage()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleConfirm = async () => {
    setResetting(true)
    setError('')
    try {
      await resetLeague()
      setConfirmOpen(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(t(err.message))
    } finally {
      setResetting(false)
    }
  }

  const handleCancel = () => {
    if (resetting) return
    setConfirmOpen(false)
    setError('')
  }

  return (
    <div className="admin-danger-zone" style={{ marginTop: 22 }}>
      <p>{t('admin.dangerZoneDescription')}</p>
      <button className="btn btn-danger-solid btn-block" onClick={() => setConfirmOpen(true)}>
        <AlertTriangle size={15} />
        {t('admin.finishLeagueButton')}
      </button>

      {success && (
        <div className="saved-note" style={{ justifyContent: 'center', marginTop: 12 }}>
          {t('admin.resetSuccess')}
        </div>
      )}

      {confirmOpen && (
        <div className="modal-backdrop" onClick={handleCancel}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon modal-icon-danger">
              <AlertTriangle size={22} />
            </div>
            <div className="modal-title">{t('admin.confirmResetTitle')}</div>
            <p className="modal-text">{t('admin.confirmResetMessage')}</p>
            {error && <div className="login-error">{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-danger-solid btn-block" onClick={handleConfirm} disabled={resetting}>
                {resetting ? t('admin.resetting') : t('admin.confirmResetButton')}
              </button>
              <button className="btn btn-outline btn-block" onClick={handleCancel} disabled={resetting}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
