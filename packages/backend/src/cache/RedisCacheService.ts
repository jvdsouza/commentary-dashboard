import Redis from 'ioredis';
import type { CacheMetadata } from '@commentary/shared';
import type { ICacheService } from './ICacheService';

/**
 * Redis cache implementation
 * Connects to Redis and provides caching with automatic serialization
 */
export class RedisCacheService implements ICacheService {
  private redis: Redis;
  private connected: boolean = false;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[Redis] Connection failed after 3 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 2000);
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    // Event handlers
    this.redis.on('connect', () => {
      console.log('✅ RedisCacheService connected');
      this.connected = true;
    });

    this.redis.on('error', (err) => {
      console.error('[Redis] Error:', err.message);
      this.connected = false;
    });

    this.redis.on('close', () => {
      console.log('[Redis] Connection closed');
      this.connected = false;
    });

    // Start connection
    this.redis.connect().catch((err) => {
      console.error('[Redis] Failed to connect:', err.message);
    });
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`[Redis] GET error for key ${key}:`, error);
      throw error;
    }
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error(`[Redis] SET error for key ${key}:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`[Redis] DEL error for key ${key}:`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[Redis] EXISTS error for key ${key}:`, error);
      throw error;
    }
  }

  async getMetadata(key: string): Promise<CacheMetadata | null> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      const ttl = await this.redis.ttl(key);

      if (ttl <= 0) {
        return null; // Key doesn't exist or has no expiration
      }

      const now = Date.now();
      const ttlMs = ttl * 1000;

      return {
        key,
        ttl,
        createdAt: now - ttlMs, // Approximation
        expiresAt: now + ttlMs
      };
    } catch (error) {
      console.error(`[Redis] TTL error for key ${key}:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      await this.redis.flushdb();
    } catch (error) {
      console.error('[Redis] FLUSHDB error:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.redis.quit();
      this.connected = false;
    } catch (error) {
      console.error('[Redis] Error closing connection:', error);
    }
  }

  getName(): string {
    return 'RedisCache';
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get Redis info
   */
  async getInfo(): Promise<string> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    return await this.redis.info();
  }
}
