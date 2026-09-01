import { Trophy } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { computeLeaderboard } from '../services/scoringService'
import Podium from '../components/Podium.jsx'
import UpcomingMatches from '../components/UpcomingMatches.jsx'
import ProfileMenu from '../components/ProfileMenu.jsx'

export default function DashboardPage() {
  const { currentUser, players, predictions, leagueLogoUrl } = useAppData()
  const { t } = useLanguage()
  const leaderboard = computeLeaderboard(players, predictions)
  const myPoints = leaderboard.find((e) => e.player.id === currentUser.id)?.totalPoints ?? 0

  return (
    <div className="page-container">
      <div className="top-bar">
        <div className="welcome-banner">{t('dashboard.welcome', { name: currentUser.name })} 👋</div>
        <div className="top-bar-actions">
          <div className="points-pill">
            <Trophy size={14} />
            {t('dashboard.points', { count: myPoints })}
          </div>
          <ProfileMenu />
        </div>
      </div>

      <div className="dashboard-brand">
        <img src={leagueLogoUrl || '/tipovacka-logo.png'} alt="Tipovačka Liga Majstrov" className="dashboard-logo" />

        <div className="dashboard-brand-sub">SKP2</div>
      </div>

      <Podium leaderboard={leaderboard.slice(0, 3)} />

      <UpcomingMatches />
    </div>
  )
}
