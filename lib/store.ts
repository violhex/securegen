import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
}

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
    }),
    {
      name: 'securegen-store',
      partialize: (state) => ({
        passwordConfig: state.passwordConfig,
        passphraseConfig: state.passphraseConfig,
        usernameConfig: state.usernameConfig,
        history: state.history,
        activeTab: state.activeTab,
      }),
    }
  )
); 