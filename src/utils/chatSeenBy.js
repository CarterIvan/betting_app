/** Which players (excluding the message's own sender) have read this
 * message — i.e. have a chat_read_receipts row (see migration 0021) with
 * last_read_at at or after this message's created_at. Pure, O(players)
 * per message — players is a small, bounded list, so this stays cheap
 * regardless of how much chat history exists. A player who has never
 * opened the chat has no receipt row at all and is naturally excluded. */
export function getSeenByPlayers(message, chatReadReceipts, players) {
  const messageTime = new Date(message.createdAt).getTime()
  const seenPlayerIds = new Set(
    chatReadReceipts
      .filter((r) => r.playerId !== message.playerId)
      .filter((r) => new Date(r.lastReadAt).getTime() >= messageTime)
      .map((r) => r.playerId)
  )
  return players.filter((p) => seenPlayerIds.has(p.id))
}
