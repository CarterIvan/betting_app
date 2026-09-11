import { useState } from 'react'
import { ArrowLeft, Users, Minus, Plus } from 'lucide-react'
import TeamBadge from './TeamBadge.jsx'
import PlayerAvatar from './PlayerAvatar.jsx'
import { getLiveMinuteDisplay, HALFTIME_DISPLAY, getLiveScoreDisplay } from '../utils/matchState'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { cx } from '../utils/formatters'

export default function LiveMatchDetail({ match, onBack }) {
  const { currentUser, players, predictions, getTeamById, updateMatchLiveScore } = useAppData()
  const { t } = useLanguage()
  const home = getTeamById(match.homeTeam)
  const away = getTeamById(match.awayTeam)
  const minuteDisplay = getLiveMinuteDisplay(match)
  const [pending, setPending] = useState({ home: false, away: false })

  // Admin-only quick +/- for the existing informational live score (see
  // migration 0020) — this ONLY ever sends live_home_score/live_away_score
  // via the same updateMatchLiveScore() the Admin → Zápasy form already
  // uses (matchesService.updateLiveScore only touches those two columns).
  // Never touches final_home_score/final_away_score, never calls
  // finish_match()/apply_match_result(), never affects scoring.
  const adjustLiveScore = async (side, delta) => {
    if (pending[side]) return
    const current = side === 'home' ? match.liveHomeScore : match.liveAwayScore
    // Unset (null) is treated as 0 for this quick control — a single "+"
    // tap visibly sets the score to 1 instead of silently doing nothing;
    // clamped so it can never go below 0.
    const next = Math.max(0, (current ?? 0) + delta)
    setPending((p) => ({ ...p, [side]: true }))
    try {
      await updateMatchLiveScore(match.id, {
        liveHomeScore: side === 'home' ? next : match.liveHomeScore,
        liveAwayScore: side === 'away' ? next : match.liveAwayScore,
      })
    } finally {
      setPending((p) => ({ ...p, [side]: false }))
    }
  }

  const tips = predictions
    .filter((p) => p.matchId === match.id && p.predictedHome !== null && p.predictedAway !== null)
    .map((p) => ({ ...p, player: players.find((pl) => pl.id === p.playerId) }))
    .filter((p) => p.player)

  return (
    <div className="page-container">
      <div className="live-detail-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="page-title" style={{ margin: 0 }}>{t('live.matchTitle')}</div>
      </div>

      <div className="live-card" style={{ cursor: 'default' }}>
        <div className="live-badge-row">
          <div className="live-badge">
            <span className="live-dot" />
            LIVE
          </div>
          <span className="live-minute">
            {minuteDisplay === HALFTIME_DISPLAY ? t('live.halftime') : `${minuteDisplay}'`}
          </span>
        </div>
        <div className="live-card-teams">
          <div className="live-card-team">
            <TeamBadge teamId={match.homeTeam} size="lg" />
            <span className="live-card-team-name">{home?.name}</span>
          </div>
          {currentUser?.isAdmin ? (
            <div className="live-score-admin-controls">
              <button
                type="button"
                className="live-score-btn"
                onClick={() => adjustLiveScore('home', -1)}
                disabled={pending.home || !(match.liveHomeScore > 0)}
                aria-label={t('live.decreaseHomeScore')}
              >
                <Minus size={13} />
              </button>
              <span className="live-score-num">{match.liveHomeScore ?? '–'}</span>
              <button
                type="button"
                className="live-score-btn"
                onClick={() => adjustLiveScore('home', 1)}
                disabled={pending.home}
                aria-label={t('live.increaseHomeScore')}
              >
                <Plus size={13} />
              </button>
              <span className="live-score-sep">:</span>
              <button
                type="button"
                className="live-score-btn"
                onClick={() => adjustLiveScore('away', -1)}
                disabled={pending.away || !(match.liveAwayScore > 0)}
                aria-label={t('live.decreaseAwayScore')}
              >
                <Minus size={13} />
              </button>
              <span className="live-score-num">{match.liveAwayScore ?? '–'}</span>
              <button
                type="button"
                className="live-score-btn"
                onClick={() => adjustLiveScore('away', 1)}
                disabled={pending.away}
                aria-label={t('live.increaseAwayScore')}
              >
                <Plus size={13} />
              </button>
            </div>
          ) : (
            <span className="live-card-score">{getLiveScoreDisplay(match)}</span>
          )}
          <div className="live-card-team">
            <TeamBadge teamId={match.awayTeam} size="lg" />
            <span className="live-card-team-name">{away?.name}</span>
          </div>
        </div>
      </div>

      <div className="section-title">
        <Users size={13} />
        {t('live.playerTips')}
      </div>

      {tips.length === 0 ? (
        <div className="empty-state">{t('live.noTipsYet')}</div>
      ) : (
        tips.map((tip) => (
          <div className="player-tip-row" key={tip.id}>
            <span className="player-tip-name">
              <span className={cx('player-tip-avatar', tip.player.isAdmin && 'avatar-admin')}>
                <PlayerAvatar name={tip.player.name} avatarUrl={tip.player.avatarUrl} />
              </span>
              {tip.player.name}
            </span>
            <span className="player-tip-score">
              {tip.predictedHome} : {tip.predictedAway}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
