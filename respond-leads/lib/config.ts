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
  static get whatsappPhoneNumberId(): string | undefined {
    return process.env.WHATSAPP_PHONE_NUMBER_ID
  }

  static get whatsappAccessToken(): string | undefined {
    return process.env.WHATSAPP_ACCESS_TOKEN
  }

  static get whatsappAppSecret(): string | undefined {
    return process.env.WHATSAPP_APP_SECRET
  }

  static get whatsappVerifyToken(): string | undefined {
    return process.env.WHATSAPP_VERIFY_TOKEN
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
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
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

    // Optional validations for WhatsApp
    if (this.whatsappPhoneNumberId && this.whatsappAccessToken && this.whatsappAppSecret && this.whatsappVerifyToken) {
      console.log('WhatsApp configuration found - webhook features enabled')
      if (this.whatsappAccessToken.length < 50) {
        console.warn('WHATSAPP_ACCESS_TOKEN appears to be invalid')
      }
    } else {
      console.warn('WhatsApp environment variables not configured - webhook features will be disabled')
    }

    // Optional validations for AI
    if (this.anthropicApiKey && this.anthropicApiKey.length < 20) {
      console.warn('ANTHROPIC_API_KEY appears to be invalid, AI features will be disabled')
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
    const phoneNumberId = this.whatsappPhoneNumberId
    const accessToken = this.whatsappAccessToken
    const appSecret = this.whatsappAppSecret
    const verifyToken = this.whatsappVerifyToken

    if (!phoneNumberId || !accessToken || !appSecret || !verifyToken) {
      throw new Error('WhatsApp configuration is incomplete. Please set all required WhatsApp environment variables.')
    }

    return {
      phoneNumberId,
      accessToken,
      appSecret,
      verifyToken,
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
