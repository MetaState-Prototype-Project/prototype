import type { EVault } from '../../routes/api/evaults/+server';
import { cacheService } from './cacheService';

export class EVaultService {
	/**
	 * Get eVaults with stale-while-revalidate pattern:
	 * 1. Return cached data immediately (fast)
	 * 2. Fetch fresh data in background
	 * 3. Update cache for next request
	 */
	static async getEVaults(): Promise<EVault[]> {
		try {
			// 1. Get cached data immediately (fast response)
			const cachedEVaults = await cacheService.getCachedEVaults();
			
			// 2. Check if we need to refresh in background
			if (cacheService.isCacheStale()) {
				// Fire and forget - fetch fresh data in background
				this.refreshCacheInBackground();
			}
			
			// 3. Return cached data immediately
			return cachedEVaults;
		} catch (error) {
			console.error('Error getting cached eVaults:', error);
			// Fallback to direct API call if cache fails
			return this.fetchEVaultsDirectly();
		}
	}

	/**
	 * Fetch fresh eVaults from API and update cache
	 * This runs in the background to avoid blocking the UI
	 */
	private static async refreshCacheInBackground(): Promise<void> {
		try {
			console.log('🔄 Refreshing eVault cache in background...');
			const freshEVaults = await this.fetchEVaultsDirectly();
			await cacheService.updateCache(freshEVaults);
			console.log('✅ Cache refreshed successfully');
		} catch (error) {
			console.error('❌ Failed to refresh cache:', error);
			// Mark cache as stale so we try again next time
			await cacheService.markStale();
		}
	}

	/**
	 * Direct API call to fetch eVaults (fallback method)
	 */
	private static async fetchEVaultsDirectly(): Promise<EVault[]> {
		try {
			const response = await fetch('/api/evaults');
			if (!response.ok) {
				throw new Error('Failed to fetch eVaults');
			}
			const data = await response.json();
			return data.evaults || [];
		} catch (error) {
			console.error('Error fetching eVaults directly:', error);
			return [];
		}
	}

	/**
	 * Force refresh cache and return fresh data
	 * Useful for manual refresh buttons
	 */
	static async forceRefresh(): Promise<EVault[]> {
		try {
			console.log('🔄 Force refreshing eVault cache...');
			const freshEVaults = await this.fetchEVaultsDirectly();
			await cacheService.updateCache(freshEVaults);
			return freshEVaults;
		} catch (error) {
			console.error('Error force refreshing eVaults:', error);
			// Return cached data as fallback
			return await cacheService.getCachedEVaults();
		}
	}

	/**
	 * Get cache status for debugging/monitoring
	 */
	static getCacheStatus() {
		return cacheService.getCacheStatus();
	}

	/**
	 * Clear cache (useful for troubleshooting)
	 */
	static async clearCache(): Promise<void> {
		await cacheService.clearCache();
	}

	static async getEVaultLogs(
		namespace: string,
		podName: string,
		tail: number = 100
	): Promise<string[]> {
		try {
			const response = await fetch(
				`/api/evaults/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/logs?tail=${tail}`
			);
			if (!response.ok) {
				throw new Error('Failed to fetch logs');
			}
			const data = await response.json();
			return data.logs || [];
		} catch (error) {
			console.error('Error fetching logs:', error);
			return [];
		}
	}

	static async getEVaultDetails(namespace: string, podName: string): Promise<any> {
		try {
			const response = await fetch(
				`/api/evaults/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/details`
			);
			if (!response.ok) {
				throw new Error('Failed to fetch eVault details');
			}
			return await response.json();
		} catch (error) {
			console.error('Error fetching eVault details:', error);
			return null;
		}
	}

	static async getEVaultMetrics(namespace: string, podName: string): Promise<any> {
		try {
			const response = await fetch(
				`/api/evaults/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/metrics`
			);
			if (!response.ok) {
				throw new Error('Failed to fetch metrics');
			}
			return await response.json();
		} catch (error) {
			console.error('Error fetching metrics:', error);
			return null;
		}
	}
}
