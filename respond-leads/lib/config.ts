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
    } catch (error) {
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
