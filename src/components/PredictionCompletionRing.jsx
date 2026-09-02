import { Check } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { cx } from '../utils/formatters'

const SIZE = 28
const STROKE = 3
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Aggregate-only completion indicator — "3/13 players have submitted".
 * Fed exclusively by predictionCompletion (see migration 0010's
 * get_predictions_completion RPC), which never returns who submitted or
 * what they predicted — only two counts. Renders nothing for 0 active
 * players, since a ratio wouldn't mean anything. */
export default function PredictionCompletionRing({ submittedCount, totalPlayers }) {
  const { t } = useLanguage()

  if (!totalPlayers) return null

  const complete = submittedCount >= totalPlayers
  const ratio = Math.min(submittedCount / totalPlayers, 1)
  const offset = CIRCUMFERENCE * (1 - ratio)

  return (
    <div
      className={cx('prediction-ring', complete && 'complete')}
      title={t('matches.predictionCompletionHint', { count: submittedCount, total: totalPlayers })}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none" stroke="var(--gray-200)" strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none"
          stroke={complete ? 'var(--green)' : 'var(--gold)'}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      <span className="prediction-ring-count">{submittedCount}/{totalPlayers}</span>
      {complete && <Check size={11} className="prediction-ring-check" />}
    </div>
  )
}
