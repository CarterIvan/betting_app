import { cx, formatClock } from '../utils/formatters'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import PlayerAvatar from './PlayerAvatar.jsx'

/** Cap on how many "seen by" avatars are ever rendered per message — a
 * compact Messenger-style hint, not a full read log, so this deliberately
 * never grows into a wide row even for a large group. */
const MAX_SEEN_AVATARS = 6

export default function ChatMessage({ message, mine, seenBy = [] }) {
  const { t } = useLanguage()
  const isAdmin = message.playerIsAdmin
  const displayName = message.playerName || t('chat.unknownPlayer')

  return (
    <div className={cx('chat-message', mine && 'mine')}>
      <div className={cx('chat-avatar', isAdmin && 'avatar-admin')}>
        <PlayerAvatar name={displayName} avatarUrl={message.playerAvatarUrl} />
      </div>
      <div className="chat-bubble-col">
        <div className="chat-message-author">
          {displayName}
          {isAdmin && <span className="chat-admin-badge">ADMIN</span>}
        </div>
        <div className={cx('chat-bubble', isAdmin && 'chat-bubble-admin')}>{message.text}</div>
        <div className="chat-message-time">{formatClock(message.createdAt)}</div>
        {seenBy.length > 0 && (
          <div className="chat-seen-by" title={seenBy.map((p) => p.name).join(', ')}>
            {seenBy.slice(0, MAX_SEEN_AVATARS).map((player) => (
              <span className="chat-seen-avatar" key={player.id}>
                <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
