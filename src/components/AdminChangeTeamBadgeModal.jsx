import { useRef, useState } from 'react'
import { Upload, RotateCcw } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { getReadableTextColor } from '../utils/formatters'

/** Admin > Timovi — logo-only editor for a PREDEFINED team (opened from
 * AdminTeamsList's "Change badge" link). Name/short_name/country stay
 * locked — enforced server-side by a trigger (see migration 0011), not
 * just by this form never showing those fields. Reuses teamsService.update
 * (the same call AdminTeamForm uses for custom teams), just with only
 * logoFile/removeLogo set — name/shortName/colors are omitted here, so
 * they're left untouched on the row rather than sent as unrelated changes. */
export default function AdminChangeTeamBadgeModal({ team, onClose }) {
  const { updateTeam } = useAppData()
  const { t } = useLanguage()

  const [logoFile, setLogoFile] = useState(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [preview, setPreview] = useState(team.logo)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLogoFile(file)
    setRemoveLogo(false)
    setPreview(URL.createObjectURL(file))
  }

  const handleUseGenerated = () => {
    setLogoFile(null)
    setRemoveLogo(true)
    setPreview(null)
  }

  const handleSave = async () => {
    setError('')
    setSubmitting(true)
    try {
      await updateTeam(team.id, { logoFile, removeLogo })
      onClose()
    } catch (err) {
      const message = t(err.message)
      setError(message !== err.message ? message : t('admin.teamUpdateFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !submitting && onClose()}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t('admin.changeBadgeTitle', { name: team.name })}</div>
        {error && <div className="login-error">{error}</div>}

        <div className="team-form-logo-preview" style={{ width: 72, height: 72, margin: '0 auto 18px' }}>
          {preview ? (
            <img src={preview} alt="" />
          ) : (
            <div
              className="team-badge-color-preview"
              style={{
                background: `linear-gradient(135deg, ${team.primary}, ${team.secondary})`,
                color: getReadableTextColor(team.primary, team.secondary),
              }}
            >
              {team.shortName}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-outline btn-block" type="button" onClick={() => fileInputRef.current?.click()} disabled={submitting}>
            <Upload size={15} /> {t('admin.uploadNewBadgeButton')}
          </button>
          <button className="btn btn-outline btn-block" type="button" onClick={handleUseGenerated} disabled={submitting}>
            <RotateCcw size={15} /> {t('admin.useGeneratedBadgeButton')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button className="btn btn-gold btn-block" type="button" onClick={handleSave} disabled={submitting}>
            {submitting ? t('common.saving') : t('common.save')}
          </button>
          <button className="btn btn-outline btn-block" type="button" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
