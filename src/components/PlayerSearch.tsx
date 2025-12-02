import React, { useState, useMemo } from 'react';
import type { Player } from '../types';

interface PlayerSearchProps {
  players: Player[];
  onPlayerSelect: (player: Player | null) => void;
  selectedPlayer?: Player | null;
}

export const PlayerSearch: React.FC<PlayerSearchProps> = ({
  players,
  onPlayerSelect,
  selectedPlayer,
}) => {
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

  const handlePlayerClick = (player: Player) => {
    onPlayerSelect(player);
    setSearchTerm(player.tag || player.name || '');
    setIsDropdownOpen(false);
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
    setSearchTerm('');
    setIsDropdownOpen(false);
    // Notify parent component that selection has been cleared
    onPlayerSelect(null);
  };

  const getPlayerDisplayName = (player: Player) => {
    return player.tag || player.name || 'Unknown Player';
  };

  const getPlayerSubtext = (player: Player) => {
    const parts = [];
    if (player.tournamentHistory?.length) parts.push(`${player.tournamentHistory.length} tournaments`);
    if (player.startggId) parts.push('start.gg verified');
    return parts.join(' • ') || 'Tournament participant';
  };

  return (
    <div className="player-search">
      <label htmlFor="player-search-input">Search Players:</label>
      <div className="search-container">
        <input
          id="player-search-input"
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
                  onClick={() => handlePlayerClick(player)}
                >
                  <div className="player-name">{getPlayerDisplayName(player)}</div>
                  <div className="player-subtext">{getPlayerSubtext(player)}</div>
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

      {selectedPlayer && (
        <div className="selected-player-info">
          <div className="selected-label">Selected:</div>
          <div className="selected-name">{getPlayerDisplayName(selectedPlayer)}</div>
          <button 
            className="clear-selection"
            onClick={clearSelection}
            type="button"
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
};