import { useEffect, useRef, useState } from 'react'
import { Send, Users } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import ChatMessage from '../components/ChatMessage.jsx'
import { getSeenByPlayers } from '../utils/chatSeenBy'

const QUICK_EMOJI = ['⚽', '🔥', '😂', '🖕', '😢']

export default function ChatPage() {
  const { currentUser, players, chatMessages, chatReadReceipts, sendChatMessage, markChatRead, markChatSeen } =
    useAppData()
  const { t, pluralPlayers } = useLanguage()
  const [text, setText] = useState('')
  const endRef = useRef(null)

  const memberCount = players.length

  useEffect(() => {
    markChatRead()
    markChatSeen()
  }, [chatMessages.length, markChatRead, markChatSeen])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages.length])

  const handleSend = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    sendChatMessage(text)
    setText('')
  }

  return (
    <div className="chat-page">
      <div className="page-container" style={{ paddingBottom: 'calc(var(--nav-height) + 116px + var(--safe-bottom))' }}>
        <div className="page-title">{t('chat.title')}</div>
        <div className="chat-header-meta">
          <Users size={13} />
          {t('chat.membersInLeague', { count: memberCount, word: pluralPlayers(memberCount) })}
        </div>
        <div className="chat-messages">
          {chatMessages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              mine={message.playerId === currentUser.id}
              seenBy={getSeenByPlayers(message, chatReadReceipts, players)}
            />
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="chat-input-bar">
        <div className="chat-input-inner">
          <div className="chat-quick-emoji">
            {QUICK_EMOJI.map((emoji) => (
              <button key={emoji} type="button" onClick={() => setText((prev) => prev + emoji)}>
                {emoji}
              </button>
            ))}
          </div>
          <form className="chat-input-row" onSubmit={handleSend}>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('chat.placeholder')}
            />
            <button className="chat-send-btn" type="submit" disabled={!text.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
