import type { ICacheService } from './ICacheService';
import { RedisCacheService } from './RedisCacheService';
import { InMemoryCacheService } from './InMemoryCacheService';
import { FallbackCacheService } from './FallbackCacheService';

/**
 * Create cache service based on environment configuration
 *
 * Fallback order:
 * 1. Redis (if REDIS_URL is provided)
 * 2. In-Memory (always available as fallback)
 *
 * @returns ICacheService instance
 */
export function createCacheService(): ICacheService {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    console.log('🔧 Creating cache service with Redis + In-Memory fallback');

    try {
      const redisCache = new RedisCacheService(redisUrl);
      const memoryCache = new InMemoryCacheService();

      // Return fallback cache that tries Redis first, then in-memory
      return new FallbackCacheService([redisCache, memoryCache]);
    } catch (error) {
      console.error('Failed to create Redis cache, falling back to in-memory only:', error);
      return new InMemoryCacheService();
    }
  } else {
    console.log('🔧 Creating in-memory cache service (no REDIS_URL provided)');
    return new InMemoryCacheService();
  }
}

/**
 * Create a specific cache implementation for testing
 */
export function createInMemoryCache(): ICacheService {
  return new InMemoryCacheService();
}

/**
 * Create Redis cache for testing (requires Redis URL)
 */
export function createRedisCache(redisUrl: string): ICacheService {
  return new RedisCacheService(redisUrl);
}

/**
 * Create fallback cache with custom cache order
 */
export function createFallbackCache(...caches: ICacheService[]): ICacheService {
  return new FallbackCacheService(caches);
}
