import { logger } from '@/lib/logger'

// Compression utilities for large data
const compressData = (data: any): string => {
  try {
    return JSON.stringify(data)
  } catch {
    return data
  }
}

const decompressData = (data: string): any => {
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

export interface CacheEntry<T> {
  value: T
  compressedValue?: string
  expiresAt: number
  createdAt: number
  hits: number
  size: number
  lastAccessed: number
  priority: 'low' | 'medium' | 'high'
}

export interface CacheStats {
  name: string
  size: number
  hits: number
  misses: number
  hitRate: number
  totalSize: number
  compressionRatio: number
  evictions: number
}

export class EnhancedCacheService<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private readonly ttlMs: number
  private readonly maxSize: number
  private readonly maxMemoryMB: number
  private readonly name: string
  private hits = 0
  private misses = 0
  private evictions = 0
  private totalSize = 0
  private compressionEnabled = true
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(
    name: string,
    ttlMs: number = 5 * 60 * 1000,
    maxSize: number = 500,
    maxMemoryMB: number = 50
  ) {
    this.name = name
    this.ttlMs = ttlMs
    this.maxSize = maxSize
    this.maxMemoryMB = maxMemoryMB

    // Start background cleanup
    this.startBackgroundCleanup()
  }

  set(key: string, value: T, priority: 'low' | 'medium' | 'high' = 'medium'): void {
    const size = this.calculateSize(value)
    const compressedValue = this.compressionEnabled ? compressData(value) : undefined
    const compressedSize = compressedValue ? compressedValue.length : size

    // Check memory limits
    if (this.totalSize + compressedSize > this.maxMemoryMB * 1024 * 1024) {
      this.evictByPriority()
    }

    // Check size limits
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    const expiresAt = Date.now() + this.ttlMs
    const now = Date.now()

    this.cache.set(key, {
      value,
      compressedValue,
      expiresAt,
      createdAt: now,
      hits: 0,
      size: compressedSize,
      lastAccessed: now,
      priority
    })

    this.totalSize += compressedSize

    logger.debug(`Cache SET: ${this.name}/${key}`, {
      ttlMs: this.ttlMs,
      size: this.cache.size,
      memoryMB: (this.totalSize / (1024 * 1024)).toFixed(2)
    })
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.misses++
      return null
    }

    if (Date.now() > entry.expiresAt) {
      this.delete(key)
      this.misses++
      return null
    }

    entry.hits++
    entry.lastAccessed = Date.now()
    this.hits++

    logger.debug(`Cache HIT: ${this.name}/${key}`, { hits: entry.hits })
    return entry.value
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() > entry.expiresAt) {
      this.delete(key)
      return false
    }
    return true
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key)
    if (entry) {
      this.totalSize -= entry.size
      this.cache.delete(key)
      return true
    }
    return false
  }

  clear(): void {
    logger.debug(`Cache CLEAR: ${this.name}`, { size: this.cache.size })
    this.cache.clear()
    this.totalSize = 0
    this.hits = 0
    this.misses = 0
    this.evictions = 0
  }

  invalidatePattern(pattern: RegExp | string): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    let count = 0
    const keysToDelete: string[] = []

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.delete(key)
      count++
    }

    logger.debug(`Cache INVALIDATE: ${this.name}`, { pattern: pattern.toString(), invalidated: count })
    return count
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0
    const originalSize = Array.from(this.cache.values()).reduce((sum, entry) => {
      return sum + (entry.compressedValue ? entry.compressedValue.length * 2 : entry.size)
    }, 0)
    const compressionRatio = originalSize > 0 ? (this.totalSize / originalSize) * 100 : 100

    return {
      name: this.name,
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalSize: this.totalSize,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      evictions: this.evictions
    }
  }

  resetStats(): void {
    this.hits = 0
    this.misses = 0
    this.evictions = 0
  }

  // Advanced eviction strategies
  private evictLRU(): void {
    let lruKey: string | null = null
    let lruTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed
        lruKey = key
      }
    }

    if (lruKey) {
      this.delete(lruKey)
      this.evictions++
      logger.debug(`Cache EVICT LRU: ${this.name}/${lruKey}`)
    }
  }

  private evictByPriority(): void {
    const priorities: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high']

    for (const priority of priorities) {
      const entries = Array.from(this.cache.entries()).filter(([, entry]) => entry.priority === priority)

      if (entries.length > 0) {
        // Sort by last accessed time (oldest first)
        entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)

        const [keyToEvict] = entries[0]
        this.delete(keyToEvict)
        this.evictions++
        logger.debug(`Cache EVICT Priority: ${this.name}/${keyToEvict} (${priority})`)
        return
      }
    }
  }

  private calculateSize(value: any): number {
    try {
      const str = JSON.stringify(value)
      return str.length * 2 // Rough estimate for UTF-16
    } catch {
      return 1000 // Default size for non-serializable objects
    }
  }

  private startBackgroundCleanup(): void {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      const keysToDelete: string[] = []

      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          keysToDelete.push(key)
        }
      }

      for (const key of keysToDelete) {
        this.delete(key)
      }

      if (keysToDelete.length > 0) {
        logger.debug(`Background cleanup: ${this.name}`, { cleaned: keysToDelete.length })
      }
    }, 5 * 60 * 1000) // 5 minutes
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }
}

/**
 * Global cache instances for common use cases
 */
export const inventoryCache = new EnhancedCacheService('inventory', 5 * 60 * 1000, 1000)
export const conversationCache = new EnhancedCacheService('conversations', 10 * 60 * 1000, 500)
export const inventorySearchCache = new EnhancedCacheService('inventorySearch', 1 * 60 * 1000, 200)
export const claudeResponseCache = new EnhancedCacheService('claudeResponse', 30 * 60 * 1000, 1000)
export const whatsappCache = new EnhancedCacheService('whatsapp', 2 * 60 * 1000, 100)

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
 * Clear browser storage (localStorage, sessionStorage)
 */
export function clearBrowserStorage(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.clear()
      sessionStorage.clear()
      logger.info('Browser storage cleared')
    } catch (e) {
      logger.warn('Failed to clear browser storage', { error: String(e) })
    }
  }
}

/**
 * Clear all caches and browser storage
 */
export function clearAllData(): void {
  clearAllCaches()
  clearBrowserStorage()
  logger.info('All data cleared')
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
