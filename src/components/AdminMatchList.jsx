import { useState } from 'react'
import { Pencil, Trash2, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import TeamBadge from './TeamBadge.jsx'
import { getMatchStatus, MATCH_STATUS } from '../utils/matchState'
import { formatDate } from '../utils/formatters'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

function AdminMatchRow({ match, onUpdate, onDelete, onFinish }) {
  const { players, predictions, teams, getTeamById } = useAppData()
  const { t, language } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    date: match.date,
    startTime: match.startTime,
  })
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [showTips, setShowTips] = useState(false)
  const [homeScore, setHomeScore] = useState(match.finalHomeScore ?? '')
  const [awayScore, setAwayScore] = useState(match.finalAwayScore ?? '')

  const status = getMatchStatus(match)
  const home = getTeamById(match.homeTeam)
  const away = getTeamById(match.awayTeam)

  const statusLabel = {
    [MATCH_STATUS.LIVE]: t('matches.statusLive'),
    [MATCH_STATUS.UPCOMING]: t('matches.statusUpcoming'),
    [MATCH_STATUS.FINISHED]: t('matches.statusFinished'),
  }[status]

  const tips = predictions
    .filter((p) => p.matchId === match.id)
    .map((p) => ({ ...p, player: players.find((pl) => pl.id === p.playerId) }))
    .filter((p) => p.player)

  const handleSaveEdit = async () => {
    setEditSaving(true)
    setEditError('')
    try {
      await onUpdate(match.id, editForm)
      setEditing(false)
    } catch {
      setEditError(t('admin.matchUpdateFailed'))
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleteError('')
    try {
      await onDelete(match.id)
    } catch {
      setDeleteError(t('admin.matchDeleteFailed'))
    }
  }

  const handleFinish = () => {
    if (homeScore === '' || awayScore === '') return
    onFinish(match.id, Number(homeScore), Number(awayScore))
  }

  if (editing) {
    return (
      <div className="admin-match-card">
        {editError && <div className="login-error">{editError}</div>}
        <div className="admin-form-grid">
          <div className="field">
            <label>{t('admin.homeTeam')}</label>
            <select value={editForm.homeTeam} onChange={(e) => setEditForm((f) => ({ ...f, homeTeam: e.target.value }))}>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('admin.awayTeam')}</label>
            <select value={editForm.awayTeam} onChange={(e) => setEditForm((f) => ({ ...f, awayTeam: e.target.value }))}>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('admin.date')}</label>
            <input type="date" value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="field">
            <label>{t('admin.time')}</label>
            <input type="time" value={editForm.startTime} onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))} />
          </div>
        </div>
        <div className="flex-row" style={{ gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={editSaving}>
            <Check size={14} /> {editSaving ? t('common.saving') : t('common.save')}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(false)}><X size={14} /> {t('common.cancel')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-match-card">
      <div className="admin-match-top">
        <div className="admin-match-teams">
          <TeamBadge teamId={match.homeTeam} size="sm" />
          {home?.shortName} - {away?.shortName}
          <TeamBadge teamId={match.awayTeam} size="sm" />
        </div>
        <div className="admin-match-actions">
          <button className="admin-icon-btn" onClick={() => setEditing(true)} title={t('admin.editTooltip')}>
            <Pencil size={15} />
          </button>
          <button className="admin-icon-btn danger" onClick={handleDelete} title={t('admin.deleteTooltip')}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {deleteError && <div className="login-error">{deleteError}</div>}

      <div className="match-meta" style={{ marginBottom: 0 }}>
        <span className="match-date">{formatDate(match.date, language)} · {match.startTime}</span>
        <span className={`match-status-chip ${status.toLowerCase()}`}>
          {status === MATCH_STATUS.LIVE && <span className="live-dot" />}
          {statusLabel}
        </span>
      </div>

      <div className="admin-result-row">
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
        <button
          className="btn btn-gold btn-sm"
          style={{ flex: 1 }}
          disabled={homeScore === '' || awayScore === ''}
          onClick={handleFinish}
        >
          {match.finished ? t('admin.updateResult') : t('admin.closeMatch')}
        </button>
      </div>

      <button className="admin-toggle-link" onClick={() => setShowTips((v) => !v)}>
        {showTips ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {' '}{t('admin.playerTipsCount', { count: tips.length })}
      </button>

      {showTips && (
        <div className="admin-predictions-list">
          {tips.length === 0 && <div className="admin-prediction-item">{t('admin.noTipsYet')}</div>}
          {tips.map((tip) => (
            <div className="admin-prediction-item" key={tip.id}>
              <span>{tip.player.name}</span>
              <span>
                {tip.predictedHome} : {tip.predictedAway}
                {tip.points !== null && tip.points !== undefined ? t('admin.tipPointsSuffix', { points: tip.points }) : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminMatchList({ matches, onUpdate, onDelete, onFinish }) {
  const { t } = useLanguage()
  if (matches.length === 0) {
    return <div className="empty-state">{t('admin.noMatches')}</div>
  }
  return (
    <>
      {matches.map((match) => (
        <AdminMatchRow key={match.id} match={match} onUpdate={onUpdate} onDelete={onDelete} onFinish={onFinish} />
      ))}
    </>
  )
}
