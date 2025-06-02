import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  PasswordConfig, 
  PassphraseConfig, 
  UsernameConfig, 
  GeneratedItem,
  GeneratorType 
} from '@/types';

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
              id: crypto.randomUUID(),
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