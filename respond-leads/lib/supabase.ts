import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client factories for the RespondLeadz dashboard.
 *
 * `NEXT_PUBLIC_*` values are inlined into the browser bundle at build time, so
 * the real anon client only needs them in the browser. To keep the production
 * build hermetic — `next build` statically evaluates client modules during
 * prerender, where runtime secrets may be absent — construction never throws on
 * missing configuration. Instead it logs a warning and constructs a client with
 * inert placeholder values; any actual network call made without real
 * configuration will surface a normal Supabase request error at use time rather
 * than crashing the build or the initial render.
 *
 * The server-side service-role client (used only in server contexts) keeps its
 * placeholder fallback behind the same non-throwing contract.
 */

/** Placeholder values used only so client construction never throws at build time. */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'placeholder-anon-key'

let warnedBrowserConfig = false
let warnedServerConfig = false

/**
 * Create a browser/SSR Supabase client using the public anon key. When the
 * public env values are absent (e.g. during a build without secrets) a warning
 * is logged once and an inert placeholder client is returned so prerendering
 * never crashes.
 */
export const createSupabaseClient = (): SupabaseClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    if (!warnedBrowserConfig) {
      warnedBrowserConfig = true
      console.warn(
        'Supabase public env vars are not set (NEXT_PUBLIC_SUPABASE_URL / ' +
          'NEXT_PUBLIC_SUPABASE_ANON_KEY); using a placeholder client. Set these ' +
          'in the environment for the dashboard to reach Supabase.'
      )
    }
    return createClient(PLACEHOLDER_URL, PLACEHOLDER_KEY)
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Create a server-side Supabase client, preferring the service-role key and
 * falling back to the anon key. Non-throwing for the same build-safety reason
 * as the browser client.
 */
export const createSupabaseServerClient = (): SupabaseClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const key = supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !key) {
    if (!warnedServerConfig) {
      warnedServerConfig = true
      console.warn(
        'Supabase server env vars are not set (NEXT_PUBLIC_SUPABASE_URL / ' +
          'SUPABASE_SERVICE_ROLE_KEY); using a placeholder client.'
      )
    }
    return createClient(PLACEHOLDER_URL, PLACEHOLDER_KEY)
  }

  return createClient(supabaseUrl, key)
}

// Singleton instance for client-side use.
let supabaseClient: SupabaseClient | null = null

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient()
  }
  return supabaseClient
}
