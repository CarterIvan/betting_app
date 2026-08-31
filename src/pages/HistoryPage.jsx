import { History } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { getKickoffTimestamp, getMatchStatus, MATCH_STATUS } from '../utils/matchState'
import HistoryMatchCard from '../components/HistoryMatchCard.jsx'

export default function HistoryPage() {
  const { currentUser, matches, predictions } = useAppData()
  const { t } = useLanguage()

  const finished = matches
    .filter((m) => getMatchStatus(m) === MATCH_STATUS.FINISHED)
    .sort((a, b) => getKickoffTimestamp(b) - getKickoffTimestamp(a))

  return (
    <div className="page-container">
      <div className="page-title">{t('history.title')}</div>

      {finished.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><History size={30} /></div>
          {t('history.noFinished')}
        </div>
      ) : (
        finished.map((match) => {
          const prediction = predictions.find(
            (p) => p.matchId === match.id && p.playerId === currentUser.id
          )
          return <HistoryMatchCard key={match.id} match={match} prediction={prediction} />
        })
      )}
    </div>
  )
}
