export interface Player {
  id: string;
  tag: string;
  name?: string;
  startggId?: string;
  achievements?: Achievement[];
  tournamentHistory?: TournamentEntry[];
  currentTournament?: TournamentProgress;
}

export interface Achievement {
  tournament: string;
  placement: number;
  date: string;
  participants?: number;
}

export interface TournamentEntry {
  name: string;
  date: string;
  placement: number;
  participants: number;
}

export interface TournamentProgress {
  currentRound?: string;
  bracketPath: BracketMatch[];
  opponentHistory: OpponentMatch[];
}

export interface BracketMatch {
  id: string;
  round: string;
  opponent?: Player;
  result?: 'win' | 'loss' | 'pending';
}

export interface OpponentMatch {
  opponent: Player;
  result: 'win' | 'loss';
  round: string;
  notes?: string;
}

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  url: string;
  events: TournamentEvent[];
}

export interface TournamentEvent {
  id: string;
  name: string;
  slug: string;
  brackets: Bracket[];
  participants: Player[];
  currentMatches: Match[];
}

export interface Bracket {
  id: string;
  name: string;
  matches: Match[];
}

export interface Match {
  id: string;
  round: string;
  player1?: Player;
  player2?: Player;
  winner?: Player;
  status: 'pending' | 'in_progress' | 'completed';
  bracketName: string;
  score?: {
    player1Score: number;
    player2Score: number;
  };
  startedAt?: number; // Unix timestamp
  completedAt?: number; // Unix timestamp
  scheduledTime?: number; // Unix timestamp
  updatedAt?: number; // Unix timestamp
}

export interface ApiError {
  message: string;
  source: 'startgg' | 'network';
  timestamp: Date;
}