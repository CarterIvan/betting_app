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

/** Applies fresh totals back onto player records (cheap cache for quick reads
 * like the dashboard header), computed only from recalculated predictions —
 * never incremented by hand. */
export function syncPlayerPoints(players, predictions) {
  return players.map((player) => {
    const { totalPoints } = computePlayerStats(player.id, predictions)
    return { ...player, points: totalPoints }
  })
}
