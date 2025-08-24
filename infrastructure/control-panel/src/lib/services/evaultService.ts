import type { EVault } from '../../routes/api/evaults/+server';
import { cacheService } from './cacheService';

export class EVaultService {
  /**
   * Get eVaults with stale-while-revalidate caching
   * Returns cached data immediately, refreshes in background if stale
   */
  static async getEVaults(): Promise<EVault[]> {
    // In browser, always fetch from server since caching doesn't work here
    if (typeof window !== 'undefined') {
      return this.fetchEVaultsDirectly();
    }
    
    // On server, use caching
    const isStale = await cacheService.isCacheStale();
    
    if (isStale) {
      // Cache is stale, refresh in background
      this.refreshCacheInBackground();
    }
    
    // Return cached data immediately (even if stale)
    return await cacheService.getCachedEVaults();
  }

  /**
   * Force refresh the cache with fresh data
   */
  static async forceRefresh(): Promise<EVault[]> {
    const evaults = await this.fetchEVaultsDirectly();
    await cacheService.updateCache(evaults);
    return evaults;
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
   * Refresh cache in background (non-blocking)
   */
  private static async refreshCacheInBackground(): Promise<void> {
    try {
      const evaults = await this.fetchEVaultsDirectly();
      await cacheService.updateCache(evaults);
    } catch (error) {
      console.error('Background cache refresh failed:', error);
      // Mark cache as stale so next request will try again
      await cacheService.markStale();
    }
  }

  /**
   * Fetch eVaults directly from Kubernetes API
   */
  private static async fetchEVaultsDirectly(): Promise<EVault[]> {
    try {
      const response = await fetch('/api/evaults');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch eVaults:', error);
      throw error;
    }
  }
}
