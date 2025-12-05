import axios from 'axios';
import type { Tournament, TournamentEvent, Player, Match, Bracket } from '@commentary/shared';

const STARTGG_API_URL = 'https://api.start.gg/gql/alpha';

class StartGgApi {
  private token: string;
  private axiosInstance;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private readonly RATE_LIMIT_DELAY = 800; // 800ms between requests (75 req/min - under 80/min limit)
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds base delay

  constructor() {
    this.token = process.env.STARTGG_API_TOKEN || '';
    if (!this.token) {
      throw new Error('STARTGG_API_TOKEN environment variable is required');
    }
    this.axiosInstance = axios.create({
      baseURL: STARTGG_API_URL,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async query(query: string, variables: any = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.executeQueryWithRetry(query, variables);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  private async executeQueryWithRetry(query: string, variables: any = {}, retryCount = 0): Promise<any> {
    try {
      // Ensure we respect rate limits
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
        await this.sleep(this.RATE_LIMIT_DELAY - timeSinceLastRequest);
      }
      
      this.lastRequestTime = Date.now();
      
      const response = await this.axiosInstance.post('', {
        query,
        variables,
      });

      if (response.data.errors) {
        throw new Error(`GraphQL Error: ${response.data.errors.map((e: any) => e.message).join(', ')}`);
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        
        // Handle rate limiting with exponential backoff
        if (status === 429 && retryCount < this.MAX_RETRIES) {
          const backoffDelay = this.RETRY_DELAY * Math.pow(2, retryCount);
          console.warn(`Rate limited. Retrying in ${backoffDelay}ms... (Attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
          await this.sleep(backoffDelay);
          return this.executeQueryWithRetry(query, variables, retryCount + 1);
        }
        
        // Handle other HTTP errors
        if (status === 401) {
          throw new Error(`Authentication Error: Invalid or expired start.gg API token`);
        }
        
        if (status >= 500) {
          throw new Error(`Server Error: start.gg API is temporarily unavailable (${status})`);
        }
        
        throw new Error(`API Error: ${error.message} (Status: ${status || 'Unknown'})`);
      }
      throw error;
    }
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
      }
    }
    
    this.isProcessingQueue = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getTournamentBySlug(
    slug: string, 
    onProgress?: (progress: { phase: string; bracket?: string; matches: number; total: number }) => void,
    onBracketComplete?: (tournament: Tournament, event: TournamentEvent) => void
  ): Promise<Tournament> {
    // First, get basic tournament info and events
    const tournamentQuery = `
      query TournamentQuery($slug: String!) {
        tournament(slug: $slug) {
          id
          name
          slug
          url
          events {
            id
            name
            slug
            entrants(query: {page: 1, perPage: 16}) {
              nodes {
                id
                name
                participants {
                  id
                  gamerTag
                  user {
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const tournamentData = await this.query(tournamentQuery, { slug });
    
    if (!tournamentData || !tournamentData.tournament) {
      throw new Error(`Tournament with slug "${slug}" not found or tournament data is invalid`);
    }
    
    const tournament = this.transformBasicTournamentData(tournamentData.tournament);

    // For each event, get phase groups and current matches separately
    for (const event of tournament.events) {
      try {
        await this.loadEventDetails(event, slug, onProgress, (updatedEvent) => {
          onBracketComplete?.(tournament, updatedEvent);
        });
      } catch (error) {
        console.warn(`Failed to load details for event ${event.name}:`, error);
        // Continue with other events even if one fails
      }
    }

    return tournament;
  }

  private async loadEventDetails(
    event: TournamentEvent, 
    tournamentSlug: string, 
    onProgress?: (progress: { phase: string; bracket?: string; matches: number; total: number }) => void,
    onBracketComplete?: (event: TournamentEvent) => void
  ): Promise<void> {
    // First, get the phase groups structure
    const phaseGroupsQuery = `
      query PhaseGroupsQuery($slug: String!, $eventId: ID!) {
        tournament(slug: $slug) {
          events(filter: {id: $eventId}) {
            id
            name
            slug
            phaseGroups {
              id
              displayIdentifier
              bracketType
              phase {
                id
                name
              }
            }
          }
        }
      }
    `;

    const phaseGroupData = await this.query(phaseGroupsQuery, { 
      slug: tournamentSlug, 
      eventId: event.id
    });
    
    if (!phaseGroupData.tournament?.events || phaseGroupData.tournament.events.length === 0) {
      return;
    }

    const eventDetails = phaseGroupData.tournament.events[0];
    if (!eventDetails.phaseGroups) {
      return;
    }

    // Initialize brackets and show early structure
    event.brackets = eventDetails.phaseGroups.map((phaseGroup: any) => ({
      id: phaseGroup.id,
      name: this.getBracketName(phaseGroup),
      matches: []
    }));
    
    // Initialize currentMatches array
    event.currentMatches = [];

    // Report initial structure loaded and trigger immediate UI update
    onProgress?.({ 
      phase: 'structure', 
      matches: 0, 
      total: eventDetails.phaseGroups.length 
    });
    
    // Show the initial structure immediately
    onBracketComplete?.(event);

    // Now fetch sets for each phase group separately to avoid complexity limits
    const allMatches: any[] = [];
    const allPlayers = new Map<string, any>();

    for (let i = 0; i < eventDetails.phaseGroups.length; i++) {
      const phaseGroup = eventDetails.phaseGroups[i];

      // No extra delay needed - request queue already enforces rate limit

      let page = 1;
      let hasMorePages = true;
      const bracketMatches: any[] = [];
      const bracketPlayers = new Map<string, any>();

      while (hasMorePages && page <= 10) { // Allow up to 10 pages if needed
        try {
          const setsData = await this.loadPhaseGroupSets(tournamentSlug, phaseGroup.id, page);
          
          if (setsData && setsData.length > 0) {
            // Transform and add matches for this bracket
            const bracketName = this.getBracketName(phaseGroup);
            const matches = setsData.map((set: any) => this.transformMatchData(set, bracketName));
            bracketMatches.push(...matches);
            allMatches.push(...matches);

            // Extract players for this bracket
            setsData.forEach((set: any) => {
              if (set.slots) {
                set.slots.forEach((slot: any) => {
                  if (slot.entrant && slot.entrant.id) {
                    const player = this.transformPlayerData(slot.entrant);
                    if (player.id && player.tag !== 'Unknown Player') {
                      bracketPlayers.set(player.id, player);
                      allPlayers.set(player.id, player);
                    }
                  }
                });
              }
            });

            // Check if we got fewer results than requested (indicates last page)
            if (setsData.length < 30) {
              hasMorePages = false;
            } else {
              page++;
            }
          } else {
            hasMorePages = false;
          }
        } catch (error) {
          console.warn(`Failed to load page ${page} for phase group ${phaseGroup.id}:`, error);
          hasMorePages = false;
        }
      }

      // Update the specific bracket with its matches
      const bracketIndex = event.brackets.findIndex(b => b.id === phaseGroup.id);
      if (bracketIndex !== -1) {
        event.brackets[bracketIndex].matches = bracketMatches;
      }

      // Add new players to the event participants
      const existingPlayerIds = new Set(event.participants.map(p => p.id));
      const newPlayers = Array.from(bracketPlayers.values()).filter(p => !existingPlayerIds.has(p.id));
      event.participants.push(...newPlayers);

      // Update current matches with newly loaded matches
      const newCurrentMatches = bracketMatches.filter(match => 
        match.status === 'pending' || match.status === 'in_progress'
      );
      event.currentMatches = [...event.currentMatches, ...newCurrentMatches];

      // Report progress for this bracket
      const bracketName = this.getBracketName(phaseGroup);
      onProgress?.({ 
        phase: 'loading', 
        bracket: bracketName,
        matches: allMatches.length, 
        total: eventDetails.phaseGroups.length 
      });

      // Trigger UI update immediately after each bracket is loaded
      onBracketComplete?.(event);
    }

    // Final cleanup - brackets and current matches are already updated progressively
    // Just ensure currentMatches is properly filtered
    event.currentMatches = event.currentMatches.filter((match, index, self) => 
      index === self.findIndex(m => m.id === match.id) // Remove duplicates
    );
  }

  private async loadPhaseGroupSets(tournamentSlug: string, phaseGroupId: string, page: number): Promise<any[]> {
    const setsQuery = `
      query PhaseGroupSetsQuery($phaseGroupId: ID!, $page: Int!) {
        phaseGroup(id: $phaseGroupId) {
          sets(page: $page, perPage: 30, filters: {state: [1, 2, 3]}) {
            nodes {
              id
              fullRoundText
              round
              state
              startedAt
              completedAt
              updatedAt
              slots {
                entrant {
                  id
                  name
                  participants {
                    id
                    gamerTag
                  }
                }
                standing {
                  stats {
                    score {
                      label
                      value
                    }
                  }
                }
              }
              games {
                winnerId
                orderNum
                stage {
                  name
                }
              }
              winnerId
            }
          }
        }
      }
    `;

    try {
      const result = await this.query(setsQuery, { 
        phaseGroupId,
        page
      });

      return result?.phaseGroup?.sets?.nodes || [];
    } catch (error) {
      console.warn(`Failed to load sets for phase group ${phaseGroupId}, page ${page}:`, error);
      return [];
    }
  }

  private getBracketName(phaseGroup: any): string {
    const phaseName = phaseGroup.phase?.name || '';
    const identifier = phaseGroup.displayIdentifier || `Pool ${phaseGroup.id}`;
    return phaseName ? `${phaseName} - ${identifier}` : identifier;
  }

  async getTournamentByUrl(
    url: string,
    onProgress?: (progress: { phase: string; bracket?: string; matches: number; total: number }) => void,
    onBracketComplete?: (tournament: Tournament, event: TournamentEvent) => void
  ): Promise<Tournament> {
    const slug = this.extractSlugFromUrl(url);
    return this.getTournamentBySlug(slug, onProgress, onBracketComplete);
  }

  async getPlayerHistory(playerId: string): Promise<any> {
    const query = `
      query PlayerQuery($id: ID!) {
        user(id: $id) {
          id
          gamerTag
          player {
            gamerTag
          }
          tournaments(query: {
            page: 1
            perPage: 20
          }) {
            nodes {
              id
              name
              endAt
              events {
                id
                name
                entrants(query: {
                  filter: {
                    participantIds: [$id]
                  }
                }) {
                  nodes {
                    id
                    name
                    standing {
                      placement
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    return this.query(query, { id: playerId });
  }

  private extractSlugFromUrl(url: string): string {
    // Extract slug from URLs like:
    // https://www.start.gg/tournament/manila-madness-4/details
    // https://www.start.gg/tournament/manila-madness-4/event/tekken-8-twt-challenger-event
    const match = url.match(/\/tournament\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid start.gg URL format');
    }
    return match[1];
  }

  private transformBasicTournamentData(rawTournament: any): Tournament {
    if (!rawTournament) {
      throw new Error('Tournament data is null or undefined');
    }

    const tournament: Tournament = {
      id: rawTournament.id?.toString() || 'unknown',
      name: rawTournament.name || 'Unknown Tournament',
      slug: rawTournament.slug || 'unknown-tournament',
      url: rawTournament.url || '',
      events: [],
    };

    if (rawTournament.events && Array.isArray(rawTournament.events)) {
      tournament.events = rawTournament.events
        .filter(event => event && event.id)
        .map((event: any) => this.transformBasicEventData(event));
    }

    return tournament;
  }

  private transformBasicEventData(rawEvent: any): TournamentEvent {
    if (!rawEvent || !rawEvent.id) {
      console.warn('Invalid event data:', rawEvent);
      return {
        id: `unknown-event-${Math.random().toString(36).substr(2, 9)}`,
        name: 'Unknown Event',
        slug: 'unknown-event',
        brackets: [],
        participants: [],
        currentMatches: [],
      };
    }

    const event: TournamentEvent = {
      id: rawEvent.id.toString(),
      name: rawEvent.name || 'Unknown Event',
      slug: rawEvent.slug || 'unknown-event',
      brackets: [], // Will be populated later
      participants: [],
      currentMatches: [], // Will be populated later
    };

    // Transform participants
    if (rawEvent.entrants?.nodes && Array.isArray(rawEvent.entrants.nodes)) {
      event.participants = rawEvent.entrants.nodes
        .filter(entrant => entrant && entrant.id)
        .map((entrant: any) => this.transformPlayerData(entrant));
    }

    return event;
  }

  private transformTournamentData(rawTournament: any): Tournament {
    const tournament: Tournament = {
      id: rawTournament.id,
      name: rawTournament.name,
      slug: rawTournament.slug,
      url: rawTournament.url,
      events: [],
    };

    if (rawTournament.events) {
      tournament.events = rawTournament.events.map((event: any) => this.transformEventData(event));
    }

    return tournament;
  }

  private transformEventData(rawEvent: any): TournamentEvent {
    const event: TournamentEvent = {
      id: rawEvent.id,
      name: rawEvent.name,
      slug: rawEvent.slug,
      brackets: [],
      participants: [],
      currentMatches: [],
    };

    // Transform participants
    if (rawEvent.entrants?.nodes) {
      event.participants = rawEvent.entrants.nodes.map((entrant: any) => this.transformPlayerData(entrant));
    }

    // Transform brackets and matches
    if (rawEvent.phaseGroups) {
      event.brackets = rawEvent.phaseGroups.map((phaseGroup: any) => this.transformBracketData(phaseGroup));
      
      // Extract current matches
      event.currentMatches = this.extractCurrentMatches(rawEvent.phaseGroups);
    }

    return event;
  }

  private transformPlayerData(entrant: any): Player {
    if (!entrant || !entrant.id) {
      console.warn('Invalid entrant data:', entrant);
      return {
        id: `unknown-${Math.random().toString(36).substr(2, 9)}`,
        tag: 'Unknown Player',
        name: undefined,
        startggId: undefined,
      };
    }

    const participant = entrant.participants?.[0];
    return {
      id: entrant.id.toString(),
      tag: participant?.gamerTag || entrant.name || 'Unknown Player',
      name: participant?.user?.name,
      startggId: participant?.id?.toString(),
    };
  }

  private transformBracketData(phaseGroup: any): Bracket {
    // Better bracket naming using phase information
    const phaseName = phaseGroup.phase?.name || '';
    const identifier = phaseGroup.displayIdentifier || `Pool ${phaseGroup.id}`;
    const bracketName = phaseName ? `${phaseName} - ${identifier}` : identifier;
    
    const bracket: Bracket = {
      id: phaseGroup.id,
      name: bracketName,
      matches: [],
    };

    if (phaseGroup.sets?.nodes) {
      bracket.matches = phaseGroup.sets.nodes.map((set: any) => this.transformMatchData(set, bracket.name));
    }

    return bracket;
  }

  private transformMatchData(set: any, bracketName: string): Match {
    if (!set || !set.id) {
      console.warn('Invalid set data:', set);
      return {
        id: `invalid-${Math.random().toString(36).substr(2, 9)}`,
        round: 'Unknown Round',
        player1: undefined,
        player2: undefined,
        winner: undefined,
        status: 'pending',
        bracketName: bracketName || 'Unknown Bracket',
      };
    }

    const slots = set.slots || [];
    const player1Data = slots[0]?.entrant;
    const player2Data = slots[1]?.entrant;

    // Extract scores from slots data
    let score: { player1Score: number; player2Score: number } | undefined;
    
    // Debug: log the set data to understand the structure
    if (set.id && Math.random() < 0.1) { // Log 10% of sets for debugging
      console.log('Set data for score extraction:', {
        id: set.id,
        slots: set.slots,
        games: set.games,
        winnerId: set.winnerId
      });
    }
    
    if (set.slots && set.slots.length >= 2) {
      const slot1Score = set.slots[0]?.standing?.stats?.score?.value;
      const slot2Score = set.slots[1]?.standing?.stats?.score?.value;
      
      if (slot1Score !== undefined && slot2Score !== undefined) {
        score = {
          player1Score: parseInt(slot1Score) || 0,
          player2Score: parseInt(slot2Score) || 0
        };
      }
    }
    
    // Fallback: try to determine scores from games if available
    if (!score && set.games && set.games.length > 0) {
      let player1Wins = 0;
      let player2Wins = 0;
      
      set.games.forEach((game: any) => {
        if (game.winnerId === player1Data?.id) {
          player1Wins++;
        } else if (game.winnerId === player2Data?.id) {
          player2Wins++;
        }
      });
      
      if (player1Wins > 0 || player2Wins > 0) {
        score = {
          player1Score: player1Wins,
          player2Score: player2Wins
        };
      }
    }
    
    // Fallback for completed matches without detailed scores
    if (!score && set.state === 3 && set.winnerId) { // 3 = completed
      // If we know there's a winner but no detailed scores, show 1-0
      const player1Won = player1Data?.id === set.winnerId;
      const player2Won = player2Data?.id === set.winnerId;
      
      if (player1Won || player2Won) {
        score = {
          player1Score: player1Won ? 1 : 0,
          player2Score: player2Won ? 1 : 0
        };
      }
    }

    // Find winner based on winnerId
    let winner: Player | undefined;
    if (set.winnerId) {
      if (player1Data?.id === set.winnerId) {
        winner = this.transformPlayerData(player1Data);
      } else if (player2Data?.id === set.winnerId) {
        winner = this.transformPlayerData(player2Data);
      }
    }

    return {
      id: set.id.toString(),
      round: set.fullRoundText || `Round ${set.round || 'Unknown'}`,
      player1: player1Data ? this.transformPlayerData(player1Data) : undefined,
      player2: player2Data ? this.transformPlayerData(player2Data) : undefined,
      winner,
      status: this.getMatchStatus(set.state),
      bracketName: bracketName || 'Unknown Bracket',
      score,
      startedAt: set.startedAt || undefined,
      completedAt: set.completedAt || undefined,
      updatedAt: set.updatedAt || undefined,
      // Debug log when score is included
      ...(score && Math.random() < 0.1 && console.log('Match with score:', { id: set.id, score })),
    };
  }

  private getMatchStatus(state: number): 'pending' | 'in_progress' | 'completed' {
    // start.gg set states: 1 = pending, 2 = started, 3 = completed
    switch (state) {
      case 1: return 'pending';
      case 2: return 'in_progress';
      case 3: return 'completed';
      default: return 'pending';
    }
  }

}

export const startGgApi = new StartGgApi();