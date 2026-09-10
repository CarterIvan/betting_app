import { ArrowLeft, Users } from 'lucide-react'
import TeamBadge from './TeamBadge.jsx'
import PlayerAvatar from './PlayerAvatar.jsx'
import { getLiveMinuteDisplay, HALFTIME_DISPLAY, getLiveScoreDisplay } from '../utils/matchState'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { cx } from '../utils/formatters'

export default function LiveMatchDetail({ match, onBack }) {
  const { players, predictions, getTeamById } = useAppData()
  const { t } = useLanguage()
  const home = getTeamById(match.homeTeam)
  const away = getTeamById(match.awayTeam)
  const minuteDisplay = getLiveMinuteDisplay(match)

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
          <span className="live-card-score">{getLiveScoreDisplay(match)}</span>
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
