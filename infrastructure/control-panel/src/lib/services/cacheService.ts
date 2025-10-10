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
  private db: any | null = null;
  private isInitialized = false;

  constructor() {
    // Only initialize on the server side
    if (typeof window === 'undefined') {
      this.init();
    }
  }

  private async init() {
    if (this.isInitialized) return;
    
    try {
      // Dynamically import lowdb only on server
      const { Low } = await import('lowdb');
      const { JSONFile } = await import('lowdb/node');
      
      // Initialize LowDB with JSON file adapter
      const adapter = new JSONFile<CacheData>(CACHE_FILE);
      this.db = new Low(adapter, defaultData);
      
      // Load existing data or create default
      await this.db.read();
      if (!this.db.data) {
        this.db.data = defaultData;
        await this.db.write();
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize cache service:', error);
    }
  }

  async getCachedEVaults(): Promise<EVault[]> {
    if (typeof window !== 'undefined') {
      // In browser, try to get from localStorage as a simple cache
      try {
        const cached = localStorage.getItem('evault-cache');
        if (cached) {
          const data = JSON.parse(cached);
          if (data.evaults && Array.isArray(data.evaults)) {
            return data.evaults;
          }
        }
      } catch (error) {
        console.log('No localStorage cache available');
      }
      return [];
    }
    
    await this.init();
    return this.db?.data?.evaults || [];
  }

  async isCacheStale(): Promise<boolean> {
    if (typeof window !== 'undefined') {
      return true; // Always stale in browser
    }
    
    await this.init();
    const lastUpdated = this.db?.data?.lastUpdated || 0;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    return (now - lastUpdated) > fiveMinutes;
  }

  async updateCache(evaults: EVault[]): Promise<void> {
    if (typeof window !== 'undefined') {
      // In browser, save to localStorage
      try {
        const cacheData = {
          evaults,
          lastUpdated: Date.now(),
          isStale: false
        };
        localStorage.setItem('evault-cache', JSON.stringify(cacheData));
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
      return;
    }
    
    await this.init();
    if (this.db) {
      this.db.data = {
        evaults,
        lastUpdated: Date.now(),
        isStale: false
      };
      await this.db.write();
    }
  }

  async markStale(): Promise<void> {
    if (typeof window !== 'undefined') {
      return; // No-op in browser
    }
    
    await this.init();
    if (this.db && this.db.data) {
      this.db.data.isStale = true;
      await this.db.write();
    }
  }

  getCacheStatus(): { lastUpdated: number; isStale: boolean; itemCount: number } {
    if (typeof window !== 'undefined') {
      // In browser, get from localStorage
      try {
        const cached = localStorage.getItem('evault-cache');
        if (cached) {
          const data = JSON.parse(cached);
          return {
            lastUpdated: data.lastUpdated || 0,
            isStale: data.isStale || false,
            itemCount: data.evaults?.length || 0
          };
        }
      } catch (error) {
        console.log('No localStorage cache available');
      }
      return { lastUpdated: 0, isStale: true, itemCount: 0 };
    }
    
    if (!this.db?.data) {
      return { lastUpdated: 0, isStale: true, itemCount: 0 };
    }
    
    return {
      lastUpdated: this.db.data.lastUpdated,
      isStale: this.db.data.isStale,
      itemCount: this.db.data.evaults.length
    };
  }

  async clearCache(): Promise<void> {
    if (typeof window !== 'undefined') {
      // In browser, clear localStorage
      try {
        localStorage.removeItem('evault-cache');
      } catch (error) {
        console.error('Failed to clear localStorage cache:', error);
      }
      return;
    }
    
    await this.init();
    if (this.db) {
      this.db.data = defaultData;
      await this.db.write();
    }
  }
}

// Export a singleton instance
export const cacheService = new CacheService();
