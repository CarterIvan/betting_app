import { cx, formatClock } from '../utils/formatters'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import PlayerAvatar from './PlayerAvatar.jsx'

export default function ChatMessage({ message, mine }) {
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
      </div>
    </div>
  )
}
