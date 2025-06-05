'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  Power, 
  LogOut, 
  Monitor, 
  Globe, 
  Copy, 
  CheckCircle,
  AlertCircle,
  Shield,
  User,
  HardDrive,
  Cpu,
  Database,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Wrench
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getSystemInformation } from '@/lib/hardware-id';
import { tauri, isTauriEnvironment } from '@/types/tauri';
import { 
  hasLegacyStorage, 
  clearLegacyStorage,
  cleanupOldStorage,
  getStorageDetails
} from '@/lib/storage-migration';
import { 
  StorageIntegrityManager, 
  StorageKeyManager 
} from '@/lib/storage-enhanced';
import { useAppStore } from '@/lib/store';
import { TauriAPI } from '@/lib/tauri';



export function Settings() {
  const [copied, setCopied] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState({
    hwid: 'Loading...',
    ip: 'Loading...',
    platform: 'Unknown',
    version: '1.0.0',
    buildNumber: '2024.001',
  });
  const [storageInfo, setStorageInfo] = useState({
    currentUserKey: '',
    totalStorageKeys: 0,
    userSpecificKeys: 0,
    hasLegacy: false,
    historyCount: 0,
    legacyKey: null as string | null,
  });

  const [storageOperations, setStorageOperations] = useState({
    isPerformingIntegrityCheck: false,
    isExporting: false,
    isImporting: false,
    lastIntegrityCheck: null as Date | null,
    integrityResult: null as {
      valid: boolean;
      issues: string[];
      cleanedEntries: number;
      migratedEntries: number;
    } | null,
  });

  const { history, clearHistory, userStorageKey } = useAppStore();

 // Obfuscated display key - actual key should come from secure storage
 const displayApiKey = 'bw_api_****************************';

  useEffect(() => {
    const initializeSystemInfo = async () => {
      try {
        // Get comprehensive system information including hardware ID
        const sysInfo = await getSystemInformation();

        // Get real app version from Tauri if available
        let appVersion = '1.0.0';
        let buildNumber = '2024.001';
        
        if (isTauriEnvironment() && tauri.app) {
          try {
            appVersion = await tauri.app.getVersion();
            // Extract build number from version if present
            const versionParts = appVersion.split('-');
            if (versionParts.length > 1) {
              buildNumber = versionParts[1];
              appVersion = versionParts[0];
            }
          } catch (error) {
            console.warn('Failed to get Tauri app version:', error);
          }
        }

        // Update system info with all collected data
        setSystemInfo(prev => ({
          ...prev,
          hwid: sysInfo.hardwareId,
          version: appVersion,
          buildNumber,
          platform: sysInfo.platform,
        }));

        // Update storage information with detailed breakdown
        const storageDetails = await getStorageDetails();
        setStorageInfo({
          currentUserKey: userStorageKey || 'Generating...',
          totalStorageKeys: storageDetails.totalEntries,
          userSpecificKeys: storageDetails.userSpecificKeys.length,
          hasLegacy: storageDetails.hasLegacy,
          historyCount: history.length,
          legacyKey: storageDetails.legacyKey,
        });

        // Get IP address using Tauri's HTTP client for better security
        try {
          const maskedIp = await TauriAPI.getPublicIPAddress();
          setSystemInfo(prev => ({ ...prev, ip: maskedIp }));
        } catch (error) {
          console.warn('Failed to fetch IP address:', error);
          setSystemInfo(prev => ({ ...prev, ip: 'Not available' }));
        }
      } catch (error) {
        console.warn('Failed to get system information:', error);
        setSystemInfo(prev => ({
          ...prev,
          platform: navigator.platform,
          hwid: 'HWID-ERROR-GENERATING-ID',
        }));
      }
    };

    initializeSystemInfo();
  }, [history.length, userStorageKey]);

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success(`${type} copied to clipboard!`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error(`Failed to copy ${type.toLowerCase()}`, {
        description: 'Clipboard operation failed',
      });
    }
  };

  const handleCloseApplication = async () => {
    try {
      // Check if we're running in a Tauri environment
      if (isTauriEnvironment() && tauri.process) {
        await tauri.process.exit(0);
      } else {
        // Fallback for development environment
        toast.info('Close application functionality', {
          description: 'This would close the SecureGen application in production',
        });
      }
    } catch (error) {
      toast.error('Failed to close application', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleLogOut = () => {
    // Placeholder for logout functionality
    toast.info('Logout functionality not yet implemented', {
      description: 'This will be available in future versions',
    });
  };

  const handleClearHistory = () => {
    try {
      clearHistory();
      setStorageInfo(prev => ({ ...prev, historyCount: 0 }));
      toast.success('Password history cleared successfully!');
    } catch (error) {
      toast.error('Failed to clear history', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleClearLegacyStorage = () => {
    try {
      if (!hasLegacyStorage()) {
        toast.info('No legacy storage found to clear');
        return;
      }
      
      const success = clearLegacyStorage();
      if (success) {
        setStorageInfo(prev => ({ ...prev, hasLegacy: false, legacyKey: null }));
        toast.success('Legacy storage cleared successfully!');
      } else {
        toast.error('Failed to clear legacy storage');
      }
    } catch (error) {
      toast.error('Failed to clear legacy storage', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleCleanupOldStorage = async () => {
    try {
      const cleanedCount = await cleanupOldStorage();
      const storageDetails = await getStorageDetails();
      
      setStorageInfo(prev => ({ 
        ...prev, 
        totalStorageKeys: storageDetails.totalEntries,
        userSpecificKeys: storageDetails.userSpecificKeys.length
      }));
      
      if (cleanedCount > 0) {
        toast.success(`Cleaned up ${cleanedCount} old storage entries!`);
      } else {
        toast.info('No old storage entries found to clean up');
      }
    } catch (error) {
      toast.error('Failed to cleanup old storage', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleStorageIntegrityCheck = async () => {
    try {
      setStorageOperations(prev => ({ ...prev, isPerformingIntegrityCheck: true }));
      
      const result = await StorageIntegrityManager.performIntegrityCheck();
      
      setStorageOperations(prev => ({
        ...prev,
        isPerformingIntegrityCheck: false,
        lastIntegrityCheck: new Date(),
        integrityResult: result,
      }));

      if (result.valid) {
        toast.success('Storage integrity check passed!', {
          description: result.cleanedEntries > 0 
            ? `Cleaned ${result.cleanedEntries} corrupted entries` 
            : 'All storage entries are valid',
        });
      } else {
        toast.warning('Storage integrity issues found', {
          description: `${result.issues.length} issues detected and addressed`,
        });
      }

      // Refresh storage info
      const storageDetails = await getStorageDetails();
      setStorageInfo(prev => ({
        ...prev,
        totalStorageKeys: storageDetails.totalEntries,
        userSpecificKeys: storageDetails.userSpecificKeys.length,
      }));
    } catch (error) {
      setStorageOperations(prev => ({ ...prev, isPerformingIntegrityCheck: false }));
      toast.error('Storage integrity check failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleExportData = async () => {
    try {
      setStorageOperations(prev => ({ ...prev, isExporting: true }));
      
      const exportData = await StorageIntegrityManager.exportUserData();
      
      // Create downloadable file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `securegen-backup-${timestamp}.json`;
      
      // Trigger download (works in both Tauri and browser environments)
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Data exported successfully!', {
        description: `Backup downloaded as ${filename}`,
      });
    } catch (error) {
      toast.error('Failed to export data', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setStorageOperations(prev => ({ ...prev, isExporting: false }));
    }
  };

  const handleImportData = async () => {
    try {
      setStorageOperations(prev => ({ ...prev, isImporting: true }));
      
      // Use file input (works in both Tauri and browser environments)
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          // Reset flag if no file selected
          setStorageOperations(prev => ({ ...prev, isImporting: false }));
          return;
        }
        
        try {
          const text = await file.text();
          const importData = JSON.parse(text);
          
          const success = await StorageIntegrityManager.importUserData(importData);
          
          if (success) {
            toast.success('Data imported successfully!', {
              description: 'Your settings and history have been restored',
            });
            
            // Refresh the page to load imported data
            window.location.reload();
          } else {
            toast.error('Failed to import data', {
              description: 'The backup file may be corrupted or incompatible',
            });
          }
        } catch (parseError: unknown) {
          console.error('Failed to parse backup file:', parseError);
          toast.error('Invalid backup file', {
            description: 'The selected file is not a valid SecureGen backup',
          });
        } finally {
          // Reset flag after import completes (success or failure)
          setStorageOperations(prev => ({ ...prev, isImporting: false }));
        }
      };
      input.click();
    } catch (error) {
      toast.error('Failed to import data', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
      // Reset flag on immediate error (before file selection)
      setStorageOperations(prev => ({ ...prev, isImporting: false }));
    }
  };

  const handleResetStorageKey = async () => {
    try {
      // Clear the storage key cache to force regeneration
      StorageKeyManager.clearCache();
      
      toast.success('Storage key reset!', {
        description: 'The app will regenerate your storage key on next startup',
      });
      
      // Refresh storage info
      setTimeout(async () => {
        const storageDetails = await getStorageDetails();
        setStorageInfo(prev => ({
          ...prev,
          currentUserKey: 'Will regenerate on restart',
          totalStorageKeys: storageDetails.totalEntries,
        }));
      }, 1000);
    } catch (error) {
      toast.error('Failed to reset storage key', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="text-center space-y-4"
      >
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
          Manage your SecureGen application preferences and view system information.
        </p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Application Controls */}
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="card-flat p-2.5 rounded-lg bg-primary/10">
                  <SettingsIcon className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                Application Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Button
                  onClick={handleLogOut}
                  variant="outline"
                  className="w-full justify-start card-flat hover:card-elevated"
                  disabled
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  Log Out
                  <Badge variant="secondary" className="ml-auto">
                    Coming Soon
                  </Badge>
                </Button>
                
                <Separator />
                
                <Button
                  onClick={handleCloseApplication}
                  variant="destructive"
                  className="w-full justify-start"
                >
                  <Power className="w-4 h-4 mr-3" />
                  Close Application
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* User Information */}
        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="card-flat p-2.5 rounded-lg bg-success/10">
                  <User className="w-5 h-5 text-success" aria-hidden="true" />
                </div>
                User Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">API Key</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-border font-mono text-sm">
                      {displayApiKey}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(displayApiKey, 'API Key')}
                      className="card-flat hover:card-elevated"
                    >
                      {copied === 'API Key' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your Bitwarden API key for authentication
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* System Information */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="lg:col-span-2"
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="card-flat p-2.5 rounded-lg bg-info/10">
                  <Monitor className="w-5 h-5 text-info" aria-hidden="true" />
                </div>
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    Hardware ID (HWID)
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 rounded bg-muted/50 border border-border font-mono text-xs">
                      {systemInfo.hwid}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(systemInfo.hwid, 'HWID')}
                      className="h-8 w-8 p-0"
                    >
                      {copied === 'HWID' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    IP Address
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 rounded bg-muted/50 border border-border font-mono text-xs">
                      {systemInfo.ip}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(systemInfo.ip, 'IP Address')}
                      className="h-8 w-8 p-0"
                    >
                      {copied === 'IP Address' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-muted-foreground" />
                    Platform
                  </Label>
                  <div className="p-2 rounded bg-muted/50 border border-border font-mono text-xs">
                    {systemInfo.platform}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    Version
                  </Label>
                  <div className="space-y-1">
                    <div className="p-2 rounded bg-muted/50 border border-border font-mono text-xs">
                      v{systemInfo.version}
                    </div>
                    <div className="p-1 rounded bg-muted/30 text-xs text-center text-muted-foreground">
                      Build {systemInfo.buildNumber}
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Security Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <p className="text-sm font-medium text-success">Encrypted Storage</p>
                      <p className="text-xs text-success/80">Local data is encrypted</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <p className="text-sm font-medium text-success">Secure Generation</p>
                      <p className="text-xs text-success/80">Using Bitwarden algorithms</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <AlertCircle className="w-5 h-5 text-warning" />
                    <div>
                      <p className="text-sm font-medium text-warning">Offline Mode</p>
                      <p className="text-xs text-warning/80">Not connected to vault</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Storage Management */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="lg:col-span-2"
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="card-flat p-2.5 rounded-lg bg-warning/10">
                  <Database className="w-5 h-5 text-warning" aria-hidden="true" />
                </div>
                Storage Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    User Storage Key
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 rounded bg-muted/50 border border-border font-mono text-xs">
                      {storageInfo.currentUserKey.length > 20 
                        ? `${storageInfo.currentUserKey.substring(0, 20)}...` 
                        : storageInfo.currentUserKey}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(storageInfo.currentUserKey, 'Storage Key')}
                      className="h-8 w-8 p-0"
                    >
                      {copied === 'Storage Key' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Database className="w-4 h-4 text-muted-foreground" />
                    Password History
                  </Label>
                  <div className="p-2 rounded bg-muted/50 border border-border text-xs text-center">
                    {storageInfo.historyCount} items
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    Storage Entries
                  </Label>
                  <div className="space-y-1">
                    <div className="p-2 rounded bg-muted/50 border border-border text-xs text-center">
                      {storageInfo.totalStorageKeys} total
                    </div>
                    <div className="p-1 rounded bg-muted/30 text-xs text-center text-muted-foreground">
                      {storageInfo.userSpecificKeys} user-specific
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    Legacy Storage
                  </Label>
                  <div className={`p-2 rounded border text-xs text-center ${
                    storageInfo.hasLegacy 
                      ? 'bg-warning/10 border-warning/20 text-warning' 
                      : 'bg-success/10 border-success/20 text-success'
                  }`}>
                    {storageInfo.hasLegacy ? 'Present' : 'Clean'}
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Storage Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    onClick={handleClearHistory}
                    className="justify-start card-flat hover:card-elevated"
                    disabled={storageInfo.historyCount === 0}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear History
                    <Badge variant="secondary" className="ml-auto">
                      {storageInfo.historyCount}
                    </Badge>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleClearLegacyStorage}
                    className="justify-start card-flat hover:card-elevated"
                    disabled={!storageInfo.hasLegacy}
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Clear Legacy
                    {storageInfo.hasLegacy && (
                      <Badge variant="destructive" className="ml-auto">
                        Found
                      </Badge>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleCleanupOldStorage}
                    className="justify-start card-flat hover:card-elevated"
                  >
                    <HardDrive className="w-4 h-4 mr-2" />
                    Cleanup Old
                    <Badge variant="secondary" className="ml-auto">
                      {storageInfo.userSpecificKeys}
                    </Badge>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleStorageIntegrityCheck}
                    className="justify-start card-flat hover:card-elevated"
                    disabled={storageOperations.isPerformingIntegrityCheck}
                  >
                    {storageOperations.isPerformingIntegrityCheck ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Wrench className="w-4 h-4 mr-2" />
                    )}
                    Check Integrity
                    {storageOperations.integrityResult && (
                      <Badge 
                        variant={storageOperations.integrityResult.valid ? "default" : "destructive"} 
                        className="ml-auto"
                      >
                        {storageOperations.integrityResult.valid ? "OK" : "Issues"}
                      </Badge>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleExportData}
                    className="justify-start card-flat hover:card-elevated"
                    disabled={storageOperations.isExporting}
                  >
                    {storageOperations.isExporting ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Export Data
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleImportData}
                    className="justify-start card-flat hover:card-elevated"
                    disabled={storageOperations.isImporting}
                  >
                    {storageOperations.isImporting ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Import Data
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleResetStorageKey}
                    className="justify-start card-flat hover:card-elevated col-span-full md:col-span-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reset Storage Key
                  </Button>
                </div>
                
                {/* Enhanced Storage Status */}
                {storageOperations.lastIntegrityCheck && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Last Integrity Check</p>
                      <Badge variant={storageOperations.integrityResult?.valid ? "default" : "destructive"}>
                        {storageOperations.integrityResult?.valid ? "Passed" : "Issues Found"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {storageOperations.lastIntegrityCheck.toLocaleString()}
                    </p>
                    {storageOperations.integrityResult && (
                      <div className="mt-2 text-xs">
                        {storageOperations.integrityResult.cleanedEntries > 0 && (
                          <p className="text-warning">• Cleaned {storageOperations.integrityResult.cleanedEntries} corrupted entries</p>
                        )}
                        {storageOperations.integrityResult.migratedEntries > 0 && (
                          <p className="text-success">• Migrated {storageOperations.integrityResult.migratedEntries} legacy entries</p>
                        )}
                        {storageOperations.integrityResult.issues.length > 0 && (
                          <p className="text-destructive">• {storageOperations.integrityResult.issues.length} issues detected</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3 rounded-lg bg-info/10 border border-info/20">
                  <p className="text-xs text-info">
                    <strong>Enhanced Storage:</strong> Your data is now protected with improved hardware fingerprinting, 
                    automatic integrity checks, and export/import capabilities for cross-device migration.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    </div>
  );
} 