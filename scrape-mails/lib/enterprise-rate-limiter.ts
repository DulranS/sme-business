// lib/enterprise-rate-limiter.ts - Enterprise-grade rate limiting for API calls
import { supabaseAdmin } from './supabaseClient';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (identifier: string) => string;
}

interface RateLimitEntry {
  identifier: string;
  requests: number;
  windowStart: number;
  lastReset: number;
}

export class EnterpriseRateLimiter {
  private static instance: EnterpriseRateLimiter;
  private limits: Map<string, RateLimitConfig> = new Map();
  private cache: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  static getInstance(): EnterpriseRateLimiter {
    if (!EnterpriseRateLimiter.instance) {
      EnterpriseRateLimiter.instance = new EnterpriseRateLimiter();
    }
    return EnterpriseRateLimiter.instance;
  }

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  defineLimit(name: string, config: RateLimitConfig): void {
    this.limits.set(name, config);
  }

  async checkLimit(
    limitName: string,
    identifier: string,
    customConfig?: RateLimitConfig
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    const config = customConfig || this.limits.get(limitName);
    
    if (!config) {
      throw new Error(`Rate limit '${limitName}' not defined`);
    }

    const key = config.keyGenerator 
      ? config.keyGenerator(identifier)
      : `${limitName}:${identifier}`;

    const now = Date.now();
    const entry = this.cache.get(key);

    // If no entry or window expired, create new
    if (!entry || now - entry.windowStart >= config.windowMs) {
      const newEntry: RateLimitEntry = {
        identifier: key,
        requests: 1,
        windowStart: now,
        lastReset: now
      };

      this.cache.set(key, newEntry);
      await this.persistEntry(newEntry);

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs
      };
    }

    // Check if limit exceeded
    if (entry.requests >= config.maxRequests) {
      const retryAfter = Math.ceil((entry.windowStart + config.windowMs - now) / 1000);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.windowStart + config.windowMs,
        retryAfter
      };
    }

    // Increment counter
    entry.requests++;
    await this.persistEntry(entry);

    return {
      allowed: true,
      remaining: config.maxRequests - entry.requests,
      resetTime: entry.windowStart + config.windowMs
    };
  }

  private async persistEntry(entry: RateLimitEntry): Promise<void> {
    try {
      await supabaseAdmin
        .from('rate_limits')
        .upsert({
          identifier: entry.identifier,
          requests: entry.requests,
          window_start: new Date(entry.windowStart).toISOString(),
          last_reset: new Date(entry.lastReset).toISOString()
        }, {
          onConflict: 'identifier'
        });
    } catch (error) {
      console.error('Failed to persist rate limit entry:', error);
      // Continue without persistence - cache will handle it
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      const config = this.limits.get(key.split(':')[0]);
      if (config && now - entry.windowStart >= config.windowMs * 2) {
        toDelete.push(key);
      }
    });

    toDelete.forEach(key => this.cache.delete(key));
  }

  async getStats(limitName?: string): Promise<any> {
    try {
      let query = supabaseAdmin.from('rate_limits').select('*');
      
      if (limitName) {
        query = query.like('identifier', `${limitName}:%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      const stats = {
        totalEntries: data?.length || 0,
        activeEntries: 0,
        totalRequests: 0,
        byLimit: {} as Record<string, number>
      };

      const now = Date.now();
      
      data?.forEach(entry => {
        const [limit] = entry.identifier.split(':');
        
        // Check if entry is still active
        const config = this.limits.get(limit);
        if (config && now - new Date(entry.window_start).getTime() < config.windowMs) {
          stats.activeEntries++;
        }

        stats.totalRequests += entry.requests;
        stats.byLimit[limit] = (stats.byLimit[limit] || 0) + entry.requests;
      });

      return stats;
    } catch (error) {
      console.error('Error getting rate limit stats:', error);
      return {
        totalEntries: 0,
        activeEntries: 0,
        totalRequests: 0,
        byLimit: {}
      };
    }
  }

  // Predefined enterprise limits
  setupEnterpriseLimits(): void {
    // Gmail API limits
    this.defineLimit('gmail-send', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 emails per minute
    });

    this.defineLimit('gmail-read', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 reads per minute
    });

    // OpenAI API limits
    this.defineLimit('openai-gpt4', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20, // 20 requests per minute
    });

    // Supabase limits
    this.defineLimit('supabase-read', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 1000, // 1000 reads per minute
    });

    this.defineLimit('supabase-write', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 writes per minute
    });

    // Cron job limits
    this.defineLimit('cron-reply-check', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1, // Once per 15 minutes
    });

    this.defineLimit('cron-followup', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 1, // Once per hour
    });
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global rate limiter instance
export const rateLimiter = EnterpriseRateLimiter.getInstance();

// Setup enterprise limits automatically
rateLimiter.setupEnterpriseLimits();
