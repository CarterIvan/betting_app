import { useState } from 'react'
import { Lock, Trash2, Plus, AlertTriangle } from 'lucide-react'
import TeamBadge from './TeamBadge.jsx'
import AdminTeamForm from './AdminTeamForm.jsx'
import AdminChangeTeamBadgeModal from './AdminChangeTeamBadgeModal.jsx'
import { useAppData } from '../context/AppDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/** Admin > Timovi — the 36 predefined Champions League teams (name/
 * short_name/country/deletion locked, see migration 0011 — only their
 * logo/colors can change, via "Change badge") plus any custom teams the
 * admin has created (fully editable, deletable). */
export default function AdminTeamsList() {
  const { teams, deleteTeam } = useAppData()
  const { t, language } = useLanguage()
  const [view, setView] = useState('list') // list | create | edit
  const [editingTeam, setEditingTeam] = useState(null)
  const [badgeTeam, setBadgeTeam] = useState(null)
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const predefined = teams
    .filter((team) => !team.isCustom)
    .sort((a, b) => a.name.localeCompare(b.name, language))
  const custom = teams
    .filter((team) => team.isCustom)
    .sort((a, b) => a.name.localeCompare(b.name, language))

  const handleSaved = () => {
    setView('list')
    setEditingTeam(null)
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteTeam(confirmDeleteTeam.id)
      setConfirmDeleteTeam(null)
    } catch (err) {
      const message = t(err.message)
      setDeleteError(message !== err.message ? message : t('admin.teamDeleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  if (view === 'create') {
    return (
      <div className="card">
        <AdminTeamForm onSaved={handleSaved} onCancel={() => setView('list')} />
      </div>
    )
  }
  if (view === 'edit' && editingTeam) {
    return (
      <div className="card">
        <AdminTeamForm team={editingTeam} onSaved={handleSaved} onCancel={() => setView('list')} />
      </div>
    )
  }

  return (
    <>
      <button className="btn btn-gold btn-block" style={{ marginBottom: 18 }} onClick={() => setView('create')} type="button">
        <Plus size={16} /> {t('admin.addTeamButton')}
      </button>

      <div className="section-title">{t('admin.predefinedTeamsTitle')}</div>
      <div className="admin-teams-list">
        {predefined.map((team) => (
          <div className="admin-team-row" key={team.id}>
            <TeamBadge teamId={team.id} size="sm" />
            <div className="admin-team-info">
              <span className="admin-team-name">{team.name}</span>
              <button type="button" className="admin-team-change-badge" onClick={() => setBadgeTeam(team)}>
                {t('admin.changeBadgeButton')}
              </button>
            </div>
            <span className="admin-team-locked" title={t('admin.predefinedTeamHint')}>
              <Lock size={14} />
            </span>
          </div>
        ))}
      </div>

      <div className="section-title">{t('admin.customTeamsTitle')}</div>
      {custom.length === 0 ? (
        <div className="empty-state">{t('admin.noCustomTeams')}</div>
      ) : (
        <div className="admin-teams-list">
          {custom.map((team) => (
            <button
              type="button"
              className="admin-team-row admin-team-row-clickable"
              key={team.id}
              onClick={() => {
                setEditingTeam(team)
                setView('edit')
              }}
            >
              <TeamBadge teamId={team.id} size="sm" />
              <span className="admin-team-name">{team.name}</span>
              <span
                role="button"
                tabIndex={-1}
                className="admin-team-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteError('')
                  setConfirmDeleteTeam(team)
                }}
                title={t('admin.deleteTeamButton')}
              >
                <Trash2 size={14} />
              </span>
            </button>
          ))}
        </div>
      )}

      {confirmDeleteTeam && (
        <div className="modal-backdrop" onClick={() => !deleting && setConfirmDeleteTeam(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon modal-icon-danger">
              <AlertTriangle size={22} />
            </div>
            <div className="modal-title">{t('admin.confirmDeleteTeamTitle')}</div>
            <p className="modal-text">
              {t('admin.confirmDeleteTeamMessage', { name: confirmDeleteTeam.name })}
            </p>
            {deleteError && <div className="login-error">{deleteError}</div>}
            <div className="modal-actions">
              <button className="btn btn-danger-solid btn-block" onClick={handleConfirmDelete} disabled={deleting} type="button">
                {deleting ? t('admin.deletingTeam') : t('admin.deleteTeamConfirmButton')}
              </button>
              <button
                className="btn btn-outline btn-block"
                onClick={() => setConfirmDeleteTeam(null)}
                disabled={deleting}
                type="button"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {badgeTeam && (
        <AdminChangeTeamBadgeModal team={badgeTeam} onClose={() => setBadgeTeam(null)} />
      )}
    </>
  )
}
