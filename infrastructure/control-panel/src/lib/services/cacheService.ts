import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import type { EVault } from '../../routes/api/evaults/+server';

// Define the cache data structure
interface CacheData {
  evaults: EVault[];
  lastUpdated: number;
  isStale: boolean;
}

// Cache file path (will be created in the project root)
const CACHE_FILE = './evault-cache.json';

// Default cache data
const defaultData: CacheData = {
  evaults: [],
  lastUpdated: 0,
  isStale: true
};

class CacheService {
  private db: Low<CacheData>;
  private isInitialized = false;

  constructor() {
    // Initialize LowDB with JSON file adapter
    const adapter = new JSONFile<CacheData>(CACHE_FILE);
    this.db = new Low(adapter, defaultData);
  }

  /**
   * Initialize the cache service
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      await this.db.read();
      this.isInitialized = true;
      console.log('Cache service initialized');
    } catch (error) {
      console.warn('Cache file not found, using default data');
      this.db.data = defaultData;
      await this.db.write();
      this.isInitialized = true;
    }
  }

  /**
   * Get cached eVaults (fast, returns immediately)
   */
  async getCachedEVaults(): Promise<EVault[]> {
    await this.init();
    return this.db.data.evaults;
  }

  /**
   * Check if cache is stale (older than 5 minutes)
   */
  isCacheStale(): boolean {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return this.db.data.lastUpdated < fiveMinutesAgo;
  }

  /**
   * Update cache with fresh data
   */
  async updateCache(evaults: EVault[]): Promise<void> {
    await this.init();
    
    this.db.data = {
      evaults,
      lastUpdated: Date.now(),
      isStale: false
    };
    
    await this.db.write();
    console.log(`Cache updated with ${evaults.length} eVaults`);
  }

  /**
   * Mark cache as stale (force refresh on next request)
   */
  async markStale(): Promise<void> {
    await this.init();
    this.db.data.isStale = true;
    await this.db.write();
  }

  /**
   * Get cache status
   */
  getCacheStatus(): { lastUpdated: number; isStale: boolean; count: number } {
    return {
      lastUpdated: this.db.data.lastUpdated,
      isStale: this.db.data.isStale,
      count: this.db.data.evaults.length
    };
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    await this.init();
    this.db.data = defaultData;
    await this.db.write();
    console.log('Cache cleared');
  }
}

// Export singleton instance
export const cacheService = new CacheService();
