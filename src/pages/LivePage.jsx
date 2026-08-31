import { useState } from 'react'
import { Radio } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { getMatchStatus, MATCH_STATUS } from '../utils/matchState'
import LiveMatchCard from '../components/LiveMatchCard.jsx'
import LiveMatchDetail from '../components/LiveMatchDetail.jsx'

export default function LivePage() {
  const { matches } = useAppData()
  const { t } = useLanguage()
  const [selectedId, setSelectedId] = useState(null)

  const liveMatches = matches.filter((m) => getMatchStatus(m) === MATCH_STATUS.LIVE)
  const selectedMatch = liveMatches.find((m) => m.id === selectedId)

  if (selectedMatch) {
    return <LiveMatchDetail match={selectedMatch} onBack={() => setSelectedId(null)} />
  }

  return (
    <div className="page-container">
      <div className="page-title">{t('live.title')}</div>

      {liveMatches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Radio size={30} /></div>
          {t('live.noLiveMatches')}
        </div>
      ) : (
        liveMatches.map((match) => (
          <LiveMatchCard key={match.id} match={match} onClick={() => setSelectedId(match.id)} />
        ))
      )}
    </div>
  )
}
