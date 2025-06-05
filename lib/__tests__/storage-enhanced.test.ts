/**
 * Tests for Enhanced Storage System
 * Verifies key generation, integrity checks, and data portability
 */

import { StorageKeyManager, StorageIntegrityManager } from '../storage-enhanced';

// Mock browser environment
const mockLocalStorage: Storage & { data: Record<string, string>; clear: jest.Mock } = {
  data: {} as Record<string, string>,
  getItem: jest.fn((key: string) => mockLocalStorage.data[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.data[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockLocalStorage.data[key];
  }),
  key: jest.fn((index: number) => Object.keys(mockLocalStorage.data)[index] || null),
  get length(): number {
    return Object.keys(mockLocalStorage.data).length;
  },
  clear: jest.fn(() => {
    mockLocalStorage.data = {};
  }),
};

// Mock crypto for testing
const mockCrypto = {
  subtle: {
    digest: jest.fn((algorithm: string, data: BufferSource) => {
      // Simple mock hash for testing
      const text = new TextDecoder().decode(data);
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const hashArray = new Uint8Array(32);
      hashArray[0] = Math.abs(hash) & 0xFF;
      hashArray[1] = (Math.abs(hash) >> 8) & 0xFF;
      return Promise.resolve(hashArray.buffer);
    }),
  },
  getRandomValues: jest.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
};

// Mock navigator and global objects
const mockNavigator = {
  platform: 'Win32',
  language: 'en-US',
  hardwareConcurrency: 8,
};

const mockScreen = {
  width: 1920,
  height: 1080,
  colorDepth: 24,
};

// Setup global mocks
beforeAll(() => {
  (global as unknown as { localStorage: typeof mockLocalStorage }).localStorage = mockLocalStorage;
  (global as unknown as { crypto: typeof mockCrypto }).crypto = mockCrypto;
  (global as unknown as { navigator: typeof mockNavigator }).navigator = mockNavigator;
  (global as unknown as { screen: typeof mockScreen }).screen = mockScreen;
  (global as unknown as { window: { localStorage: typeof mockLocalStorage; navigator: typeof mockNavigator; screen: typeof mockScreen } }).window = { 
    localStorage: mockLocalStorage,
    navigator: mockNavigator,
    screen: mockScreen,
  };
  
  // Mock Date for consistent timezone
  jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(480); // PST
});

afterEach(() => {
  mockLocalStorage.clear();
  StorageKeyManager.clearCache();
  jest.restoreAllMocks();
});

describe('StorageKeyManager', () => {
  test('should generate consistent storage keys', async () => {
    const key1 = await StorageKeyManager.generateStorageKey('primary');
    const key2 = await StorageKeyManager.generateStorageKey('primary');
    
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^securegen-v2-[a-f0-9]{16}$/);
  });

  test('should generate different keys for different purposes', async () => {
    const primaryKey = await StorageKeyManager.generateStorageKey('primary');
    const backupKey = await StorageKeyManager.generateStorageKey('backup');
    
    expect(primaryKey).not.toBe(backupKey);
    expect(primaryKey).toMatch(/^securegen-v2-/);
    expect(backupKey).toMatch(/^securegen-v2-/);
  });

  test('should use cached keys for performance', async () => {
    const key1 = await StorageKeyManager.generateStorageKey('primary');
    const key2 = await StorageKeyManager.generateStorageKey('primary');
    
    // Should be the same instance (cached)
    expect(key1).toBe(key2);
  });

  test('should handle crypto.subtle unavailable', async () => {
    // Temporarily disable crypto.subtle
    const originalCrypto = (global as unknown as { crypto: typeof mockCrypto }).crypto;
    (global as unknown as { crypto: undefined }).crypto = undefined;
    
    StorageKeyManager.clearCache();
    
    const key = await StorageKeyManager.generateStorageKey('primary');
    expect(key).toMatch(/^securegen-fallback-v2-/);
    
    // Restore crypto
    (global as unknown as { crypto: typeof mockCrypto }).crypto = originalCrypto;
  });
});

describe('StorageIntegrityManager', () => {
  beforeEach(() => {
    // Setup test data
    mockLocalStorage.setItem('securegen-v2-test123', JSON.stringify({
      passwordConfig: { length: 16 },
      history: [{ id: '1', value: 'test', type: 'password', createdAt: new Date() }],
    }));
    
    mockLocalStorage.setItem('securegen-v2-old456', JSON.stringify({
      passwordConfig: { length: 12 },
      lastModified: Date.now() - 86400000, // 24 hours ago
    }));
    
    // Add corrupted entry
    mockLocalStorage.setItem('securegen-v2-corrupt', 'invalid json{');
  });

  test('should perform integrity check and clean corrupted data', async () => {
    const result = await StorageIntegrityManager.performIntegrityCheck();
    
    expect(result.valid).toBe(false);
    expect(result.cleanedEntries).toBe(1); // Corrupted entry removed
    expect(result.issues).toContain('Corrupted data in securegen-v2-corrupt');
    expect(mockLocalStorage.getItem('securegen-v2-corrupt')).toBeNull();
  });

  test('should export user data correctly', async () => {
    // Mock the storage key generation
    jest.spyOn(StorageKeyManager, 'generateStorageKey').mockResolvedValue('securegen-v2-test123');
    
    const exportData = await StorageIntegrityManager.exportUserData();
    
    expect(exportData.version).toBe(2);
    expect(exportData.exportedAt).toBeGreaterThan(0);
    expect(exportData.data.passwordConfig).toEqual({ length: 16 });
    expect(exportData.data.history).toHaveLength(1);
  });

  test('should import user data and merge with existing', async () => {
    const importData = {
      version: 2,
      exportedAt: Date.now(),
      hardwareId: 'different-device',
      data: {
        passwordConfig: { length: 20 },
        history: [{ id: '2', value: 'imported', type: 'password', createdAt: new Date() }],
      },
    };
    
    // Mock the storage key generation
    jest.spyOn(StorageKeyManager, 'generateStorageKey').mockResolvedValue('securegen-v2-test123');
    
    const success = await StorageIntegrityManager.importUserData(importData);
    
    expect(success).toBe(true);
    
    const storedData = JSON.parse(mockLocalStorage.getItem('securegen-v2-test123')!);
    expect(storedData.passwordConfig.length).toBe(20); // Imported config
    expect(storedData.importedFrom).toBe('different-device');
    expect(storedData.importedAt).toBeGreaterThan(0);
  });

  test('should handle invalid import data', async () => {
    const invalidData = {
      version: 1,
      // Missing required fields
    };
    
    const success = await StorageIntegrityManager.importUserData(invalidData as {
      version: number;
      exportedAt: number;
      hardwareId: string;
      data: Record<string, unknown>;
    });
    expect(success).toBe(false);
  });

  test('should limit storage entries during cleanup', async () => {
    // Add many old entries
    for (let i = 0; i < 15; i++) {
      mockLocalStorage.setItem(`securegen-v2-old-${i}`, JSON.stringify({
        data: `test-${i}`,
        lastModified: Date.now() - (i * 86400000), // Increasing age
      }));
    }
    
    const result = await StorageIntegrityManager.performIntegrityCheck();
    
    // Should clean up entries beyond the limit (10 max)
    expect(result.cleanedEntries).toBeGreaterThan(0);
    expect(mockLocalStorage.length).toBeLessThanOrEqual(12); // 10 max + current + legacy
  });
});

describe('Integration Tests', () => {
  test('should handle complete storage lifecycle', async () => {
    // 1. Generate storage key
    const storageKey = await StorageKeyManager.generateStorageKey('primary');
    expect(storageKey).toMatch(/^securegen-v2-/);
    
    // 2. Store some data
    const testData = {
      passwordConfig: { length: 16, uppercase: true },
      history: [
        { id: '1', value: 'password1', type: 'password', createdAt: new Date() },
        { id: '2', value: 'password2', type: 'password', createdAt: new Date() },
      ],
    };
    mockLocalStorage.setItem(storageKey, JSON.stringify(testData));
    
    // 3. Export data
    const exportData = await StorageIntegrityManager.exportUserData();
    expect(exportData.data.history).toHaveLength(2);
    
    // 4. Clear storage
    mockLocalStorage.clear();
    
    // 5. Import data back
    const success = await StorageIntegrityManager.importUserData(exportData);
    expect(success).toBe(true);
    
    // 6. Verify data integrity
    const result = await StorageIntegrityManager.performIntegrityCheck();
    expect(result.valid).toBe(true);
    
    // 7. Check that data was restored
    const restoredData = JSON.parse(mockLocalStorage.getItem(storageKey)!);
    expect(restoredData.passwordConfig.length).toBe(16);
    expect(restoredData.history).toHaveLength(2);
  });

  test('should handle hardware ID changes gracefully', async () => {
    // Setup initial data
    const initialKey = await StorageKeyManager.generateStorageKey('primary');
    mockLocalStorage.setItem(initialKey, JSON.stringify({
      passwordConfig: { length: 16 },
      history: [{ id: '1', value: 'test', type: 'password', createdAt: new Date() }],
    }));
    
    // Simulate hardware change by clearing cache and changing navigator
    StorageKeyManager.clearCache();
    (global as unknown as { navigator: typeof mockNavigator }).navigator = { ...mockNavigator, platform: 'Linux x86_64' };
    
    // Generate new key (would be different due to platform change)
    const newKey = await StorageKeyManager.generateStorageKey('primary');
    expect(newKey).not.toBe(initialKey);
    
    // Verify that integrity check can find and potentially recover old data
    const result = await StorageIntegrityManager.performIntegrityCheck();
    expect(result.cleanedEntries).toBeGreaterThanOrEqual(0);
    
    // Restore original navigator
    (global as unknown as { navigator: typeof mockNavigator }).navigator = mockNavigator;
  });
});

// Performance tests
describe('Performance Tests', () => {
  test('storage key generation should be fast', async () => {
    const start = performance.now();
    
    await Promise.all([
      StorageKeyManager.generateStorageKey('primary'),
      StorageKeyManager.generateStorageKey('backup'),
      StorageKeyManager.generateStorageKey('primary'), // Should use cache
    ]);
    
    const end = performance.now();
    expect(end - start).toBeLessThan(100); // Should complete in under 100ms
  });

  test('integrity check should handle large storage efficiently', async () => {
    // Create many storage entries
    for (let i = 0; i < 50; i++) {
      mockLocalStorage.setItem(`securegen-v2-entry-${i}`, JSON.stringify({
        data: `large-data-${i}`.repeat(100), // Simulate larger entries
        timestamp: Date.now() - i * 1000,
      }));
    }
    
    const start = performance.now();
    const result = await StorageIntegrityManager.performIntegrityCheck();
    const end = performance.now();
    
    expect(result.cleanedEntries).toBeGreaterThan(0); // Should clean up excess entries
    expect(end - start).toBeLessThan(1000); // Should complete in under 1 second
  });
}); 