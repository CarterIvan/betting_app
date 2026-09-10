import { useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { getKickoffTimestamp, getMatchStatus, MATCH_STATUS } from '../utils/matchState'
import HistoryRoundGroup from '../components/HistoryRoundGroup.jsx'

// Not a real round name any admin would plausibly type — used only as the
// Map key for finished matches with no round_name set (see migration
// 0019). Never shown as-is; the fallback group's translated label is used
// instead wherever this key is rendered.
const NO_ROUND_KEY = '__no_round__'

export default function HistoryPage() {
  const { currentUser, matches, predictions } = useAppData()
  const { t } = useLanguage()

  // Same finished-match filter and same newest-first sort this page always
  // used — grouping below only reorganizes this same list, it doesn't
  // change which matches qualify or their order within a group.
  const finished = useMemo(
    () =>
      matches
        .filter((m) => getMatchStatus(m) === MATCH_STATUS.FINISHED)
        .sort((a, b) => getKickoffTimestamp(b) - getKickoffTimestamp(a)),
    [matches]
  )

  // Group by round_name (verbatim, whatever the admin typed — see
  // migration 0019), NULL matches under one fallback key. A round only
  // ever appears here if it has at least one finished match, since this
  // only ever iterates `finished`. Groups are ordered by their earliest
  // match's kickoff, newest group first — this sidesteps any need to
  // parse "1. kolo" vs "10. kolo" as numbers (alphabetical sort would get
  // that wrong); the group with a match starting most recently is always
  // the one that ends up on top.
  const groups = useMemo(() => {
    const byRound = new Map()
    for (const match of finished) {
      const key = match.roundName || NO_ROUND_KEY
      if (!byRound.has(key)) byRound.set(key, [])
      byRound.get(key).push(match)
    }
    return Array.from(byRound.entries())
      .map(([key, groupMatches]) => ({
        key,
        roundName: key === NO_ROUND_KEY ? t('history.otherMatches') : key,
        matches: groupMatches,
        earliestKickoff: Math.min(...groupMatches.map(getKickoffTimestamp)),
      }))
      .sort((a, b) => b.earliestKickoff - a.earliestKickoff)
  }, [finished, t])

  // Newest round open by default, everything else collapsed — computed
  // once from the groups available when the page first has data; the user
  // freely opens/closes any section afterward independent of this.
  const [openKeys, setOpenKeys] = useState(() => new Set())
  const [initialized, setInitialized] = useState(false)
  if (!initialized && groups.length > 0) {
    setInitialized(true)
    setOpenKeys(new Set([groups[0].key]))
  }

  const toggleGroup = (key) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="page-container">
      <div className="page-title">{t('history.title')}</div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><History size={30} /></div>
          {t('history.noFinished')}
        </div>
      ) : (
        groups.map((group) => (
          <HistoryRoundGroup
            key={group.key}
            roundName={group.roundName}
            matches={group.matches}
            predictions={predictions}
            currentUserId={currentUser.id}
            open={openKeys.has(group.key)}
            onToggle={() => toggleGroup(group.key)}
          />
        ))
      )}
    </div>
  )
}
