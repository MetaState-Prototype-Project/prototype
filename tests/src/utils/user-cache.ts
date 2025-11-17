import { TestUser } from './user-factory';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(__dirname, '../../.test-users-cache.json');

export interface CachedUsers {
  users: TestUser[];
  createdAt: string;
  userCount: number;
}

/**
 * Load cached users from disk
 */
export function loadCachedUsers(): CachedUsers | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = fs.readFileSync(CACHE_FILE, 'utf-8');
      const cached: CachedUsers = JSON.parse(cacheData);
      
      // Validate cache structure
      if (cached.users && Array.isArray(cached.users) && cached.users.length > 0) {
        return cached;
      }
    }
  } catch (error) {
    console.warn('Failed to load user cache:', error);
  }
  
  return null;
}

/**
 * Save users to cache
 */
export function saveCachedUsers(users: TestUser[]): void {
  try {
    const cacheData: CachedUsers = {
      users,
      createdAt: new Date().toISOString(),
      userCount: users.length,
    };
    
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf-8');
    console.log(`Cached ${users.length} test users to ${CACHE_FILE}`);
  } catch (error) {
    console.warn('Failed to save user cache:', error);
  }
}

/**
 * Clear user cache
 */
export function clearUserCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
      console.log('User cache cleared');
    }
  } catch (error) {
    console.warn('Failed to clear user cache:', error);
  }
}

/**
 * Check if cached users match the requested count
 */
export function isCacheValid(requestedCount: number): boolean {
  const cached = loadCachedUsers();
  if (!cached) {
    return false;
  }
  
  // Cache is valid if it has at least the requested number of users
  return cached.users.length >= requestedCount;
}

/**
 * Get cached users (up to requested count)
 */
export function getCachedUsers(requestedCount: number): TestUser[] | null {
  const cached = loadCachedUsers();
  if (!cached) {
    return null;
  }
  
  if (cached.users.length >= requestedCount) {
    console.log(`Cache hit: Found ${cached.users.length} cached users, using ${requestedCount}`);
    return cached.users.slice(0, requestedCount);
  }
  
  console.log(`Cache miss: Cached users (${cached.users.length}) < requested (${requestedCount})`);
  return null;
}

