/**
 * Enhanced Storage System
 * Addresses hardware ID stability, cross-device sync preparation, and storage integrity
 */

import { generateHardwareId } from '@/lib/hardware-id';

// Normalized storage key generation (consistent across all modules)
export class StorageKeyManager {
  private static cache = new Map<string, string>();
  private static readonly STORAGE_VERSION = 2; // Increment when key generation changes
  
  /**
   * Generate normalized hardware-based storage key with stability improvements
   */
  static async generateStorageKey(purpose: 'primary' | 'backup' = 'primary'): Promise<string> {
    const cacheKey = `storage-key-${purpose}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Get normalized hardware ID with reduced volatility
      const hardwareId = await this.getNormalizedHardwareId();
      
      // Create deterministic key using crypto.subtle when available
      const keyData = await this.createDeterministicKey(hardwareId, purpose);
      const storageKey = `securegen-v${this.STORAGE_VERSION}-${keyData}`;
      
      this.cache.set(cacheKey, storageKey);
      return storageKey;
    } catch (error) {
      console.error('Failed to generate storage key:', error);
      
      // Fallback to collision-resistant random key
      const fallbackKey = this.generateFallbackKey(purpose);
      this.cache.set(cacheKey, fallbackKey);
      return fallbackKey;
    }
  }

  /**
   * Get normalized hardware ID with reduced sensitivity to volatile characteristics
   */
  private static async getNormalizedHardwareId(): Promise<string> {
    try {
      // Collect stable hardware characteristics only
      const stableInfo = await this.collectStableSystemInfo();
      
      // Create deterministic string from stable characteristics
      const infoString = [
        stableInfo.platform,
        stableInfo.architecture || 'unknown',
        stableInfo.osFamily || 'unknown',
        stableInfo.languageBase, // Only primary language (en, fr, etc.)
        stableInfo.timezoneStable, // Rounded timezone
        stableInfo.screenStable, // Normalized screen info
        stableInfo.hardwareConcurrency.toString(),
      ].join('|');

      return await this.hashString(infoString);
    } catch (error) {
      throw new Error(`Hardware ID generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Collect only stable system characteristics that are unlikely to change
   */
  private static async collectStableSystemInfo() {
    const navigator = globalThis.navigator;
    const screen = globalThis.screen;

    // Extract base language (remove region/script variants)
    const languageBase = navigator.language?.split('-')[0] || 'en';
    
    // Normalize timezone to reduce drift from DST changes
    const rawTimezone = new Date().getTimezoneOffset();
    const timezoneStable = Math.round(rawTimezone / 60) * 60; // Round to nearest hour
    
    // Normalize screen dimensions to reduce resolution change sensitivity
    const screenStable = screen ? 
      `${Math.round(screen.width / 100) * 100}x${Math.round(screen.height / 100) * 100}` : 
      '1920x1080';

    // Try to get additional stable Tauri info
    let platform = navigator.platform;
    let architecture: string | undefined;
    let osFamily: string | undefined;

    if (typeof window !== 'undefined' && (window as any).__TAURI__?.os) {
      try {
        const tauriOs = (window as any).__TAURI__.os;
        const [platformResult, archResult, familyResult] = await Promise.allSettled([
          tauriOs.platform(),
          tauriOs.arch(),
          tauriOs.family?.() || tauriOs.type?.(),
        ]);

        if (platformResult.status === 'fulfilled') platform = platformResult.value;
        if (archResult.status === 'fulfilled') architecture = archResult.value;
        if (familyResult.status === 'fulfilled') osFamily = familyResult.value;
      } catch (error) {
        console.warn('Failed to get Tauri OS info:', error);
      }
    }

    return {
      platform,
      architecture,
      osFamily,
      languageBase,
      timezoneStable,
      screenStable,
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
    };
  }

  /**
   * Create deterministic key from hardware ID with optional purpose differentiation
   */
  private static async createDeterministicKey(hardwareId: string, purpose: string): Promise<string> {
    const input = `${hardwareId}:${purpose}:${this.STORAGE_VERSION}`;
    
    if (this.isSecureContext()) {
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      const hashArray = Array.from(new Uint8Array(hash));
      return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback hash for non-secure contexts
      return this.simpleHash(input).toString(16).padStart(8, '0').substring(0, 8);
    }
  }

  /**
   * Generate collision-resistant fallback key
   */
  private static generateFallbackKey(purpose: string): string {
    const timestamp = Date.now().toString(16);
    const random = Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
    return `securegen-fallback-v${this.STORAGE_VERSION}-${purpose}-${timestamp}-${random}`;
  }

  /**
   * Check if we're in a secure context
   */
  private static isSecureContext(): boolean {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' && 
           typeof crypto.subtle.digest === 'function';
  }

  /**
   * Hash string using crypto.subtle or fallback
   */
  private static async hashString(input: string): Promise<string> {
    if (this.isSecureContext()) {
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      const hashArray = Array.from(new Uint8Array(hash));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      return this.simpleHash(input).toString(16);
    }
  }

  /**
   * Simple hash function for non-secure contexts
   */
  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Clear cached keys (useful for testing or when hardware changes)
   */
  static clearCache(): void {
    this.cache.clear();
  }
}

// Storage integrity and migration manager
export class StorageIntegrityManager {
  private static readonly INTEGRITY_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly MAX_STORAGE_ENTRIES = 10; // Maximum storage entries to keep
  private static readonly STORAGE_PREFIX = 'securegen-';

  /**
   * Perform comprehensive storage integrity check
   */
  static async performIntegrityCheck(): Promise<{
    valid: boolean;
    issues: string[];
    cleanedEntries: number;
    migratedEntries: number;
  }> {
    const issues: string[] = [];
    let cleanedEntries = 0;
    let migratedEntries = 0;

    try {
      // Check if browser environment
      if (typeof localStorage === 'undefined') {
        return { valid: true, issues: ['No localStorage available'], cleanedEntries: 0, migratedEntries: 0 };
      }

      // Get all SecureGen storage entries
      const allEntries = this.getAllStorageEntries();
      
      // Check for orphaned entries
      const currentKey = await StorageKeyManager.generateStorageKey('primary');
      const orphanedEntries = allEntries.filter(entry => 
        entry.key !== currentKey && 
        entry.key !== 'securegen-store' && // Keep legacy for now
        !entry.key.includes('fallback') // Keep fallback entries temporarily
      );

      // Clean up old entries if too many exist
      if (orphanedEntries.length > this.MAX_STORAGE_ENTRIES) {
        const entriesToRemove = orphanedEntries
          .sort((a, b) => (a.lastModified || 0) - (b.lastModified || 0))
          .slice(0, orphanedEntries.length - this.MAX_STORAGE_ENTRIES);

        for (const entry of entriesToRemove) {
          try {
            localStorage.removeItem(entry.key);
            cleanedEntries++;
          } catch (error) {
            issues.push(`Failed to remove entry ${entry.key}: ${error}`);
          }
        }
      }

      // Check for corrupted data
      for (const entry of allEntries) {
        try {
          JSON.parse(entry.value);
        } catch (error) {
          issues.push(`Corrupted data in ${entry.key}`);
          try {
            localStorage.removeItem(entry.key);
            cleanedEntries++;
          } catch (removeError) {
            issues.push(`Failed to remove corrupted entry ${entry.key}`);
          }
        }
      }

      // Check for legacy data that needs migration
      const legacyEntry = localStorage.getItem('securegen-store');
      if (legacyEntry && !localStorage.getItem(currentKey)) {
        try {
          const legacyData = JSON.parse(legacyEntry);
          localStorage.setItem(currentKey, JSON.stringify({
            ...legacyData,
            migratedAt: Date.now(),
            version: 2,
          }));
          migratedEntries++;
        } catch (error) {
          issues.push(`Failed to migrate legacy data: ${error}`);
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        cleanedEntries,
        migratedEntries,
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Integrity check failed: ${error}`],
        cleanedEntries,
        migratedEntries,
      };
    }
  }

  /**
   * Get all SecureGen storage entries with metadata
   */
  private static getAllStorageEntries(): Array<{
    key: string;
    value: string;
    size: number;
    lastModified?: number;
  }> {
    const entries: Array<{
      key: string;
      value: string;
      size: number;
      lastModified?: number;
    }> = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.STORAGE_PREFIX)) {
          const value = localStorage.getItem(key) || '';
          let lastModified: number | undefined;

          try {
            const parsed = JSON.parse(value);
            lastModified = parsed.lastModified || parsed.timestamp || parsed.createdAt;
          } catch {
            // Ignore parsing errors for metadata extraction
          }

          entries.push({
            key,
            value,
            size: new Blob([value]).size,
            lastModified,
          });
        }
      }
    } catch (error) {
      console.error('Failed to enumerate storage entries:', error);
    }

    return entries;
  }

  /**
   * Schedule automatic integrity checks
   */
  static scheduleIntegrityChecks(): void {
    // Check on startup
    setTimeout(() => {
      this.performIntegrityCheck().then(result => {
        if (!result.valid || result.cleanedEntries > 0) {
          console.log('Storage integrity check completed:', result);
        }
      }).catch(error => {
        console.error('Storage integrity check failed:', error);
      });
    }, 5000); // Delay to avoid startup interference

    // Schedule periodic checks
    setInterval(() => {
      this.performIntegrityCheck().catch(error => {
        console.error('Scheduled integrity check failed:', error);
      });
    }, this.INTEGRITY_CHECK_INTERVAL);
  }

  /**
   * Export all user data for backup/migration
   */
  static async exportUserData(): Promise<{
    version: number;
    exportedAt: number;
    hardwareId: string;
    data: Record<string, any>;
  }> {
    try {
      const currentKey = await StorageKeyManager.generateStorageKey('primary');
      const rawData = localStorage.getItem(currentKey);
      
      if (!rawData) {
        throw new Error('No user data found to export');
      }

      const data = JSON.parse(rawData);
      const hardwareId = await generateHardwareId();

      return {
        version: 2,
        exportedAt: Date.now(),
        hardwareId,
        data,
      };
    } catch (error) {
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import user data from backup
   */
  static async importUserData(exportData: {
    version: number;
    exportedAt: number;
    hardwareId: string;
    data: Record<string, any>;
  }): Promise<boolean> {
    try {
      // Validate export data
      if (!exportData.version || !exportData.data) {
        throw new Error('Invalid export data format');
      }

      const currentKey = await StorageKeyManager.generateStorageKey('primary');
      
      // Merge with existing data or replace
      const existingData = localStorage.getItem(currentKey);
      let finalData = exportData.data;

      if (existingData) {
        const existing = JSON.parse(existingData);
        finalData = {
          ...existing,
          ...exportData.data,
          importedAt: Date.now(),
          importedFrom: exportData.hardwareId,
        };
      }

      localStorage.setItem(currentKey, JSON.stringify(finalData));
      return true;
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  }
}

// Storage recovery manager for handling hardware ID changes
export class StorageRecoveryManager {
  /**
   * Attempt to recover user data when hardware ID changes
   */
  static async attemptDataRecovery(): Promise<{
    recovered: boolean;
    dataFound: boolean;
    recoveredFrom?: string;
  }> {
    try {
      const currentKey = await StorageKeyManager.generateStorageKey('primary');
      
      // Check if current key has data
      if (localStorage.getItem(currentKey)) {
        return { recovered: false, dataFound: true };
      }

      // Look for potential previous user data
      const allEntries = this.findPotentialUserEntries();
      
      if (allEntries.length === 0) {
        return { recovered: false, dataFound: false };
      }

      // Try to recover from the most recent entry
      const mostRecent = allEntries.sort((a, b) => 
        (b.lastModified || 0) - (a.lastModified || 0)
      )[0];

      // Copy data to current key
      localStorage.setItem(currentKey, JSON.stringify({
        ...mostRecent.data,
        recoveredAt: Date.now(),
        recoveredFrom: mostRecent.key,
      }));

      return {
        recovered: true,
        dataFound: true,
        recoveredFrom: mostRecent.key,
      };
    } catch (error) {
      console.error('Data recovery failed:', error);
      return { recovered: false, dataFound: false };
    }
  }

  /**
   * Find potential user entries (excluding legacy and fallback)
   */
  private static findPotentialUserEntries(): Array<{
    key: string;
    data: any;
    lastModified?: number;
  }> {
    const entries: Array<{
      key: string;
      data: any;
      lastModified?: number;
    }> = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('securegen-v') && !key.includes('fallback')) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              const data = JSON.parse(value);
              entries.push({
                key,
                data,
                lastModified: data.lastModified || data.timestamp,
              });
            } catch {
              // Skip corrupted entries
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to find user entries:', error);
    }

    return entries;
  }
}

// Initialize storage system
export function initializeEnhancedStorage(): void {
  if (typeof window !== 'undefined') {
    // Schedule integrity checks
    StorageIntegrityManager.scheduleIntegrityChecks();

    // Attempt data recovery if needed
    StorageRecoveryManager.attemptDataRecovery().then(result => {
      if (result.recovered) {
        console.log('User data recovered from hardware ID change');
      }
    }).catch(error => {
      console.error('Failed to attempt data recovery:', error);
    });
  }
} 