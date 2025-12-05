# Cache System Architecture

Refactored cache system using **interface-based design** with **fallback strategy**.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 ICacheService                       │  ← Interface
│  (get, set, del, exists, getMetadata, clear, close) │
└─────────────────────────────────────────────────────┘
                        ▲
                        │ implements
        ┌───────────────┼───────────────┐
        │               │               │
┌───────────────┐ ┌──────────────┐ ┌─────────────────────┐
│ RedisCache    │ │ InMemory     │ │ FallbackCache       │
│ Service       │ │ CacheService │ │ Service             │
└───────────────┘ └──────────────┘ └─────────────────────┘
                                    │                     │
                                    │  Orchestrates:      │
                                    │  1. Try Redis       │
                                    │  2. Fall back to    │
                                    │     In-Memory       │
                                    └─────────────────────┘
```

## Components

### 1. **ICacheService** (`ICacheService.ts`)
Interface defining cache operations.

**Methods:**
- `get<T>(key): Promise<T | null>` - Retrieve from cache
- `set(key, value, ttl): Promise<void>` - Store in cache
- `del(key): Promise<void>` - Delete from cache
- `exists(key): Promise<boolean>` - Check if key exists
- `getMetadata(key): Promise<CacheMetadata | null>` - Get TTL info
- `clear(): Promise<void>` - Clear all entries
- `close(): Promise<void>` - Cleanup connections
- `getName(): string` - Get cache name for logging

### 2. **RedisCacheService** (`RedisCacheService.ts`)
Redis implementation using `ioredis`.

**Features:**
- Automatic reconnection with retry strategy
- Connection status tracking
- JSON serialization/deserialization
- Error handling with descriptive messages

**Usage:**
```typescript
const redis = new RedisCacheService('redis://localhost:6379');
await redis.set('key', { data: 'value' }, 60);
const value = await redis.get('key');
```

### 3. **InMemoryCacheService** (`InMemoryCacheService.ts`)
In-memory Map-based implementation.

**Features:**
- No external dependencies
- Automatic expiration cleanup (every 5 minutes)
- TTL tracking with millisecond precision
- Statistics API

**Usage:**
```typescript
const memory = new InMemoryCacheService();
await memory.set('key', { data: 'value' }, 60);
const value = await memory.get('key');
```

### 4. **FallbackCacheService** (`FallbackCacheService.ts`)
Orchestrates multiple cache implementations with fallback order.

**Strategy:**
- **Writes (set):** Write-through to all caches
- **Reads (get):** Try caches in order, return first hit
- **Deletes (del):** Delete from all caches

**Features:**
- Automatic failover on errors
- Optional cache promotion (commented out by default)
- Detailed logging for debugging
- Graceful degradation

**Usage:**
```typescript
const redis = new RedisCacheService('redis://localhost:6379');
const memory = new InMemoryCacheService();
const fallback = new FallbackCacheService([redis, memory]);

// Tries Redis first, falls back to memory if Redis fails
await fallback.get('key');
```

### 5. **Factory** (`factory.ts`)
Creates appropriate cache service based on environment.

**Logic:**
```typescript
if (REDIS_URL is set) {
  return FallbackCacheService([Redis, InMemory])
} else {
  return InMemoryCacheService()
}
```

**Usage:**
```typescript
import { createCacheService } from './cache/factory';

const cache = createCacheService(); // Auto-detects from env
```

## Usage Examples

### Basic Usage (Recommended)

```typescript
import { cacheService } from './cache';

// Set with 60 second TTL
await cacheService.set('tournament:123', tournamentData, 60);

// Get
const data = await cacheService.get('tournament:123');

// Delete
await cacheService.del('tournament:123');

// Check exists
const exists = await cacheService.exists('tournament:123');

// Get metadata
const meta = await cacheService.getMetadata('tournament:123');
console.log(`TTL: ${meta.ttl}s, Expires: ${new Date(meta.expiresAt)}`);
```

### Dependency Injection (Testing)

```typescript
import { createInMemoryCache } from './cache/factory';
import { createTournamentRouter } from './routes/tournament';

// Test with in-memory cache only
const testCache = createInMemoryCache();
const router = createTournamentRouter(testCache);
```

### Custom Cache Order

```typescript
import { createFallbackCache, RedisCacheService, InMemoryCacheService } from './cache';

const l1 = new InMemoryCacheService();  // Fast L1 cache
const l2 = new RedisCacheService('redis://localhost:6379'); // Persistent L2

const cache = createFallbackCache(l1, l2); // Try L1 first, then L2
```

### Multiple Redis Instances

```typescript
import { createFallbackCache, RedisCacheService } from './cache';

const primary = new RedisCacheService('redis://primary:6379');
const replica = new RedisCacheService('redis://replica:6379');

const cache = createFallbackCache(primary, replica);
```

## Fallback Behavior

### Read Path

```
GET request
    ↓
Try Redis.get(key)
    ├─ Success → return value
    └─ Fail (error/null)
        ↓
    Try InMemory.get(key)
        ├─ Success → return value
        └─ Fail → return null
```

### Write Path

```
SET request
    ↓
┌─────────────┬─────────────┐
│             │             │
▼             ▼             ▼
Redis.set()  InMemory.set()
    ↓             ↓
(parallel writes)
    ↓
If ANY succeeds → Success
If ALL fail → Error
```

## Benefits

### ✅ **Testability**
```typescript
// Easy to mock for unit tests
const mockCache: ICacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  // ...
};
```

### ✅ **Flexibility**
```typescript
// Swap implementations without changing business logic
const cache = isProduction
  ? createCacheService()  // Redis + Memory
  : createInMemoryCache(); // Memory only for dev
```

### ✅ **Composability**
```typescript
// Build complex cache strategies
const cache = new FallbackCacheService([
  new InMemoryCacheService(),      // L1: Fast, small
  new RedisCacheService(url1),     // L2: Persistent, shared
  new RedisCacheService(url2),     // L3: Backup Redis
]);
```

### ✅ **Observability**
```typescript
// Log which cache was hit
const value = await cache.get('key');
console.log(`Retrieved from: ${cache.getName()}`);
// Output: "FallbackCache(RedisCache → InMemoryCache)"
```

## Configuration

### Environment Variables

```env
# Optional: Redis URL for persistent caching
REDIS_URL=redis://localhost:6379

# If not set, uses in-memory cache only
```

### Startup Behavior

**With Redis:**
```
🔧 Creating cache service with Redis + In-Memory fallback
✅ RedisCacheService connected
ℹ️  InMemoryCacheService initialized
✅ FallbackCacheService initialized with fallback order: RedisCache → InMemoryCache
```

**Without Redis:**
```
🔧 Creating in-memory cache service (no REDIS_URL provided)
ℹ️  InMemoryCacheService initialized
```

## Monitoring & Debugging

### Cache Hit Logging

```typescript
// Automatically logs which cache level was hit
[FallbackCache] Cache hit in InMemoryCache (fallback level 1)
```

### Error Logging

```typescript
[Redis] GET error for key tournament:123: Connection closed
[FallbackCache] RedisCache GET failed, trying fallback: Connection closed
```

### Get Cache Name

```typescript
console.log(cacheService.getName());
// Output: "FallbackCache(RedisCache → InMemoryCache)"
```

## Migration from Old Code

### Before (Old Cache)

```typescript
import { cacheService } from './cache';

await cacheService.get('key');
await cacheService.set('key', value, 60);
```

### After (New Cache)

```typescript
import { cacheService } from './cache';

await cacheService.get('key');
await cacheService.set('key', value, 60);
```

**No changes needed!** The interface is backward compatible.

## Advanced: Cache Promotion (Optional)

Uncomment the cache promotion logic in `FallbackCacheService.get()` to enable automatic warming of higher-priority caches:

```typescript
// In FallbackCacheService.get()
if (value !== null) {
  if (i > 0) {
    // Promote to L1 cache for faster subsequent access
    this.promoteToHigherCaches(key, value, i); // ← Uncomment this
  }
  return value;
}
```

**Use case:** When L2 (Redis) has data but L1 (memory) doesn't, automatically populate L1.

## Testing

### Unit Test Example

```typescript
import { InMemoryCacheService } from './cache';

describe('InMemoryCacheService', () => {
  let cache: InMemoryCacheService;

  beforeEach(() => {
    cache = new InMemoryCacheService();
  });

  afterEach(async () => {
    await cache.close();
  });

  test('should set and get value', async () => {
    await cache.set('key', { data: 'value' }, 60);
    const value = await cache.get('key');
    expect(value).toEqual({ data: 'value' });
  });

  test('should expire after TTL', async () => {
    await cache.set('key', 'value', 1); // 1 second TTL
    await new Promise(resolve => setTimeout(resolve, 1100));
    const value = await cache.get('key');
    expect(value).toBeNull();
  });
});
```

### Integration Test with Fallback

```typescript
import { FallbackCacheService, InMemoryCacheService } from './cache';

test('should fallback to memory when Redis fails', async () => {
  const redis = new RedisCacheService('redis://invalid:9999');
  const memory = new InMemoryCacheService();
  const cache = new FallbackCacheService([redis, memory]);

  // Redis will fail, should fallback to memory
  await cache.set('key', 'value', 60);
  const value = await cache.get('key');

  expect(value).toBe('value');
});
```

## Performance Characteristics

| Implementation | Get Latency | Set Latency | Memory Usage | Persistence |
|----------------|-------------|-------------|--------------|-------------|
| InMemory       | <1ms        | <1ms        | High (RAM)   | No          |
| Redis          | 1-5ms       | 1-5ms       | Low (shared) | Yes         |
| Fallback       | 1-5ms*      | 5-10ms**    | Medium       | Partial     |

*Depends on which cache hits
**Writes to all caches in parallel

## Summary

This refactored cache system provides:

1. ✅ **Interface-based design** - Easy to test and swap implementations
2. ✅ **Automatic fallback** - Redis → In-Memory with zero downtime
3. ✅ **Write-through** - Data consistency across cache layers
4. ✅ **Graceful degradation** - Continues working even if Redis fails
5. ✅ **Composable** - Build custom cache strategies
6. ✅ **Observable** - Clear logging and debugging
7. ✅ **Backward compatible** - Drop-in replacement for old code

**No changes needed in existing routes or business logic!**
