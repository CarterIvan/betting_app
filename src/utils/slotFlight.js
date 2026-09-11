export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Purely decorative DOM animation: clones the already-rendered crest DOM
 * node from the slot reel and flies it to the matching slot in the club
 * album, then removes itself. No React state, no re-render, no data
 * read/written — it only ever runs after a spin has already resolved as a
 * genuinely new club (gated by the caller), so it can never affect which
 * club was drawn, whether it counted as new, or any Supabase state.
 *
 * `onImpact`, if given, fires at the exact moment the flight ends (or,
 * under reduced motion where there's no flight to time against,
 * immediately) — the caller uses this as the one "landing" instant to
 * reveal any deferred UI state, so the album can never show a club as
 * unlocked before its crest has actually arrived there. */
export function flyBadgeToAlbum(sourceEl, destEl, onImpact) {
  if (!sourceEl || !destEl || typeof window === 'undefined') return

  if (prefersReducedMotion()) {
    onImpact?.()
    pulseLanded(destEl)
    return
  }

  const sourceRect = sourceEl.getBoundingClientRect()
  const destRect = destEl.getBoundingClientRect()
  if (sourceRect.width === 0 || destRect.width === 0) return

  const clone = sourceEl.cloneNode(true)
  clone.className = 'slot-flight-badge'
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${sourceRect.left}px`,
    top: `${sourceRect.top}px`,
    width: `${sourceRect.width}px`,
    height: `${sourceRect.height}px`,
    margin: '0',
    zIndex: '999',
    pointerEvents: 'none',
  })
  document.body.appendChild(clone)

  const dx = destRect.left + destRect.width / 2 - (sourceRect.left + sourceRect.width / 2)
  const dy = destRect.top + destRect.height / 2 - (sourceRect.top + sourceRect.height / 2)
  const scale = Math.max(destRect.width / sourceRect.width, 0.35)

  // Force a layout flush so the transition below actually animates from
  // the starting position instead of jumping straight to the end state.
  // eslint-disable-next-line no-unused-expressions
  clone.getBoundingClientRect()

  requestAnimationFrame(() => {
    clone.style.transition = 'transform 0.85s cubic-bezier(0.22, 0.9, 0.32, 1), opacity 0.85s ease'
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
    clone.style.opacity = '0.92'
  })

  let done = false
  const cleanup = () => {
    if (done) return
    done = true
    clone.remove()
    onImpact?.()
    pulseLanded(destEl)
  }
  clone.addEventListener('transitionend', cleanup, { once: true })
  // Safety net in case transitionend never fires (tab backgrounded, etc).
  setTimeout(cleanup, 1000)
}

function pulseLanded(destEl) {
  const item = destEl.closest('.slot-album-item') || destEl
  item.classList.add('slot-album-item-landed')
  setTimeout(() => item.classList.remove('slot-album-item-landed'), 700)
}
