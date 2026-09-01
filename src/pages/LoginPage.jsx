import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'

export default function LoginPage() {
  const { login, leagueLogoUrl } = useAppData()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [forgotNote, setForgotNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(t(err.message))
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgot = (e) => {
    e.preventDefault()
    setForgotNote(t('login.forgotNote'))
    setTimeout(() => setForgotNote(''), 2500)
  }

  return (
    <div className="login-page">
      <div className="login-language-selector">
        <LanguageSelector />
      </div>

      <img src={leagueLogoUrl || '/tipovacka-logo.png'} alt="Tipovačka Liga Majstrov" className="login-logo" />
     
 

      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card-title">{t('login.cardTitle')}</div>
        {error && <div className="login-error">{error}</div>}
        <div className="field">
          <label htmlFor="email">{t('login.emailLabel')}</label>
          <div className="input-icon-wrap">
            <Mail size={17} className="field-icon" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              autoComplete="username"
              required
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="password">{t('login.passwordLabel')}</label>
          <div className="input-icon-wrap">
            <Lock size={17} className="field-icon" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="field-toggle"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? t('login.loggingIn') : t('login.loginButton')}
        </button>
        <button type="button" className="login-forgot" onClick={handleForgot}>
          {forgotNote || t('login.forgotPassword')}
        </button>
      </form>

      <div className="login-hint">{t('login.registerHint')}</div>
      <div className="login-credit">Created by iponican</div>

      <div className="login-deco" />
      <div className="login-deco-ball">⚽</div>
    </div>
  )
}
