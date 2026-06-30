/**
 * Structured Logger with credential redaction.
 *
 * Feature: respond-leadz
 * Requirements: 13.3, 17.1, 17.2
 *
 * Responsibilities:
 * - Emit log entries at distinct severity levels for errors, warnings, and
 *   informational events (Requirement 17.2).
 * - Produce a per-message log entry containing the tenant, phone number, message
 *   id, and processing outcome (Requirement 17.1).
 * - Refer to credentials by name only and never write credential values to the
 *   log (Requirement 13.3). Redaction works two ways: any context key whose name
 *   matches a credential pattern has its value replaced with a placeholder, and
 *   any registered secret value is scrubbed from the serialized output regardless
 *   of where it appears.
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

/** Replacement written in place of any redacted credential value. */
export const REDACTION_PLACEHOLDER = '[REDACTED]'

/**
 * Field-name patterns that identify credential/secret values. Any context key
 * matching one of these has its value redacted: the log keeps the credential
 * NAME but never its value (Requirement 13.3).
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /token/i,
  /secret/i,
  /password/i,
  /passwd/i,
  /credential/i,
  /authorization/i,
  /api[_-]?key/i,
  /access[_-]?key/i,
  /service[_-]?role/i,
  /private[_-]?key/i,
  /\bkey\b/i,
  /(^|[_-])key$/i
]

/** Returns true when a context key name denotes a credential/secret value. */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: unknown
  error?: {
    name: string
    message: string
    stack?: string
  }
}

/**
 * The fields recorded for every processed inbound message (Requirement 17.1).
 * None of these are credentials; the phone number is intentionally logged for
 * diagnosability.
 */
export interface MessageLogFields {
  /** Owning tenant identifier. */
  tenant: string
  /** Sender phone number. */
  phone: string
  /** WhatsApp message id. */
  messageId: string
  /** Processing outcome (e.g. "replied", "duplicate", "fallback", "error"). */
  outcome: string
}

export class Logger {
  private static instance: Logger
  private logLevel: LogLevel = LogLevel.INFO

  /** Known secret values to scrub from serialized output (defense in depth). */
  private readonly secretValues: Set<string> = new Set()

  private constructor() {
    // Set log level based on environment
    if (process.env.NODE_ENV === 'development') {
      this.logLevel = LogLevel.DEBUG
    } else if (process.env.NODE_ENV === 'production') {
      this.logLevel = LogLevel.INFO
    }

    // Register known credential values from the environment so they are never
    // emitted, even if they reach a logging context under a non-credential key.
    this.registerEnvSecrets()
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  /**
   * Register a credential value so it is scrubbed from any serialized log
   * output. The value itself is never stored anywhere it can be logged.
   */
  registerSecret(value: string | undefined | null): void {
    if (typeof value === 'string' && value.trim().length > 0) {
      this.secretValues.add(value)
    }
  }

  /** Register the well-known credential values present in the environment. */
  private registerEnvSecrets(): void {
    const secretEnvKeys = [
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_APP_SECRET',
      'WHATSAPP_VERIFY_TOKEN',
      'ANTHROPIC_API_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ]
    for (const key of secretEnvKeys) {
      this.registerSecret(process.env[key])
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG]
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex <= currentLevelIndex
  }

  /**
   * Recursively redact credential values from a context value. Any key that
   * denotes a credential has its value replaced with {@link REDACTION_PLACEHOLDER}
   * so only the credential's name survives (Requirement 13.3).
   */
  private redact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
    if (value === null || value === undefined) return value
    if (typeof value !== 'object') return value

    if (seen.has(value as object)) return '[Circular]'
    seen.add(value as object)

    if (Array.isArray(value)) {
      return value.map((item) => this.redact(item, seen))
    }

    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        result[key] = REDACTION_PLACEHOLDER
      } else {
        result[key] = this.redact(val, seen)
      }
    }
    return result
  }

  /** Remove any registered secret value from a serialized string. */
  private scrubSecrets(serialized: string): string {
    let output = serialized
    for (const secret of this.secretValues) {
      output = output.split(secret).join(REDACTION_PLACEHOLDER)
    }
    return output
  }

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, error } = entry

    let logString = `[${timestamp}] ${level}: ${message}`

    if (context !== undefined && context !== null) {
      // Context may be a structured object or, from legacy callers, an arbitrary
      // value (e.g. an Error). Redact then serialize either shape safely.
      const isObject = typeof context === 'object'
      if (!isObject || Object.keys(context as Record<string, unknown>).length > 0) {
        const redactedContext = this.redact(context)
        logString += ` | Context: ${JSON.stringify(redactedContext)}`
      }
    }

    if (error) {
      logString += ` | Error: ${error.name}: ${error.message}`
      if (error.stack) {
        logString += `\nStack: ${error.stack}`
      }
    }

    // Final defense-in-depth pass: scrub any registered secret value that may
    // have reached the output through a non-credential key (Requirement 13.3).
    return this.scrubSecrets(logString)
  }

  private log(level: LogLevel, message: string, context?: unknown, error?: Error): void {
    if (!this.shouldLog(level)) return

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    }

    const formattedLog = this.formatLog(logEntry)

    // Output to console with appropriate method
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedLog)
        break
      case LogLevel.WARN:
        console.warn(formattedLog)
        break
      case LogLevel.INFO:
        console.info(formattedLog)
        break
      case LogLevel.DEBUG:
        console.debug(formattedLog)
        break
    }

    // In production, forward error entries to an external logging service.
    if (process.env.NODE_ENV === 'production' && level === LogLevel.ERROR) {
      // TODO: Send to external logging service (e.g., Sentry, LogRocket)
      void this.sendToExternalService(logEntry)
    }
  }

  private async sendToExternalService(logEntry: LogEntry): Promise<void> {
    // Placeholder for external logging service integration. Any payload sent
    // here MUST be redacted/scrubbed the same way as console output.
    void logEntry
  }

  error(message: string, context?: unknown, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error)
  }

  warn(message: string, context?: unknown): void {
    this.log(LogLevel.WARN, message, context)
  }

  info(message: string, context?: unknown): void {
    this.log(LogLevel.INFO, message, context)
  }

  debug(message: string, context?: unknown): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  /**
   * Record a per-message log entry for a processed inbound message. The entry
   * always contains the tenant, phone number, message id, and processing outcome
   * (Requirement 17.1). Defaults to the INFO level; pass a different level to
   * record a failed outcome at a higher severity (Requirement 17.2).
   */
  message(fields: MessageLogFields, level: LogLevel = LogLevel.INFO, extra?: Record<string, unknown>): void {
    const context: Record<string, unknown> = {
      type: 'inbound_message',
      tenant: fields.tenant,
      phone: fields.phone,
      messageId: fields.messageId,
      outcome: fields.outcome,
      ...(extra ?? {})
    }
    this.log(level, `Inbound message processed: ${fields.outcome}`, context)
  }

  // Specialized logging methods
  webhook(message: string, data: unknown): void {
    this.info(`Webhook: ${message}`, { type: 'webhook', data })
  }

  ai(message: string, data: unknown): void {
    this.info(`AI Service: ${message}`, { type: 'ai', data })
  }

  database(message: string, data: unknown): void {
    this.info(`Database: ${message}`, { type: 'database', data })
  }

  whatsapp(message: string, data: unknown): void {
    this.info(`WhatsApp: ${message}`, { type: 'whatsapp', data })
  }
}

// Export singleton instance
export const logger = Logger.getInstance()
