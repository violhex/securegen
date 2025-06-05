import { useEffect } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useAppStore } from '@/lib/store';

interface TrayEventPayload {
  // Empty payload for our simple events
}

export function useSystemTray() {
  const { setActiveTab } = useAppStore();

  useEffect(() => {
    let unlistenPassword: UnlistenFn | undefined;
    let unlistenPassphrase: UnlistenFn | undefined;
    let unlistenUsername: UnlistenFn | undefined;

    const setupTrayListeners = async () => {
      try {
        // Listen for tray-generated password requests
        unlistenPassword = await listen<TrayEventPayload>('tray-generate-password', () => {
          // Switch to password tab and trigger generation
          setActiveTab('password');
          // The password generator component will handle the actual generation
          const event = new CustomEvent('tray-generate-password');
          window.dispatchEvent(event);
        });

        // Listen for tray-generated passphrase requests
        unlistenPassphrase = await listen<TrayEventPayload>('tray-generate-passphrase', () => {
          // Switch to passphrase tab and trigger generation
          setActiveTab('passphrase');
          // The passphrase generator component will handle the actual generation
          const event = new CustomEvent('tray-generate-passphrase');
          window.dispatchEvent(event);
        });

        // Listen for tray-generated username requests
        unlistenUsername = await listen<TrayEventPayload>('tray-generate-username', () => {
          // Switch to username tab and trigger generation
          setActiveTab('username');
          // The username generator component will handle the actual generation
          const event = new CustomEvent('tray-generate-username');
          window.dispatchEvent(event);
        });
      } catch (error) {
        console.error('Failed to setup tray event listeners:', error);
      }
    };

    setupTrayListeners();

    // Cleanup listeners on unmount
    return () => {
      if (unlistenPassword) {
        unlistenPassword();
      }
      if (unlistenPassphrase) {
        unlistenPassphrase();
      }
      if (unlistenUsername) {
        unlistenUsername();
      }
    };
  }, [setActiveTab]);

  return {
    // Could expose additional tray-related functions here if needed
  };
} 