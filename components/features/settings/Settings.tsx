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
  Cpu
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getSystemInformation } from '@/lib/hardware-id';
import { tauri, isTauriEnvironment } from '@/types/tauri';



export function Settings() {
  const [copied, setCopied] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState({
    hwid: 'Loading...',
    ip: 'Loading...',
    platform: 'Unknown',
    version: '1.0.0',
    buildNumber: '2024.001',
  });

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

 // Get IP address with proper timeout and user consent
 const controller = new AbortController();
 const timeoutId = setTimeout(() => controller.abort(), 5000);
 
 try {
   const response = await fetch('https://api.ipify.org?format=json', {
     signal: controller.signal,
     headers: { 'Accept': 'application/json' }
   });
   
   if (!response.ok) throw new Error('Network response was not ok');
   
   const data = await response.json();
   setSystemInfo(prev => ({ ...prev, ip: data.ip }));
 } catch (error) {
   console.warn('Failed to fetch IP address:', error);
   setSystemInfo(prev => ({ ...prev, ip: 'Not available' }));
 } finally {
   clearTimeout(timeoutId);
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
  }, []);

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
      </div>
    </div>
  );
} 