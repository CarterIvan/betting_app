import { useState } from 'react'
import { Check } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const FIELDS = [
  { key: 'firstPlacePrize', labelKey: 'admin.place1Label' },
  { key: 'secondPlacePrize', labelKey: 'admin.place2Label' },
  { key: 'thirdPlacePrize', labelKey: 'admin.place3Label' },
]

export default function AdminPrizeForm() {
  const { settings, updatePrizeSettings } = useAppData()
  const { t } = useLanguage()
  const [form, setForm] = useState({
    firstPlacePrize: String(settings?.firstPlacePrize ?? 0),
    secondPlacePrize: String(settings?.secondPlacePrize ?? 0),
    thirdPlacePrize: String(settings?.thirdPlacePrize ?? 0),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value.replace(/[^0-9.]/g, '') }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await updatePrizeSettings({
        firstPlacePrize: Number(form.firstPlacePrize) || 0,
        secondPlacePrize: Number(form.secondPlacePrize) || 0,
        thirdPlacePrize: Number(form.thirdPlacePrize) || 0,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError(t('admin.distributionSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      {error && <div className="login-error">{error}</div>}
      {FIELDS.map(({ key, labelKey }) => (
        <div className="field" key={key}>
          <label>{t(labelKey)}</label>
          <input inputMode="decimal" value={form[key]} onChange={update(key)} placeholder="0" />
        </div>
      ))}
      <button className="btn btn-gold btn-block" type="submit" disabled={saving}>
        {saving ? t('common.saving') : t('admin.saveDistribution')}
      </button>
      {saved && (
        <div className="saved-note" style={{ justifyContent: 'center', marginTop: 10 }}>
          <Check size={13} /> {t('admin.distributionSaved')}
        </div>
      )}
    </form>
  )
}
