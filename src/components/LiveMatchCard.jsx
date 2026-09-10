import TeamBadge from './TeamBadge.jsx'
import { getLiveMinuteDisplay, HALFTIME_DISPLAY, getLiveScoreDisplay } from '../utils/matchState'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function LiveMatchCard({ match, onClick }) {
  const { getTeamById } = useAppData()
  const { t } = useLanguage()
  const home = getTeamById(match.homeTeam)
  const away = getTeamById(match.awayTeam)
  const minuteDisplay = getLiveMinuteDisplay(match)

  return (
    <div className="live-card" onClick={onClick}>
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
  )
}
