import React, { useState, useMemo } from 'react';
import { BracketEmbed } from './BracketEmbed';
import type { Tournament, TournamentEvent, Player, Match } from '../types';

interface BracketVisualizationProps {
  tournament?: Tournament;
  selectedEvent?: TournamentEvent;
  players: Player[];
  onPlayerSelect?: (player: Player | null) => void;
}

export const BracketVisualization: React.FC<BracketVisualizationProps> = ({
  tournament,
  selectedEvent,
  players,
  onPlayerSelect,
}) => {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredPlayers = useMemo(() => {
    if (!searchTerm.trim()) return players;
    
    const term = searchTerm.toLowerCase();
    return players.filter(player => 
      (player.tag?.toLowerCase().includes(term)) ||
      (player.name?.toLowerCase().includes(term))
    );
  }, [players, searchTerm]);

  const handlePlayerSelection = (player: Player) => {
    setSelectedPlayer(player);
    setSearchTerm(getPlayerDisplayName(player));
    setIsDropdownOpen(false);
    
    // Future: Could highlight player's matches in the bracket visualization here
    
    onPlayerSelect?.(player);
  };

  const getPlayerStatus = (player: Player): 'active' | 'eliminated' | 'unknown' => {
    if (!selectedEvent || !player) return 'unknown';
    
    // Find player's most recent completed match
    const playerMatches = selectedEvent.brackets
      .flatMap(bracket => bracket.matches)
      .filter(match => 
        (match.player1?.id === player.id || match.player2?.id === player.id) &&
        match.status === 'completed'
      )
      .sort((a, b) => {
        // Sort by round progression (later rounds = higher numbers)
        const roundA = parseInt(a.round.match(/\d+/)?.[0] || '0');
        const roundB = parseInt(b.round.match(/\d+/)?.[0] || '0');
        return roundB - roundA;
      });
    
    if (playerMatches.length === 0) return 'unknown';
    
    const lastMatch = playerMatches[0];
    const playerWonLastMatch = lastMatch.winner?.id === player.id;
    
    // Check if player has any pending/in-progress matches
    const hasPendingMatches = selectedEvent.brackets
      .flatMap(bracket => bracket.matches)
      .some(match => 
        (match.player1?.id === player.id || match.player2?.id === player.id) &&
        (match.status === 'pending' || match.status === 'in_progress')
      );
    
    // If player lost their last match and has no pending matches, they're eliminated
    if (!playerWonLastMatch && !hasPendingMatches) {
      return 'eliminated';
    }
    
    return 'active';
  };

  const sortPlayerPathMatches = (matches: Match[]) => {
    return matches.sort((a, b) => {
      // Primary sort: by completion time (earliest completed first for chronological order)
      if (a.status === 'completed' && b.status === 'completed') {
        const aTime = a.completedAt || a.updatedAt || 0;
        const bTime = b.completedAt || b.updatedAt || 0;
        return aTime - bTime; // Earliest first (chronological order)
      }
      
      // Secondary sort: in-progress matches come after completed but before pending
      if (a.status === 'completed' && b.status !== 'completed') return -1;
      if (b.status === 'completed' && a.status !== 'completed') return 1;
      
      if (a.status === 'in_progress' && b.status === 'pending') return -1;
      if (b.status === 'in_progress' && a.status === 'pending') return 1;
      
      // Tertiary sort: by start time for pending/in-progress
      if (a.status !== 'completed' || b.status !== 'completed') {
        const aTime = a.startedAt || a.updatedAt || 0;
        const bTime = b.startedAt || b.updatedAt || 0;
        if (aTime && bTime) return aTime - bTime; // Earliest start time first
      }
      
      // Fallback: sort by round progression
      const roundA = parseInt(a.round.match(/\d+/)?.[0] || '0');
      const roundB = parseInt(b.round.match(/\d+/)?.[0] || '0');
      return roundA - roundB;
    });
  };

  const sortCurrentMatches = (matches: Match[]) => {
    return matches.sort((a, b) => {
      // Priority: in-progress > pending > recently completed
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
      
      if (a.status === 'pending' && b.status === 'completed') return -1;
      if (b.status === 'pending' && a.status === 'completed') return 1;
      
      // For completed matches, show most recent first
      if (a.status === 'completed' && b.status === 'completed') {
        const aTime = a.completedAt || a.updatedAt || 0;
        const bTime = b.completedAt || b.updatedAt || 0;
        return bTime - aTime; // Most recent first for current matches
      }
      
      // For same status, sort by update time
      const aTime = a.updatedAt || a.startedAt || 0;
      const bTime = b.updatedAt || b.startedAt || 0;
      return bTime - aTime;
    });
  };

  const getPlayerPathMatches = () => {
    if (!selectedPlayer || !selectedEvent) return [];
    
    const playerMatches = selectedEvent.brackets
      .flatMap(bracket => bracket.matches)
      .filter(match => 
        match.player1?.id === selectedPlayer.id || match.player2?.id === selectedPlayer.id
      );
      
    return sortPlayerPathMatches(playerMatches);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsDropdownOpen(true);
  };

  const handleInputFocus = () => {
    setIsDropdownOpen(true);
  };

  const handleInputBlur = () => {
    // Delay closing to allow click events on dropdown items
    setTimeout(() => setIsDropdownOpen(false), 200);
  };

  const clearSelection = () => {
    setSelectedPlayer(null);
    setSearchTerm('');
    setIsDropdownOpen(false);
    onPlayerSelect?.(null);
  };


  const getPlayerDisplayName = (player: Player | undefined) => {
    if (!player) return 'TBD';
    return player.tag || player.name || 'Unknown';
  };

  const formatMatchTime = (match: Match) => {
    const now = Date.now() / 1000; // Convert to Unix timestamp
    
    if (match.status === 'completed' && match.completedAt) {
      const timeDiff = now - match.completedAt;
      if (timeDiff < 300) return 'Just finished'; // Less than 5 minutes
      if (timeDiff < 3600) return `${Math.floor(timeDiff / 60)}m ago`; // Less than 1 hour
      if (timeDiff < 86400) return `${Math.floor(timeDiff / 3600)}h ago`; // Less than 24 hours
      return new Date(match.completedAt * 1000).toLocaleDateString();
    }
    
    if (match.status === 'in_progress' && match.startedAt) {
      const timeDiff = now - match.startedAt;
      if (timeDiff < 3600) return `Started ${Math.floor(timeDiff / 60)}m ago`;
      return `Started ${Math.floor(timeDiff / 3600)}h ago`;
    }
    
    if (match.updatedAt) {
      const timeDiff = now - match.updatedAt;
      if (timeDiff < 300) return 'Just updated';
      if (timeDiff < 3600) return `Updated ${Math.floor(timeDiff / 60)}m ago`;
      return `Updated ${Math.floor(timeDiff / 3600)}h ago`;
    }
    
    return '';
  };

  if (!tournament || !selectedEvent) {
    return (
      <div className="bracket-placeholder">
        <p>Load a tournament to view brackets</p>
      </div>
    );
  }

  return (
    <div className="bracket-visualization">
      <div className="bracket-header">
        <h2>{tournament.name}</h2>
        <h3>{selectedEvent.name}</h3>
        
        <div className="player-selector">
          <label htmlFor="player-path-search">Highlight Player Path:</label>
          <div className="search-container">
            <input
              id="player-path-search"
              type="text"
              placeholder="Type player name or tag..."
              value={searchTerm}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="search-input"
              autoComplete="off"
            />
            
            {searchTerm && (
              <button 
                className="clear-search"
                onClick={clearSelection}
                type="button"
              >
                ✕
              </button>
            )}

            {isDropdownOpen && filteredPlayers.length > 0 && (
              <div className="search-dropdown">
                <div className="dropdown-content">
                  {filteredPlayers.slice(0, 10).map(player => (
                    <div
                      key={player.id}
                      className={`dropdown-item ${selectedPlayer?.id === player.id ? 'selected' : ''}`}
                      onClick={() => handlePlayerSelection(player)}
                    >
                      <div className="player-name">{getPlayerDisplayName(player)}</div>
                    </div>
                  ))}
                  
                  {filteredPlayers.length > 10 && (
                    <div className="dropdown-more">
                      +{filteredPlayers.length - 10} more results
                    </div>
                  )}
                </div>
              </div>
            )}

            {isDropdownOpen && searchTerm && filteredPlayers.length === 0 && (
              <div className="search-dropdown">
                <div className="dropdown-content">
                  <div className="dropdown-item no-results">
                    No players found matching "{searchTerm}"
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="current-matches">
        <h4>Current Matches</h4>
        {selectedEvent.currentMatches.length > 0 ? (
          <div className="current-matches-grid">
            {sortCurrentMatches(selectedEvent.currentMatches).map(match => {
              const playerWon = match.status === 'completed' && match.winner;
              const player1Won = playerWon && match.winner?.id === match.player1?.id;
              const player2Won = playerWon && match.winner?.id === match.player2?.id;
              
              // Determine scores for display
              let player1Score = 0;
              let player2Score = 0;
              if (match.score) {
                player1Score = match.score.player1Score;
                player2Score = match.score.player2Score;
              }
              
              return (
                <div key={match.id} className={`current-match-card ${match.status} ${
                  match.status === 'completed' ? 'match-completed' : 
                  match.status === 'in_progress' ? 'match-active' : 'match-pending'
                }`}>
                  <div className="match-card-header">
                    <div className="match-context">
                      <div className="bracket-name">{match.bracketName}</div>
                      <div className="round-name">{match.round}</div>
                    </div>
                    <div className="match-status-badge">
                      {match.status === 'in_progress' ? '⚡ Live' : 
                       match.status === 'completed' ? '✅ Complete' : 
                       '⏳ Upcoming'}
                    </div>
                  </div>
                  
                  {formatMatchTime(match) && (
                    <div className="match-timestamp">
                      {formatMatchTime(match)}
                    </div>
                  )}
                  
                  <div className="match-card-content">
                    <div className="match-contestants">
                      <div className={`contestant ${player1Won ? 'winner' : player2Won ? 'loser' : ''}`}>
                        <div className="player-name">{getPlayerDisplayName(match.player1)}</div>
                        {match.score && (
                          <div className="player-score-detail">
                            <span className="score-number">{player1Score}</span>
                            {match.status === 'completed' && player1Won && (
                              <span className="winner-indicator">🏆</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="vs-divider">
                        {match.score !== undefined ? (
                          <div className="score-display">
                            <span className="score-label">Score:</span>
                            <span className="score-numbers">{player1Score} - {player2Score}</span>
                          </div>
                        ) : (
                          <div className="vs-text">vs</div>
                        )}
                      </div>
                      
                      <div className={`contestant ${player2Won ? 'winner' : player1Won ? 'loser' : ''}`}>
                        <div className="player-name">{getPlayerDisplayName(match.player2)}</div>
                        {match.score && (
                          <div className="player-score-detail">
                            <span className="score-number">{player2Score}</span>
                            {match.status === 'completed' && player2Won && (
                              <span className="winner-indicator">🏆</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {match.status === 'completed' && match.winner && (
                      <div className="match-winner">
                        🏆 Winner: <strong>{getPlayerDisplayName(match.winner)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-current-matches">
            <p>No matches currently in progress</p>
            <span className="no-matches-subtitle">Check back later for live matches</span>
          </div>
        )}
      </div>

      {selectedPlayer ? (
        <div className="player-path-focused">
          <div className="player-path-header">
            <h4>Tournament Path for {getPlayerDisplayName(selectedPlayer)}</h4>
            <div className={`player-status status-${getPlayerStatus(selectedPlayer)}`}>
              {getPlayerStatus(selectedPlayer) === 'eliminated' ? '❌ Eliminated' : 
               getPlayerStatus(selectedPlayer) === 'active' ? '✅ Still Active' : 
               '❓ Status Unknown'}
            </div>
          </div>
          
          <div className="path-timeline">
            {getPlayerPathMatches().map((match, index) => {
              const opponent = match.player1?.id === selectedPlayer.id ? match.player2 : match.player1;
              const playerWon = match.winner?.id === selectedPlayer.id;
              const playerLost = match.winner && match.winner.id !== selectedPlayer.id;
              const isPlayerFirst = match.player1?.id === selectedPlayer.id;
              
              // Determine scores for display
              let playerScore = 0;
              let opponentScore = 0;
              if (match.score) {
                if (isPlayerFirst) {
                  playerScore = match.score.player1Score;
                  opponentScore = match.score.player2Score;
                } else {
                  playerScore = match.score.player2Score;
                  opponentScore = match.score.player1Score;
                }
              }
              
              return (
                <div key={match.id} className={`path-match-card ${match.status} ${
                  match.status === 'completed' ? 
                    (playerWon ? 'result-won' : playerLost ? 'result-lost' : 'result-unknown') : 
                    ''
                }`}>
                  <div className="match-card-header">
                    <div className="match-number">Match #{index + 1}</div>
                    <div className="match-status-badge">
                      {match.status === 'completed' ? 
                        (playerWon ? '🏆 WON' : playerLost ? '💀 LOST' : '❓ Unknown') : 
                       match.status === 'in_progress' ? '⚡ In Progress' : 
                       '⏳ Pending'}
                    </div>
                  </div>
                  
                  <div className="match-card-content">
                    <div className="match-context">
                      <div className="bracket-name">{match.bracketName}</div>
                      <div className="round-name">{match.round}</div>
                    </div>
                    
                    <div className="match-contestants">
                      <div className={`contestant player-contestant ${playerWon ? 'winner' : playerLost ? 'loser' : ''}`}>
                        <div className="player-name">{getPlayerDisplayName(selectedPlayer)}</div>
                        {match.score && (
                          <div className="player-score-detail">
                            <span className="score-number">{playerScore}</span>
                            {match.status === 'completed' && playerWon && (
                              <span className="winner-indicator">🏆</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="vs-divider">
                        {match.score !== undefined ? (
                          <div className="score-display">
                            <span className="score-label">Score:</span>
                            <span className="score-numbers">{playerScore} - {opponentScore}</span>
                          </div>
                        ) : (
                          <div className="vs-text">vs</div>
                        )}
                      </div>
                      
                      <div className={`contestant opponent-contestant ${
                        playerLost ? 'winner' : playerWon ? 'loser' : ''
                      }`}>
                        <div className="player-name">{getPlayerDisplayName(opponent)}</div>
                        {match.score && (
                          <div className="player-score-detail">
                            <span className="score-number">{opponentScore}</span>
                            {match.status === 'completed' && playerLost && (
                              <span className="winner-indicator">🏆</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {formatMatchTime(match) && (
                      <div className="match-timestamp">
                        {formatMatchTime(match)}
                      </div>
                    )}
                  </div>
                  
                  {index < getPlayerPathMatches().length - 1 && match.status === 'completed' && playerWon && (
                    <div className="path-progression">
                      <div className="progression-line"></div>
                      <div className="progression-arrow">↓</div>
                      <div className="progression-text">Advanced to next round</div>
                    </div>
                  )}
                  
                  {match.status === 'completed' && playerLost && (
                    <div className="elimination-card">
                      <div className="elimination-icon">🚫</div>
                      <div className="elimination-text">
                        <strong>{getPlayerDisplayName(selectedPlayer)} Eliminated</strong>
                        <p>Knocked out in {match.round} by {getPlayerDisplayName(opponent)}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {getPlayerPathMatches().length === 0 && (
            <div className="no-matches">
              No matches found for this player yet.
            </div>
          )}
        </div>
      ) : (
        <>
          <BracketEmbed 
            event={selectedEvent} 
            onPlayerSelect={handlePlayerSelection}
          />
          
          <div className="brackets-container-collapsed">
            <div className="brackets-summary">
              <h4>Tournament Brackets Overview</h4>
              <p>Select a player above to see their detailed tournament path or interact with the bracket visualization above</p>
              
              <div className="brackets-list">
                {selectedEvent.brackets.map(bracket => (
                  <div key={bracket.id} className="bracket-summary">
                    <h5>{bracket.name}</h5>
                    <span className="match-count">{bracket.matches.length} matches</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};