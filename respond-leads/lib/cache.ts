import { logger } from '@/lib/logger'

export interface CacheEntry<T> {
  value: T
  expiresAt: number
  createdAt: number
  hits: number
}

export interface CacheStats {
  name: string
  size: number
  hits: number
  misses: number
  hitRate: number
}

export class CacheService<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private readonly ttlMs: number
  private readonly maxSize: number
  private readonly name: string
  private hits = 0
  private misses = 0

  constructor(name: string, ttlMs: number = 5 * 60 * 1000, maxSize: number = 500) {
    this.name = name
    this.ttlMs = ttlMs
    this.maxSize = maxSize
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    const expiresAt = Date.now() + this.ttlMs
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
      hits: 0
    })

    logger.debug(`Cache SET: ${this.name}/${key}`, { ttlMs: this.ttlMs, size: this.cache.size })
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.misses++
      return null
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.misses++
      return null
    }

    entry.hits++
    this.hits++

    logger.debug(`Cache HIT: ${this.name}/${key}`, { hits: entry.hits })
    return entry.value
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    logger.debug(`Cache CLEAR: ${this.name}`, { size: this.cache.size })
    this.cache.clear()
  }

  invalidatePattern(pattern: RegExp | string): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    let count = 0

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        count++
      }
    }

    logger.debug(`Cache INVALIDATE: ${this.name}`, { pattern: pattern.toString(), invalidated: count })
    return count
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0

    return {
      name: this.name,
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100
    }
  }

  resetStats(): void {
    this.hits = 0
    this.misses = 0
  }

  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      logger.debug(`Cache EVICT: ${this.name}/${oldestKey}`, { maxSize: this.maxSize })
    }
  }
}

/**
 * Global cache instances for common use cases
 */
export const inventoryCache = new CacheService('inventory', 5 * 60 * 1000, 1000)
export const conversationCache = new CacheService('conversations', 10 * 60 * 1000, 500)
export const inventorySearchCache = new CacheService('inventorySearch', 1 * 60 * 1000, 200)
export const claudeResponseCache = new CacheService('claudeResponse', 30 * 60 * 1000, 1000)
export const whatsappCache = new CacheService('whatsapp', 2 * 60 * 1000, 100)

/**
 * Get stats for all caches
 */
export function getAllCacheStats(): CacheStats[] {
  return [
    inventoryCache.getStats(),
    conversationCache.getStats(),
    inventorySearchCache.getStats(),
    claudeResponseCache.getStats(),
    whatsappCache.getStats()
  ]
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  inventoryCache.clear()
  conversationCache.clear()
  inventorySearchCache.clear()
  claudeResponseCache.clear()
  whatsappCache.clear()
  logger.info('All caches cleared')
}

/**
 * Invalidate cache pattern across all caches
 */
export function invalidateCachePattern(pattern: RegExp | string): void {
  inventoryCache.invalidatePattern(pattern)
  conversationCache.invalidatePattern(pattern)
  inventorySearchCache.invalidatePattern(pattern)
  claudeResponseCache.invalidatePattern(pattern)
  whatsappCache.invalidatePattern(pattern)
}
