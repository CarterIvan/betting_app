import { supabase } from '../lib/supabase'

const BUCKET = 'league-logo'
const OBJECT_PATH = 'current-logo'
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']

/** Same limits are enforced server-side by the bucket itself (file_size_limit
 * / allowed_mime_types — see migration 0008) — this is just the fast,
 * friendly failure before ever starting an upload. Throws an i18n KEY (see
 * src/i18n/locales/*.js), not translated text — this file has no access to
 * the current UI language; the caller resolves it via t(err.message). */
function validateLogoFile(file) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('admin.logoInvalidFileType')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('admin.logoFileTooLarge')
  }
}

/** Uploads (or replaces) the league's single logo. Always writes to the
 * SAME fixed path (no per-league folder — this app is one competition) with
 * upsert, so replacing never leaves an orphaned old file behind. Storage
 * RLS (see migration 0008) independently re-checks that only an admin can
 * write here. Does NOT touch settings.logo_url — the caller is responsible
 * for saving the returned URL there. */
async function upload(file) {
  validateLogoFile(file)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(OBJECT_PATH, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(OBJECT_PATH)
  // The object path never changes on replace, so bust any CDN/browser cache
  // of the old image with a fresh query string each time.
  return `${data.publicUrl}?v=${Date.now()}`
}

/** Deletes the single logo object from Storage. The caller is responsible
 * for clearing settings.logo_url afterwards. */
async function remove() {
  const { error } = await supabase.storage.from(BUCKET).remove([OBJECT_PATH])
  if (error) throw error
}

const logoService = { upload, remove, MAX_FILE_BYTES, ALLOWED_MIME_TYPES }

export default logoService
