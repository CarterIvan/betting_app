import { supabase } from '../lib/supabase'

const BUCKET = 'profile-photos'
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

/** Same limits are enforced server-side by the bucket itself (file_size_limit
 * / allowed_mime_types — see migration 0003) — this is just the fast,
 * friendly failure before ever starting an upload. Throws an i18n KEY (see
 * src/i18n/locales/*.js), not translated text — this file has no access to
 * the current UI language; the caller resolves it via t(err.message). */
function validateAvatarFile(file) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('profile.invalidFileType')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('profile.fileTooLarge')
  }
}

/** Uploads (or replaces) the caller's own profile photo and saves its URL
 * onto their player row. Always writes to the SAME fixed path per user
 * (`{userId}/avatar`, no extension) with upsert — so a re-upload overwrites
 * the previous file in place instead of accumulating a new object per
 * change. Storage RLS (see migration 0003) independently enforces that a
 * user can only ever write inside their own `{userId}/...` folder, so this
 * can genuinely fail for a tampered `userId` — it isn't just convention. */
async function uploadAvatar(userId, file) {
  validateAvatarFile(file)

  const path = `${userId}/avatar`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  // The object path never changes on replace, so bust any CDN/browser cache
  // of the old image with a fresh query string each time.
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`

  const { error: updateError } = await supabase
    .from('players')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)
  if (updateError) throw updateError

  return avatarUrl
}

const profileService = { uploadAvatar, MAX_FILE_BYTES, ALLOWED_MIME_TYPES }

export default profileService
