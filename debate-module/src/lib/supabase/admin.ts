import { createClient } from '@supabase/supabase-js'

// Service role client — never expose to the browser
export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. ' +
      'Add SUPABASE_SERVICE_ROLE_KEY to your Vercel environment variables and redeploy.'
    )
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
