import { ChevronDown } from 'lucide-react'
import HistoryMatchCard from './HistoryMatchCard.jsx'
import { cx } from '../utils/formatters'

/** One collapsible round/stage section on the History page — a header
 * button (round name + match count + chevron) and a body that opens/closes
 * via a pure-CSS grid-row transition (see .history-round-body in
 * index.css), so no height is ever measured in JS. Renders the SAME
 * existing HistoryMatchCard used before this feature existed — nothing
 * about the match card itself changes. */
export default function HistoryRoundGroup({ roundName, matches, predictions, currentUserId, open, onToggle }) {
  return (
    <div className="history-round">
      <button type="button" className="history-round-header" onClick={onToggle} aria-expanded={open}>
        <span className="history-round-name">{roundName}</span>
        <span className="history-round-count">{matches.length}</span>
        <ChevronDown size={18} className={cx('history-round-chevron', open && 'open')} />
      </button>
      <div className={cx('history-round-body', open && 'open')}>
        <div className="history-round-body-inner">
          {matches.map((match) => {
            const prediction = predictions.find(
              (p) => p.matchId === match.id && p.playerId === currentUserId
            )
            return <HistoryMatchCard key={match.id} match={match} prediction={prediction} />
          })}
        </div>
      </div>
    </div>
  )
}
