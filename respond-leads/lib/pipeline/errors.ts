/**
 * Typed errors for the canonical RespondLeadz pipeline.
 *
 * Each pipeline failure is surfaced as a typed error so the Inbound_Handler can
 * map it to the correct HTTP status and log severity. Credential values are
 * never included in error messages (Requirement 13.3) — errors reference
 * credentials and configuration by name only.
 *
 * Feature: respond-leadz
 * Requirements: 2.6, 3.2, 8.1, 9.2, 12.4, 17.3
 */

/**
 * Base class for all typed pipeline errors. Carries the HTTP status the handler
 * should respond with and the log severity the error should be recorded at.
 */
export abstract class PipelineError extends Error {
  /** HTTP status the Inbound_Handler should respond with for this error. */
  abstract readonly httpStatus: number
  /** Severity level the error should be logged at. */
  abstract readonly severity: 'error' | 'warn' | 'info'

  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = new.target.name
    if (options?.cause !== undefined) {
      // Preserve the underlying cause without exposing it in the message.
      ;(this as { cause?: unknown }).cause = options.cause
    }
    // Maintain a proper stack trace where available (V8).
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, new.target)
    }
  }
}

/**
 * Raised when a webhook payload cannot be parsed into the expected structure.
 * The handler maps this to a logged HTTP 200 with no text processing
 * (Requirement 2.6).
 */
export class PayloadParseError extends PipelineError {
  readonly httpStatus = 200
  readonly severity = 'error' as const

  constructor(message = 'Webhook payload could not be parsed', options?: { cause?: unknown }) {
    super(message, options)
  }
}

/**
 * Raised when a webhook request signature is missing, malformed, or does not
 * match the computed HMAC-SHA256 signature. The handler rejects the request
 * with HTTP 401 and processes no messages (Requirement 3.2).
 */
export class SignatureError extends PipelineError {
  readonly httpStatus = 401
  readonly severity = 'warn' as const

  constructor(message = 'Webhook signature verification failed', options?: { cause?: unknown }) {
    super(message, options)
  }
}

/**
 * Raised when a required configuration value is absent or empty. Reported as a
 * named configuration error; the named value's identity is captured without
 * exposing any secret value (Requirements 1.7, 3.6, 19.2).
 */
export class ConfigError extends PipelineError {
  readonly httpStatus = 500
  readonly severity = 'error' as const
  /** Names of the missing or empty configuration values (never their values). */
  readonly missingKeys: readonly string[]

  constructor(missingKeys: string | readonly string[], message?: string) {
    const keys = typeof missingKeys === 'string' ? [missingKeys] : [...missingKeys]
    super(message ?? `Missing or empty configuration value(s): ${keys.join(', ')}`)
    this.missingKeys = keys
  }
}

/**
 * Raised when the LLM fails during intent extraction or response generation.
 * The AI_Responder responds with a Fallback_Response and the failure is logged
 * (Requirements 8.1–8.3).
 */
export class LlmError extends PipelineError {
  readonly httpStatus = 200
  readonly severity = 'error' as const
  /** The pipeline stage that failed. */
  readonly stage: 'extract' | 'generate'

  constructor(stage: 'extract' | 'generate', message?: string, options?: { cause?: unknown }) {
    super(message ?? `LLM ${stage} request failed`, options)
    this.stage = stage
  }
}

/**
 * Raised when all attempts to deliver an outbound reply fail. Records the
 * phone number and message id of the undelivered reply (Requirement 7.3).
 */
export class DeliveryError extends PipelineError {
  readonly httpStatus = 200
  readonly severity = 'error' as const
  readonly phoneNumber: string
  readonly messageId: string

  constructor(
    phoneNumber: string,
    messageId: string,
    message?: string,
    options?: { cause?: unknown }
  ) {
    super(message ?? `Failed to deliver reply to ${phoneNumber} (message ${messageId})`, options)
    this.phoneNumber = phoneNumber
    this.messageId = messageId
  }
}

/**
 * Raised when a tenant-scoped operation is attempted without an established
 * tenant context, or when RLS is disabled or unavailable. The Tenant_Manager
 * denies all tenant-scoped reads and writes in this case (Requirement 12.4).
 */
export class TenantContextError extends PipelineError {
  readonly httpStatus = 500
  readonly severity = 'error' as const

  constructor(
    message = 'Tenant context is not established or RLS is unavailable; tenant-scoped access denied',
    options?: { cause?: unknown }
  ) {
    super(message, options)
  }
}
