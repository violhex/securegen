import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateHardwareId } from '@/lib/hardware-id';
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

// Generate user-specific storage key based on hardware ID
let userStorageKey: string | null = null;

async function getUserStorageKey(): Promise<string> {
  if (userStorageKey) {
    return userStorageKey;
  }
  
  try {
    const hardwareId = await generateHardwareId();
    // Create a shorter, more manageable key from the hardware ID
    const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hardwareId));
    const keyArray = Array.from(new Uint8Array(keyHash));
    const shortKey = keyArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
    
    userStorageKey = `securegen-store-${shortKey}`;
    return userStorageKey;
  } catch (error) {
    console.warn('Failed to generate user-specific storage key, using fallback:', error);
    // Fallback to a timestamp-based key to ensure uniqueness
    const fallbackKey = `securegen-store-${Date.now().toString(16)}`;
    userStorageKey = fallbackKey;
    return fallbackKey;
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
    (set, get) => ({
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
        try {
          const storageKey = await getUserStorageKey();
          set({ userStorageKey: storageKey });
          
          // Log for debugging (remove in production)
          console.log(`Initialized user-specific storage with key: ${storageKey}`);
        } catch (error) {
          console.error('Failed to initialize user-specific storage:', error);
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
      // Custom storage implementation to handle dynamic keys
      storage: {
        getItem: async (name: string) => {
          try {
            // Check if we're in a browser environment
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
              return null;
            }
            
            const key = userStorageKey || await getUserStorageKey();
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
          } catch (error) {
            console.error('Failed to get item from storage:', error);
            return null;
          }
        },
        setItem: async (name: string, value: any) => {
          try {
            // Check if we're in a browser environment
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
              return;
            }
            
            const key = userStorageKey || await getUserStorageKey();
            localStorage.setItem(key, JSON.stringify(value));
          } catch (error) {
            console.error('Failed to set item in storage:', error);
          }
        },
        removeItem: async (name: string) => {
          try {
            // Check if we're in a browser environment
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
              return;
            }
            
            const key = userStorageKey || await getUserStorageKey();
            localStorage.removeItem(key);
          } catch (error) {
            console.error('Failed to remove item from storage:', error);
          }
        },
      },
    }
  )
);

// Initialize the store with user-specific storage on first load
if (typeof window !== 'undefined') {
  // Initialize user storage when the module loads
  useAppStore.getState().initializeUserStorage().catch(console.error);
} 