import { backendApi } from './backendApi';
import type { Tournament, TournamentEvent, Player, ApiError } from '@commentary/shared';

export class TournamentService {
  private errorHandlers: ((error: ApiError) => void)[] = [];

  addErrorHandler(handler: (error: ApiError) => void) {
    this.errorHandlers.push(handler);
  }

  private handleError(message: string, source: 'startgg' | 'network' | 'backend') {
    const error: ApiError = {
      message,
      source,
      timestamp: new Date(),
    };

    this.errorHandlers.forEach(handler => handler(error));
    throw error;
  }

  async loadTournamentFromUrl(
    url: string,
    eventName?: string,
    onProgress?: (progress: { phase: string; bracket?: string; matches: number; total: number }) => void,
    onBracketComplete?: (tournament: Tournament, selectedEvent?: TournamentEvent, players?: Player[]) => void,
    refresh: boolean = false
  ): Promise<{
    tournament: Tournament;
    selectedEvent?: TournamentEvent;
    players: Player[];
  }> {
    try {
      // Parse and load tournament data
      const tournament = await this.parseTournamentUrl(url, onProgress, (tournament, event) => {
        // Find the selected event if we have one
        let targetEvent = event;
        if (eventName) {
          targetEvent = tournament.events.find(e => {
            const eventNameLower = e.name.toLowerCase();
            const eventSlugLower = e.slug.toLowerCase();
            const targetLower = eventName.toLowerCase();
            return eventSlugLower === targetLower || 
                   eventSlugLower.includes(targetLower) || 
                   targetLower.includes(eventSlugLower) ||
                   eventNameLower.includes(targetLower) || 
                   targetLower.includes(eventNameLower);
          }) || event;
        }
        
        // Get players from the updated event
        const eventPlayers = targetEvent ? targetEvent.participants : [];

        // Call the bracket complete callback with updated data
        onBracketComplete?.(tournament, targetEvent, eventPlayers);
      }, refresh);
      
      // Find specific event if eventName is provided, or extract from URL
      let selectedEvent: TournamentEvent | undefined;
      let targetEventName = eventName;
      
      // If no event name provided, try to extract from URL
      if (!targetEventName) {
        targetEventName = this.extractEventFromUrl(url);
      }
      
      if (targetEventName) {
        // Try multiple matching strategies
        selectedEvent = tournament.events.find(event => {
          const eventNameLower = event.name.toLowerCase();
          const eventSlugLower = event.slug.toLowerCase();
          const targetLower = targetEventName!.toLowerCase();
          
          // Direct slug match (most reliable)
          if (eventSlugLower === targetLower) return true;
          
          // Slug contains target or target contains slug
          if (eventSlugLower.includes(targetLower) || targetLower.includes(eventSlugLower)) return true;
          
          // Name contains target or target contains name
          if (eventNameLower.includes(targetLower) || targetLower.includes(eventNameLower)) return true;
          
          // Try with spaces and dashes normalized
          const normalizedTarget = targetLower.replace(/[-\s]+/g, ' ').trim();
          const normalizedName = eventNameLower.replace(/[-\s]+/g, ' ').trim();
          const normalizedSlug = eventSlugLower.replace(/[-\s]+/g, ' ').trim();
          
          if (normalizedName.includes(normalizedTarget) || normalizedTarget.includes(normalizedName)) return true;
          if (normalizedSlug.includes(normalizedTarget) || normalizedTarget.includes(normalizedSlug)) return true;
          
          return false;
        });
        
        if (!selectedEvent) {
          // Log available events for debugging
          const availableEvents = tournament.events.map(e => `"${e.name}" (slug: ${e.slug})`).join(', ');
          this.handleError(`Event "${targetEventName}" not found in tournament. Available events: ${availableEvents}`, 'startgg');
        }
      }

      // Get all participants from selected event or all events
      const players = selectedEvent 
        ? selectedEvent.participants 
        : tournament.events.flatMap(event => event.participants);

      return {
        tournament,
        selectedEvent,
        players,
      };
    } catch (error) {
      if (error instanceof Error) {
        // Check for specific error types and provide better feedback
        if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
          this.handleError('Rate limit exceeded. The tournament data is being loaded more slowly to respect API limits. Please wait a moment and try again.', 'startgg');
        } else if (error.message.includes('401') || error.message.includes('Authentication')) {
          this.handleError('Authentication failed. Please check your start.gg API token in the environment variables.', 'startgg');
        } else {
          this.handleError(error.message, 'network');
        }
      }
      throw error;
    }
  }

  async parseTournamentUrl(
    url: string,
    onProgress?: (progress: { phase: string; bracket?: string; matches: number; total: number }) => void,
    onBracketComplete?: (tournament: Tournament, event: TournamentEvent) => void,
    refresh: boolean = false
  ): Promise<Tournament> {
    try {
      if (this.isStartGgUrl(url)) {
        // Call backend BFF which handles caching
        const response = await backendApi.getTournamentByUrl(url, refresh);

        // Log cache info
        if (response.cached) {
          console.log(`[CACHE HIT] Tournament loaded from cache (TTL: ${response.metadata.ttl}s)`);
        } else {
          console.log(`[CACHE MISS] Fresh tournament data loaded`);
        }

        // Call progress and completion callbacks with the data
        // Note: Backend doesn't support progressive loading callbacks yet,
        // but we still support the interface for future enhancement
        if (onProgress) {
          onProgress({ phase: 'complete', matches: 0, total: 1 });
        }

        if (onBracketComplete && response.data.events.length > 0) {
          response.data.events.forEach(event => {
            onBracketComplete(response.data, event);
          });
        }

        return response.data;
      } else {
        this.handleError('Invalid tournament URL. Only start.gg URLs are supported.', 'backend');
      }
    } catch (error) {
      if (error instanceof Error) {
        // Check for specific error types and provide better feedback
        if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
          this.handleError('start.gg API rate limit exceeded. The backend is managing this - please wait a moment.', 'backend');
        } else if (error.message.includes('401') || error.message.includes('Authentication')) {
          this.handleError('Backend authentication failed. Please check the backend configuration.', 'backend');
        } else if (error.message.includes('503') || error.message.includes('unavailable')) {
          this.handleError('Backend service is currently unavailable. Please ensure the backend server is running.', 'backend');
        } else {
          this.handleError(`Failed to load tournament: ${error.message}`, 'backend');
        }
      }
      throw error;
    }
  }

  private isStartGgUrl(url: string): boolean {
    return url.includes('start.gg/tournament/');
  }


  categorizePlayersByStatus(players: Player[]): {
    majorContenders: Player[];
    newContenders: Player[];
    improving: Player[];
  } {
    const majorContenders: Player[] = [];
    const newContenders: Player[] = [];
    const improving: Player[] = [];

    // Sort players by their current tournament performance and history
    players.forEach(player => {
      const category = this.categorizePlayer(player);
      
      if (category === 'major') {
        majorContenders.push(player);
      } else if (category === 'new') {
        newContenders.push(player);
      } else if (category === 'improving') {
        improving.push(player);
      }
    });

    return { majorContenders, newContenders, improving };
  }

  private categorizePlayer(player: Player): 'major' | 'new' | 'improving' | 'regular' {
    // Check if player has current tournament progress (indicates active participation)
    const hasCurrentProgress = player.currentTournament?.bracketPath?.length || 0;
    const wins = player.currentTournament?.opponentHistory?.filter(m => m.result === 'win').length || 0;
    const totalMatches = player.currentTournament?.opponentHistory?.length || 0;
    
    // Major contenders: Players performing well in current tournament
    if (hasCurrentProgress > 3 && wins >= 2) {
      return 'major';
    }
    
    // Strong performance in current tournament (high win rate)
    if (totalMatches >= 2 && wins / totalMatches >= 0.7) {
      return 'major';
    }

    // Historical tournament data (if available)
    if (player.tournamentHistory && player.tournamentHistory.length > 0) {
      const avgPlacement = player.tournamentHistory.reduce((sum, t) => sum + t.placement, 0) / player.tournamentHistory.length;
      const recentTournaments = player.tournamentHistory.slice(-5);
      const hasTopPlacements = player.tournamentHistory.some(t => t.placement <= 3);
      
      // Major contenders: consistently good placements
      if (avgPlacement <= 8 && hasTopPlacements) {
        return 'major';
      }
      
      // New contenders: limited history but decent performance
      if (player.tournamentHistory.length <= 3 && avgPlacement <= 16) {
        return 'new';
      }
      
      // Improving: getting better placements recently
      if (recentTournaments.length >= 2) {
        const recentAvg = recentTournaments.reduce((sum, t) => sum + t.placement, 0) / recentTournaments.length;
        const olderAvg = player.tournamentHistory.slice(0, -5).reduce((sum, t) => sum + t.placement, 0) / Math.max(1, player.tournamentHistory.length - 5);
        
        if (recentAvg < olderAvg * 0.8) { // 20% improvement
          return 'improving';
        }
      }
    }

    // Current tournament based categorization for players without history
    if (totalMatches >= 1 && wins >= 1) {
      if (totalMatches <= 2) {
        return 'new'; // New but showing promise
      } else if (wins >= totalMatches * 0.6) {
        return 'improving'; // Consistent performance
      }
    }

    return 'regular';
  }

  extractEventFromUrl(url: string): string | null {
    // Extract event name from URLs like:
    // https://www.start.gg/tournament/manila-madness-4/event/tekken-8-twt-challenger-event
    const match = url.match(/\/event\/([^\/\?]+)/);
    return match ? match[1] : null; // Keep original format for better matching
  }

  extractBracketFromUrl(url: string): { tournamentSlug: string; eventSlug?: string; bracketId?: string } | null {
    // Extract bracket info from URLs like:
    // https://www.start.gg/tournament/manila-madness-4/event/tekken-8-twt-challenger-event/brackets/1941086/2850777
    const tournamentMatch = url.match(/\/tournament\/([^\/]+)/);
    const eventMatch = url.match(/\/event\/([^\/]+)/);
    const bracketMatch = url.match(/\/brackets\/([^\/]+)/);

    if (!tournamentMatch) {
      return null;
    }

    return {
      tournamentSlug: tournamentMatch[1],
      eventSlug: eventMatch ? eventMatch[1] : undefined,
      bracketId: bracketMatch ? bracketMatch[1] : undefined,
    };
  }
}

export const tournamentService = new TournamentService();