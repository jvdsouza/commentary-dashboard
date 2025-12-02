import { useState, useEffect, useCallback } from 'react';
import type { Tournament, TournamentEvent, Player, ApiError } from '../types';
import { tournamentService } from '../services/tournamentService';

interface TournamentData {
  tournament?: Tournament;
  selectedEvent?: TournamentEvent;
  players: Player[];
  majorContenders: Player[];
  newContenders: Player[];
  improving: Player[];
  loading: boolean;
  error?: ApiError;
  loadingProgress?: {
    phase: string;
    bracket?: string;
    matches: number;
    total: number;
  };
}

export const useTournamentData = () => {
  const [data, setData] = useState<TournamentData>({
    players: [],
    majorContenders: [],
    newContenders: [],
    improving: [],
    loading: false,
  });

  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Set up error handler
    const handleError = (error: ApiError) => {
      setData(prev => ({ ...prev, error, loading: false }));
    };

    tournamentService.addErrorHandler(handleError);

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  const loadTournament = useCallback(async (url: string, eventName?: string) => {
    setData(prev => ({ ...prev, loading: true, error: undefined, loadingProgress: undefined }));

    try {
      const result = await tournamentService.loadTournamentFromUrl(
        url, 
        eventName, 
        // Progress callback
        (progress) => {
          setData(prev => ({ ...prev, loadingProgress: progress }));
        },
        // Bracket completion callback - update UI immediately as each bracket loads
        (tournament, selectedEvent, players) => {
          if (tournament && selectedEvent && players) {
            const categorized = tournamentService.categorizePlayersByStatus(players);
            
            setData(prev => ({
              ...prev,
              tournament,
              selectedEvent,
              players,
              majorContenders: categorized.majorContenders,
              newContenders: categorized.newContenders,
              improving: categorized.improving,
              // Keep loading true until all brackets are done
            }));
          }
        }
      );
      
      // Final update when everything is complete
      const categorized = tournamentService.categorizePlayersByStatus(result.players);
      setData({
        tournament: result.tournament,
        selectedEvent: result.selectedEvent,
        players: result.players,
        majorContenders: categorized.majorContenders,
        newContenders: categorized.newContenders,
        improving: categorized.improving,
        loading: false,
        loadingProgress: undefined,
      });
    } catch (error) {
      // Error is handled by the error handler
      console.error('Failed to load tournament:', error);
    }
  }, []);

  const refreshData = useCallback(async () => {
    if (!data.tournament) return;

    try {
      // Re-fetch current tournament data
      const tournamentUrl = `https://www.start.gg/tournament/${data.tournament.slug}`;
      const eventName = data.selectedEvent?.name;
      
      const result = await tournamentService.loadTournamentFromUrl(
        tournamentUrl, 
        eventName, 
        // Progress callback
        (progress) => {
          setData(prev => ({ ...prev, loadingProgress: progress }));
        },
        // Bracket completion callback - update UI immediately during refresh
        (tournament, selectedEvent, players) => {
          if (tournament && selectedEvent && players) {
            const categorized = tournamentService.categorizePlayersByStatus(players);
            
            setData(prev => ({
              ...prev,
              tournament,
              selectedEvent,
              players,
              majorContenders: categorized.majorContenders,
              newContenders: categorized.newContenders,
              improving: categorized.improving,
            }));
          }
        }
      );
      
      const categorized = tournamentService.categorizePlayersByStatus(result.players);

      setData(prev => ({
        ...prev,
        tournament: result.tournament,
        selectedEvent: result.selectedEvent,
        players: result.players,
        majorContenders: categorized.majorContenders,
        newContenders: categorized.newContenders,
        improving: categorized.improving,
        error: undefined,
        loadingProgress: undefined,
      }));
    } catch (error) {
      console.warn('Failed to refresh tournament data:', error);
    }
  }, [data.tournament, data.selectedEvent]);

  const startAutoRefresh = useCallback(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    // Refresh every 30 seconds as per requirements
    const interval = setInterval(refreshData, 30000);
    setRefreshInterval(interval);
  }, [refreshData, refreshInterval]);

  const stopAutoRefresh = useCallback(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [refreshInterval]);

  const clearError = useCallback(() => {
    setData(prev => ({ ...prev, error: undefined }));
  }, []);

  return {
    ...data,
    loadTournament,
    refreshData,
    startAutoRefresh,
    stopAutoRefresh,
    clearError,
  };
};

export default useTournamentData;