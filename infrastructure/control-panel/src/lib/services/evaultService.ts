import type { EVault } from '../../routes/api/evaults/+server';
import { cacheService } from './cacheService';

export class EVaultService {
  /**
   * Get eVaults - load from cache first, then fetch fresh data
   */
  static async getEVaults(): Promise<EVault[]> {
    // First, try to get cached data (fast)
    let cachedData: EVault[] = [];
    try {
      cachedData = await cacheService.getCachedEVaults();
    } catch (error) {
      console.log('No cached data available');
    }

    // Fire off fresh request in background (don't wait for it)
    this.fetchFreshDataInBackground();

    // Return cached data immediately (even if empty)
    return cachedData;
  }

  /**
   * Force refresh - get fresh data and update cache
   */
  static async forceRefresh(): Promise<EVault[]> {
    const freshData = await this.fetchEVaultsDirectly();
    await cacheService.updateCache(freshData);
    return freshData;
  }

  /**
   * Get cache status information
   */
  static getCacheStatus() {
    return cacheService.getCacheStatus();
  }

  /**
   * Clear the cache
   */
  static async clearCache(): Promise<void> {
    await cacheService.clearCache();
  }

  /**
   * Fetch fresh data in background and update cache
   */
  private static async fetchFreshDataInBackground(): Promise<void> {
    try {
      const freshData = await this.fetchEVaultsDirectly();
      await cacheService.updateCache(freshData);
    } catch (error) {
      console.error('Background refresh failed:', error);
    }
  }

  /**
   * Fetch eVaults directly from API
   */
  private static async fetchEVaultsDirectly(): Promise<EVault[]> {
    try {
      const response = await fetch('/api/evaults');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // The backend returns { evaults: [...] }
      return data.evaults || [];
    } catch (error) {
      console.error('Failed to fetch eVaults:', error);
      throw error;
    }
  }
}
