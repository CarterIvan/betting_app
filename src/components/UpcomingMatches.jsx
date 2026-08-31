import { CalendarClock } from 'lucide-react'
import MatchCard from './MatchCard.jsx'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { getKickoffTimestamp, getMatchStatus, MATCH_STATUS } from '../utils/matchState'

export default function UpcomingMatches() {
  const { matches } = useAppData()
  const { t } = useLanguage()

  const list = matches
    .filter((m) => getMatchStatus(m) !== MATCH_STATUS.FINISHED)
    .sort((a, b) => getKickoffTimestamp(a) - getKickoffTimestamp(b))

  return (
    <>
      <div className="section-title">{t('matches.upcomingTitle')}</div>
      {list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><CalendarClock size={30} /></div>
          {t('matches.noUpcoming')}
        </div>
      ) : (
        list.map((match) => <MatchCard key={match.id} match={match} />)
      )}
    </>
  )
}
