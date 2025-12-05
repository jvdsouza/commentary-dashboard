import type { CacheMetadata } from '@commentary/shared';
import type { ICacheService } from './ICacheService';

interface CacheEntry {
  data: any;
  expiresAt: number;
  createdAt: number;
}

/**
 * In-memory cache implementation
 * Uses a Map to store cache entries with expiration
 */
export class InMemoryCacheService implements ICacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanExpired();
    }, 5 * 60 * 1000);

    console.log('ℹ️  InMemoryCacheService initialized');
  }

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry = {
      data: value,
      createdAt: now,
      expiresAt: now + (ttlSeconds * 1000)
    };

    this.cache.set(key, entry);
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async getMetadata(key: string): Promise<CacheMetadata | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }

    const now = Date.now();
    const ttlMs = entry.expiresAt - now;

    return {
      key,
      ttl: Math.floor(ttlMs / 1000),
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt
    };
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async close(): Promise<void> {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }

  getName(): string {
    return 'InMemoryCache';
  }

  /**
   * Remove expired entries from cache
   */
  private cleanExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[InMemoryCache] Cleaned ${cleaned} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}
