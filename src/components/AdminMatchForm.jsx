import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const emptyForm = { homeTeam: '', awayTeam: '', date: '', startTime: '' }

export default function AdminMatchForm({ onAdd }) {
  const { teams } = useAppData()
  const { t } = useLanguage()
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.homeTeam || !form.awayTeam || !form.date || !form.startTime) {
      setError(t('admin.fillAllFields'))
      return
    }
    if (form.homeTeam === form.awayTeam) {
      setError(t('admin.teamsMustDiffer'))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onAdd(form)
      setForm(emptyForm)
    } catch {
      setError(t('admin.matchAddFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 22 }}>
      {error && <div className="login-error">{error}</div>}
      <div className="admin-form-grid">
        <div className="field">
          <label>{t('admin.homeTeam')}</label>
          <select value={form.homeTeam} onChange={update('homeTeam')}>
            <option value="">{t('admin.selectTeam')}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t('admin.awayTeam')}</label>
          <select value={form.awayTeam} onChange={update('awayTeam')}>
            <option value="">{t('admin.selectTeam')}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t('admin.date')}</label>
          <input type="date" value={form.date} onChange={update('date')} />
        </div>
        <div className="field">
          <label>{t('admin.time')}</label>
          <input type="time" value={form.startTime} onChange={update('startTime')} />
        </div>
      </div>
      <button className="btn btn-gold btn-block" type="submit" disabled={submitting}>
        <Plus size={16} />
        {submitting ? t('admin.adding') : t('admin.addMatch')}
      </button>
    </form>
  )
}
