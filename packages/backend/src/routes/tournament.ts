import { Router, Request, Response } from 'express';
import { startGgApi } from '../startgg';
import { cacheService } from '../cache';
import { calculateDynamicTTL, getMatchStateMetadata } from '../utils/ttl-calculator';
import type { TournamentResponse } from '@commentary/shared';

export const tournamentRouter = Router();

/**
 * GET /api/tournament/:slug
 * Get tournament data with smart caching
 * Query params:
 *   - refresh: boolean - force cache bypass
 */
tournamentRouter.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const bustCache = req.query.refresh === 'true';

    const cacheKey = `tournament:${slug}`;

    // Check cache unless refresh is requested
    if (!bustCache) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        console.log(`[CACHE HIT] ${slug}`);
        const metadata = await cacheService.getMetadata(cacheKey);

        const response: TournamentResponse = {
          data: cached,
          cached: true,
          metadata: {
            cachedAt: metadata?.createdAt,
            ttl: metadata?.ttl,
            ...getMatchStateMetadata(cached)
          }
        };

        return res.json(response);
      }
    }

    console.log(`[CACHE MISS] ${slug} (refresh: ${bustCache})`);

    // Fetch fresh data from start.gg
    const tournament = await startGgApi.getTournamentBySlug(slug);

    // Calculate dynamic TTL based on match states
    const ttl = calculateDynamicTTL(tournament);
    const matchMetadata = getMatchStateMetadata(tournament);

    console.log(`[TTL] ${slug} -> ${ttl}s (ongoing: ${matchMetadata.counts.ongoing}, recent: ${matchMetadata.counts.recentlyCompleted})`);

    // Cache the result
    await cacheService.set(cacheKey, tournament, ttl);

    const response: TournamentResponse = {
      data: tournament,
      cached: false,
      metadata: {
        cachedAt: Date.now(),
        ttl,
        ...matchMetadata
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Tournament fetch error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch tournament',
      source: 'backend'
    });
  }
});

/**
 * POST /api/tournament/:slug/refresh
 * Explicitly bust cache and fetch fresh data
 */
tournamentRouter.post('/:slug/refresh', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const cacheKey = `tournament:${slug}`;

    console.log(`[CACHE BUST] ${slug}`);

    // Delete from cache
    await cacheService.del(cacheKey);

    // Fetch fresh data
    const tournament = await startGgApi.getTournamentBySlug(slug);

    // Calculate dynamic TTL
    const ttl = calculateDynamicTTL(tournament);
    const matchMetadata = getMatchStateMetadata(tournament);

    console.log(`[TTL] ${slug} -> ${ttl}s (refreshed)`);

    // Cache the result
    await cacheService.set(cacheKey, tournament, ttl);

    const response: TournamentResponse = {
      data: tournament,
      cached: false,
      metadata: {
        cachedAt: Date.now(),
        ttl,
        ...matchMetadata
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Tournament refresh error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to refresh tournament',
      source: 'backend'
    });
  }
});

/**
 * GET /api/tournament/:slug/cache-status
 * Check if tournament is cached and get metadata
 */
tournamentRouter.get('/:slug/cache-status', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const cacheKey = `tournament:${slug}`;

    const exists = await cacheService.exists(cacheKey);
    const metadata = exists ? await cacheService.getMetadata(cacheKey) : null;

    res.json({
      cached: exists,
      metadata
    });
  } catch (error) {
    console.error('Cache status check error:', error);
    res.status(500).json({
      error: 'Failed to check cache status',
      source: 'backend'
    });
  }
});
