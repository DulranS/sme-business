export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401)
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429)
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(`${service} error: ${message}`, 502)
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500)
  }
}

// Error handling utilities
export const handleDatabaseError = (error: any): AppError => {
  console.error('Database error:', error)
  
  // Handle specific Supabase errors
  if (error?.code === 'PGRST116') {
    return new NotFoundError('Record not found')
  }
  
  if (error?.code === 'PGRST301') {
    return new ValidationError('Invalid data format')
  }
  
  if (error?.code === '23505') {
    return new ConflictError('Duplicate entry')
  }
  
  return new DatabaseError(error?.message || 'Database operation failed')
}

export const handleExternalServiceError = (service: string, error: any): AppError => {
  console.error(`${service} error:`, error)
  
  if (error?.status === 401) {
    return new AuthenticationError(`${service} authentication failed`)
  }
  
  if (error?.status === 403) {
    return new AuthorizationError(`${service} access denied`)
  }
  
  if (error?.status === 429) {
    return new RateLimitError(`${service} rate limit exceeded`)
  }
  
  if (error?.status >= 500) {
    return new ExternalServiceError(service, 'Service temporarily unavailable')
  }
  
  return new ExternalServiceError(service, error?.message || 'Unknown error')
}
