import { useState } from 'react'
import { useAppData } from '../context/AppDataContext.jsx'

/** Renders a team's real crest when `logo` is set and loads successfully.
 * Otherwise (or if the image 404s) falls back to a generated shield-shaped
 * placeholder in the team's own colors — so a real crest file can be added
 * later per team (via the `teams` table) without touching any calling
 * component. */
export default function TeamBadge({ teamId, size = 'md' }) {
  const { getTeamById } = useAppData()
  const team = getTeamById(teamId)
  const [imgFailed, setImgFailed] = useState(false)
  if (!team) return null

  const useImage = team.logo && !imgFailed

  if (useImage) {
    return (
      <div className={`team-badge size-${size}`} title={team.name}>
        <img src={team.logo} alt={team.name} onError={() => setImgFailed(true)} />
      </div>
    )
  }

  const gradientId = `crest-${team.id}-${size}`

  return (
    <div className={`team-badge size-${size}`} title={team.name}>
      <svg viewBox="0 0 44 48" className="team-crest">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={team.primary} />
            <stop offset="100%" stopColor={team.secondary} />
          </linearGradient>
        </defs>
        <path
          d="M22 1 L41 7 V22 C41 34 33 43 22 47 C11 43 3 34 3 22 V7 Z"
          fill={`url(#${gradientId})`}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="1.5"
        />
        <text
          x="22"
          y="27"
          textAnchor="middle"
          className="team-crest-text"
        >
          {team.shortName}
        </text>
      </svg>
    </div>
  )
}
