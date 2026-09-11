import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/** Dashboard-only, admin-controlled scrolling ticker (see migration 0023,
 * settings.ticker_message). Renders nothing at all — not an empty
 * container — whenever no ticker is currently active. The message itself
 * is admin-entered content, shown verbatim in every language; only the
 * fixed "📢 NOVINKY"-style badge label and accessible aria-label around it
 * go through i18n. The seamless infinite
 * scroll is two identical copies of the text side by side, animated
 * exactly one copy-width to the left on loop (see .dashboard-ticker-track
 * in index.css) — a well-known CSS-only technique that never "jumps"
 * because the second copy is already in place where the first one was. */
export default function DashboardTicker() {
  const { settings } = useAppData()
  const { t } = useLanguage()
  const message = settings?.tickerMessage

  if (!message) return null

  return (
    <div className="dashboard-ticker" role="status" aria-label={t('dashboard.tickerLabel')}>
      <span className="dashboard-ticker-badge">
        <span className="dashboard-ticker-badge-emoji" aria-hidden="true">📢</span>
        <span className="dashboard-ticker-badge-text">{t('dashboard.tickerBadgeLabel')}</span>
      </span>
      <div className="dashboard-ticker-scroll">
        <div className="dashboard-ticker-track">
          <span className="dashboard-ticker-text">{message}</span>
          <span className="dashboard-ticker-text" aria-hidden="true">{message}</span>
        </div>
      </div>
    </div>
  )
}
