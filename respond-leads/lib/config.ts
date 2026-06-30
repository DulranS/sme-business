// Environment configuration and validation
export class Config {
  // Supabase
  static get supabaseUrl(): string {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
    return url
  }

  static get supabaseAnonKey(): string {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
    return key
  }

  static get supabaseServiceRoleKey(): string | undefined {
    return process.env.SUPABASE_SERVICE_ROLE_KEY
  }

  // WhatsApp
  static get whatsappPhoneNumberId(): string {
    const id = process.env.WHATSAPP_PHONE_NUMBER_ID
    if (!id) throw new Error('WHATSAPP_PHONE_NUMBER_ID is required')
    return id
  }

  static get whatsappAccessToken(): string {
    const token = process.env.WHATSAPP_ACCESS_TOKEN
    if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is required')
    return token
  }

  static get whatsappAppSecret(): string {
    const secret = process.env.WHATSAPP_APP_SECRET
    if (!secret) throw new Error('WHATSAPP_APP_SECRET is required')
    return secret
  }

  static get whatsappVerifyToken(): string {
    const token = process.env.WHATSAPP_VERIFY_TOKEN
    if (!token) throw new Error('WHATSAPP_VERIFY_TOKEN is required')
    return token
  }

  // Anthropic Claude (optional - for AI features)
  static get anthropicApiKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY
  }

  // Application
  static get appUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  }

  static get nodeEnv(): string {
    return process.env.NODE_ENV || 'development'
  }

  static get isDevelopment(): boolean {
    return this.nodeEnv === 'development'
  }

  static get isProduction(): boolean {
    return this.nodeEnv === 'production'
  }

  // Validate only essential environment variables
  static validate(): void {
    const required = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_APP_SECRET',
      'WHATSAPP_VERIFY_TOKEN'
    ]

    const missing = required.filter(key => !process.env[key])
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }

    // Validate URL formats
    try {
      new URL(this.supabaseUrl)
      new URL(this.appUrl)
    } catch {
      throw new Error('Invalid URL format in environment variables')
    }

    // Optional validations
    if (this.anthropicApiKey && this.anthropicApiKey.length < 20) {
      console.warn('ANTHROPIC_API_KEY appears to be invalid, AI features will be disabled')
    }

    if (this.whatsappAccessToken.length < 50) {
      console.warn('WHATSAPP_ACCESS_TOKEN appears to be invalid')
    }
  }

  // Get database configuration
  static get database() {
    return {
      url: this.supabaseUrl,
      anonKey: this.supabaseAnonKey,
      serviceRoleKey: this.supabaseServiceRoleKey
    }
  }

  // Get WhatsApp configuration
  static get whatsapp() {
    return {
      phoneNumberId: this.whatsappPhoneNumberId,
      accessToken: this.whatsappAccessToken,
      appSecret: this.whatsappAppSecret,
      verifyToken: this.whatsappVerifyToken,
      apiUrl: 'https://graph.facebook.com/v18.0'
    }
  }

  // Get AI configuration (optional)
  static get ai() {
    return {
      anthropicApiKey: this.anthropicApiKey,
      anthropicUrl: 'https://api.anthropic.com/v1/messages',
      model: 'claude-3-haiku-20240307',
      maxTokens: {
        keyword: 50,
        response: 500
      },
      enabled: !!this.anthropicApiKey
    }
  }

  // Rate limiting configuration
  static get rateLimit() {
    return {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,    // requests per window
      webhookMaxRequests: 1000 // higher limit for webhooks
    }
  }

  // Logging configuration
  static get logging() {
    return {
      level: this.isDevelopment ? 'debug' : 'info',
      enableExternalService: this.isProduction
    }
  }
}

// Note: Config.validate() should be called explicitly when needed, not on module evaluation
// This allows the app to load gracefully and validate environment variables only when required

// ---------------------------------------------------------------------------
// Startup configuration validation (ConfigValidator)
//
// Feature: respond-leadz
// Requirements: 1.1, 1.7, 19.1, 19.2, 19.3, 13.1, 13.2
//
// `validateStartup()` verifies that every required environment value is present
// and non-empty. If one or more are missing or empty it reports a named
// configuration error (referencing each value by name only, never its value)
// and keeps the application in a "starting" state that refuses inbound webhook
// requests until the configuration is resolved. When all required values are
// present the validator transitions to a "ready" state in which webhooks are
// accepted, regardless of other non-required validation outcomes.
// ---------------------------------------------------------------------------

import { ConfigError } from './pipeline/errors'
import { logger } from './logger'

/**
 * The required environment configuration values that must be present and
 * non-empty before RespondLeadz will accept inbound webhook requests.
 *
 * All secrets are read from environment configuration rather than source code
 * (Requirement 13.1). The four WhatsApp credentials are mandatory per
 * Requirement 1.1; the Supabase connection values are required for the database
 * layer that backs every tenant-scoped operation.
 */
export const REQUIRED_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_VERIFY_TOKEN',
] as const

/** A required environment configuration key. */
export type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number]

/** The lifecycle state of the application with respect to startup validation. */
export type StartupState = 'starting' | 'ready'

/** The outcome of a startup validation run. */
export interface StartupValidationResult {
  /** True only when every required value is present and non-empty. */
  ok: boolean
  /** Names (never values) of required values that are missing or empty. */
  missingKeys: RequiredEnvKey[]
  /** A named configuration error when validation failed; null on success. */
  error: ConfigError | null
}

/** A minimal view of an environment source (e.g. `process.env`). */
type EnvSource = Record<string, string | undefined>

/**
 * Validates required startup configuration and gates inbound webhook acceptance
 * on the result. The app begins in a `starting` state and only advances to
 * `ready` once every required value is present and non-empty.
 */
export class ConfigValidator {
  private static state: StartupState = 'starting'
  private static lastResult: StartupValidationResult | null = null

  /**
   * Returns true when a value is present and non-empty (ignoring surrounding
   * whitespace). Absent, empty, and whitespace-only values are treated as
   * missing (Requirements 19.1, 19.2).
   */
  private static isPresent(value: string | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0
  }

  /**
   * Verify that all required environment configuration values are present and
   * non-empty.
   *
   * On failure, reports a named {@link ConfigError} identifying each missing or
   * empty value (by name only — no values are ever read into the error or log)
   * and leaves the validator in the `starting` state so inbound webhooks are
   * refused until the configuration is resolved (Requirements 1.7, 19.2).
   *
   * On success, transitions to the `ready` state so inbound webhooks are
   * accepted (Requirement 19.3).
   *
   * @param env Optional environment source; defaults to `process.env`.
   * @returns The validation result, including any named configuration error.
   */
  static validateStartup(env: EnvSource = process.env): StartupValidationResult {
    const missingKeys = REQUIRED_ENV_KEYS.filter((key) => !this.isPresent(env[key]))

    if (missingKeys.length > 0) {
      const error = new ConfigError(missingKeys)
      this.state = 'starting'
      this.lastResult = { ok: false, missingKeys: [...missingKeys], error }
      // Log by name only — credential values are never written to the log
      // (Requirement 13.3). ConfigError.missingKeys holds names, not values.
      logger.error('Startup configuration validation failed: missing or empty required value(s)', {
        type: 'config',
        missingKeys: error.missingKeys,
      })
      return this.lastResult
    }

    this.state = 'ready'
    this.lastResult = { ok: true, missingKeys: [], error: null }
    logger.info('Startup configuration validation passed; accepting inbound webhooks', {
      type: 'config',
    })
    return this.lastResult
  }

  /** The current startup lifecycle state. */
  static getState(): StartupState {
    return this.state
  }

  /** The result of the most recent {@link validateStartup} run, if any. */
  static getLastResult(): StartupValidationResult | null {
    return this.lastResult
  }

  /**
   * Whether the application is in a state that accepts inbound webhook requests.
   * Returns false until {@link validateStartup} has confirmed all required
   * values are present (Requirements 19.2, 19.3).
   */
  static isAcceptingWebhooks(): boolean {
    return this.state === 'ready'
  }

  /**
   * Throws the named {@link ConfigError} when the application is not yet ready
   * to accept inbound webhooks. Use this at the entry of the webhook handler to
   * refuse requests while configuration is unresolved (Requirement 19.2).
   */
  static assertAcceptingWebhooks(): void {
    if (!this.isAcceptingWebhooks()) {
      throw (
        this.lastResult?.error ??
        new ConfigError(
          [...REQUIRED_ENV_KEYS],
          'Startup configuration has not been validated; refusing inbound webhooks'
        )
      )
    }
  }

  /**
   * Reset validation state back to `starting`. Primarily intended for tests so
   * each scenario starts from a known state.
   */
  static reset(): void {
    this.state = 'starting'
    this.lastResult = null
  }
}
