import { useEffect, useState } from 'react'
import { Lock, Check, AlertCircle } from 'lucide-react'
import PredictionLimitModal from './PredictionLimitModal.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function PredictionInput({ prediction, locked, onSave }) {
  const { t } = useLanguage()
  const [home, setHome] = useState(prediction?.predictedHome ?? '')
  const [away, setAway] = useState(prediction?.predictedAway ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showLimitPopup, setShowLimitPopup] = useState(false)

  useEffect(() => {
    setHome(prediction?.predictedHome ?? '')
    setAway(prediction?.predictedAway ?? '')
  }, [prediction?.predictedHome, prediction?.predictedAway])

  const sanitize = (value) => value.replace(/[^0-9]/g, '').slice(0, 2)

  const canSave = home !== '' && away !== '' && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const saved = await onSave(Number(home), Number(away))
      if (saved?.saveCount === 1) {
        // First save on this match — nothing to confirm inline, the popup
        // itself is the confirmation.
        setShowLimitPopup(true)
      } else {
        // Second (final) save — no popup, just a short confirmation before
        // the parent re-renders this into the locked view.
        setNotice(t('matches.finalChangeNotice'))
        setTimeout(() => setNotice(''), 4000)
      }
    } catch (err) {
      // These substring checks inspect the raw Postgres/RLS error text
      // (which stays in the database's own language, see migrations
      // 0002/0004) — only the DISPLAYED message below is translated.
      const message = err.message || ''
      if (message.includes('vyčerpali')) {
        setError(t('matches.errorLimitReached'))
      } else if (message.toLowerCase().includes('permission') || err.code === '42501') {
        setError(t('matches.errorMatchStarted'))
      } else {
        setError(t('matches.errorSaveFailed'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="prediction-block">
      <div className="prediction-label">{t('matches.myTip')}</div>

      {locked ? (
        <>
          <div className="prediction-row">
            <input className="score-input" value={home === '' ? '-' : home} disabled readOnly />
            <span className="score-sep">:</span>
            <input className="score-input" value={away === '' ? '-' : away} disabled readOnly />
          </div>
          <div className="locked-note">
            <Lock size={13} />
            {t('matches.tipLocked')}
          </div>
        </>
      ) : (
        <>
          <div className="prediction-row">
            <input
              className="score-input"
              inputMode="numeric"
              value={home}
              onChange={(e) => setHome(sanitize(e.target.value))}
              placeholder="0"
            />
            <span className="score-sep">:</span>
            <input
              className="score-input"
              inputMode="numeric"
              value={away}
              onChange={(e) => setAway(sanitize(e.target.value))}
              placeholder="0"
            />
          </div>
          <div className="prediction-actions">
            <button className="btn btn-primary btn-block btn-sm" disabled={!canSave} onClick={handleSave}>
              {saving ? t('common.saving') : t('matches.saveTip')}
            </button>
          </div>
        </>
      )}

      {notice && (
        <div className="saved-note">
          <Check size={13} /> {notice}
        </div>
      )}
      {error && (
        <div className="saved-note" style={{ color: 'var(--red)' }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {showLimitPopup && <PredictionLimitModal onClose={() => setShowLimitPopup(false)} />}
    </div>
  )
}
