import type { CacheMetadata } from '@commentary/shared';
import type { ICacheService } from './ICacheService';

/**
 * Fallback cache service that tries multiple cache implementations in order
 *
 * Strategy:
 * - Writes to all caches (write-through)
 * - Reads from first available cache (fail-fast with fallback)
 * - If primary fails, falls back to secondary automatically
 *
 * Example: Redis (primary) → In-Memory (fallback)
 */
export class FallbackCacheService implements ICacheService {
  private caches: ICacheService[];

  constructor(caches: ICacheService[]) {
    if (caches.length === 0) {
      throw new Error('FallbackCacheService requires at least one cache implementation');
    }

    this.caches = caches;
    console.log(`✅ FallbackCacheService initialized with fallback order: ${caches.map(c => c.getName()).join(' → ')}`);
  }

  /**
   * Get from first available cache (fail-fast with fallback)
   */
  async get<T = any>(key: string): Promise<T | null> {
    for (let i = 0; i < this.caches.length; i++) {
      const cache = this.caches[i];

      try {
        const value = await cache.get<T>(key);

        if (value !== null) {
          // Found in cache
          if (i > 0) {
            // Found in fallback cache - log it
            console.log(`[FallbackCache] Cache hit in ${cache.getName()} (fallback level ${i})`);

            // Optional: Repopulate higher-priority caches (cache warming)
            // Uncomment if you want automatic cache promotion
            // this.promoteToHigherCaches(key, value, i);
          }

          return value;
        }
      } catch (error) {
        // Primary cache failed, try next
        console.warn(`[FallbackCache] ${cache.getName()} GET failed, trying fallback:`, error instanceof Error ? error.message : error);
        continue;
      }
    }

    // Not found in any cache
    return null;
  }

  /**
   * Set in all caches (write-through)
   */
  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const errors: Array<{ cache: string; error: any }> = [];

    // Write to all caches
    await Promise.all(
      this.caches.map(async (cache) => {
        try {
          await cache.set(key, value, ttlSeconds);
        } catch (error) {
          errors.push({ cache: cache.getName(), error });
          console.error(`[FallbackCache] ${cache.getName()} SET failed:`, error);
        }
      })
    );

    // If all caches failed, throw error
    if (errors.length === this.caches.length) {
      throw new Error(`All caches failed to SET key ${key}: ${errors.map(e => e.cache).join(', ')}`);
    }

    // If some caches failed but not all, log warning
    if (errors.length > 0) {
      console.warn(`[FallbackCache] Some caches failed to SET key ${key}:`, errors.map(e => e.cache).join(', '));
    }
  }

  /**
   * Delete from all caches
   */
  async del(key: string): Promise<void> {
    await Promise.all(
      this.caches.map(async (cache) => {
        try {
          await cache.del(key);
        } catch (error) {
          console.error(`[FallbackCache] ${cache.getName()} DEL failed:`, error);
        }
      })
    );
  }

  /**
   * Check if exists in any cache
   */
  async exists(key: string): Promise<boolean> {
    for (const cache of this.caches) {
      try {
        const exists = await cache.exists(key);
        if (exists) {
          return true;
        }
      } catch (error) {
        console.error(`[FallbackCache] ${cache.getName()} EXISTS failed:`, error);
        continue;
      }
    }

    return false;
  }

  /**
   * Get metadata from first available cache
   */
  async getMetadata(key: string): Promise<CacheMetadata | null> {
    for (const cache of this.caches) {
      try {
        const metadata = await cache.getMetadata(key);
        if (metadata) {
          return metadata;
        }
      } catch (error) {
        console.error(`[FallbackCache] ${cache.getName()} getMetadata failed:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    await Promise.all(
      this.caches.map(async (cache) => {
        try {
          await cache.clear();
        } catch (error) {
          console.error(`[FallbackCache] ${cache.getName()} CLEAR failed:`, error);
        }
      })
    );
  }

  /**
   * Close all caches
   */
  async close(): Promise<void> {
    await Promise.all(
      this.caches.map(async (cache) => {
        try {
          await cache.close();
        } catch (error) {
          console.error(`[FallbackCache] ${cache.getName()} CLOSE failed:`, error);
        }
      })
    );
  }

  getName(): string {
    return `FallbackCache(${this.caches.map(c => c.getName()).join(' → ')})`;
  }

  /**
   * Optional: Promote cache entry to higher-priority caches
   * Useful for warming L1 cache when L2 cache hits
   */
  private async promoteToHigherCaches(key: string, value: any, foundAtLevel: number): Promise<void> {
    // Get metadata from the cache where we found the value
    const metadata = await this.caches[foundAtLevel].getMetadata(key);

    if (!metadata) {
      return;
    }

    const ttlSeconds = metadata.ttl;

    // Write to all higher-priority caches
    for (let i = 0; i < foundAtLevel; i++) {
      try {
        await this.caches[i].set(key, value, ttlSeconds);
        console.log(`[FallbackCache] Promoted key ${key} to ${this.caches[i].getName()}`);
      } catch (error) {
        console.error(`[FallbackCache] Failed to promote to ${this.caches[i].getName()}:`, error);
      }
    }
  }

  /**
   * Get statistics from all caches
   */
  getCacheNames(): string[] {
    return this.caches.map(c => c.getName());
  }
}
