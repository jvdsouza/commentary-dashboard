import React, { useState } from 'react';
import type { TournamentEvent, Match, Player } from '../types';

interface BracketEmbedProps {
  event: TournamentEvent;
  onPlayerSelect?: (player: Player | null) => void;
}

export const BracketEmbed: React.FC<BracketEmbedProps> = ({
  event,
  onPlayerSelect,
}) => {
  const [selectedBracket, setSelectedBracket] = useState<string>('');

  const getPlayerDisplayName = (player: Player | undefined) => {
    if (!player) return 'TBD';
    return player.tag || player.name || 'Unknown';
  };

  const handlePlayerClick = (player: Player | undefined) => {
    if (player) {
      onPlayerSelect?.(player);
    }
  };

  const renderMatch = (match: Match, isHighlighted = false) => {
    const player1Won = match.winner?.id === match.player1?.id;
    const player2Won = match.winner?.id === match.player2?.id;
    
    // Show score if available, or show status for matches without scores
    const hasScore = match.score && (match.score.player1Score !== undefined && match.score.player2Score !== undefined);
    
    return (
      <div
        key={match.id}
        className={`bracket-match ${match.status} ${isHighlighted ? 'highlighted' : ''}`}
      >
        <div className="match-header">
          {hasScore ? (
            <span className="match-score">
              {match.score.player1Score} - {match.score.player2Score}
            </span>
          ) : (
            <span className="match-status-text">
              {match.status === 'completed' ? 'Completed' : 
               match.status === 'in_progress' ? 'In Progress' : 
               'Upcoming'}
            </span>
          )}
        </div>
        
        <div className="match-players">
          <div 
            className={`player-slot ${player1Won ? 'winner' : player2Won ? 'loser' : ''}`}
            onClick={() => handlePlayerClick(match.player1)}
          >
            <span className="player-name">{getPlayerDisplayName(match.player1)}</span>
            {hasScore && (
              <span className="player-score">{match.score.player1Score}</span>
            )}
          </div>
          
          <div 
            className={`player-slot ${player2Won ? 'winner' : player1Won ? 'loser' : ''}`}
            onClick={() => handlePlayerClick(match.player2)}
          >
            <span className="player-name">{getPlayerDisplayName(match.player2)}</span>
            {hasScore && (
              <span className="player-score">{match.score.player2Score}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const organizeMatchesByRound = (matches: Match[]) => {
    const rounds = new Map<string, Match[]>();
    
    matches.forEach(match => {
      const roundKey = match.round;
      if (!rounds.has(roundKey)) {
        rounds.set(roundKey, []);
      }
      rounds.get(roundKey)!.push(match);
    });
    
    return Array.from(rounds.entries()).sort((a, b) => {
      // Sort rounds by progression (earlier rounds first)
      const roundA = parseInt(a[0].match(/(\d+)/)?.[1] || '0');
      const roundB = parseInt(b[0].match(/(\d+)/)?.[1] || '0');
      return roundA - roundB;
    });
  };

  const selectedBracketData = selectedBracket 
    ? event.brackets.find(b => b.id === selectedBracket)
    : event.brackets[0];

  if (!selectedBracketData) {
    return (
      <div className="bracket-embed">
        <div className="no-bracket">
          <p>No bracket data available</p>
        </div>
      </div>
    );
  }

  const roundsData = organizeMatchesByRound(selectedBracketData.matches);

  return (
    <div className="bracket-embed">
      <div className="bracket-header">
        <h3>Tournament Bracket</h3>
        
        {event.brackets.length > 1 && (
          <div className="bracket-selector">
            <label htmlFor="bracket-select">Bracket:</label>
            <select
              id="bracket-select"
              value={selectedBracket || event.brackets[0]?.id}
              onChange={(e) => setSelectedBracket(e.target.value)}
            >
              {event.brackets.map(bracket => (
                <option key={bracket.id} value={bracket.id}>
                  {bracket.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="bracket-grid">
        {roundsData.map(([roundName, matches]) => (
          <div key={roundName} className="bracket-round">
            <div className="round-header">
              <h4>{roundName}</h4>
              <span className="match-count">({matches.length} matches)</span>
            </div>
            
            <div className="round-matches">
              {matches.map(match => renderMatch(match))}
            </div>
          </div>
        ))}
      </div>
      
      {roundsData.length === 0 && (
        <div className="no-matches">
          <p>No matches available for this bracket</p>
        </div>
      )}
    </div>
  );
};