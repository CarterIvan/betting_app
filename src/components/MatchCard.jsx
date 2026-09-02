import { CalendarClock } from 'lucide-react'
import TeamBadge from './TeamBadge.jsx'
import PredictionInput from './PredictionInput.jsx'
import PredictionCompletionRing from './PredictionCompletionRing.jsx'
import { getMatchStatus, MATCH_STATUS } from '../utils/matchState'
import { formatDate } from '../utils/formatters'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function MatchCard({ match }) {
  const { currentUser, predictions, predictionCompletion, savePrediction, getTeamById } = useAppData()
  const { t, language } = useLanguage()
  const home = getTeamById(match.homeTeam)
  const away = getTeamById(match.awayTeam)
  const status = getMatchStatus(match)

  const myPrediction = predictions.find(
    (p) => p.matchId === match.id && p.playerId === currentUser.id
  )

  // Locked once the match kicks off, OR once the player has used both of
  // their two allowed saves for this match — whichever comes first. The
  // database enforces both independently (RLS for kickoff, a trigger for
  // the save count); this just mirrors that so the UI matches reality.
  const locked = status !== MATCH_STATUS.UPCOMING || (myPrediction?.saveCount ?? 0) >= 2

  const statusLabel = {
    [MATCH_STATUS.LIVE]: t('matches.statusLive'),
    [MATCH_STATUS.UPCOMING]: t('matches.statusUpcoming'),
    [MATCH_STATUS.FINISHED]: t('matches.statusFinished'),
  }[status]

  const completion = predictionCompletion.find((c) => c.matchId === match.id)

  return (
    <div className="match-card">
      <div className="match-meta">
        <span className="match-date">
          <CalendarClock size={12} />
          {formatDate(match.date, language)} · {match.startTime}
        </span>
        <div className="match-meta-right">
          {completion && (
            <PredictionCompletionRing
              submittedCount={completion.submittedCount}
              totalPlayers={completion.totalPlayers}
            />
          )}
          <span className={`match-status-chip ${status.toLowerCase()}`}>
            {status === MATCH_STATUS.LIVE && <span className="live-dot" />}
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="match-teams">
        <div className="match-team">
          <TeamBadge teamId={match.homeTeam} size="md" />
          <span className="match-team-name">{home?.name}</span>
        </div>
        <div className="match-vs">
          <span className="match-time">{match.startTime}</span>
          <span className="match-vs-label">{t('matches.vs')}</span>
        </div>
        <div className="match-team">
          <TeamBadge teamId={match.awayTeam} size="md" />
          <span className="match-team-name">{away?.name}</span>
        </div>
      </div>

      <PredictionInput
        prediction={myPrediction}
        locked={locked}
        onSave={(h, a) => savePrediction(match.id, h, a)}
      />
    </div>
  )
}
