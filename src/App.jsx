import { useState } from 'react'
import { useAppData } from './context/AppDataContext.jsx'
import { useLanguage } from './i18n/LanguageContext.jsx'
import LoginPage from './pages/LoginPage.jsx'
import Layout from './components/Layout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import TablePage from './pages/TablePage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import LivePage from './pages/LivePage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import BankaPage from './pages/BankaPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import AccessBlockedPage from './pages/AccessBlockedPage.jsx'

export default function App() {
  const { loading, loadError, currentUser, accessBlocked } = useAppData()
  const { t } = useLanguage()
  const [currentPage, setCurrentPage] = useState('dashboard')

  if (loadError && !currentUser) {
    return (
      <div className="app-backdrop">
        <div className="app-shell">
          <div className="page-container">
            <div className="login-error" style={{ margin: '40px 16px' }}>{t(loadError)}</div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-backdrop">
        <div className="app-shell" />
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="app-backdrop">
        <LoginPage />
      </div>
    )
  }

  if (accessBlocked) {
    return (
      <div className="app-backdrop">
        <div className="app-shell">
          <AccessBlockedPage />
        </div>
      </div>
    )
  }

  const activePage = currentPage === 'admin' && !currentUser.isAdmin ? 'dashboard' : currentPage

  const pages = {
    dashboard: <DashboardPage />,
    table: <TablePage />,
    chat: <ChatPage />,
    live: <LivePage />,
    history: <HistoryPage />,
    banka: <BankaPage />,
    admin: <AdminPage onNavigate={setCurrentPage} />,
  }

  return (
    <div className="app-backdrop">
      <Layout currentPage={activePage} onNavigate={setCurrentPage}>
        {pages[activePage] ?? pages.dashboard}
      </Layout>
    </div>
  )
}
