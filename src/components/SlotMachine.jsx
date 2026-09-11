import { useEffect, useRef, useState } from 'react'
import { Sparkles, Ticket, Clover } from 'lucide-react'
import TeamBadge from './TeamBadge.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const REEL_COUNT = 4
// Staggered stop times (ms) — reel 1 locks first, then each following one
// a little later, for a classic "slowing down" slot feel. All 4 reels
// always land on the SAME single outcome — the 4 reels are a visual
// effect, the actual outcome (a specific club, or "no card") comes from
// the server (spin_slot()), never guessed or decided client-side.
const REEL_STOP_DELAYS = [1200, 1550, 1900, 2300]
const FLICKER_INTERVAL_MS = 90

// Sentinel reel value for a "no card" outcome — never a real team, so it's
// checked by identity (`=== EMPTY_SLOT`) wherever reels are rendered.
const EMPTY_SLOT = { id: '__slot_empty__' }

function randomTeam(teams) {
  return teams[Math.floor(Math.random() * teams.length)]
}

/** Pure presentation + local animation state. `onSpin` is the ONLY place
 * that actually draws an outcome — it calls the app's spinSlot() action
 * (spin_slot() RPC under the hood, see migration 0024) and must resolve
 * with { teamId, isEmpty, isNew, collectedCount, totalTeams, justCompleted,
 * spinsRemaining } or throw. The reel animation only ever lands on
 * whatever the SERVER returned — requested first, then animated to. */
export default function SlotMachine({ teams, remainingSpins, onSpin, onLanded }) {
  const { t } = useLanguage()
  const [spinning, setSpinning] = useState(false)
  const [reelTeams, setReelTeams] = useState(() => teams.slice(0, REEL_COUNT))
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const timersRef = useRef([])

  const clearTimers = () => {
    timersRef.current.forEach(clearInterval)
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  const runReelAnimation = (landingValue, onDone) => {
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      setReelTeams(Array(REEL_COUNT).fill(landingValue))
      onDone()
      return
    }

    const locked = new Set()
    const flicker = setInterval(() => {
      setReelTeams((prev) => prev.map((team, i) => (locked.has(i) ? team : randomTeam(teams))))
    }, FLICKER_INTERVAL_MS)
    timersRef.current.push(flicker)

    REEL_STOP_DELAYS.forEach((delay, i) => {
      const timeout = setTimeout(() => {
        locked.add(i)
        setReelTeams((prev) => {
          const next = [...prev]
          next[i] = landingValue
          return next
        })
        if (locked.size === REEL_COUNT) {
          clearInterval(flicker)
          onDone()
        }
      }, delay)
      timersRef.current.push(timeout)
    })
  }

  const handleSpin = async () => {
    if (spinning || remainingSpins <= 0 || teams.length === 0) return
    setError('')
    setResult(null)
    setSpinning(true)

    try {
      // Ask the server FIRST — spin_slot() is the only source of truth for
      // the outcome (a specific club, or one of the "no card" outcomes),
      // whether it's new, and the full collected/total/justCompleted
      // state. The reels only ever animate toward this already-decided
      // result; nothing here influences or recomputes the outcome.
      const spinResult = await onSpin()
      const landingValue = spinResult.isEmpty ? EMPTY_SLOT : teams.find((team) => team.id === spinResult.teamId)
      if (!landingValue) {
        setSpinning(false)
        return
      }
      runReelAnimation(landingValue, () => {
        setSpinning(false)
        setResult({ team: spinResult.isEmpty ? null : landingValue, ...spinResult })
        // Purely visual hook — the caller decides whether/how to react
        // (e.g. flying the crest to the album); never influences the
        // already-final spinResult itself.
        onLanded?.(spinResult)
      })
    } catch (err) {
      setSpinning(false)
      setError(t(err.message) !== err.message ? t(err.message) : t('slot.spinFailed'))
    }
  }

  // Cleanup any in-flight timers if the page unmounts mid-spin.
  useEffect(() => clearTimers, [])

  return (
    <div className="slot-machine">
      <div className="slot-reels-panel">
        <div className="slot-reels">
          {reelTeams.map((team, i) => (
            <div key={i} className="slot-reel" data-reel-index={i}>
              {team === EMPTY_SLOT ? (
                <Clover size={30} className="slot-reel-empty-icon" />
              ) : (
                <TeamBadge teamId={team.id} size="lg" />
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        className="btn btn-gold btn-block slot-spin-btn"
        onClick={handleSpin}
        disabled={spinning || remainingSpins <= 0}
      >
        <Sparkles size={16} />
        {spinning ? t('slot.spinning') : t('slot.spinButton')}
      </button>

      <div className="slot-remaining">
        <Ticket size={13} />
        <span>{t('slot.remainingSpins', { count: remainingSpins, limit: 3 })}</span>
        <span className="slot-remaining-dots" aria-hidden="true">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className={`slot-remaining-dot${i < remainingSpins ? ' active' : ''}`} />
          ))}
        </span>
      </div>

      {error && <div className="login-error" style={{ marginTop: 10 }}>{error}</div>}

      {result && !spinning && (
        result.justCompleted ? (
          <div className="slot-result complete">
            <div className="slot-result-complete-icon">
              <Sparkles size={22} />
            </div>
            <div className="slot-result-title">{t('slot.completeTitle')}</div>
            <div className="slot-result-sub">{t('slot.completeSub', { count: result.totalTeams })}</div>
            <div className="slot-result-complete-count">{result.collectedCount} / {result.totalTeams}</div>
          </div>
        ) : result.isEmpty ? (
          <div className="slot-result empty">
            <div className="slot-result-title">🍀 {t('slot.emptyTitle')}</div>
            <div className="slot-result-sub">{t('slot.emptySub')}</div>
          </div>
        ) : (
          <div className={`slot-result ${result.isNew ? 'new' : 'duplicate'}`}>
            <div className="slot-result-title">
              {result.isNew ? t('slot.newClubTitle') : t('slot.duplicateTitle')}
              {result.isNew && <span className="slot-result-new-badge">{t('slot.newBadge')}</span>}
            </div>
            <div className="slot-result-badge">
              <TeamBadge teamId={result.team.id} size="md" />
            </div>
            <div className="slot-result-sub">
              {result.isNew ? result.team.name : t('slot.duplicateSub', { club: result.team.name })}
            </div>
            {result.isNew && <div className="slot-result-caption">{t('slot.addedToAlbum')}</div>}
          </div>
        )
      )}
    </div>
  )
}
