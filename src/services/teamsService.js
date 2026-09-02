import { supabase } from '../lib/supabase'

const LOGO_BUCKET = 'team-logos'
const LOGO_MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const LOGO_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']

function mapTeam(row) {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    country: row.country,
    logo: row.logo,
    primary: row.primary_color,
    secondary: row.secondary_color,
    isCustom: row.is_custom,
  }
}

const SELECT_COLUMNS = 'id, name, short_name, country, logo, primary_color, secondary_color, is_custom'
// Everything except is_custom (see migration 0011) — teams is CORE data
// (players/matches/predictions all depend on it loading), so its fetch
// must keep working in an environment where that migration hasn't been
// applied yet. Falling back here, rather than letting the error propagate,
// is what keeps that one new column from taking down the whole app load.
const SELECT_COLUMNS_LEGACY = 'id, name, short_name, country, logo, primary_color, secondary_color'

async function getAll() {
  const { data, error } = await supabase.from('teams').select(SELECT_COLUMNS).order('name')
  if (!error) return data.map(mapTeam)

  // 42703 = undefined_column. Only fall back for exactly that case — any
  // other error (network, RLS, etc.) still throws normally rather than
  // masking a real problem.
  if (error.code === '42703') {
    const { data: legacyData, error: legacyError } = await supabase
      .from('teams')
      .select(SELECT_COLUMNS_LEGACY)
      .order('name')
    if (legacyError) throw legacyError
    // No is_custom column yet means the Team Library feature doesn't exist
    // in this environment yet either — every team is predefined until it
    // does, which is exactly what is_custom: false already means.
    return legacyData.map((row) => mapTeam({ ...row, is_custom: false }))
  }

  throw error
}

/** Same limits are enforced server-side by the bucket itself (file_size_limit
 * / allowed_mime_types — see migration 0011). Throws an i18n KEY (see
 * src/i18n/locales/*.js), not translated text — the caller resolves it via
 * t(err.message). */
function validateLogoFile(file) {
  if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
    throw new Error('admin.teamLogoInvalidFileType')
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error('admin.teamLogoFileTooLarge')
  }
}

/** Always writes to the SAME fixed path per team (the team's own id, no
 * extension) with upsert — replacing a custom team's logo never leaves an
 * orphaned old file behind. Storage RLS (migration 0011) independently
 * re-checks that only an admin can write here. */
async function uploadLogo(teamId, file) {
  validateLogoFile(file)
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(teamId, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(teamId)
  // The object path never changes on replace, so bust any CDN/browser cache
  // of the old crest with a fresh query string each time.
  return `${data.publicUrl}?v=${Date.now()}`
}

/** Admin-only (RLS — see migration 0011). Creates a custom team. `id` is
 * generated client-side (a uuid, unlike the predefined teams' readable
 * slugs) so the logo can be uploaded to a known path before the row even
 * exists. Logo is optional — TeamBadge already falls back to a generated
 * crest (primary/secondary colors) when logo is null, exactly like every
 * predefined team does today. */
async function create({ name, shortName, logoFile }) {
  const id = crypto.randomUUID()
  const logo = logoFile ? await uploadLogo(id, logoFile) : null

  const { error } = await supabase.from('teams').insert({
    id,
    name,
    short_name: shortName,
    logo,
    is_custom: true,
  })
  if (error) throw error
  return id
}

/** Admin-only (RLS — restricted to is_custom rows only; a predefined team
 * can never reach this regardless of what the client sends, see migration
 * 0011). Logo is only touched if a new file was actually picked. */
async function update(teamId, { name, shortName, logoFile }) {
  const patch = { name, short_name: shortName }
  if (logoFile) {
    patch.logo = await uploadLogo(teamId, logoFile)
  }

  const { error } = await supabase.from('teams').update(patch).eq('id', teamId)
  if (error) throw error
}

/** Admin-only, permanent (RLS — restricted to is_custom rows only, see
 * migration 0011). If the team is still referenced by any match, the
 * existing FK (matches.home_team_id/away_team_id → teams.id, no ON DELETE
 * clause — i.e. RESTRICT) rejects the delete outright rather than the app
 * cascading anything — surfaced here as a specific, friendly error instead
 * of a raw Postgres one. */
async function remove(teamId) {
  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) {
    if (error.code === '23503') {
      throw new Error('admin.teamInUseCannotDelete')
    }
    throw error
  }
}

const teamsService = { getAll, create, update, remove }

export default teamsService
