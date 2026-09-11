import TeamBadge from './TeamBadge.jsx'
import { cx } from '../utils/formatters'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/** Read-only display of the local slot album — reuses the exact same
 * TeamBadge every other part of the app already uses for club crests
 * (real uploaded logo, or the generated shield fallback), so nothing
 * about how a crest is sourced/rendered is duplicated here. Locked
 * (not-yet-collected) clubs get a CSS-only grayscale/opacity treatment
 * applied to a wrapper — TeamBadge itself is untouched. */
export default function ClubAlbum({ teams, collected, unlockingTeamId }) {
  const { t } = useLanguage()
  const collectedCount = teams.filter((team) => collected[team.id] > 0).length
  const total = teams.length
  const progressPct = total > 0 ? (collectedCount / total) * 100 : 0
  const isComplete = total > 0 && collectedCount === total

  return (
    <div className={cx('slot-album card', isComplete && 'complete')}>
      <div className="slot-album-header">
        <span className="slot-album-title">{t('slot.albumTitle')}</span>
        <span className="slot-album-count">
          {collectedCount} / {total}
        </span>
      </div>
      <div className="slot-album-progress">
        <span className="slot-album-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      {isComplete ? (
        <div className="slot-album-complete-badge">✓ {t('slot.albumCompleteBadge')}</div>
      ) : (
        <div className="slot-album-progress-label">{t('slot.albumCollectedLabel')}</div>
      )}

      <div className="slot-album-grid">
        {teams.map((team) => {
          const owned = collected[team.id] > 0
          const unlocking = team.id === unlockingTeamId
          return (
            <div
              key={team.id}
              data-team-id={team.id}
              className={cx('slot-album-item', !owned && 'locked', unlocking && 'unlocking')}
              title={team.name}
            >
              <TeamBadge teamId={team.id} size="md" />
              <span className="slot-album-item-name">{team.shortName}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
