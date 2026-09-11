import { cx } from '../utils/formatters'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import PlayerAvatar from './PlayerAvatar.jsx'

export default function Leaderboard({ leaderboard, currentUserId }) {
  const { t } = useLanguage()
  return (
    <div className="rank-table">
      <div className="rank-table-head">
        <span className="rank-head-pos">{t('table.headPosition')}</span>
        <span className="rank-head-avatar-spacer" />
        <span className="rank-head-name">{t('table.headPlayer')}</span>
        <span>{t('table.headPoints')}</span>
      </div>
      {leaderboard.map((entry, index) => {
        const position = index + 1
        const isMe = entry.player.id === currentUserId
        return (
          <div key={entry.player.id} className={cx('rank-row', `pos-${position}`, isMe && 'me')}>
            <div className="rank-position">
              <span className={cx('rank-badge', position <= 3 && `rank-badge-${position}`)}>{position}</span>
            </div>
            <div className={cx('rank-avatar', entry.player.isAdmin && 'avatar-admin')}>
              <PlayerAvatar name={entry.player.name} avatarUrl={entry.player.avatarUrl} />
            </div>
            <div className="rank-name">{entry.player.name}</div>
            <div className="rank-points-pill">{entry.totalPoints}</div>
          </div>
        )
      })}
    </div>
  )
}
