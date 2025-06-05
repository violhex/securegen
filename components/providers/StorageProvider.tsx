'use client';

import { useEffect, useState } from 'react';
import { performStorageMigration, hasLegacyStorage } from '@/lib/storage-migration';
import { toast } from 'sonner';

interface StorageProviderProps {
  children: React.ReactNode;
}

export function StorageProvider({ children }: StorageProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeStorage = async () => {
      try {
        // Check if we need to perform migration
        const hasLegacy = hasLegacyStorage();
        
        if (hasLegacy) {
          console.log('Legacy storage detected, performing migration...');
          
          // Show a toast to inform the user
          toast.info('Migrating your data to user-specific storage...', {
            description: 'This ensures your password history is private to you.',
            duration: 3000,
          });
          
          const result = await performStorageMigration();
          
          if (result.migrated) {
            toast.success('Data migration completed successfully!', {
              description: 'Your password history is now private to your user account.',
              duration: 5000,
            });
          }
          
          if (result.oldStorageCleaned > 0) {
            console.log(`Cleaned up ${result.oldStorageCleaned} old storage entries`);
          }
        } else {
          console.log('No legacy storage found, proceeding with user-specific storage');
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize storage:', error);
        
        toast.error('Storage initialization failed', {
          description: 'Some features may not work correctly. Please refresh the app.',
          duration: 10000,
        });
        
        // Still mark as initialized to prevent blocking the app
        setIsInitialized(true);
      }
    };

    initializeStorage();
  }, []);

  // Show a loading state while initializing storage
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">
            Initializing SecureGen...
          </p>
          {hasLegacyStorage() && (
            <p className="text-xs text-muted-foreground">
              Migrating your data to user-specific storage
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 