import Redis from 'ioredis';
import type { Tournament, CacheMetadata } from '@commentary/shared';

export class CacheService {
  private redis: Redis | null = null;
  private inMemoryCache: Map<string, { data: any; expiresAt: number }> = new Map();
  private useRedis: boolean = false;

  constructor() {
    // Try to connect to Redis if URL is provided
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          retryStrategy: (times) => {
            if (times > 3) {
              console.warn('Redis connection failed after 3 retries, falling back to in-memory cache');
              return null; // Stop retrying
            }
            return Math.min(times * 100, 2000);
          },
          maxRetriesPerRequest: 3,
        });

        this.redis.on('connect', () => {
          console.log('✅ Connected to Redis');
          this.useRedis = true;
        });

        this.redis.on('error', (err) => {
          console.warn('Redis error, using in-memory cache:', err.message);
          this.useRedis = false;
        });
      } catch (error) {
        console.warn('Failed to initialize Redis, using in-memory cache:', error);
        this.redis = null;
        this.useRedis = false;
      }
    } else {
      console.log('ℹ️  No REDIS_URL provided, using in-memory cache');
    }
  }

  /**
   * Get data from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (this.useRedis && this.redis) {
      try {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error(`Redis GET error for key ${key}:`, error);
        // Fall through to in-memory cache
      }
    }

    // In-memory cache fallback
    const cached = this.inMemoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    } else if (cached) {
      // Expired, remove it
      this.inMemoryCache.delete(key);
    }
    return null;
  }

  /**
   * Set data in cache with TTL (in seconds)
   */
  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
        return;
      } catch (error) {
        console.error(`Redis SET error for key ${key}:`, error);
        // Fall through to in-memory cache
      }
    }

    // In-memory cache fallback
    this.inMemoryCache.set(key, {
      data: value,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
  }

  /**
   * Delete data from cache
   */
  async del(key: string): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.error(`Redis DEL error for key ${key}:`, error);
      }
    }

    this.inMemoryCache.delete(key);
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (this.useRedis && this.redis) {
      try {
        const result = await this.redis.exists(key);
        return result === 1;
      } catch (error) {
        console.error(`Redis EXISTS error for key ${key}:`, error);
        // Fall through to in-memory cache
      }
    }

    const cached = this.inMemoryCache.get(key);
    return cached !== undefined && cached.expiresAt > Date.now();
  }

  /**
   * Get cache metadata
   */
  async getMetadata(key: string): Promise<CacheMetadata | null> {
    if (this.useRedis && this.redis) {
      try {
        const ttl = await this.redis.ttl(key);
        if (ttl > 0) {
          const now = Date.now();
          return {
            key,
            ttl,
            createdAt: now - ((ttl * 1000)),
            expiresAt: now + (ttl * 1000)
          };
        }
      } catch (error) {
        console.error(`Redis TTL error for key ${key}:`, error);
      }
    }

    const cached = this.inMemoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      const now = Date.now();
      const ttlMs = cached.expiresAt - now;
      return {
        key,
        ttl: Math.floor(ttlMs / 1000),
        createdAt: cached.expiresAt - ttlMs,
        expiresAt: cached.expiresAt
      };
    }

    return null;
  }

  /**
   * Clear all cache entries (useful for testing)
   */
  async clear(): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        await this.redis.flushdb();
      } catch (error) {
        console.error('Redis FLUSHDB error:', error);
      }
    }

    this.inMemoryCache.clear();
  }

  /**
   * Clean up expired entries from in-memory cache
   */
  cleanExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.inMemoryCache.entries()) {
      if (value.expiresAt <= now) {
        this.inMemoryCache.delete(key);
      }
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();

// Clean up in-memory cache every 5 minutes
setInterval(() => {
  cacheService.cleanExpired();
}, 5 * 60 * 1000);
