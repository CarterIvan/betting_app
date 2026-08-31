import TeamBadge from './TeamBadge.jsx'
import { getElapsedMinutes } from '../utils/matchState'
import { useAppData } from '../context/AppDataContext.jsx'

export default function LiveMatchCard({ match, onClick }) {
  const { getTeamById } = useAppData()
  const home = getTeamById(match.homeTeam)
  const away = getTeamById(match.awayTeam)

  return (
    <div className="live-card" onClick={onClick}>
      <div className="live-badge-row">
        <div className="live-badge">
          <span className="live-dot" />
          LIVE
        </div>
        <span className="live-minute">{getElapsedMinutes(match)}'</span>
      </div>
      <div className="live-card-teams">
        <div className="live-card-team">
          <TeamBadge teamId={match.homeTeam} size="lg" />
          <span className="live-card-team-name">{home?.name}</span>
        </div>
        <span className="live-card-score">– : –</span>
        <div className="live-card-team">
          <TeamBadge teamId={match.awayTeam} size="lg" />
          <span className="live-card-team-name">{away?.name}</span>
        </div>
      </div>
    </div>
  )
}
