import { cx } from '../utils/formatters'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import PlayerAvatar from './PlayerAvatar.jsx'

export default function FavoriteTipTable({ favoriteTips, currentUserId }) {
  const { t } = useLanguage()
  return (
    <div className="favorite-tip-list">
      {favoriteTips.map(({ player, results, count, total }) => (
        <div key={player.id} className={cx('favorite-tip-row', player.id === currentUserId && 'me')}>
          <div className="favorite-tip-player">
            <span className={cx('favorite-tip-avatar', player.isAdmin && 'avatar-admin')}>
              <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} />
            </span>
            <span className="favorite-tip-player-text">
              <span className="favorite-tip-name">{player.name}</span>
              <span className="favorite-tip-subtitle">{t('table.favoriteTipTooltip')}</span>
            </span>
          </div>

          {total === 0 ? (
            <span className="stats-metric-empty">{t('table.noFavoriteTip')}</span>
          ) : (
            <>
              <div className="favorite-tip-score-pill">{results.join(' / ')}</div>
              <div className="favorite-tip-count">
                <span className="favorite-tip-count-value">
                  {count} / {total}
                </span>
                <span className="favorite-tip-progress">
                  <span className="favorite-tip-progress-fill" style={{ width: `${(count / total) * 100}%` }} />
                </span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
