import { useState } from 'react'
import { Check } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function AdminPaymentForm() {
  const { settings, updatePaymentIban } = useAppData()
  const { t } = useLanguage()
  const [iban, setIban] = useState(settings?.paymentIban ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await updatePaymentIban(iban.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError(t('admin.ibanSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      {error && <div className="login-error">{error}</div>}
      <div className="field">
        <label>{t('admin.ibanLabel')}</label>
        <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="SK00 0000 0000 0000 0000 0000" />
      </div>
      <button className="btn btn-gold btn-block" type="submit" disabled={saving}>
        {saving ? t('common.saving') : t('admin.saveIban')}
      </button>
      {saved && (
        <div className="saved-note" style={{ justifyContent: 'center', marginTop: 10 }}>
          <Check size={13} /> {t('admin.ibanSaved')}
        </div>
      )}
    </form>
  )
}
