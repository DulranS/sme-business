import { createClient } from '@supabase/supabase-js'
import { Config } from '@/lib/config'

// Client for browser/SSR usage (with anon key)
export const createSupabaseClient = () => {
  const supabaseUrl = Config.supabaseUrl
  const supabaseAnonKey = Config.supabaseAnonKey
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Client for server-side usage (with service role key, fallback to anon key)
export const createSupabaseServerClient = () => {
  const supabaseUrl = Config.supabaseUrl
  const key = Config.supabaseServiceRoleKey || Config.supabaseAnonKey
  return createClient(supabaseUrl, key)
}

// Singleton instance for client-side
let supabaseClient: ReturnType<typeof createSupabaseClient> | null = null

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient()
  }
  return supabaseClient
}
