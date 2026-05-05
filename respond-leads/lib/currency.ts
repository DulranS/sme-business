import { Currency, CURRENCIES } from '@/types'
import { CurrencyConverter } from '@/lib/currency-converter'

export class CurrencyService {
  private static readonly STORAGE_KEY = 'preferred_currency'
  private static readonly DEFAULT_CURRENCY = 'USD'

  static getAvailableCurrencies(): Currency[] {
    return Object.values(CURRENCIES).sort((a, b) => a.code.localeCompare(b.code))
  }

  static searchCurrencies(query: string): Currency[] {
    const normalized = String(query || '').trim().toLowerCase()
    if (!normalized) return this.getAvailableCurrencies()

    return this.getAvailableCurrencies().filter(currency =>
      currency.code.toLowerCase().includes(normalized) ||
      currency.name.toLowerCase().includes(normalized) ||
      currency.symbol.toLowerCase().includes(normalized)
    )
  }

  static getCurrentCurrency(): string {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY)
        if (stored && typeof stored === 'string') {
          return stored
        }
        return this.DEFAULT_CURRENCY
      } catch (e) {
        // localStorage might be blocked, corrupted, or quota exceeded
        console.warn('Currency preference deserialization failed, using default:', e)
        return this.DEFAULT_CURRENCY
      }
    }
    return this.DEFAULT_CURRENCY
  }

  static setCurrentCurrency(currencyCode: string): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.STORAGE_KEY, currencyCode)
      } catch (e) {
        // localStorage might be blocked on mobile in some browsers
        console.warn('Unable to save currency preference:', e)
      }
    }
  }

  static getCurrencyInfo(currencyCode: string): Currency {
    return CURRENCIES[currencyCode] || CURRENCIES[this.DEFAULT_CURRENCY]
  }

  static formatPrice(amount: number, currencyCode: string): string {
    const currency = this.getCurrencyInfo(currencyCode)
    const formattedAmount = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
    
    return `${currency.symbol}${formattedAmount}`
  }

  static formatPriceWithCode(amount: number, currencyCode: string): string {
    const currency = this.getCurrencyInfo(currencyCode)
    const formattedAmount = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
    
    return `${formattedAmount} ${currency.code}`
  }

  // New methods for multi-currency support
  static convertPrice(amount: number, fromCurrency: string, toCurrency: string): number {
    return CurrencyConverter.convert(amount, fromCurrency, toCurrency)
  }

  static convertToUSD(amount: number, fromCurrency: string): number {
    return CurrencyConverter.convertToUSD(amount, fromCurrency)
  }

  static convertFromUSD(amount: number, toCurrency: string): number {
    return CurrencyConverter.convertFromUSD(amount, toCurrency)
  }

  static getExchangeRate(fromCurrency: string, toCurrency: string): number {
    return CurrencyConverter.getExchangeRate(fromCurrency, toCurrency)
  }

  static isValidCurrency(currency: string): boolean {
    return CurrencyConverter.isValidCurrency(currency)
  }

  // Format price for display in user's preferred currency
  static formatPriceInPreferredCurrency(amount: number, itemCurrency: string): string {
    const preferredCurrency = this.getCurrentCurrency()
    
    if (itemCurrency === preferredCurrency) {
      return this.formatPrice(amount, itemCurrency)
    }
    
    const convertedAmount = this.convertPrice(amount, itemCurrency, preferredCurrency)
    return this.formatPrice(convertedAmount, preferredCurrency)
  }
}
