import { cx } from '../utils/formatters'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function StatsTable({ leaderboard, currentUserId }) {
  const { t } = useLanguage()
  return (
    <div className="stats-list">
      {leaderboard.map((entry) => (
        <div key={entry.player.id} className={cx('stats-row', entry.player.id === currentUserId && 'me')}>
          <span className="stats-name">{entry.player.name}</span>
          <span className="stats-metrics">
            <span className="stats-metric" title={t('table.exactScores')}>
              <span className="stats-metric-icon">🎯</span>
              {entry.exactCount}
            </span>
            <span className="stats-metric" title={t('table.correctWinner')}>
              <span className="stats-metric-icon">👍</span>
              {entry.correctWinnerCount}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
