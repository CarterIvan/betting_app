import { useState } from 'react'
import { UserPlus, Check } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const emptyForm = { name: '', email: '', password: '', paymentAmount: '' }

/** Admin > Hráči — creates a real, immediately-usable player account.
 * Security lives server-side in the admin-create-player Edge Function
 * (re-verifies the caller is an admin before ever touching service_role);
 * this form is just the UI for it. */
export default function AdminAddPlayerForm() {
  const { createPlayer } = useAppData()
  const { t } = useLanguage()
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const name = form.name.trim()
    const email = form.email.trim()
    const password = form.password
    const paymentAmount = Number(form.paymentAmount)

    if (!name || !email || !password || form.paymentAmount.trim() === '' || !Number.isFinite(paymentAmount) || paymentAmount < 0) {
      setError(t('admin.fillAllFields'))
      setSuccess(false)
      return
    }

    setError('')
    setSuccess(false)
    setSubmitting(true)
    try {
      await createPlayer({ name, email, password, paymentAmount })
      setForm(emptyForm)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(t(err.message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 22 }}>
      <div className="admin-menu-sub" style={{ marginBottom: 12, fontWeight: 800, color: 'var(--navy)', fontSize: 13 }}>
        {t('admin.addPlayerTitle')}
      </div>
      {error && <div className="login-error">{error}</div>}
      <div className="field">
        <label>{t('admin.playerNameLabel')}</label>
        <input
          type="text"
          value={form.name}
          onChange={update('name')}
          placeholder={t('admin.playerNamePlaceholder')}
        />
      </div>
      <div className="field">
        <label>{t('admin.playerEmailLabel')}</label>
        <input
          type="email"
          value={form.email}
          onChange={update('email')}
          placeholder={t('login.emailPlaceholder')}
        />
      </div>
      <div className="field">
        <label>{t('admin.playerPasswordLabel')}</label>
        <input
          type="password"
          value={form.password}
          onChange={update('password')}
          placeholder={t('admin.playerPasswordPlaceholder')}
        />
      </div>
      <div className="field">
        <label>{t('admin.playerPaymentLabel')}</label>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={form.paymentAmount}
          onChange={update('paymentAmount')}
          placeholder={t('admin.playerPaymentPlaceholder')}
        />
      </div>
      <button className="btn btn-gold btn-block" type="submit" disabled={submitting}>
        <UserPlus size={16} />
        {submitting ? t('admin.addingPlayer') : t('admin.addPlayerButton')}
      </button>
      {success && (
        <div className="saved-note" style={{ justifyContent: 'center', marginTop: 10 }}>
          <Check size={13} /> {t('admin.playerCreated')}
        </div>
      )}
    </form>
  )
}
