import BottomNavigation from './BottomNavigation.jsx'
import ResultCorrectionPopup from './ResultCorrectionPopup.jsx'

export default function Layout({ currentPage, onNavigate, children }) {
  return (
    <div className="app-shell">
      {children}
      <BottomNavigation currentPage={currentPage} onNavigate={onNavigate} />
      <ResultCorrectionPopup />
    </div>
  )
}
