'use client';

import { useAppStore } from '@/lib/store';
import { AppLayout } from '@/components/layout/AppLayout';
import { StorageProvider } from '@/components/providers/StorageProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { PasswordGenerator } from '@/components/features/password-generator/PasswordGenerator';
import { PassphraseGenerator } from '@/components/features/passphrase-generator/PassphraseGenerator';
import { UsernameGenerator } from '@/components/features/username-generator/UsernameGenerator';
import { History } from '@/components/features/history/History';
import { Settings } from '@/components/features/settings/Settings';

export default function HomePage() {
  const { activeTab } = useAppStore();

  const renderContent = () => {
    switch (activeTab) {
      case 'password':
        return <PasswordGenerator />;
      case 'passphrase':
        return <PassphraseGenerator />;
      case 'username':
        return <UsernameGenerator />;
      case 'history':
        return <History />;
      case 'settings':
        return <Settings />;
      default:
        return <PasswordGenerator />;
    }
  };

  return (
    <StorageProvider>
      <ThemeProvider>
        <AppLayout>
          {renderContent()}
        </AppLayout>
      </ThemeProvider>
    </StorageProvider>
  );
}
