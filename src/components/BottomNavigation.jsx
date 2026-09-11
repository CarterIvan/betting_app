import { Home, Trophy, MessageCircle, Radio, History, Landmark, Sparkles, ShieldCheck } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { cx } from '../utils/formatters'

const ITEMS = [
  { key: 'dashboard', labelKey: 'nav.dashboard', icon: Home },
  { key: 'table', labelKey: 'nav.table', icon: Trophy },
  { key: 'chat', labelKey: 'nav.chat', icon: MessageCircle },
  { key: 'live', labelKey: 'nav.live', icon: Radio },
  { key: 'history', labelKey: 'nav.history', icon: History },
  { key: 'banka', labelKey: 'nav.banka', icon: Landmark },
  { key: 'slot', labelKey: 'nav.slot', icon: Sparkles },
]

// Which nav items can carry a count badge, and where that count comes from.
const BADGE_COUNTS = {
  chat: (data) => data.unreadChatCount,
  live: (data) => data.liveMatchCount,
}

export default function BottomNavigation({ currentPage, onNavigate }) {
  const appData = useAppData()
  const { currentUser } = appData
  const { t } = useLanguage()

  const items = currentUser?.isAdmin
    ? [...ITEMS, { key: 'admin', labelKey: 'nav.admin', icon: ShieldCheck, isAdmin: true }]
    : ITEMS

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {items.map(({ key, labelKey, icon: Icon, isAdmin }) => {
          const active = currentPage === key
          const badgeCount = BADGE_COUNTS[key]?.(appData) ?? 0
          return (
            <button
              key={key}
              className={cx('nav-item', isAdmin && 'admin-item', active && 'active')}
              onClick={() => onNavigate(key)}
            >
              <Icon size={21} strokeWidth={active ? 2.4 : 2} />
              <span>{t(labelKey)}</span>
              {badgeCount > 0 && <span className="nav-badge">{badgeCount}</span>}
              {active && <span className="nav-item-dot" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
