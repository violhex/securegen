import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateHardwareId } from '@/lib/hardware-id';
import { StorageKeyManager, initializeEnhancedStorage } from '@/lib/storage-enhanced';
import type { 
  PasswordConfig, 
  PassphraseConfig, 
  UsernameConfig, 
  GeneratedItem,
  GeneratorType 
} from '@/types';

// UUID generation with fallback for compatibility
function generateUUID(): string {
  // Check if crypto.randomUUID is available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (error) {
      console.warn('crypto.randomUUID failed, falling back to alternative method:', error);
    }
  }
  
  // Fallback 1: Use crypto.getRandomValues if available
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    try {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      
      // Set version (4) and variant bits according to RFC 4122
      array[6] = (array[6] & 0x0f) | 0x40; // Version 4
      array[8] = (array[8] & 0x3f) | 0x80; // Variant 10
      
      // Convert to hex string with proper formatting
      const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32)
      ].join('-');
    } catch (error) {
      console.warn('crypto.getRandomValues failed, falling back to Math.random:', error);
    }
  }
  
  // Fallback 2: Use Math.random (less secure but universally supported)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Storage mutex implementation to prevent race conditions
class StorageMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const release = () => {
        this.locked = false;
        const next = this.queue.shift();
        if (next) {
          this.locked = true;
          next();
        }
      };

      if (!this.locked) {
        this.locked = true;
        resolve(release);
      } else {
        this.queue.push(() => resolve(release));
      }
    });
  }
}

// Global storage mutex instance
const storageMutex = new StorageMutex();

// Generate user-specific storage key based on hardware ID
let userStorageKey: string | null = null;

/**
 * Check if we're in a secure context (HTTPS or localhost)
 */
function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check if crypto.subtle is available (requires secure context)
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' && 
         typeof crypto.subtle.digest === 'function';
}

/**
 * Generate a collision-resistant fallback key using UUID and random components
 */
function generateCollisionResistantFallback(): string {
  try {
    // Use crypto.getRandomValues if available for better entropy
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const randomBytes = new Uint8Array(8);
      crypto.getRandomValues(randomBytes);
      const randomHex = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Combine with timestamp for additional uniqueness
      const timestamp = Date.now().toString(16);
      return `securegen-store-${randomHex}-${timestamp}`;
    }
    
    // Fallback to Math.random with multiple components for collision resistance
    const random1 = Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
    const random2 = Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
    const timestamp = Date.now().toString(16);
    
    return `securegen-store-${random1}-${random2}-${timestamp}`;
  } catch {
    // Ultimate fallback with UUID-like structure
    const uuid = generateUUID();
    return `securegen-store-${uuid}`;
  }
}

async function getUserStorageKey(): Promise<string> {
  if (userStorageKey) {
    return userStorageKey;
  }
  
  try {
    // Use the enhanced storage key manager for normalized, stable key generation
    const enhancedKey = await StorageKeyManager.generateStorageKey('primary');
    userStorageKey = enhancedKey;
    return enhancedKey;
  } catch (error) {
    // Enhanced error handling with development-only logging
    if (process.env.NODE_ENV === 'development') {
      console.warn('Enhanced storage key generation failed, using legacy fallback:', error);
    }
    
    // Fallback to legacy key generation for compatibility
    try {
      const hardwareId = await generateHardwareId();
      
      if (!isSecureContext()) {
        const encoder = new TextEncoder();
        const data = encoder.encode(hardwareId);
        
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
          const char = data[i];
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        
        const shortKey = Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
        userStorageKey = `securegen-store-${shortKey}`;
        return userStorageKey;
      }
      
      const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hardwareId));
      const keyArray = Array.from(new Uint8Array(keyHash));
      const shortKey = keyArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
      
      userStorageKey = `securegen-store-${shortKey}`;
      return userStorageKey;
    } catch {
      const fallbackKey = generateCollisionResistantFallback();
      userStorageKey = fallbackKey;
      return fallbackKey;
    }
  }
}

interface AppStore {
  // Generator Configurations
  passwordConfig: PasswordConfig;
  passphraseConfig: PassphraseConfig;
  usernameConfig: UsernameConfig;
  
  // Generated Content
  currentPassword: string;
  currentPassphrase: string;
  currentUsername: string;
  
  // History
  history: GeneratedItem[];
  
  // UI State
  activeTab: GeneratorType;
  isGenerating: boolean;
  isNeumorphismEnabled: boolean;
  
  // User identification
  userStorageKey: string;
  
  // Actions
  setPasswordConfig: (config: Partial<PasswordConfig>) => void;
  setPassphraseConfig: (config: Partial<PassphraseConfig>) => void;
  setUsernameConfig: (config: Partial<UsernameConfig>) => void;
  
  setCurrentPassword: (password: string) => void;
  setCurrentPassphrase: (passphrase: string) => void;
  setCurrentUsername: (username: string) => void;
  
  addToHistory: (item: Omit<GeneratedItem, 'id' | 'createdAt'>) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  
  setActiveTab: (tab: GeneratorType) => void;
  setIsGenerating: (generating: boolean) => void;
  toggleNeumorphism: () => void;
  
  // Initialize user-specific storage
  initializeUserStorage: () => Promise<void>;
}

// Create the store with dynamic storage key
export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // Initial configurations
      passwordConfig: {
        length: 16,
        lowercase: true,
        uppercase: true,
        numbers: true,
        special: false,
        avoid_ambiguous: false,
        min_lowercase: undefined,
        min_uppercase: undefined,
        min_number: undefined,
        min_special: undefined,
      },
      passphraseConfig: {
        wordCount: 4,
        separator: '-',
        capitalize: true,
        includeNumbers: false,
      },
      usernameConfig: {
        type: 'Word',
        capitalize: true,
        include_number: false,
        strength: 'Standard',
      },
      
      // Generated content
      currentPassword: '',
      currentPassphrase: '',
      currentUsername: '',
      
      // History
      history: [],
      
      // UI state
      activeTab: 'password',
      isGenerating: false,
      isNeumorphismEnabled: false,
      
      // User identification
      userStorageKey: '',
      
      // Actions
      setPasswordConfig: (config) =>
        set((state) => ({
          passwordConfig: { ...state.passwordConfig, ...config },
        })),
      
      setPassphraseConfig: (config) =>
        set((state) => ({
          passphraseConfig: { ...state.passphraseConfig, ...config },
        })),
      
      setUsernameConfig: (config) =>
        set((state) => ({
          usernameConfig: { ...state.usernameConfig, ...config },
        })),
      
      setCurrentPassword: (password) => set({ currentPassword: password }),
      setCurrentPassphrase: (passphrase) => set({ currentPassphrase: passphrase }),
      setCurrentUsername: (username) => set({ currentUsername: username }),
      
      addToHistory: (item) =>
        set((state) => ({
          history: [
            {
              ...item,
              id: generateUUID(),
              createdAt: new Date(),
            },
            ...state.history.slice(0, 99), // Keep only last 100 items
          ],
        })),
      
      removeFromHistory: (id) =>
        set((state) => ({
          history: state.history.filter((item) => item.id !== id),
        })),
      
      clearHistory: () => set({ history: [] }),
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      setIsGenerating: (generating) => set({ isGenerating: generating }),
      toggleNeumorphism: () => set((state) => ({ 
        isNeumorphismEnabled: !state.isNeumorphismEnabled 
      })),
      
      // Initialize user-specific storage
      initializeUserStorage: async () => {
        const release = await storageMutex.acquire();
        try {
          const storageKey = await getUserStorageKey();
          set({ userStorageKey: storageKey });
        } catch (error) {
          // Enhanced error handling with categorization
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          const errorType = error instanceof Error ? error.name : 'UnknownError';
          
          // Log structured error information without exposing sensitive data
          console.error('Storage initialization failed:', {
            type: errorType,
            message: errorMessage,
            timestamp: new Date().toISOString(),
            context: 'user-storage-initialization'
          });
          
          // Set a fallback storage key to prevent complete failure
          const fallbackKey = `securegen-fallback-${Date.now()}`;
          set({ userStorageKey: fallbackKey });
          
          // Re-throw with enhanced context for upstream handling
          throw new Error(`Storage initialization failed: ${errorMessage}`, { cause: error });
        } finally {
          release();
        }
      },
    }),
    {
      name: 'securegen-store', // This will be dynamically updated
      partialize: (state) => ({
        passwordConfig: state.passwordConfig,
        passphraseConfig: state.passphraseConfig,
        usernameConfig: state.usernameConfig,
        history: state.history,
        activeTab: state.activeTab,
        isNeumorphismEnabled: state.isNeumorphismEnabled,
        userStorageKey: state.userStorageKey,
      }),
      // Custom storage implementation to handle dynamic keys with mutex protection
      storage: {
        getItem: async () => {
          const release = await storageMutex.acquire();
          try {
            // Check if we're in a browser environment
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
              return null;
            }
            
            const key = userStorageKey || await getUserStorageKey();
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
          } catch (error) {
            // Enhanced error handling for storage retrieval
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            const errorType = error instanceof Error ? error.name : 'UnknownError';
            
            console.error('Storage retrieval failed:', {
              type: errorType,
              message: errorMessage,
              operation: 'getItem',
              timestamp: new Date().toISOString(),
              context: 'persistent-storage'
            });
            
            // Return null to allow graceful degradation
            return null;
          } finally {
            release();
          }
        },
        setItem: async (_name: string, value: unknown) => {
          const release = await storageMutex.acquire();
          try {
            // Check if we're in a browser environment
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
              return;
            }
            
            const key = userStorageKey || await getUserStorageKey();
            localStorage.setItem(key, JSON.stringify(value));
          } catch (error) {
            // Enhanced error handling for storage persistence
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            const errorType = error instanceof Error ? error.name : 'UnknownError';
            
            console.error('Storage persistence failed:', {
              type: errorType,
              message: errorMessage,
              operation: 'setItem',
              timestamp: new Date().toISOString(),
              context: 'persistent-storage',
              // Check if it's a quota exceeded error
              isQuotaError: errorType === 'QuotaExceededError' || errorMessage.includes('quota')
            });
            
            // For quota errors, we might want to clear old data or notify the user
            if (errorType === 'QuotaExceededError' || errorMessage.includes('quota')) {
              console.warn('Storage quota exceeded. Consider clearing old data.');
            }
          } finally {
            release();
          }
        },
        removeItem: async () => {
          const release = await storageMutex.acquire();
          try {
            // Check if we're in a browser environment
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
              return;
            }
            
            const key = userStorageKey || await getUserStorageKey();
            localStorage.removeItem(key);
          } catch (error) {
            // Enhanced error handling for storage removal
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            const errorType = error instanceof Error ? error.name : 'UnknownError';
            
            console.error('Storage removal failed:', {
              type: errorType,
              message: errorMessage,
              operation: 'removeItem',
              timestamp: new Date().toISOString(),
              context: 'persistent-storage'
            });
            
            // For removal operations, we might want to continue despite errors
            // as the goal is to clean up data anyway
          } finally {
            release();
          }
        },
      },
    }
  )
);

// Initialize the store with user-specific storage on first load
if (typeof window !== 'undefined') {
  // Initialize enhanced storage system
  initializeEnhancedStorage();
  
  // Initialize user storage when the module loads
  useAppStore.getState().initializeUserStorage().catch((error) => {
    // Enhanced error handling for module initialization
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorType = error instanceof Error ? error.name : 'UnknownError';
    
    console.error('Module initialization failed:', {
      type: errorType,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      context: 'module-initialization',
      severity: 'critical'
    });
    
    // In production, you might want to report this to an error tracking service
    // or show a user-friendly error message
  });
} 