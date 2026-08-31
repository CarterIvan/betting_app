import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import TeamBadge from './TeamBadge.jsx'
import { formatDate, cx } from '../utils/formatters'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/** Same 3 / 1 / 0 result the scoring engine already produced for this
 * prediction — this just maps it to the label/color shown in the UI. */
function pointsMeta(points, t) {
  if (points === 3) return { label: t('history.exactPoints'), cls: 'exact' }
  if (points === 1) return { label: t('history.winnerPoints'), cls: 'winner' }
  return { label: t('history.zeroPoints'), cls: 'zero' }
}

export default function HistoryMatchCard({ match, prediction }) {
  const { players, predictions, getTeamById } = useAppData()
  const { t, language } = useLanguage()
  const [showAll, setShowAll] = useState(false)
  const home = getTeamById(match.homeTeam)
  const away = getTeamById(match.awayTeam)
  const hasPrediction = prediction && prediction.predictedHome !== null && prediction.predictedAway !== null
  const meta = hasPrediction ? pointsMeta(prediction.points, t) : null

  const allTips = predictions
    .filter((p) => p.matchId === match.id && p.predictedHome !== null && p.predictedAway !== null)
    .map((p) => ({ ...p, player: players.find((pl) => pl.id === p.playerId) }))
    .filter((p) => p.player)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))

  return (
    <div className={cx('history-card', meta && `result-${meta.cls}`)}>
      <div className="match-date" style={{ marginBottom: 8 }}>{formatDate(match.date, language)}</div>

      <div className="history-result-row">
        <div className="history-team">
          <TeamBadge teamId={match.homeTeam} size="sm" />
          {home?.name}
        </div>
        <div className="history-final-score">
          {match.finalHomeScore} : {match.finalAwayScore}
        </div>
        <div className="history-team">
          <TeamBadge teamId={match.awayTeam} size="sm" />
          {away?.name}
        </div>
      </div>
      <div className="history-finished-chip">{t('history.finished')}</div>

      {hasPrediction ? (
        <div className="history-my-tip">
          <div className="history-my-tip-col">
            <div className="history-my-tip-label">{t('history.myTip')}</div>
            <div className="history-my-tip-value mine">{prediction.predictedHome} : {prediction.predictedAway}</div>
          </div>
          <div className="history-my-tip-col">
            <div className="history-my-tip-label">{t('history.result')}</div>
            <div className="history-my-tip-value">{match.finalHomeScore} : {match.finalAwayScore}</div>
          </div>
          <div className="history-my-tip-col">
            <span className={`history-points-chip ${meta.cls}`}>{meta.label}</span>
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ padding: '12px 0' }}>{t('history.noTip')}</div>
      )}

      {allTips.length > 0 && (
        <>
          <button className="history-toggle" onClick={() => setShowAll((v) => !v)}>
            {showAll ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {t('history.allTips', { count: allTips.length })}
          </button>
          {showAll && (
            <div className="history-all-tips">
              <table className="history-tips-table">
                <thead>
                  <tr>
                    <th>{t('history.player')}</th>
                    <th>{t('history.tip')}</th>
                    <th>{t('history.points')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allTips.map((tip) => (
                    <tr key={tip.id} className={cx(tip.playerId === prediction?.playerId && 'me')}>
                      <td>{tip.player.name}</td>
                      <td>{tip.predictedHome} : {tip.predictedAway}</td>
                      <td className={tip.points > 0 ? 'history-tip-icon correct' : 'history-tip-icon incorrect'}>
                        {tip.points === 3 ? '🎯' : tip.points === 1 ? '👍' : '❌'} {tip.points ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
