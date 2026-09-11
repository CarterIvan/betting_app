// Central scoring/ranking logic. Nothing in the app should hand-compute or
// hand-store a player's total points anywhere else — everything is derived
// from finished matches + predictions here, so the numbers can never drift.

/** Exact score = 3, correct outcome only = 1, otherwise 0. */
export function calculatePoints(prediction, result) {
  const { predictedHome, predictedAway } = prediction
  const { homeScore, awayScore } = result

  if (
    predictedHome === null || predictedHome === undefined ||
    predictedAway === null || predictedAway === undefined ||
    homeScore === null || homeScore === undefined ||
    awayScore === null || awayScore === undefined
  ) {
    return 0
  }

  if (predictedHome === homeScore && predictedAway === awayScore) return 3

  const predictedOutcome = getOutcome(predictedHome, predictedAway)
  const actualOutcome = getOutcome(homeScore, awayScore)

  return predictedOutcome === actualOutcome ? 1 : 0
}

function getOutcome(home, away) {
  if (home > away) return 'HOME'
  if (home < away) return 'AWAY'
  return 'DRAW'
}

/** Recomputes `points` for every prediction that belongs to a finished match.
 * Predictions on matches that aren't finished yet get points = null. */
export function recalculatePredictions(predictions, matches) {
  const matchById = new Map(matches.map((m) => [m.id, m]))

  return predictions.map((prediction) => {
    const match = matchById.get(prediction.matchId)
    if (!match || !match.finished) {
      return { ...prediction, points: null }
    }
    const points = calculatePoints(prediction, {
      homeScore: match.finalHomeScore,
      awayScore: match.finalAwayScore,
    })
    return { ...prediction, points }
  })
}

/** Per-player totals derived purely from (already recalculated) predictions. */
export function computePlayerStats(playerId, predictions) {
  const own = predictions.filter((p) => p.playerId === playerId && p.points !== null)
  const totalPoints = own.reduce((sum, p) => sum + p.points, 0)
  const exactCount = own.filter((p) => p.points === 3).length
  const correctWinnerCount = own.filter((p) => p.points === 1).length
  return { totalPoints, exactCount, correctWinnerCount }
}

/** Full leaderboard, sorted by points desc (ties broken alphabetically).
 * `isAdmin` is purely an access-control flag — an admin who also plays
 * (predicts matches) competes in the ranking like anyone else. */
export function computeLeaderboard(players, predictions) {
  return players
    .map((player) => {
      const stats = computePlayerStats(player.id, predictions)
      return { player, ...stats }
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || a.player.name.localeCompare(b.player.name, 'sk'))
}

/** Each player's most-often-saved exact score (home:away) — but ONLY over
 * predictions on FINISHED matches, same population as computePlayerStats
 * above and via the exact same signal: `p.points !== null` is already
 * how this codebase knows a prediction belongs to a finished match (set
 * server-side once that match is scored, null otherwise — see
 * recalculatePredictions above and apply_match_result() in SQL). A tip on
 * a live or upcoming match must never move this number — a player's own
 * still-hidden pick would otherwise leak into a stat other players can
 * see the moment they save it, before the match is even over.
 *
 * A tie for most-frequent returns every tied score, never an arbitrary
 * pick — `results` is an array (one entry for a clear favorite, several
 * when tied). `total === 0` means the player has no scored prediction yet.
 *
 * One pass over `predictions`, one pass over `players` — no per-player
 * query, no N+1, nothing new fetched or stored: purely derived from data
 * already loaded into AppDataContext. */
export function computeFavoriteTips(players, predictions) {
  const byPlayer = new Map()
  for (const p of predictions) {
    if (p.points === null || p.points === undefined) continue
    if (p.predictedHome === null || p.predictedHome === undefined) continue
    if (p.predictedAway === null || p.predictedAway === undefined) continue
    if (!byPlayer.has(p.playerId)) byPlayer.set(p.playerId, [])
    byPlayer.get(p.playerId).push(p)
  }

  const favorites = players.map((player) => {
    const own = byPlayer.get(player.id) ?? []
    const total = own.length
    if (total === 0) return { player, results: [], count: 0, total: 0 }

    const scoreCounts = new Map()
    for (const p of own) {
      // Normalized for THIS STAT ONLY — 2:1 and 1:2 count as the same
      // "favorite tip" (which side scored more doesn't matter here), by
      // always putting the larger number first. This never touches
      // p.predictedHome/p.predictedAway themselves — the real saved
      // prediction (and everything scoring reads from it) is untouched.
      const key =
        p.predictedHome >= p.predictedAway
          ? `${p.predictedHome}:${p.predictedAway}`
          : `${p.predictedAway}:${p.predictedHome}`
      scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1)
    }

    const maxCount = Math.max(...scoreCounts.values())
    const results = Array.from(scoreCounts.entries())
      .filter(([, count]) => count === maxCount)
      .map(([score]) => score)
      .sort((a, b) => {
        const [aHome, aAway] = a.split(':').map(Number)
        const [bHome, bAway] = b.split(':').map(Number)
        return aHome - bHome || aAway - bAway
      })

    return { player, results, count: maxCount, total }
  })

  return favorites.sort(
    (a, b) => b.count - a.count || a.player.name.localeCompare(b.player.name, 'sk')
  )
}

/** Applies fresh totals back onto player records (cheap cache for quick reads
 * like the dashboard header), computed only from recalculated predictions —
 * never incremented by hand. */
export function syncPlayerPoints(players, predictions) {
  return players.map((player) => {
    const { totalPoints } = computePlayerStats(player.id, predictions)
    return { ...player, points: totalPoints }
  })
}
