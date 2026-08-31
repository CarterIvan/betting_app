import { useState } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import PlayerAvatar from './PlayerAvatar.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { formatEuro } from '../utils/formatters'

/** Full contributor list — kept as its own view (not shown inline on the
 * main Banka page) so the page stays short regardless of player count.
 * Receives the already-computed `contributors` from BankaPage — no
 * separate fetch, same player data already loaded for the whole app. */
export default function BankaContributionsList({ contributors, onBack }) {
  const { t, language } = useLanguage()
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? contributors.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : contributors

  return (
    <div className="page-container">
      <div className="live-detail-header">
        <button className="back-btn" onClick={onBack} aria-label={t('common.back')}>
          <ArrowLeft size={18} />
        </button>
        <div className="page-title" style={{ margin: 0 }}>{t('banka.contributions')}</div>
      </div>

      <div className="field">
        <div className="input-icon-wrap">
          <Search size={17} className="field-icon" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('banka.searchPlaceholder')}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          {contributors.length === 0 ? t('banka.noContributions') : t('banka.noResults')}
        </div>
      ) : (
        <div className="banka-contrib-list">
          {filtered.map((player) => (
            <div className="banka-contrib-row" key={player.id}>
              <div className="banka-contrib-avatar">
                <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} />
              </div>
              <span className="banka-contrib-name">{player.name}</span>
              <span className="banka-contrib-amount" title={t('banka.paidContribution')}>
                +{formatEuro(player.paymentAmount, language)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
