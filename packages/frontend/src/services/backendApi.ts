import axios from 'axios';
import type { TournamentResponse } from '@commentary/shared';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

class BackendApi {
  private axiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: BACKEND_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minutes timeout for large tournaments
    });
  }

  /**
   * Get tournament data from BFF (uses smart caching)
   * @param slug - Tournament slug
   * @param refresh - Force cache bypass
   */
  async getTournamentBySlug(slug: string, refresh: boolean = false): Promise<TournamentResponse> {
    try {
      const response = await this.axiosInstance.get<TournamentResponse>(
        `/api/tournament/${slug}`,
        {
          params: refresh ? { refresh: 'true' } : {}
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error || error.message;

        if (status === 404) {
          throw new Error(`Tournament "${slug}" not found`);
        }

        if (status === 500) {
          throw new Error(`Backend error: ${message}`);
        }

        if (status === 503) {
          throw new Error('Backend service unavailable. Please try again later.');
        }

        throw new Error(`API Error: ${message} (Status: ${status || 'Unknown'})`);
      }

      throw error;
    }
  }

  /**
   * Explicitly refresh tournament data (bust cache)
   */
  async refreshTournament(slug: string): Promise<TournamentResponse> {
    try {
      const response = await this.axiosInstance.post<TournamentResponse>(
        `/api/tournament/${slug}/refresh`
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new Error(`Refresh failed: ${message}`);
      }
      throw error;
    }
  }

  /**
   * Check cache status for a tournament
   */
  async getCacheStatus(slug: string): Promise<{ cached: boolean; metadata: any }> {
    try {
      const response = await this.axiosInstance.get(
        `/api/tournament/${slug}/cache-status`
      );
      return response.data;
    } catch (error) {
      console.warn('Failed to get cache status:', error);
      return { cached: false, metadata: null };
    }
  }

  /**
   * Extract slug from URL
   */
  extractSlugFromUrl(url: string): string {
    const match = url.match(/\/tournament\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid start.gg URL format');
    }
    return match[1];
  }

  /**
   * Get tournament by URL (convenience method)
   */
  async getTournamentByUrl(url: string, refresh: boolean = false): Promise<TournamentResponse> {
    const slug = this.extractSlugFromUrl(url);
    return this.getTournamentBySlug(slug, refresh);
  }
}

export const backendApi = new BackendApi();
