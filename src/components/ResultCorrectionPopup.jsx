import { useMemo, useState } from 'react'
import { X, Check, XCircle } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/** Mounted once, app-wide (see Layout.jsx) — shows the oldest pending
 * correction request the current user holds an unvoted seat on, one at a
 * time (never stacked). A player with no seat for a given request (not
 * eligible, or it was created after they lost/gained access) simply never
 * sees it — seats are a server-side snapshot from request creation (see
 * migration 0012's request_result_correction), not computed here. Closing
 * without voting only hides it for this session/mount; it reappears on
 * the next login/reload since nothing about that is persisted. */
export default function ResultCorrectionPopup() {
  const { currentUser, correctionRequests, correctionVotes, matches, players, getTeamById, voteOnResultCorrection } =
    useAppData()
  const { t } = useLanguage()
  const [dismissedIds, setDismissedIds] = useState(() => new Set())
  const [submittingVote, setSubmittingVote] = useState(false)
  const [error, setError] = useState('')

  const pendingRequests = useMemo(
    () =>
      correctionRequests
        .filter((r) => r.status === 'pending')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [correctionRequests]
  )

  const mySeat = (requestId) =>
    correctionVotes.find((v) => v.requestId === requestId && v.playerId === currentUser?.id)

  const activeRequest = pendingRequests.find((r) => mySeat(r.id) && !dismissedIds.has(r.id))

  if (!currentUser || !activeRequest) return null

  const seat = mySeat(activeRequest.id)
  const votesForRequest = correctionVotes.filter((v) => v.requestId === activeRequest.id)
  const approvedCount = votesForRequest.filter((v) => v.vote === true).length
  const totalSeats = votesForRequest.length
  const hasVoted = seat.vote !== null

  const match = matches.find((m) => m.id === activeRequest.matchId)
  const home = match ? getTeamById(match.homeTeam) : null
  const away = match ? getTeamById(match.awayTeam) : null
  const requester = players.find((p) => p.id === activeRequest.requestedBy)

  const handleDismiss = () => {
    setDismissedIds((prev) => new Set(prev).add(activeRequest.id))
  }

  const handleVote = async (approve) => {
    setError('')
    setSubmittingVote(true)
    try {
      await voteOnResultCorrection(activeRequest.id, approve)
    } catch (err) {
      const message = t(err.message)
      setError(message !== err.message ? message : t('admin.correctionVoteFailed'))
    } finally {
      setSubmittingVote(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card correction-popup-card">
        <button type="button" className="correction-popup-close" onClick={handleDismiss} aria-label={t('common.close')}>
          <X size={16} />
        </button>

        <div className="modal-title">{t('admin.correctionPopupTitle')}</div>
        <p className="modal-text">{t('admin.correctionPopupIntro', { name: requester?.name ?? '' })}</p>

        <div className="correction-score-change">
          <span className="correction-score-row">
            {home?.shortName} {activeRequest.oldHomeScore} - {activeRequest.oldAwayScore} {away?.shortName}
          </span>
          <span className="correction-score-arrow">↓</span>
          <span className="correction-score-row new">
            {home?.shortName} {activeRequest.newHomeScore} - {activeRequest.newAwayScore} {away?.shortName}
          </span>
        </div>

        <div className="correction-reason-box">
          <span className="correction-reason-label">{t('admin.correctionReasonLabel')}</span>
          <p className="correction-reason-text">{activeRequest.reason}</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="correction-progress">
          {t('admin.correctionProgress', { approved: approvedCount, total: totalSeats })}
        </div>

        {hasVoted ? (
          <div className="correction-already-voted">
            {seat.vote ? <Check size={14} /> : <XCircle size={14} />}
            {t('admin.alreadyVoted')}
          </div>
        ) : (
          <div className="modal-actions">
            <button className="btn btn-gold btn-block" type="button" onClick={() => handleVote(true)} disabled={submittingVote}>
              {t('admin.voteAgreeButton')}
            </button>
            <button className="btn btn-danger btn-block" type="button" onClick={() => handleVote(false)} disabled={submittingVote}>
              {t('admin.voteDisagreeButton')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
