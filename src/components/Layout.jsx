import BottomNavigation from './BottomNavigation.jsx'

export default function Layout({ currentPage, onNavigate, children }) {
  return (
    <div className="app-shell">
      {children}
      <BottomNavigation currentPage={currentPage} onNavigate={onNavigate} />
    </div>
  )
}
