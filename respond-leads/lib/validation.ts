import { ValidationError } from './errors'

export class Validator {
  static required(value: any, fieldName: string): void {
    if (value === null || value === undefined || value === '') {
      throw new ValidationError(`${fieldName} is required`)
    }
  }

  static string(value: any, fieldName: string, minLength?: number, maxLength?: number): void {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`)
    }
    
    if (minLength !== undefined && value.length < minLength) {
      throw new ValidationError(`${fieldName} must be at least ${minLength} characters`)
    }
    
    if (maxLength !== undefined && value.length > maxLength) {
      throw new ValidationError(`${fieldName} must be no more than ${maxLength} characters`)
    }
  }

  static number(value: any, fieldName: string, min?: number, max?: number): void {
    const num = Number(value)
    if (isNaN(num)) {
      throw new ValidationError(`${fieldName} must be a number`)
    }
    
    if (min !== undefined && num < min) {
      throw new ValidationError(`${fieldName} must be at least ${min}`)
    }
    
    if (max !== undefined && num > max) {
      throw new ValidationError(`${fieldName} must be no more than ${max}`)
    }
  }

  static email(value: string, fieldName: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      throw new ValidationError(`${fieldName} must be a valid email address`)
    }
  }

  static phoneNumber(value: string, fieldName: string): void {
    // Remove all non-digit characters for validation
    const digits = value.replace(/\D/g, '')
    
    if (digits.length < 10 || digits.length > 15) {
      throw new ValidationError(`${fieldName} must be a valid phone number`)
    }
  }

  static sku(value: string, fieldName: string): void {
    // SKU should be alphanumeric with optional hyphens/underscores
    const skuRegex = /^[A-Za-z0-9_-]+$/
    if (!skuRegex.test(value)) {
      throw new ValidationError(`${fieldName} must contain only letters, numbers, hyphens, and underscores`)
    }
    
    this.string(value, fieldName, 1, 50)
  }

  static price(value: any, fieldName: string): void {
    this.number(value, fieldName, 0, 999999.99)
  }

  static quantity(value: any, fieldName: string): void {
    const num = Number(value)
    this.number(value, fieldName, 0, 999999)
    
    if (!Number.isInteger(num)) {
      throw new ValidationError(`${fieldName} must be a whole number`)
    }
  }

  static inventoryItem(item: any): void {
    this.required(item.name, 'Product name')
    this.string(item.name, 'Product name', 1, 200)
    
    this.required(item.sku, 'SKU')
    this.sku(item.sku, 'SKU')
    
    this.required(item.price, 'Price')
    this.price(item.price, 'Price')
    
    this.required(item.quantity, 'Quantity')
    this.quantity(item.quantity, 'Quantity')
  }

  static whatsappMessage(message: any): void {
    this.required(message.from, 'Phone number')
    this.phoneNumber(message.from, 'Phone number')
    
    this.required(message.text?.body, 'Message text')
    this.string(message.text.body, 'Message text', 1, 1000)
    
    this.required(message.id, 'Message ID')
    this.string(message.id, 'Message ID', 1, 100)
  }

  static conversationHistory(history: string): void {
    this.string(history, 'Conversation history', 0, 4000)
  }
}

// Sanitization utilities
export class Sanitizer {
  static string(value: any): string {
    if (value === null || value === undefined) return ''
    return String(value).trim()
  }

  static phoneNumber(value: string): string {
    // Remove all non-digit characters except + at the beginning
    return value.replace(/[^\d+]/g, '').replace(/^\+/, '')
  }

  static sku(value: string): string {
    // Convert to uppercase and remove special characters except hyphens/underscores
    return value.toUpperCase().replace(/[^A-Z0-9_-]/g, '')
  }

  static messageText(value: string): string {
    // Remove excessive whitespace and limit length
    return value.replace(/\s+/g, ' ').trim().slice(0, 1000)
  }

  static inventoryItem(item: any): any {
    return {
      name: this.string(item.name),
      sku: this.sku(item.sku),
      price: parseFloat(item.price) || 0,
      quantity: parseInt(item.quantity) || 0
    }
  }
}
