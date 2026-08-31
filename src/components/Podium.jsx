import { Trophy, Crown } from 'lucide-react'
import PlayerAvatar from './PlayerAvatar.jsx'
import { cx } from '../utils/formatters'
import { useLanguage } from '../i18n/LanguageContext.jsx'

function Slot({ entry, rank, t }) {
  if (!entry) return <div className="podium-slot" style={{ visibility: 'hidden' }} />
  return (
    <div className={`podium-slot rank-${rank}`}>
      {rank === 1 && <Crown size={20} className="podium-crown" fill="currentColor" />}
      <div className={cx('podium-avatar', entry.player.isAdmin && 'avatar-admin')}>
        <PlayerAvatar name={entry.player.name} avatarUrl={entry.player.avatarUrl} />
        {entry.player.isAdmin && <span className="avatar-admin-badge"><Crown size={9} fill="currentColor" /></span>}
      </div>
      <div className="podium-medal-badge">{rank}</div>
      <div className="podium-name">{entry.player.name}</div>
      <div className="podium-points">{t('dashboard.points', { count: entry.totalPoints })}</div>
      <div className="podium-bar" />
    </div>
  )
}

export default function Podium({ leaderboard }) {
  const { t } = useLanguage()
  const [first, second, third] = leaderboard

  return (
    <div className="podium-card">
      <div className="podium-title">
        <Trophy size={13} />
        {t('dashboard.topPlayers')}
      </div>
      <div className="podium-row">
        <Slot entry={second} rank={2} t={t} />
        <Slot entry={first} rank={1} t={t} />
        <Slot entry={third} rank={3} t={t} />
      </div>
    </div>
  )
}
