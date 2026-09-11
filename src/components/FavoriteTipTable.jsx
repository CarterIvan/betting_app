import { cx } from '../utils/formatters'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function FavoriteTipTable({ favoriteTips, currentUserId }) {
  const { t } = useLanguage()
  return (
    <div className="stats-list">
      {favoriteTips.map(({ player, results, count, total }) => (
        <div key={player.id} className={cx('stats-row', player.id === currentUserId && 'me')}>
          <span className="stats-name">{player.name}</span>
          {total === 0 ? (
            <span className="stats-metric-empty">{t('table.noFavoriteTip')}</span>
          ) : (
            <span className="stats-metrics">
              <span className="stats-metric" title={t('table.favoriteTipTooltip')}>
                <span className="stats-metric-icon">⚽</span>
                {results.join(' / ')}
              </span>
              <span className="stats-metric-count">
                {count} / {total}
              </span>
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
