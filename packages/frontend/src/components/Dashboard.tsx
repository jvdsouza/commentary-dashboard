import React, { useState, useEffect } from 'react';
import { BracketVisualization } from './BracketVisualization';
import { PlayerInfo } from './PlayerInfo';
import { PlayerSearch } from './PlayerSearch';
import { ErrorDisplay } from './ErrorDisplay';
import { useTournamentData } from '../hooks/useTournamentData';
import type { Player } from '@commentary/shared';

export const Dashboard: React.FC = () => {
  // Initialize state from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const [tournamentUrl, setTournamentUrl] = useState(urlParams.get('tournament') || '');
  const [eventName, setEventName] = useState(urlParams.get('event') || '');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  
  const {
    tournament,
    selectedEvent,
    players,
    majorContenders,
    newContenders,
    improving,
    loading,
    error,
    loadingProgress,
    loadTournament,
    refreshData,
    startAutoRefresh,
    stopAutoRefresh,
    clearError,
  } = useTournamentData();

  // Update URL parameters when state changes
  const updateUrlParams = (newTournamentUrl: string, newEventName: string) => {
    const params = new URLSearchParams();
    if (newTournamentUrl.trim()) {
      params.set('tournament', newTournamentUrl.trim());
    }
    if (newEventName.trim()) {
      params.set('event', newEventName.trim());
    }
    
    const newUrl = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    
    window.history.pushState({}, '', newUrl);
  };

  const handleLoadTournament = async () => {
    if (!tournamentUrl.trim()) return;
    
    // Update URL with current parameters
    updateUrlParams(tournamentUrl, eventName);
    
    await loadTournament(tournamentUrl.trim(), eventName.trim() || undefined);
  };

  const handleRefresh = async () => {
    await refreshData(true); // Force cache bust
  };

  const toggleAutoRefresh = () => {
    if (autoRefreshEnabled) {
      stopAutoRefresh();
      setAutoRefreshEnabled(false);
    } else {
      startAutoRefresh();
      setAutoRefreshEnabled(true);
    }
  };

  const handlePlayerSelect = (player: Player | null) => {
    setSelectedPlayer(player);
  };

  // Load tournament from URL parameters on mount and handle browser navigation
  useEffect(() => {
    const loadFromUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTournament = urlParams.get('tournament');
      const urlEvent = urlParams.get('event');
      
      // Update input fields to match URL
      setTournamentUrl(urlTournament || '');
      setEventName(urlEvent || '');
      
      if (urlTournament && urlTournament.trim()) {
        // Auto-load tournament if URL parameters are present
        loadTournament(urlTournament.trim(), urlEvent?.trim() || undefined);
      }
    };
    
    // Load on mount
    loadFromUrl();
    
    // Handle browser back/forward buttons
    const handlePopState = () => {
      loadFromUrl();
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []); // Empty dependency array - only run on mount

  // Handle input changes and update URL
  const handleTournamentUrlChange = (value: string) => {
    setTournamentUrl(value);
  };

  const handleEventNameChange = (value: string) => {
    setEventName(value);
  };

  const clearTournament = () => {
    setTournamentUrl('');
    setEventName('');
    setSelectedPlayer(null);
    stopAutoRefresh();
    setAutoRefreshEnabled(false);
    
    // Clear URL parameters
    window.history.pushState({}, '', window.location.pathname);
  };

  // Auto-refresh indicator
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (autoRefreshEnabled && tournament) {
      interval = setInterval(() => {
        // Visual indicator that refresh is happening
        const indicator = document.getElementById('refresh-indicator');
        if (indicator) {
          indicator.style.opacity = '1';
          setTimeout(() => {
            if (indicator) indicator.style.opacity = '0.3';
          }, 1000);
        }
      }, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefreshEnabled, tournament]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Esports Commentary Dashboard</h1>
        
        <div className="tournament-loader">
          <div className="url-input-group">
            <input
              type="text"
              placeholder="Tournament URL (e.g., https://www.start.gg/tournament/manila-madness-4/details)"
              value={tournamentUrl}
              onChange={(e) => handleTournamentUrlChange(e.target.value)}
              className="url-input"
            />
            <input
              type="text"
              placeholder="Event name (optional)"
              value={eventName}
              onChange={(e) => handleEventNameChange(e.target.value)}
              className="event-input"
            />
            <button
              onClick={handleLoadTournament}
              disabled={loading || !tournamentUrl.trim()}
              className="load-button"
            >
              {loading ? 'Loading...' : 'Load Tournament'}
            </button>
          </div>
        </div>

        {tournament && (
          <div className="dashboard-controls">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="refresh-button"
              title="Force fresh data fetch (bypasses cache)"
            >
              🔄 Force Refresh
            </button>
            <button
              onClick={toggleAutoRefresh}
              className={`auto-refresh-button ${autoRefreshEnabled ? 'active' : ''}`}
            >
              {autoRefreshEnabled ? 'Stop Auto-Refresh' : 'Start Auto-Refresh (30s)'}
            </button>
            <button
              onClick={clearTournament}
              className="clear-tournament-button"
            >
              Clear Tournament
            </button>
            <div id="refresh-indicator" className="refresh-indicator">
              🔄
            </div>
          </div>
        )}
      </header>

      {loading && loadingProgress && (
        <div className="loading-progress">
          <div className="progress-content">
            <h3>Loading Tournament Data...</h3>
            <div className="progress-info">
              <span className="progress-phase">
                {loadingProgress.phase === 'structure' ? '📋 Loading bracket structure...' :
                 loadingProgress.phase === 'loading' ? `⚡ Loading matches${loadingProgress.bracket ? ` for ${loadingProgress.bracket}` : ''}...` :
                 '🔄 Loading...'}
              </span>
              <div className="progress-stats">
                {loadingProgress.matches > 0 && (
                  <span>{loadingProgress.matches} matches loaded from {loadingProgress.total} brackets</span>
                )}
              </div>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: loadingProgress.phase === 'structure' ? '15%' :
                           loadingProgress.total > 0 && loadingProgress.matches > 0 
                             ? `${Math.min(95, 15 + (loadingProgress.matches / Math.max(loadingProgress.total * 12, 1)) * 80)}%` 
                             : '15%'
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <ErrorDisplay error={error} onDismiss={clearError} />
      )}

      {tournament && (
        <div className="dashboard-content">
          <div className="main-content">
            <BracketVisualization
              tournament={tournament}
              selectedEvent={selectedEvent}
              players={players}
              onPlayerSelect={handlePlayerSelect}
            />
          </div>

          <div className="sidebar">
            <div className="player-search-section">
              <PlayerSearch
                players={players}
                onPlayerSelect={handlePlayerSelect}
                selectedPlayer={selectedPlayer}
              />
            </div>

            {selectedPlayer && (
              <div className="selected-player-section">
                <h3>Selected Player</h3>
                <PlayerInfo player={selectedPlayer} detailed={true} />
              </div>
            )}

            <div className="player-categories">
              <div className="category">
                <h3>Major Contenders ({majorContenders.length})</h3>
                <div className="player-list">
                  {majorContenders.slice(0, 5).map(player => (
                    <div
                      key={player.id}
                      className="player-item clickable"
                      onClick={() => handlePlayerSelect(player)}
                    >
                      <PlayerInfo player={player} />
                    </div>
                  ))}
                  {majorContenders.length > 5 && (
                    <div className="more-players">
                      +{majorContenders.length - 5} more
                    </div>
                  )}
                </div>
              </div>

              <div className="category">
                <h3>New Contenders ({newContenders.length})</h3>
                <div className="player-list">
                  {newContenders.slice(0, 5).map(player => (
                    <div
                      key={player.id}
                      className="player-item clickable"
                      onClick={() => handlePlayerSelect(player)}
                    >
                      <PlayerInfo player={player} />
                    </div>
                  ))}
                  {newContenders.length > 5 && (
                    <div className="more-players">
                      +{newContenders.length - 5} more
                    </div>
                  )}
                </div>
              </div>

              <div className="category">
                <h3>Improving Players ({improving.length})</h3>
                <div className="player-list">
                  {improving.slice(0, 5).map(player => (
                    <div
                      key={player.id}
                      className="player-item clickable"
                      onClick={() => handlePlayerSelect(player)}
                    >
                      <PlayerInfo player={player} />
                    </div>
                  ))}
                  {improving.length > 5 && (
                    <div className="more-players">
                      +{improving.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!tournament && !loading && (
        <div className="welcome-message">
          <h2>Welcome to the Commentary Dashboard</h2>
          <p>Enter a start.gg tournament URL above to get started</p>
          <div className="example-urls">
            <h4>Example URLs:</h4>
            <ul>
              <li>https://www.start.gg/tournament/manila-madness-4/details</li>
              <li>https://www.start.gg/tournament/manila-madness-4/event/tekken-8-twt-challenger-event</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};