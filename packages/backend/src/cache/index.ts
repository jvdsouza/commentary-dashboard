/**
 * Cache service exports
 *
 * Usage:
 * import { cacheService } from './cache';
 *
 * await cacheService.get('key');
 * await cacheService.set('key', value, 60);
 */

export * from './ICacheService';
export * from './InMemoryCacheService';
export * from './RedisCacheService';
export * from './FallbackCacheService';
export * from './factory';

// Export singleton instance for convenience
import { createCacheService } from './factory';
export const cacheService = createCacheService();
