import { useEffect, useState } from 'react'
import { X, Wallet, Trash2, AlertTriangle } from 'lucide-react'
import PlayerAvatar from './PlayerAvatar.jsx'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { formatEuro, cx } from '../utils/formatters'

/** Admin > Hráči — opened by clicking a player row. Shows their details and
 * the two admin actions (edit balance / delete player), each behind its own
 * confirmation step. Security lives server-side (RLS + admin-only RPCs —
 * see migration 0008); this is just the UI around it. */
export default function AdminPlayerDetailModal({ player, onClose }) {
  const { getPlayerEmail, editPlayerBalance, deletePlayer } = useAppData()
  const { t, language } = useLanguage()

  const [view, setView] = useState('details') // details | editBalance | confirmBalance | confirmDelete
  const [email, setEmail] = useState(null)
  const [balanceInput, setBalanceInput] = useState(String(player.paymentAmount))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getPlayerEmail(player.id)
      .then((value) => { if (!cancelled) setEmail(value) })
      .catch(() => { if (!cancelled) setEmail(null) })
    return () => { cancelled = true }
  }, [player.id, getPlayerEmail])

  const newBalance = Number(balanceInput)
  const balanceValid = balanceInput.trim() !== '' && Number.isFinite(newBalance) && newBalance >= 0

  const handleSaveBalance = () => {
    if (!balanceValid) return
    setError('')
    setView('confirmBalance')
  }

  const handleConfirmBalance = async () => {
    setSaving(true)
    setError('')
    try {
      await editPlayerBalance(player.id, newBalance)
      onClose()
    } catch (err) {
      const message = t(err.message)
      setError(message !== err.message ? message : t('admin.balanceUpdateFailed'))
      setView('editBalance')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await deletePlayer(player.id)
      onClose()
    } catch (err) {
      const message = t(err.message)
      setError(message !== err.message ? message : t('admin.deletePlayerFailed'))
      setView('details')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 340, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        {view === 'details' && (
          <>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              style={{
                position: 'absolute', top: 14, right: 14, background: 'none', border: 'none',
                color: 'var(--text-soft)', cursor: 'pointer', padding: 4, lineHeight: 0,
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div className={cx('admin-player-avatar', player.isAdmin && 'avatar-admin')} style={{ width: 46, height: 46 }}>
                <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} />
              </div>
              <div className="modal-title" style={{ margin: 0 }}>{player.name}</div>
            </div>

            {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <DetailRow label={t('admin.playerEmailLabel')} value={email ?? t('admin.emailUnavailable')} />
              <DetailRow label={t('admin.currentBalanceLabel')} value={formatEuro(player.paymentAmount, language)} />
              <DetailRow
                label={t('admin.statusLabel')}
                value={player.isPaid ? t('admin.paid') : t('admin.unpaid')}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-gold btn-block" onClick={() => setView('editBalance')} type="button">
                <Wallet size={15} /> {t('admin.editBalanceButton')}
              </button>
              {!player.isAdmin && (
                <button className="btn btn-danger btn-block" onClick={() => setView('confirmDelete')} type="button">
                  <Trash2 size={15} /> {t('admin.deletePlayerButton')}
                </button>
              )}
              <button className="btn btn-outline btn-block" onClick={onClose} type="button">
                {t('common.close')}
              </button>
            </div>
          </>
        )}

        {view === 'editBalance' && (
          <>
            <div className="modal-icon"><Wallet size={22} /></div>
            <div className="modal-title">{t('admin.editBalanceButton')}</div>
            {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="field" style={{ textAlign: 'left', marginBottom: 18 }}>
              <label>{t('admin.newBalanceLabel')}</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-gold btn-block" onClick={handleSaveBalance} disabled={!balanceValid} type="button">
                {t('admin.saveBalanceButton')}
              </button>
              <button className="btn btn-outline btn-block" onClick={() => setView('details')} type="button">
                {t('common.cancel')}
              </button>
            </div>
          </>
        )}

        {view === 'confirmBalance' && (
          <>
            <div className="modal-icon"><Wallet size={22} /></div>
            <div className="modal-title">{t('admin.confirmBalanceChangeTitle')}</div>
            <p className="modal-text">
              {t('admin.confirmBalanceChangeMessage', {
                name: player.name,
                from: formatEuro(player.paymentAmount, language),
                to: formatEuro(newBalance, language),
              })}
            </p>
            <div className="modal-actions">
              <button className="btn btn-gold btn-block" onClick={handleConfirmBalance} disabled={saving} type="button">
                {saving ? t('common.saving') : t('common.ok')}
              </button>
              <button className="btn btn-outline btn-block" onClick={() => setView('editBalance')} disabled={saving} type="button">
                {t('common.cancel')}
              </button>
            </div>
          </>
        )}

        {view === 'confirmDelete' && (
          <>
            <div className="modal-icon modal-icon-danger"><AlertTriangle size={22} /></div>
            <div className="modal-title">{t('admin.confirmDeletePlayerTitle')}</div>
            <p className="modal-text">{t('admin.confirmDeletePlayerMessage', { name: player.name })}</p>
            <div className="modal-actions">
              <button className="btn btn-danger-solid btn-block" onClick={handleConfirmDelete} disabled={deleting} type="button">
                {deleting ? t('admin.deletingPlayer') : t('admin.deletePlayerConfirmButton')}
              </button>
              <button className="btn btn-outline btn-block" onClick={() => setView('details')} disabled={deleting} type="button">
                {t('common.cancel')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
      <span style={{ color: 'var(--text-soft)', fontWeight: 600 }}>{label}</span>
      <span style={{ color: 'var(--navy)', fontWeight: 700 }}>{value}</span>
    </div>
  )
}
