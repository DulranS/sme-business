export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, any>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

export class Logger {
  private static instance: Logger
  private logLevel: LogLevel = LogLevel.INFO

  private constructor() {
    // Set log level based on environment
    if (process.env.NODE_ENV === 'development') {
      this.logLevel = LogLevel.DEBUG
    } else if (process.env.NODE_ENV === 'production') {
      this.logLevel = LogLevel.INFO
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG]
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex <= currentLevelIndex
  }

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, error } = entry
    
    let logString = `[${timestamp}] ${level}: ${message}`
    
    if (context && Object.keys(context).length > 0) {
      logString += ` | Context: ${JSON.stringify(context)}`
    }
    
    if (error) {
      logString += ` | Error: ${error.name}: ${error.message}`
      if (error.stack) {
        logString += `\nStack: ${error.stack}`
      }
    }
    
    return logString
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
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

    // In production, you might want to send logs to external service
    if (process.env.NODE_ENV === 'production' && level === LogLevel.ERROR) {
      // TODO: Send to external logging service (e.g., Sentry, LogRocket)
      this.sendToExternalService(logEntry)
    }
  }

  private async sendToExternalService(logEntry: LogEntry): Promise<void> {
    // Placeholder for external logging service integration
    // Example: Sentry.captureException(logEntry.error)
    // Example: LogRocket.captureException(logEntry.error)
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error)
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context)
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context)
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  // Specialized logging methods
  webhook(message: string, data: any): void {
    this.info(`Webhook: ${message}`, { type: 'webhook', data })
  }

  ai(message: string, data: any): void {
    this.info(`AI Service: ${message}`, { type: 'ai', data })
  }

  database(message: string, data: any): void {
    this.info(`Database: ${message}`, { type: 'database', data })
  }

  whatsapp(message: string, data: any): void {
    this.info(`WhatsApp: ${message}`, { type: 'whatsapp', data })
  }
}

// Export singleton instance
export const logger = Logger.getInstance()
