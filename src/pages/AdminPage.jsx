import { useState } from 'react'
import {
  ArrowLeft, ShieldCheck, Crown, Plus, ListChecks, Users, Settings, Landmark,
  ChevronRight, CheckCircle2, Calculator, Shield, CreditCard,
} from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { getKickoffTimestamp, getMatchStatus, MATCH_STATUS } from '../utils/matchState'
import AdminMatchForm from '../components/AdminMatchForm.jsx'
import AdminMatchList from '../components/AdminMatchList.jsx'
import AdminPlayersList from '../components/AdminPlayersList.jsx'
import AdminAddPlayerForm from '../components/AdminAddPlayerForm.jsx'
import AdminPrizeForm from '../components/AdminPrizeForm.jsx'
import AdminDangerZone from '../components/AdminDangerZone.jsx'
import AdminLeagueLogo from '../components/AdminLeagueLogo.jsx'
import AdminTeamsList from '../components/AdminTeamsList.jsx'
import AdminAnnouncementForm from '../components/AdminAnnouncementForm.jsx'
import AdminTickerForm from '../components/AdminTickerForm.jsx'
import AdminPaymentForm from '../components/AdminPaymentForm.jsx'

const MENU = [
  { key: 'add', titleKey: 'admin.menuAddMatch', subKey: 'admin.menuAddMatchSub', icon: Plus },
  { key: 'matches', titleKey: 'admin.menuMatches', subKey: 'admin.menuMatchesSub', icon: ListChecks },
  { key: 'teams', titleKey: 'admin.menuTeams', subKey: 'admin.menuTeamsSub', icon: Shield },
  { key: 'players', titleKey: 'admin.menuPlayers', subKey: 'admin.menuPlayersSub', icon: Users },
  { key: 'prizes', titleKey: 'admin.menuPrizes', subKey: 'admin.menuPrizesSub', icon: Landmark },
  { key: 'payment', titleKey: 'admin.menuPayment', subKey: 'admin.menuPaymentSub', icon: CreditCard },
  { key: 'settings', titleKey: 'admin.menuSettings', subKey: 'admin.menuSettingsSub', icon: Settings },
]

export default function AdminPage({ onNavigate }) {
  const { currentUser, matches, addMatch, updateMatch, updateMatchLiveScore, deleteMatch, finishMatch, recalculateAll } =
    useAppData()
  const { t } = useLanguage()
  const [view, setView] = useState('menu')
  const [toast, setToast] = useState('')
  const [confirmFinish, setConfirmFinish] = useState(false)

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(''), 2200)
  }

  const sorted = [...matches].sort((a, b) => {
    const rank = (m) => (getMatchStatus(m) === MATCH_STATUS.FINISHED ? 1 : 0)
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    return getKickoffTimestamp(b) - getKickoffTimestamp(a)
  })

  const handleAdd = async (form) => {
    await addMatch(form)
    showToast(t('admin.matchAdded'))
    setView('matches')
  }

  const handleFinish = async (matchId, home, away) => {
    try {
      await finishMatch(matchId, home, away)
      setConfirmFinish(true)
    } catch {
      showToast(t('admin.matchCloseFailed'))
    }
  }

  const handleRecalculate = async () => {
    try {
      await recalculateAll()
      showToast(t('admin.recalcDone'))
    } catch {
      showToast(t('admin.recalcFailed'))
    }
  }

  const goBack = () => (view === 'menu' ? onNavigate('dashboard') : setView('menu'))
  const activeMenuItem = MENU.find((m) => m.key === view)
  const title = view === 'menu' ? t('admin.title') : activeMenuItem ? t(activeMenuItem.titleKey) : t('admin.title')

  if (confirmFinish) {
    return (
      <div className="page-container">
        <div className="admin-confirm">
          <div className="admin-confirm-icon">
            <CheckCircle2 size={38} />
          </div>
          <div className="admin-confirm-title">{t('admin.matchClosedTitle')}</div>
          <p className="admin-confirm-text">{t('admin.matchClosedText')}</p>
          <button
            className="btn btn-gold btn-block"
            style={{ maxWidth: 220 }}
            onClick={() => { setConfirmFinish(false); setView('matches') }}
          >
            {t('common.ok')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="live-detail-header">
        <button className="back-btn" onClick={goBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="page-title" style={{ margin: 0 }}>{title}</div>
      </div>

      {view === 'menu' && (
        <>
          <div className="admin-hero">
            <div className="admin-hero-icon">
              <Crown size={28} />
            </div>
            <div className="admin-hero-title">{currentUser.name}</div>
            <div className="admin-header-badge">
              <ShieldCheck size={13} />
              {t('admin.accessBadge')}
            </div>
          </div>
          <div className="admin-menu-list">
            {MENU.map(({ key, titleKey, subKey, icon: Icon }) => (
              <button key={key} className="admin-menu-item" onClick={() => setView(key)}>
                <span className="admin-menu-icon"><Icon size={18} /></span>
                <span className="admin-menu-text">
                  <span className="admin-menu-title">{t(titleKey)}</span>
                  <span className="admin-menu-sub">{t(subKey)}</span>
                </span>
                <ChevronRight size={17} className="admin-menu-chevron" />
              </button>
            ))}
          </div>
        </>
      )}

      {view === 'add' && <AdminMatchForm onAdd={handleAdd} />}

      {view === 'matches' && (
        <AdminMatchList
          matches={sorted}
          onUpdate={updateMatch}
          onUpdateLiveScore={updateMatchLiveScore}
          onDelete={deleteMatch}
          onFinish={handleFinish}
        />
      )}

      {view === 'teams' && <AdminTeamsList />}

      {view === 'players' && (
        <>
          <AdminAddPlayerForm />
          <AdminPlayersList />
        </>
      )}

      {view === 'prizes' && <AdminPrizeForm />}

      {view === 'payment' && <AdminPaymentForm />}

      {view === 'settings' && (
        <>
          <AdminLeagueLogo />
          <AdminAnnouncementForm />
          <AdminTickerForm />
          <div className="card">
            <p style={{ fontSize: 12.5, color: 'var(--text-soft)', margin: '0 0 12px', fontWeight: 600 }}>
              {t('admin.recalcDescription')}
            </p>
            <button className="btn btn-outline btn-sm" onClick={handleRecalculate}>
              <Calculator size={14} /> {t('admin.recalcButton')}
            </button>
          </div>
          <AdminDangerZone />
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
