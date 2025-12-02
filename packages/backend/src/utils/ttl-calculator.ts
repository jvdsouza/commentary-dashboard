import type { Tournament } from '@commentary/shared';

/**
 * Calculate TTL (Time To Live) for tournament cache based on match states
 *
 * Strategy:
 * - Live matches (in_progress): 15 seconds - needs frequent updates
 * - Recently completed (<5 min): 120 seconds (2 min) - might have late score updates
 * - Old/pending matches: 600 seconds (10 min) - low change rate
 * - All completed tournament: 1800 seconds (30 min) - very low change rate
 */
export function calculateDynamicTTL(tournament: Tournament): number {
  const now = Date.now();

  let hasOngoingMatches = false;
  let hasRecentlyCompletedMatches = false;
  let hasAnyPendingMatches = false;

  // Analyze all events and their matches
  for (const event of tournament.events) {
    for (const match of event.currentMatches) {
      // Check for ongoing matches
      if (match.status === 'in_progress') {
        hasOngoingMatches = true;
      }

      // Check for recently completed matches (within last 5 minutes)
      if (match.status === 'completed' && match.completedAt) {
        const timeSinceCompletion = now - match.completedAt;
        if (timeSinceCompletion < 5 * 60 * 1000) { // 5 minutes
          hasRecentlyCompletedMatches = true;
        }
      }

      // Check for pending matches
      if (match.status === 'pending') {
        hasAnyPendingMatches = true;
      }
    }
  }

  // Determine TTL based on match states (priority order)
  if (hasOngoingMatches) {
    return 15; // 15 seconds - live action
  } else if (hasRecentlyCompletedMatches) {
    return 120; // 2 minutes - scores might still update
  } else if (hasAnyPendingMatches) {
    return 600; // 10 minutes - waiting for matches to start
  } else {
    return 1800; // 30 minutes - tournament appears complete or inactive
  }
}

/**
 * Get metadata about match states for debugging/logging
 */
export function getMatchStateMetadata(tournament: Tournament) {
  const now = Date.now();
  let ongoingCount = 0;
  let recentlyCompletedCount = 0;
  let pendingCount = 0;
  let oldCompletedCount = 0;

  for (const event of tournament.events) {
    for (const match of event.currentMatches) {
      if (match.status === 'in_progress') {
        ongoingCount++;
      } else if (match.status === 'completed' && match.completedAt) {
        const timeSinceCompletion = now - match.completedAt;
        if (timeSinceCompletion < 5 * 60 * 1000) {
          recentlyCompletedCount++;
        } else {
          oldCompletedCount++;
        }
      } else if (match.status === 'pending') {
        pendingCount++;
      }
    }
  }

  return {
    hasOngoingMatches: ongoingCount > 0,
    hasRecentMatches: recentlyCompletedCount > 0,
    counts: {
      ongoing: ongoingCount,
      recentlyCompleted: recentlyCompletedCount,
      pending: pendingCount,
      oldCompleted: oldCompletedCount
    }
  };
}
