import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'Chýba konfigurácia Supabase. Skopíruj .env.example do .env a doplň ' +
      'VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY zo svojho Supabase projektu.'
  )
}

// A placeholder URL keeps createClient() from throwing when env vars are
// missing, so the app can still render a clear error state instead of a
// blank white screen — see AppDataContext's `configError`.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
)
