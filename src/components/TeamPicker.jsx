import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Plus, ChevronDown } from 'lucide-react'
import TeamBadge from './TeamBadge.jsx'
import AdminTeamForm from './AdminTeamForm.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { cx } from '../utils/formatters'

/** Searchable replacement for a plain <select> of teams — used by both Add
 * Match and the inline match-edit form. Filters by name AND short code,
 * and lets the admin create a brand new custom team without leaving the
 * match form (see AdminTeamForm) — the new team is selected immediately on
 * success, no reopening anything. */
export default function TeamPicker({ label, teams, value, onChange }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const searchInputRef = useRef(null)

  const selected = teams.find((team) => team.id === value) ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teams
    return teams.filter(
      (team) => team.name.toLowerCase().includes(q) || team.shortName.toLowerCase().includes(q)
    )
  }, [teams, search])

  useEffect(() => {
    if (!open || creating) return
    const id = setTimeout(() => searchInputRef.current?.focus(), 40)
    return () => clearTimeout(id)
  }, [open, creating])

  const handleOpen = () => {
    setSearch('')
    setCreating(false)
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setCreating(false)
  }

  const handleSelect = (teamId) => {
    onChange(teamId)
    handleClose()
  }

  return (
    <div className="field">
      <label>{label}</label>
      <button type="button" className="team-picker-trigger" onClick={handleOpen}>
        {selected ? (
          <span className="team-picker-trigger-selected">
            <TeamBadge teamId={selected.id} size="sm" />
            {selected.name}
          </span>
        ) : (
          <span className="team-picker-trigger-placeholder">{t('admin.selectTeam')}</span>
        )}
        <ChevronDown size={16} />
      </button>

      {open && (
        <div className="modal-backdrop" onClick={handleClose}>
          <div className="team-picker-modal" onClick={(e) => e.stopPropagation()}>
            {creating ? (
              <AdminTeamForm
                onSaved={(teamId) => handleSelect(teamId)}
                onCancel={() => setCreating(false)}
              />
            ) : (
              <>
                <div className="team-picker-search">
                  <Search size={15} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('admin.searchTeamPlaceholder')}
                  />
                </div>
                <div className="team-picker-list">
                  {filtered.length === 0 && (
                    <div className="team-picker-empty">{t('admin.noTeamsFound')}</div>
                  )}
                  {filtered.map((team) => (
                    <button
                      type="button"
                      key={team.id}
                      className={cx('team-picker-item', team.id === value && 'selected')}
                      onClick={() => handleSelect(team.id)}
                    >
                      <TeamBadge teamId={team.id} size="sm" />
                      <span className="team-picker-item-name">{team.name}</span>
                      <span className="team-picker-item-code">{team.shortName}</span>
                    </button>
                  ))}
                  <button type="button" className="team-picker-add" onClick={() => setCreating(true)}>
                    <Plus size={15} /> {t('admin.addNewTeamOption')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
