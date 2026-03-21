import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client using the anon key.
 * Safe to use in client components. Call once per component.
 */
export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createBrowserClient(url, key)
}
