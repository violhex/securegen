/**
 * Storage Migration Utility
 * Handles migration from shared storage to user-specific storage
 */

import { generateHardwareId } from '@/lib/hardware-id';

export interface LegacyStoreData {
  passwordConfig?: any;
  passphraseConfig?: any;
  usernameConfig?: any;
  history?: any[];
  activeTab?: string;
}

/**
 * Check if there's legacy shared storage data
 */
export function hasLegacyStorage(): boolean {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }
    
    const legacyData = localStorage.getItem('securegen-store');
    return legacyData !== null;
  } catch (error) {
    console.error('Failed to check for legacy storage:', error);
    return false;
  }
}

/**
 * Get legacy storage data
 */
export function getLegacyStorageData(): LegacyStoreData | null {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }
    
    const legacyData = localStorage.getItem('securegen-store');
    if (!legacyData) return null;
    
    const parsed = JSON.parse(legacyData);
    return parsed.state || parsed; // Handle both wrapped and unwrapped formats
  } catch (error) {
    console.error('Failed to parse legacy storage data:', error);
    return null;
  }
}

/**
 * Migrate legacy data to user-specific storage
 */
export async function migrateLegacyStorage(): Promise<boolean> {
  try {
    const legacyData = getLegacyStorageData();
    if (!legacyData) {
      console.log('No legacy data to migrate');
      return false;
    }

    // Generate user-specific storage key
    const hardwareId = await generateHardwareId();
    const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hardwareId));
    const keyArray = Array.from(new Uint8Array(keyHash));
    const shortKey = keyArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
    const userStorageKey = `securegen-store-${shortKey}`;

    // Check if user-specific storage already exists
    const existingUserData = localStorage.getItem(userStorageKey);
    if (existingUserData) {
      console.log('User-specific storage already exists, skipping migration');
      return false;
    }

    // Migrate the data
    const migratedData = {
      state: {
        ...legacyData,
        userStorageKey,
      },
      version: 0,
    };

    localStorage.setItem(userStorageKey, JSON.stringify(migratedData));
    console.log(`Successfully migrated legacy data to user-specific storage: ${userStorageKey}`);
    
    return true;
  } catch (error) {
    console.error('Failed to migrate legacy storage:', error);
    return false;
  }
}

/**
 * Clear legacy shared storage after successful migration
 */
export function clearLegacyStorage(): boolean {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }
    
    localStorage.removeItem('securegen-store');
    console.log('Legacy storage cleared');
    return true;
  } catch (error) {
    console.error('Failed to clear legacy storage:', error);
    return false;
  }
}

/**
 * Get all SecureGen storage keys (for debugging/cleanup)
 */
export function getAllSecureGenStorageKeys(): string[] {
  const keys: string[] = [];
  
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return keys;
    }
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('securegen-store')) {
        keys.push(key);
      }
    }
  } catch (error) {
    console.error('Failed to get storage keys:', error);
  }
  
  return keys;
}

/**
 * Get detailed storage information for better debugging
 */
export async function getStorageDetails(): Promise<{
  allKeys: string[];
  currentUserKey: string;
  legacyKey: string | null;
  userSpecificKeys: string[];
  totalEntries: number;
  hasLegacy: boolean;
}> {
  try {
    const allKeys = getAllSecureGenStorageKeys();
    const currentUserKey = await getCurrentUserStorageKey();
    const legacyKey = hasLegacyStorage() ? 'securegen-store' : null;
    
    // Filter user-specific keys (exclude legacy)
    const userSpecificKeys = allKeys.filter(key => 
      key !== 'securegen-store' && key.startsWith('securegen-store-')
    );
    
    return {
      allKeys,
      currentUserKey,
      legacyKey,
      userSpecificKeys,
      totalEntries: allKeys.length,
      hasLegacy: legacyKey !== null,
    };
  } catch (error) {
    console.error('Failed to get storage details:', error);
    return {
      allKeys: [],
      currentUserKey: '',
      legacyKey: null,
      userSpecificKeys: [],
      totalEntries: 0,
      hasLegacy: false,
    };
  }
}

/**
 * Clean up old storage entries (keep only current user's data)
 */
export async function cleanupOldStorage(): Promise<number> {
  try {
    const allKeys = getAllSecureGenStorageKeys();
    const currentUserKey = await getCurrentUserStorageKey();
    
    let cleanedCount = 0;
    
    for (const key of allKeys) {
      // Keep the current user's storage and the legacy storage (for now)
      if (key !== currentUserKey && key !== 'securegen-store') {
        try {
          localStorage.removeItem(key);
          cleanedCount++;
          console.log(`Cleaned up old storage: ${key}`);
        } catch (error) {
          console.warn(`Failed to clean up storage key: ${key}`, error);
        }
      }
    }
    
    return cleanedCount;
  } catch (error) {
    console.error('Failed to cleanup old storage:', error);
    return 0;
  }
}

/**
 * Get the current user's storage key
 */
async function getCurrentUserStorageKey(): Promise<string> {
  try {
    const hardwareId = await generateHardwareId();
    const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hardwareId));
    const keyArray = Array.from(new Uint8Array(keyHash));
    const shortKey = keyArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
    return `securegen-store-${shortKey}`;
  } catch (error) {
    console.error('Failed to generate current user storage key:', error);
    throw error;
  }
}

/**
 * Complete migration workflow
 */
export async function performStorageMigration(): Promise<{
  migrated: boolean;
  legacyCleared: boolean;
  oldStorageCleaned: number;
}> {
  console.log('Starting storage migration...');
  
  const migrated = await migrateLegacyStorage();
  let legacyCleared = false;
  let oldStorageCleaned = 0;
  
  if (migrated) {
    // Only clear legacy storage if migration was successful
    legacyCleared = clearLegacyStorage();
  }
  
  // Clean up any other old storage entries
  oldStorageCleaned = await cleanupOldStorage();
  
  console.log('Storage migration completed:', {
    migrated,
    legacyCleared,
    oldStorageCleaned,
  });
  
  return {
    migrated,
    legacyCleared,
    oldStorageCleaned,
  };
} 