import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { computeLeaderboard } from '../services/scoringService'
import Leaderboard from '../components/Leaderboard.jsx'
import StatsTable from '../components/StatsTable.jsx'

export default function TablePage() {
  const { currentUser, players, predictions } = useAppData()
  const { t } = useLanguage()
  const leaderboard = computeLeaderboard(players, predictions)

  return (
    <div className="page-container">
      <div className="page-title">{t('table.title')}</div>

      <Leaderboard leaderboard={leaderboard} currentUserId={currentUser.id} />

      <div className="section-title">{t('table.statsTitle')}</div>
      <StatsTable leaderboard={leaderboard} currentUserId={currentUser.id} />
    </div>
  )
}
