import { useState } from 'react'
import { Check, X, ChevronRight } from 'lucide-react'
import PlayerAvatar from './PlayerAvatar.jsx'
import AdminPlayerDetailModal from './AdminPlayerDetailModal.jsx'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { formatEuro, cx } from '../utils/formatters'

/** Admin > Hráči — shows every player's payment status and lets Admin flip
 * it, and opens the management panel (edit balance / delete — see
 * migration 0008) on click. Toggling PAID/UNPAID here is unrelated and
 * stays the quick, one-tap action it always was (see migration 0004) —
 * the badge stops the row click from also opening the panel. */
export default function AdminPlayersList() {
  const { players, setPlayerPaymentStatus } = useAppData()
  const { t, language } = useLanguage()
  const [pendingId, setPendingId] = useState(null)
  const [error, setError] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name, language))

  const handleToggle = async (e, player) => {
    e.stopPropagation()
    if (pendingId) return
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
          <button
            type="button"
            className="admin-player-row admin-player-row-clickable"
            key={player.id}
            onClick={() => setSelectedPlayer(player)}
          >
            <div className={cx('admin-player-avatar', player.isAdmin && 'avatar-admin')}>
              <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} />
            </div>
            <div className="admin-player-info">
              <span className="admin-player-name">{player.name}</span>
              <span className="admin-player-amount">{t('admin.deposit', { amount: formatEuro(player.paymentAmount, language) })}</span>
            </div>
            <span
              role="button"
              tabIndex={-1}
              className={cx('payment-badge', 'clickable', player.isPaid ? 'paid' : 'unpaid')}
              onClick={(e) => handleToggle(e, player)}
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
            </span>
            <ChevronRight size={16} className="admin-menu-chevron" />
          </button>
        ))}
      </div>

      {selectedPlayer && (
        <AdminPlayerDetailModal
          player={sorted.find((p) => p.id === selectedPlayer.id) ?? selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </>
  )
}
