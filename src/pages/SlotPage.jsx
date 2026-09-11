import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import slotService, { DAILY_SPIN_LIMIT } from '../services/slotService'
import { flyBadgeToAlbum, prefersReducedMotion } from '../utils/slotFlight'
import SlotMachine from '../components/SlotMachine.jsx'
import ClubAlbum from '../components/ClubAlbum.jsx'
import ZberateliaList from '../components/ZberateliaList.jsx'

/** Football-club-collecting mini-game — entirely separate from the real
 * competition. Reads `teams`/`slotCollections` from the existing
 * AppDataContext (the same data every match/prediction screen and the
 * shared realtime "Zberatelia" state already use) purely to render crests
 * and progress; the only WRITE path is the spinSlot() context action,
 * which itself only ever calls the spin_slot() RPC (see migration 0024) —
 * nothing here touches predictions, matches, or scoring in any way. */
export default function SlotPage() {
  const { currentUser, teams, players, slotCollections, spinSlot } = useAppData()
  const { t } = useLanguage()
  const [remainingSpins, setRemainingSpins] = useState(DAILY_SPIN_LIMIT)
  const slotMachineRef = useRef(null)
  const albumRef = useRef(null)
  // Presentation-only: a newly-won club is added to `slotCollections`
  // (real data) as soon as the RPC resolves, well before the reel
  // animation and the fly-to-album animation finish — without this, the
  // album would flip that slot to "unlocked" while the crest is still
  // spinning. `pendingRevealTeamId` hides just that one slot (still
  // rendered as locked/grayscale) until the flight's "impact" moment;
  // `unlockingTeamId` then drives the short unlock animation on it. Never
  // touches slotCollections/spinsRemaining/any real state.
  const [pendingRevealTeamId, setPendingRevealTeamId] = useState(null)
  const [unlockingTeamId, setUnlockingTeamId] = useState(null)
  const unlockTimeoutRef = useRef(null)

  useEffect(() => () => clearTimeout(unlockTimeoutRef.current), [])

  // One-time read of today's already-used spin count, purely so the
  // counter is correct before the player has spun anything THIS session —
  // every spin after that updates this from spin_slot()'s own response
  // instead, which is always the authoritative number.
  useEffect(() => {
    let cancelled = false
    slotService
      .getTodayStatus()
      .then(({ spinsRemaining }) => {
        if (!cancelled) setRemainingSpins(spinsRemaining)
      })
      .catch(() => {
        // Best-effort — if this fails, the spin button itself still works;
        // the server enforces the real limit regardless of what's shown.
      })
    return () => {
      cancelled = true
    }
  }, [currentUser.id])

  const myCollected = {}
  for (const c of slotCollections) {
    if (c.playerId === currentUser.id && c.teamId !== pendingRevealTeamId) myCollected[c.teamId] = 1
  }

  const handleSpin = async () => {
    const result = await spinSlot()
    setRemainingSpins(result.spinsRemaining)
    // Defer the album reveal for a genuinely new club until the flight
    // animation lands (see handleLanded) — skipped under reduced motion,
    // where the reel itself lands instantly anyway (no window to hide).
    if (result.isNew && !result.isEmpty && !prefersReducedMotion()) {
      setPendingRevealTeamId(result.teamId)
    }
    return result
  }

  // Purely decorative: fires only once a spin has already resolved as a
  // genuinely new club (never for duplicate/empty), and only animates a
  // clone of the already-rendered crest DOM node from the reel to its
  // slot in the album below — reads no data, writes nothing, and cannot
  // affect the real spinsRemaining/collection state set above.
  const handleLanded = (spinResult) => {
    if (spinResult.isEmpty || !spinResult.isNew) return
    const teamId = spinResult.teamId
    const sourceEl = slotMachineRef.current?.querySelector('.slot-reel[data-reel-index="0"] .team-badge')
    const destEl = albumRef.current?.querySelector(`[data-team-id="${teamId}"] .team-badge`)
    if (!sourceEl || !destEl) {
      // Nothing to animate toward — release any deferred reveal so the
      // slot never gets stuck looking locked.
      setPendingRevealTeamId((prev) => (prev === teamId ? null : prev))
      return
    }
    flyBadgeToAlbum(sourceEl, destEl, () => {
      setPendingRevealTeamId((prev) => (prev === teamId ? null : prev))
      setUnlockingTeamId(teamId)
      clearTimeout(unlockTimeoutRef.current)
      unlockTimeoutRef.current = setTimeout(() => setUnlockingTeamId(null), 800)
    })
  }

  return (
    <div className="page-container">
      <div className="slot-header">
        <div className="slot-header-icon">
          <Sparkles size={20} />
        </div>
        <div className="page-title slot-title" style={{ margin: 0 }}>{t('slot.pageTitle')}</div>
        <p className="slot-header-sub">{t('slot.pageSubtitle')}</p>
        <div className="slot-header-divider" aria-hidden="true">
          <span className="slot-header-divider-line" />
          <span className="slot-header-divider-star" />
          <span className="slot-header-divider-line" />
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="empty-state">{t('slot.noTeams')}</div>
      ) : (
        <>
          <div ref={slotMachineRef}>
            <SlotMachine teams={teams} remainingSpins={remainingSpins} onSpin={handleSpin} onLanded={handleLanded} />
          </div>
          <div ref={albumRef}>
            <ClubAlbum teams={teams} collected={myCollected} unlockingTeamId={unlockingTeamId} />
          </div>
          <ZberateliaList players={players} teams={teams} slotCollections={slotCollections} currentUserId={currentUser.id} />
        </>
      )}
    </div>
  )
}
