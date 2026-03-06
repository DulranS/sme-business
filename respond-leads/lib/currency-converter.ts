import { CURRENCIES } from '@/types'

export interface ExchangeRate {
  [currency: string]: number
}

export class CurrencyConverter {
  private static readonly EXCHANGE_RATES: ExchangeRate = {
    // Major Global Currencies (base: USD = 1.0)
    USD: 1.0,
    EUR: 0.85,
    GBP: 0.73,
    JPY: 110.0,
    CNY: 6.45,
    INR: 74.5,
    
    // Americas
    CAD: 1.25,
    AUD: 1.35,
    BRL: 5.2,
    MXN: 20.1,
    ARS: 98.5,
    CLP: 790.0,
    COP: 3800.0,
    PEN: 3.75,
    UYU: 44.0,
    
    // Europe
    CHF: 0.92,
    SEK: 8.6,
    NOK: 8.4,
    DKK: 6.3,
    PLN: 3.9,
    CZK: 21.8,
    HUF: 295.0,
    RON: 4.1,
    BGN: 1.6,
    HRK: 6.3,
    RUB: 74.0,
    TRY: 8.9,
    
    // Asia & Middle East
    KRW: 1180.0,
    TWD: 28.0,
    HKD: 7.8,
    SGD: 1.35,
    MYR: 4.2,
    THB: 31.5,
    VND: 23000.0,
    PHP: 50.0,
    IDR: 14500.0,
    SAR: 3.75,
    AED: 3.67,
    QAR: 3.64,
    KWD: 0.30,
    BHD: 0.38,
    OMR: 0.38,
    ILS: 3.2,
    JOD: 0.71,
    LBP: 1500.0,
    
    // Africa
    ZAR: 15.0,
    NGN: 410.0,
    GHS: 5.9,
    KES: 110.0,
    UGX: 3700.0,
    TZS: 2300.0,
    EGP: 15.7,
    MAD: 9.0,
    DZD: 135.0,
    TND: 2.9,
    
    // Oceania
    NZD: 1.4,
    FJD: 2.1,
    PGK: 3.5,
    SBD: 8.0,
    VUV: 110.0,
    WST: 2.6,
    TOP: 2.3,
    
    // Caribbean & Central America
    JMD: 150.0,
    TTD: 6.8,
    BBD: 2.0,
    BSD: 1.0,
    BZD: 2.0,
    GTQ: 7.7,
    HNL: 24.0,
    NIO: 35.0,
    CRC: 610.0,
    XCD: 2.7,
    
    // Other Major Currencies
    NIS: 3.2,
    LKR: 200.0,
    PKR: 160.0,
    BDT: 85.0,
    NPR: 120.0,
    AFN: 85.0,
    MMK: 1650.0,
    LAK: 9500.0,
    KHR: 4100.0,
    MVR: 15.4,
    BTN: 74.5,
    GEL: 3.3,
    AMD: 520.0,
    AZN: 1.7,
    KZT: 425.0,
    KGS: 85.0,
    UZS: 10500.0,
    TJS: 11.0,
    TMT: 3.4,
    MNT: 2850.0,
    KPW: 900.0,
    
    // Cryptocurrencies (volatile rates - update regularly)
    BTC: 0.000023,
    ETH: 0.00031,
    USDT: 1.0,
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
