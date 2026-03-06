import { CURRENCIES } from '@/types'

export interface ExchangeRate {
  [currency: string]: number
}

export class CurrencyConverter {
  private static readonly EXCHANGE_RATES: ExchangeRate = {
    USD: 1.0,
    EUR: 0.85,
    GBP: 0.73,
    JPY: 110.0,
    CAD: 1.25,
    AUD: 1.35,
    CHF: 0.92,
    CNY: 6.45,
    INR: 74.5,
    BRL: 5.2
  }

  private static readonly REVERSE_RATES: ExchangeRate = Object.fromEntries(
    Object.entries(CurrencyConverter.EXCHANGE_RATES).map(([currency, rate]) => [
      currency,
      1 / rate
    ])
  )

  static convertToUSD(amount: number, fromCurrency: string): number {
    const rate = this.EXCHANGE_RATES[fromCurrency] || 1.0
    return Number((amount / rate).toFixed(2))
  }

  static convertFromUSD(amount: number, toCurrency: string): number {
    const rate = this.EXCHANGE_RATES[toCurrency] || 1.0
    return Number((amount * rate).toFixed(2))
  }

  static convert(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) return amount
    
    // Convert to USD first, then to target currency
    const usdAmount = this.convertToUSD(amount, fromCurrency)
    return this.convertFromUSD(usdAmount, toCurrency)
  }

  static getExchangeRate(fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) return 1.0
    
    const fromRate = this.EXCHANGE_RATES[fromCurrency] || 1.0
    const toRate = this.EXCHANGE_RATES[toCurrency] || 1.0
    
    return Number((toRate / fromRate).toFixed(4))
  }

  static getAllRates(): ExchangeRate {
    return { ...this.EXCHANGE_RATES }
  }

  static isValidCurrency(currency: string): boolean {
    return currency in this.EXCHANGE_RATES
  }

  static getCurrencySymbol(currency: string): string {
    return CURRENCIES[currency]?.symbol || '$'
  }

  static formatCurrency(amount: number, currency: string): string {
    const symbol = this.getCurrencySymbol(currency)
    const formattedAmount = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
    
    return `${symbol}${formattedAmount}`
  }

  // For production, you'd integrate with a real exchange rate API
  static async updateRates(): Promise<void> {
    // Placeholder for real-time exchange rate updates
    // In production, integrate with:
    // - exchangerate-api.com
    // - Open Exchange Rates
    // - CurrencyLayer API
    // - Central bank APIs
    
    console.log('Exchange rates would be updated from external API')
  }
}
