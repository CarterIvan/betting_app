import PlayerAvatar from './PlayerAvatar.jsx'
import { cx } from '../utils/formatters'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/** "Zberatelia" — everyone's Slot collecting progress, read straight from
 * the shared `slotCollections` array (AppDataContext, realtime-updated —
 * see migration 0024). Purely a display of collected-club COUNTS; it
 * never reads or touches points, predictions, or ranking in any way — a
 * player with a large Slot album has zero competitive advantage. */
export default function ZberateliaList({ players, teams, slotCollections, currentUserId }) {
  const { t } = useLanguage()
  const total = teams.length

  const countsByPlayer = new Map()
  for (const c of slotCollections) {
    countsByPlayer.set(c.playerId, (countsByPlayer.get(c.playerId) ?? 0) + 1)
  }

  const ranked = players
    .map((player) => ({ player, count: countsByPlayer.get(player.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.player.name.localeCompare(b.player.name, 'sk'))

  return (
    <div className="zberatelia card">
      <div className="zberatelia-title">{t('slot.zberateliaTitle')}</div>
      <div className="zberatelia-list">
        {ranked.map(({ player, count }, index) => {
          const rank = index + 1
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={player.id} className={cx('zberatelia-row', player.id === currentUserId && 'me')}>
              <span className={cx('zberatelia-rank', rank <= 3 && `zberatelia-rank-${rank}`)}>{rank}</span>
              <span className={cx('zberatelia-avatar', player.isAdmin && 'avatar-admin')}>
                <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} />
              </span>
              <div className="zberatelia-info">
                <div className="zberatelia-name-row">
                  <span className="zberatelia-name">{player.name}</span>
                  <span className="zberatelia-count">
                    {count} / {total}
                  </span>
                </div>
                <div className="zberatelia-progress">
                  <span className="zberatelia-progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
