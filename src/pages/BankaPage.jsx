import { useState } from 'react'
import { Landmark, Users, Trophy, ChevronRight } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import BankaContributionsList from '../components/BankaContributionsList.jsx'
import { formatEuro } from '../utils/formatters'

const PRIZES = [
  { key: 'firstPlacePrize', medal: '🥇', labelKey: 'banka.place1' },
  { key: 'secondPlacePrize', medal: '🥈', labelKey: 'banka.place2' },
  { key: 'thirdPlacePrize', medal: '🥉', labelKey: 'banka.place3' },
]

export default function BankaPage() {
  const { players, settings } = useAppData()
  const { t, language, pluralPlayers } = useLanguage()
  const [showContributions, setShowContributions] = useState(false)

  // Only confirmed-paid contributions count toward the bank — dynamically
  // derived from real player data, never hard-coded.
  const contributors = players.filter((p) => p.isPaid)
  const total = contributors.reduce((sum, p) => sum + p.paymentAmount, 0)
  const amounts = contributors.map((p) => p.paymentAmount)
  const uniformAmount = amounts.length > 0 && amounts.every((a) => a === amounts[0]) ? amounts[0] : null

  if (showContributions) {
    return <BankaContributionsList contributors={contributors} onBack={() => setShowContributions(false)} />
  }

  return (
    <div className="page-container">
      <div className="page-title">{t('banka.title')}</div>
      <p className="banka-subtitle">{t('banka.subtitle')}</p>

      <div className="banka-total-card">
        <div className="banka-total-label">
          <Landmark size={14} />
          {t('banka.total')}
        </div>
        <div className="banka-total-amount">{formatEuro(total, language)}</div>
        {uniformAmount !== null && (
          <div className="banka-total-formula">
            {t('banka.formula', {
              count: contributors.length,
              word: pluralPlayers(contributors.length),
              amount: formatEuro(uniformAmount, language),
              total: formatEuro(total, language),
            })}
          </div>
        )}
      </div>

      <div className="section-title">
        <Users size={13} />
        {t('banka.contributions')}
      </div>
      <button className="admin-menu-item" onClick={() => setShowContributions(true)}>
        <span className="admin-menu-icon"><Users size={18} /></span>
        <span className="admin-menu-text">
          <span className="admin-menu-title">
            {t('banka.playerCountLabel', { count: contributors.length, word: pluralPlayers(contributors.length) })}
          </span>
          <span className="admin-menu-sub">{t('banka.totalContributionsShort', { total: formatEuro(total, language) })}</span>
        </span>
        <ChevronRight size={17} className="admin-menu-chevron" />
      </button>

      <div className="section-title">
        <Trophy size={13} />
        {t('banka.prizeDistribution')}
      </div>
      <div className="banka-prizes-card">
        {PRIZES.map(({ key, medal, labelKey }) => (
          <div className="banka-prize-row" key={key}>
            <span className="banka-prize-medal">{medal}</span>
            <span className="banka-prize-label">{t(labelKey)}</span>
            <span className="banka-prize-amount">{formatEuro(settings?.[key] ?? 0, language)}</span>
          </div>
        ))}
      </div>
      <p className="banka-note">{t('banka.note')}</p>
    </div>
  )
}
