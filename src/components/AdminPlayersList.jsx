import { useState } from 'react'
import { Check, X } from 'lucide-react'
import PlayerAvatar from './PlayerAvatar.jsx'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { formatEuro, cx } from '../utils/formatters'

/** Admin > Hráči — shows every player's payment status and lets Admin flip
 * it. Toggling PAID/UNPAID is the ONLY thing that grants or revokes app
 * access (see migration 0004) — nothing else to configure. */
export default function AdminPlayersList() {
  const { players, setPlayerPaymentStatus } = useAppData()
  const { t, language } = useLanguage()
  const [pendingId, setPendingId] = useState(null)
  const [error, setError] = useState('')

  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name, language))

  const handleToggle = async (player) => {
    setPendingId(player.id)
    setError('')
    try {
      await setPlayerPaymentStatus(player.id, !player.isPaid)
    } catch {
      setError(t('admin.paymentStatusChangeFailed'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      {error && <div className="login-error">{error}</div>}
      <div className="admin-players-list">
        {sorted.map((player) => (
          <div className="admin-player-row" key={player.id}>
            <div className={cx('admin-player-avatar', player.isAdmin && 'avatar-admin')}>
              <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} />
            </div>
            <div className="admin-player-info">
              <span className="admin-player-name">{player.name}</span>
              <span className="admin-player-amount">{t('admin.deposit', { amount: formatEuro(player.paymentAmount, language) })}</span>
            </div>
            <button
              className={cx('payment-badge', 'clickable', player.isPaid ? 'paid' : 'unpaid')}
              onClick={() => handleToggle(player)}
              disabled={pendingId === player.id}
              title={t('admin.paymentStatusHint')}
            >
              {pendingId === player.id ? (
                '…'
              ) : player.isPaid ? (
                <>
                  <Check size={12} /> {t('admin.paid')}
                </>
              ) : (
                <>
                  <X size={12} /> {t('admin.unpaid')}
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
