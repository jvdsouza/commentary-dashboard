import React from 'react';
import type { Player } from '../types';

interface PlayerInfoProps {
  player: Player;
  detailed?: boolean;
}

export const PlayerInfo: React.FC<PlayerInfoProps> = ({ player, detailed = false }) => {
  const getPlayerDisplayName = () => {
    return player.tag || player.name || 'Unknown Player';
  };

  const getPerformanceTrend = () => {
    // Since we don't have ELO data, analyze tournament performance
    if (!player.tournamentHistory || player.tournamentHistory.length < 2) {
      return { trend: 'stable', info: 'Limited data' };
    }

    const recent = player.tournamentHistory.slice(-3);
    const older = player.tournamentHistory.slice(0, -3);
    
    if (recent.length === 0 || older.length === 0) {
      return { trend: 'stable', info: 'Limited data' };
    }

    const recentAvg = recent.reduce((sum, t) => sum + t.placement, 0) / recent.length;
    const olderAvg = older.reduce((sum, t) => sum + t.placement, 0) / older.length;
    
    if (recentAvg < olderAvg * 0.8) {
      return { trend: 'up', info: 'Improving placements' };
    } else if (recentAvg > olderAvg * 1.2) {
      return { trend: 'down', info: 'Recent struggles' };
    }
    
    return { trend: 'stable', info: 'Consistent performance' };
  };

  const getRecentAchievements = () => {
    if (!player.tournamentHistory) return [];
    
    return player.tournamentHistory
      .filter(t => t.placement <= 8) // Top 8 placements only
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5); // Most recent 5
  };

  const performanceTrend = getPerformanceTrend();
  const recentAchievements = getRecentAchievements();

  return (
    <div className="player-info">
      <div className="player-header">
        <h3 className="player-name">{getPlayerDisplayName()}</h3>
        <div className="player-performance">
          <span className={`performance-trend performance-trend-${performanceTrend.trend}`}>
            {performanceTrend.info}
          </span>
        </div>
      </div>

      {detailed && (
        <>
          <div className="player-stats">
            <div className="stat-item">
              <label>Tournament Count:</label>
              <span>{player.tournamentHistory?.length || 0}</span>
            </div>
            
            {player.startggId && (
              <div className="stat-item">
                <label>Start.gg ID:</label>
                <span>{player.startggId}</span>
              </div>
            )}
          </div>

          {recentAchievements.length > 0 && (
            <div className="achievements">
              <h4>Recent Achievements</h4>
              <ul className="achievements-list">
                {recentAchievements.map((achievement, index) => (
                  <li key={index} className="achievement-item">
                    <div className="achievement-placement">
                      {achievement.placement === 1 ? '🥇' : 
                       achievement.placement === 2 ? '🥈' : 
                       achievement.placement === 3 ? '🥉' : 
                       `#${achievement.placement}`}
                    </div>
                    <div className="achievement-details">
                      <div className="tournament-name">{achievement.name}</div>
                      <div className="tournament-meta">
                        {achievement.participants > 0 && (
                          <span>{achievement.participants} entrants</span>
                        )}
                        <span>{new Date(achievement.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {player.tournamentHistory && player.tournamentHistory.length > 1 && (
            <div className="tournament-history">
              <h4>Recent Tournament History</h4>
              <div className="history-chart">
                {player.tournamentHistory.slice(-5).map((tournament, index) => (
                  <div key={index} className="tournament-entry">
                    <div className="tournament-date">
                      {new Date(tournament.date).toLocaleDateString()}
                    </div>
                    <div className="tournament-name-short">
                      {tournament.name.length > 20 ? tournament.name.substring(0, 20) + '...' : tournament.name}
                    </div>
                    <div className="placement-badge">
                      #{tournament.placement}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {player.currentTournament?.opponentHistory && (
            <div className="opponent-history">
              <h4>Tournament Matches</h4>
              <ul className="opponent-list">
                {player.currentTournament.opponentHistory.map((match, index) => (
                  <li key={index} className={`opponent-match ${match.result}`}>
                    <div className="match-round">{match.round}</div>
                    <div className="opponent-name">
                      vs {match.opponent.tag || match.opponent.name}
                    </div>
                    <div className="match-result">
                      {match.result === 'win' ? 'W' : 'L'}
                    </div>
                    {match.notes && (
                      <div className="match-notes">{match.notes}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};