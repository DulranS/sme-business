import { Currency, CURRENCIES } from '@/types'

export class CurrencyService {
  private static readonly STORAGE_KEY = 'preferred_currency'
  private static readonly DEFAULT_CURRENCY = 'USD'

  static getAvailableCurrencies(): Currency[] {
    return Object.values(CURRENCIES)
  }

  static getCurrentCurrency(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.STORAGE_KEY) || this.DEFAULT_CURRENCY
    }
    return this.DEFAULT_CURRENCY
  }

  static setCurrentCurrency(currencyCode: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, currencyCode)
    }
  }

  static getCurrencyInfo(currencyCode: string): Currency {
    return CURRENCIES[currencyCode] || CURRENCIES[this.DEFAULT_CURRENCY]
  }

  static formatPrice(amount: number, currencyCode?: string): string {
    const currency = this.getCurrencyInfo(currencyCode || this.getCurrentCurrency())
    const formattedAmount = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
    
    return `${currency.symbol}${formattedAmount}`
  }

  static formatPriceWithCode(amount: number, currencyCode?: string): string {
    const currency = this.getCurrencyInfo(currencyCode || this.getCurrentCurrency())
    const formattedAmount = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
    
    return `${formattedAmount} ${currency.code}`
  }
}
