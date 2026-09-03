import { useState } from 'react'
import { Clock, MessageCircleQuestion, LogOut, Clipboard, Check } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function AccessBlockedPage() {
  const { currentUser, logout, leagueLogoUrl, paymentIban } = useAppData()
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)

  const handleCopyIban = async () => {
    try {
      await navigator.clipboard.writeText(paymentIban)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // Clipboard access can fail (unsupported browser, denied permission) —
      // the IBAN is still shown on screen, so the player can still copy it
      // manually; nothing else to do here.
    }
  }

  return (
    <div className="access-blocked-page">
      <img src={leagueLogoUrl || '/tipovacka-logo.png'} alt="Tipovačka Liga Majstrov" className="access-blocked-logo" />

      <div className="access-blocked-icon">
        <Clock size={26} />
      </div>

      <div className="access-blocked-title">{t('access.title')}</div>
      <p className="access-blocked-text">{t('access.text', { name: currentUser.name })}</p>

      {paymentIban && (
        <div className="access-blocked-iban-box">
          <div className="access-blocked-iban-label">{t('access.ibanLabel')}</div>
          <div className="access-blocked-iban-value">{paymentIban}</div>
          <button className="btn btn-outline btn-sm" type="button" onClick={handleCopyIban}>
            <Clipboard size={14} /> {t('access.copyIban')}
          </button>
          {copied && (
            <div className="saved-note" style={{ justifyContent: 'center', marginTop: 8 }}>
              <Check size={13} /> {t('access.copied')}
            </div>
          )}
        </div>
      )}

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
