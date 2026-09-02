import { useRef, useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/** Create-or-edit form for a custom team — used both standalone (Admin >
 * Timovi) and embedded inside TeamPicker's "+ Add new team" flow. Editing
 * only ever reaches a custom team; a predefined one is never passed in
 * (AdminTeamsList doesn't wire an edit action for those, and RLS would
 * reject the update server-side regardless — see migration 0011). */
export default function AdminTeamForm({ team, onSaved, onCancel }) {
  const { createTeam, updateTeam } = useAppData()
  const { t } = useLanguage()
  const isEditing = Boolean(team)

  const [name, setName] = useState(team?.name ?? '')
  const [shortCode, setShortCode] = useState(team?.shortName ?? '')
  // Same defaults the teams table itself already falls back to for a brand
  // new row (see migration 0001) — kept in sync rather than picking an
  // arbitrary different default here.
  const [primaryColor, setPrimaryColor] = useState(team?.primary ?? '#0B1E3D')
  const [secondaryColor, setSecondaryColor] = useState(team?.secondary ?? '#1D4FD7')
  const [logoFile, setLogoFile] = useState(null)
  const [preview, setPreview] = useState(team?.logo ?? null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLogoFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedCode = shortCode.trim()
    if (!trimmedName || !trimmedCode) {
      setError(t('admin.fillAllFields'))
      return
    }

    setError('')
    setSubmitting(true)
    try {
      if (isEditing) {
        await updateTeam(team.id, { name: trimmedName, shortName: trimmedCode, logoFile, primaryColor, secondaryColor })
        onSaved(team.id)
      } else {
        const id = await createTeam({ name: trimmedName, shortName: trimmedCode, logoFile, primaryColor, secondaryColor })
        onSaved(id)
      }
    } catch (err) {
      const message = t(err.message)
      const fallback = isEditing ? 'admin.teamUpdateFailed' : 'admin.teamCreateFailed'
      setError(message !== err.message ? message : t(fallback))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="team-form" onSubmit={handleSubmit}>
      <div className="team-form-title">{t(isEditing ? 'admin.editTeamTitle' : 'admin.addTeamTitle')}</div>
      {error && <div className="login-error">{error}</div>}

      <div className="team-form-logo-row">
        <div className="team-form-logo-preview">
          {preview ? <img src={preview} alt="" /> : <ImageIcon size={20} />}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
          {t('admin.teamLogoLabel')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      <div className="field">
        <label>{t('admin.teamNameLabel')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('admin.teamNamePlaceholder')}
        />
      </div>
      <div className="field">
        <label>{t('admin.teamShortCodeLabel')}</label>
        <input
          type="text"
          value={shortCode}
          onChange={(e) => setShortCode(e.target.value.toUpperCase().slice(0, 4))}
          placeholder={t('admin.teamShortCodePlaceholder')}
        />
      </div>

      <div className="admin-form-grid">
        <div className="field">
          <label>{t('admin.teamPrimaryColorLabel')}</label>
          <div className="color-field-row">
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
            <span className="color-field-hex">{primaryColor}</span>
          </div>
        </div>
        <div className="field">
          <label>{t('admin.teamSecondaryColorLabel')}</label>
          <div className="color-field-row">
            <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
            <span className="color-field-hex">{secondaryColor}</span>
          </div>
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn btn-gold btn-block" type="submit" disabled={submitting}>
          {submitting ? t('common.saving') : t(isEditing ? 'common.save' : 'admin.addTeamButton')}
        </button>
        <button className="btn btn-outline btn-block" type="button" onClick={onCancel} disabled={submitting}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
