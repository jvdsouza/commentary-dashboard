/**
 * Cache System Usage Examples
 *
 * Run this file to see the cache system in action:
 * npx tsx src/cache/example.ts
 */

import {
  createCacheService,
  createInMemoryCache,
  createRedisCache,
  createFallbackCache,
  RedisCacheService,
  InMemoryCacheService,
  FallbackCacheService
} from './index';

// Example 1: Default cache (auto-detects from environment)
async function exampleDefault() {
  console.log('\n=== Example 1: Default Cache Service ===\n');

  const cache = createCacheService();
  console.log(`Using: ${cache.getName()}\n`);

  // Set a value
  await cache.set('user:123', { name: 'John', age: 30 }, 60);
  console.log('✓ Set user:123');

  // Get the value
  const user = await cache.get('user:123');
  console.log('✓ Retrieved:', user);

  // Get metadata
  const meta = await cache.getMetadata('user:123');
  console.log('✓ Metadata:', meta);

  // Check exists
  const exists = await cache.exists('user:123');
  console.log('✓ Exists:', exists);

  // Clean up
  await cache.del('user:123');
  console.log('✓ Deleted user:123');
}

// Example 2: In-Memory Only
async function exampleInMemory() {
  console.log('\n=== Example 2: In-Memory Cache ===\n');

  const cache = createInMemoryCache();
  console.log(`Using: ${cache.getName()}\n`);

  // Store tournament data
  const tournament = {
    id: '456',
    name: 'Manila Madness 4',
    matches: []
  };

  await cache.set('tournament:456', tournament, 120);
  console.log('✓ Cached tournament data (TTL: 120s)');

  // Retrieve
  const cached = await cache.get('tournament:456');
  console.log('✓ Retrieved:', cached?.name);

  // Stats
  if (cache instanceof InMemoryCacheService) {
    const stats = cache.getStats();
    console.log('✓ Cache stats:', stats);
  }

  await cache.close();
}

// Example 3: Redis with Fallback
async function exampleFallback() {
  console.log('\n=== Example 3: Fallback Cache (Redis → Memory) ===\n');

  // Create Redis cache (will fail if Redis not running)
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new RedisCacheService(redisUrl);
  const memory = new InMemoryCacheService();

  const cache = createFallbackCache(redis, memory);
  console.log(`Using: ${cache.getName()}\n`);

  try {
    // This will try Redis first, fallback to memory if Redis fails
    await cache.set('tournament:789', { name: 'Test Tournament' }, 60);
    console.log('✓ Set tournament:789 (wrote to all caches)');

    const data = await cache.get('tournament:789');
    console.log('✓ Retrieved from cache:', data);

    // Delete from both
    await cache.del('tournament:789');
    console.log('✓ Deleted from all caches');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  } finally {
    await cache.close();
  }
}

// Example 4: Testing Cache Expiration
async function exampleExpiration() {
  console.log('\n=== Example 4: Cache Expiration ===\n');

  const cache = createInMemoryCache();

  // Set with 2 second TTL
  await cache.set('temp:key', 'temporary value', 2);
  console.log('✓ Set temp:key with 2s TTL');

  // Check immediately
  let value = await cache.get('temp:key');
  console.log('✓ Value (immediately):', value);

  // Wait 1 second, check again
  await sleep(1000);
  value = await cache.get('temp:key');
  const meta = await cache.getMetadata('temp:key');
  console.log('✓ Value (after 1s):', value, `(TTL: ${meta?.ttl}s)`);

  // Wait another 1.5 seconds (total 2.5s)
  await sleep(1500);
  value = await cache.get('temp:key');
  console.log('✓ Value (after 2.5s):', value, '(expired)');

  await cache.close();
}

// Example 5: Write-Through Behavior
async function exampleWriteThrough() {
  console.log('\n=== Example 5: Write-Through to Multiple Caches ===\n');

  const cache1 = createInMemoryCache();
  const cache2 = createInMemoryCache();
  const fallback = createFallbackCache(cache1, cache2);

  console.log(`Using: ${fallback.getName()}\n`);

  // Write to both caches
  await fallback.set('shared:key', { data: 'shared data' }, 60);
  console.log('✓ Written to both caches');

  // Verify both have the value
  const value1 = await cache1.get('shared:key');
  const value2 = await cache2.get('shared:key');

  console.log('✓ Cache 1 has:', value1);
  console.log('✓ Cache 2 has:', value2);

  // Delete from both
  await fallback.del('shared:key');
  console.log('✓ Deleted from both caches');

  // Verify both deleted
  const after1 = await cache1.get('shared:key');
  const after2 = await cache2.get('shared:key');
  console.log('✓ Cache 1 after delete:', after1);
  console.log('✓ Cache 2 after delete:', after2);

  await fallback.close();
}

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run all examples
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Cache System Usage Examples          ║');
  console.log('╚════════════════════════════════════════╝');

  try {
    await exampleDefault();
    await exampleInMemory();
    await exampleExpiration();
    await exampleWriteThrough();

    // Only run fallback example if Redis URL is set
    if (process.env.REDIS_URL) {
      await exampleFallback();
    } else {
      console.log('\n⚠️  Skipping Redis fallback example (no REDIS_URL)');
      console.log('   Set REDIS_URL=redis://localhost:6379 to test Redis integration\n');
    }

    console.log('\n✅ All examples completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().then(() => process.exit(0));
}

export {
  exampleDefault,
  exampleInMemory,
  exampleFallback,
  exampleExpiration,
  exampleWriteThrough
};
