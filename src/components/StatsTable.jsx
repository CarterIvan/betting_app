import { cx } from '../utils/formatters'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import PlayerAvatar from './PlayerAvatar.jsx'

export default function StatsTable({ leaderboard, currentUserId }) {
  const { t } = useLanguage()
  return (
    <div className="stats-list">
      {leaderboard.map((entry) => (
        <div key={entry.player.id} className={cx('stats-row', entry.player.id === currentUserId && 'me')}>
          <span className={cx('stats-avatar', entry.player.isAdmin && 'avatar-admin')}>
            <PlayerAvatar name={entry.player.name} avatarUrl={entry.player.avatarUrl} />
          </span>
          <span className="stats-name">{entry.player.name}</span>
          <span className="stats-metrics">
            <span className="stats-metric stats-metric-exact" title={t('table.exactScores')}>
              <span className="stats-metric-icon">🎯</span>
              {entry.exactCount}
            </span>
            <span className="stats-metric stats-metric-winner" title={t('table.correctWinner')}>
              <span className="stats-metric-icon">👍</span>
              {entry.correctWinnerCount}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
