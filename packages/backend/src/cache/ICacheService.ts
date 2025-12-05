import type { CacheMetadata } from '@commentary/shared';

/**
 * Cache service interface
 * Implementations: RedisCacheService, InMemoryCacheService, FallbackCacheService
 */
export interface ICacheService {
  /**
   * Get data from cache
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T = any>(key: string): Promise<T | null>;

  /**
   * Set data in cache with TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds
   */
  set(key: string, value: any, ttlSeconds: number): Promise<void>;

  /**
   * Delete data from cache
   * @param key - Cache key
   */
  del(key: string): Promise<void>;

  /**
   * Check if key exists in cache
   * @param key - Cache key
   * @returns True if key exists and is not expired
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get cache metadata (TTL, creation time, expiration time)
   * @param key - Cache key
   * @returns Metadata or null if not found
   */
  getMetadata(key: string): Promise<CacheMetadata | null>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * Close connections and cleanup
   */
  close(): Promise<void>;

  /**
   * Get cache service name for logging
   */
  getName(): string;
}
