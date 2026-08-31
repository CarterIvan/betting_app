/** Renders the INNER content of an avatar circle — a photo if the player
 * has one, initials otherwise. Drop it inside any existing sized/colored
 * circle wrapper (`.podium-avatar`, `.chat-avatar`, `.player-tip-avatar`,
 * `.rank-avatar`, …); this only decides photo-vs-initials, not size/shape. */
export default function PlayerAvatar({ name, avatarUrl }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="avatar-img" />
  }
  return name.slice(0, 2).toUpperCase()
}
