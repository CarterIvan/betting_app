import { Clock, MessageCircleQuestion, LogOut } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function AccessBlockedPage() {
  const { currentUser, logout, leagueLogoUrl } = useAppData()
  const { t } = useLanguage()

  return (
    <div className="access-blocked-page">
      <img src={leagueLogoUrl || '/tipovacka-logo.png'} alt="Tipovačka Liga Majstrov" className="access-blocked-logo" />

      <div className="access-blocked-icon">
        <Clock size={26} />
      </div>

      <div className="access-blocked-title">{t('access.title')}</div>
      <p className="access-blocked-text">{t('access.text', { name: currentUser.name })}</p>

      <div className="access-blocked-contact">
        <MessageCircleQuestion size={16} />
        {t('access.contactAdmin')}
      </div>

      <button className="access-blocked-logout" onClick={logout}>
        <LogOut size={13} />
        {t('access.logout')}
      </button>
    </div>
  )
}
