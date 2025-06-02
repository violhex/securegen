'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Copy, RefreshCw, Save, Eye, EyeOff, CheckCircle, AlertCircle, User } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { useGenerator } from '@/hooks/useGenerator';
import { usernameConfigSchema } from '@/lib/validations';
import { TauriAPI } from '@/lib/tauri';
import { cn } from '@/lib/utils';
import type { UsernameConfig } from '@/types';

export function UsernameGenerator() {
  const [showUsername, setShowUsername] = useState(true);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [strength, setStrength] = useState(0);
  const [strengthDetails, setStrengthDetails] = useState<{
    crack_times_display: string;
    feedback: string[];
  } | null>(null);
  
  const { 
    usernameConfig, 
    setUsernameConfig, 
    currentUsername 
  } = useAppStore();
  
  const { 
    generateUsername, 
    copyToClipboard, 
    savePasswordToFile,
    isLoading
  } = useGenerator();

  const form = useForm<UsernameConfig>({
    resolver: zodResolver(usernameConfigSchema),
    defaultValues: {
      type: usernameConfig.type || 'Word',
      capitalize: usernameConfig.capitalize ?? true,
      include_number: usernameConfig.include_number ?? false,
      email: usernameConfig.email || '',
      append_type: usernameConfig.append_type || 'Random',
      website: usernameConfig.website || '',
      domain: usernameConfig.domain || '',
      service: usernameConfig.service,
      forwarded_website: usernameConfig.forwarded_website || '',
    },
  });

  // Watch form changes and update store
  useEffect(() => {
    const subscription = form.watch((value) => {
      setUsernameConfig(value as UsernameConfig);
    });
    return () => subscription.unsubscribe();
  }, [form, setUsernameConfig]);

  // Generate initial username
  useEffect(() => {
    if (!currentUsername) {
      generateUsername();
    }
  }, [currentUsername, generateUsername]);

  // Calculate username strength when username changes
  useEffect(() => {
    if (currentUsername) {
      TauriAPI.calculatePasswordStrength(currentUsername)
        .then((result) => {
          setStrength(result.score);
          setStrengthDetails({
            crack_times_display: result.crack_times_display,
            feedback: result.feedback,
          });
        })
        .catch(() => {
          // Don't show toast for strength calculation errors as they're non-critical
          setStrength(0);
          setStrengthDetails(null);
        });
    } else {
      setStrength(0);
      setStrengthDetails(null);
    }
  }, [currentUsername]);

  const handleCopy = async () => {
    if (currentUsername) {
      try {
        const success = await copyToClipboard(currentUsername);
        if (success) {
          setCopied(true);
          toast.success('Copied to clipboard!');
          setTimeout(() => setCopied(false), 2000);
        }
      } catch (error) {
        toast.error('Failed to copy to clipboard', {
          description: error instanceof Error ? error.message : 'Copy operation failed',
        });
      }
    }
  };

  const handleSave = async () => {
    if (currentUsername) {
      try {
        const filePath = await savePasswordToFile(currentUsername);
        setSaved(true);
        setSaveMessage(`Username saved to: ${filePath}`);
        toast.success('Username saved successfully!', {
          description: `Saved to: ${filePath}`,
        });
        setTimeout(() => {
          setSaved(false);
          setSaveMessage('');
        }, 5000);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Save failed';
        setSaveMessage('Failed to save username');
        toast.error('Failed to save username', {
          description: errorMessage,
        });
        setTimeout(() => setSaveMessage(''), 3000);
      }
    }
  };

  const handleGenerate = async () => {
    try {
      await generateUsername();
      toast.success('Username generated successfully!');
    } catch (error) {
      toast.error('Failed to generate username', {
        description: error instanceof Error ? error.message : 'Generation failed',
        action: {
          label: 'Retry',
          onClick: () => handleGenerate(),
        },
      });
    }
  };

  const getStrengthLabel = (score: number) => {
    if (score < 30) return { label: 'Weak', color: 'strength-weak', icon: AlertCircle };
    if (score < 60) return { label: 'Fair', color: 'strength-fair', icon: AlertCircle };
    if (score < 80) return { label: 'Good', color: 'strength-good', icon: CheckCircle };
    return { label: 'Strong', color: 'strength-strong', icon: CheckCircle };
  };

  const strengthInfo = getStrengthLabel(strength);
  const StrengthIcon = strengthInfo.icon;

  const currentType = form.watch('type');

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="text-center space-y-4"
      >
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Username Generator
        </h1>
        <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
          Generate unique and secure usernames for your accounts. 
          Choose from word-based, subaddress, catchall, or forwarded email formats.
        </p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Panel */}
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          aria-labelledby="config-title"
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle id="config-title" className="flex items-center gap-3">
                <div className="card-flat p-2.5 rounded-lg bg-primary/10">
                  <User className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Username Type */}
              <div className="space-y-3">
                <Label htmlFor="type" className="text-sm font-medium text-foreground">
                  Username Type
                </Label>
                <Select
                  value={form.watch('type')}
                  onValueChange={(value: 'Word' | 'Subaddress' | 'Catchall' | 'Forwarded') => 
                    form.setValue('type', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select username type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Word">Word-based</SelectItem>
                    <SelectItem value="Subaddress">Email Subaddress</SelectItem>
                    <SelectItem value="Catchall">Catchall Email</SelectItem>
                    <SelectItem value="Forwarded">Forwarded Email</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {currentType === 'Word' && 'Generate a single word username from the EFF wordlist'}
                  {currentType === 'Subaddress' && 'Create email subaddresses like user+generated@domain.com'}
                  {currentType === 'Catchall' && 'Generate usernames for catchall email domains'}
                  {currentType === 'Forwarded' && 'Use email forwarding services for privacy'}
                </p>
              </div>

              {/* Word Type Options */}
              {currentType === 'Word' && (
                <fieldset className="space-y-4">
                  <legend className="text-sm font-medium text-foreground">Word Options</legend>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                      <div className="flex items-center space-x-3">
                        <Switch
                          id="capitalize"
                          checked={form.watch('capitalize') ?? true}
                          onCheckedChange={(checked) => 
                            form.setValue('capitalize', checked)
                          }
                          aria-describedby="capitalize-help"
                        />
                        <div>
                          <Label htmlFor="capitalize" className="text-sm font-medium">
                            Capitalize First Letter
                          </Label>
                          <p id="capitalize-help" className="text-xs text-muted-foreground">
                            Capitalize the first letter of the word
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                      <div className="flex items-center space-x-3">
                        <Switch
                          id="include_number"
                          checked={form.watch('include_number') ?? false}
                          onCheckedChange={(checked) => 
                            form.setValue('include_number', checked)
                          }
                          aria-describedby="include_number-help"
                        />
                        <div>
                          <Label htmlFor="include_number" className="text-sm font-medium">
                            Include 4-Digit Number
                          </Label>
                          <p id="include_number-help" className="text-xs text-muted-foreground">
                            Add a random 4-digit number to the end
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </fieldset>
              )}

              {/* Subaddress Type Options */}
              {currentType === 'Subaddress' && (
                <fieldset className="space-y-4">
                  <legend className="text-sm font-medium text-foreground">Subaddress Options</legend>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-foreground">
                        Base Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@example.com"
                        value={form.watch('email') || ''}
                        onChange={(e) => form.setValue('email', e.target.value)}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Your base email address for subaddressing
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="append_type" className="text-sm font-medium text-foreground">
                        Append Type
                      </Label>
                      <Select
                        value={form.watch('append_type') || 'Random'}
                        onValueChange={(value: 'Random' | 'WebsiteName') => 
                          form.setValue('append_type', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select append type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Random">Random String</SelectItem>
                          <SelectItem value="WebsiteName">Website Name</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {form.watch('append_type') === 'WebsiteName' && (
                      <div className="space-y-2">
                        <Label htmlFor="website" className="text-sm font-medium text-foreground">
                          Website Name
                        </Label>
                        <Input
                          id="website"
                          placeholder="example.com"
                          value={form.watch('website') || ''}
                          onChange={(e) => form.setValue('website', e.target.value)}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                </fieldset>
              )}

              {/* Catchall Type Options */}
              {currentType === 'Catchall' && (
                <fieldset className="space-y-4">
                  <legend className="text-sm font-medium text-foreground">Catchall Options</legend>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="domain" className="text-sm font-medium text-foreground">
                        Catchall Domain
                      </Label>
                      <Input
                        id="domain"
                        placeholder="example.com"
                        value={form.watch('domain') || ''}
                        onChange={(e) => form.setValue('domain', e.target.value)}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Domain that accepts all email addresses
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="catchall_append_type" className="text-sm font-medium text-foreground">
                        Username Type
                      </Label>
                      <Select
                        value={form.watch('append_type') || 'Random'}
                        onValueChange={(value: 'Random' | 'WebsiteName') => 
                          form.setValue('append_type', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select username type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Random">Random String</SelectItem>
                          <SelectItem value="WebsiteName">Website Name</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {form.watch('append_type') === 'WebsiteName' && (
                      <div className="space-y-2">
                        <Label htmlFor="catchall_website" className="text-sm font-medium text-foreground">
                          Website Name
                        </Label>
                        <Input
                          id="catchall_website"
                          placeholder="example.com"
                          value={form.watch('website') || ''}
                          onChange={(e) => form.setValue('website', e.target.value)}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                </fieldset>
              )}

              {/* Forwarded Type Options */}
              {currentType === 'Forwarded' && (
                <fieldset className="space-y-4">
                  <legend className="text-sm font-medium text-foreground">Email Forwarding Service</legend>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="service_type" className="text-sm font-medium text-foreground">
                        Forwarding Service
                      </Label>
                      <Select
                        value={form.watch('service')?.type || ''}
                        onValueChange={(value: 'AddyIo' | 'DuckDuckGo' | 'Firefox' | 'Fastmail' | 'ForwardEmail' | 'SimpleLogin') => {
                          const currentService = form.watch('service') || {};
                          form.setValue('service', { ...currentService, type: value });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select forwarding service" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AddyIo">Addy.io (AnonAddy)</SelectItem>
                          <SelectItem value="DuckDuckGo">DuckDuckGo Email Protection</SelectItem>
                          <SelectItem value="Firefox">Firefox Relay</SelectItem>
                          <SelectItem value="Fastmail">Fastmail</SelectItem>
                          <SelectItem value="ForwardEmail">ForwardEmail</SelectItem>
                          <SelectItem value="SimpleLogin">SimpleLogin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {form.watch('service')?.type && (
                      <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/50">
                        <p className="text-sm text-muted-foreground">
                          Configure your {form.watch('service')?.type} service settings:
                        </p>
                        
                        {/* API Token/Key field for most services */}
                        {['AddyIo', 'Firefox', 'Fastmail', 'ForwardEmail', 'SimpleLogin'].includes(form.watch('service')?.type || '') && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              {form.watch('service')?.type === 'SimpleLogin' ? 'API Key' : 'API Token'}
                            </Label>
                            <Input
                              type="password"
                              placeholder={`Enter your ${form.watch('service')?.type} ${form.watch('service')?.type === 'SimpleLogin' ? 'API key' : 'API token'}`}
                              value={form.watch('service')?.api_token || form.watch('service')?.api_key || ''}
                                                             onChange={(e) => {
                                 const currentService = form.watch('service') || { type: 'AddyIo' as const };
                                 const field = form.watch('service')?.type === 'SimpleLogin' ? 'api_key' : 'api_token';
                                 form.setValue('service', { ...currentService, [field]: e.target.value });
                               }}
                              className="w-full"
                            />
                          </div>
                        )}

                        {/* Token field for DuckDuckGo */}
                        {form.watch('service')?.type === 'DuckDuckGo' && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Token
                            </Label>
                            <Input
                              type="password"
                              placeholder="Enter your DuckDuckGo token"
                              value={form.watch('service')?.token || ''}
                                                             onChange={(e) => {
                                 const currentService = form.watch('service') || { type: 'DuckDuckGo' as const };
                                 form.setValue('service', { ...currentService, token: e.target.value });
                               }}
                              className="w-full"
                            />
                          </div>
                        )}

                        {/* Domain field for services that need it */}
                        {['AddyIo', 'ForwardEmail'].includes(form.watch('service')?.type || '') && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Domain
                            </Label>
                            <Input
                              placeholder="your-domain.com"
                              value={form.watch('service')?.domain || ''}
                              onChange={(e) => {
                                const currentService = form.watch('service') || { type: 'Fastmail' as const };
                                form.setValue('service', { ...currentService, domain: e.target.value });
                              }}
                              className="w-full"
                            />
                          </div>
                        )}

                        {/* Base URL for services that need it */}
                        {['AddyIo', 'SimpleLogin'].includes(form.watch('service')?.type || '') && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Base URL
                            </Label>
                            <Input
                              placeholder={form.watch('service')?.type === 'AddyIo' ? 'https://app.addy.io' : 'https://app.simplelogin.io'}
                              value={form.watch('service')?.base_url || ''}
                              onChange={(e) => {
                                const currentService = form.watch('service') || { type: 'AddyIo' as const };
                                form.setValue('service', { ...currentService, base_url: e.target.value });
                              }}
                              className="w-full"
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="forwarded_website" className="text-sm font-medium text-foreground">
                            Website (Optional)
                          </Label>
                          <Input
                            id="forwarded_website"
                            placeholder="example.com"
                            value={form.watch('forwarded_website') || ''}
                            onChange={(e) => form.setValue('forwarded_website', e.target.value)}
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground">
                            Website name for display purposes
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </fieldset>
              )}

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full btn-primary"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Generate Username
                  </>
                )}
              </Button>


            </CardContent>
          </Card>
        </motion.section>

        {/* Generated Username Display */}
        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
          aria-labelledby="result-title"
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle id="result-title" className="flex items-center gap-3">
                <div className="card-flat p-2.5 rounded-lg bg-primary/10">
                  <User className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                Generated Username
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Username Display */}
              <div className="space-y-4">
                <div className="relative">
                  <div className="card-flat p-4 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {showUsername ? (
                          <p className="font-mono text-lg font-medium text-foreground break-all">
                            {currentUsername || 'Click generate to create a username'}
                          </p>
                        ) : (
                          <p className="font-mono text-lg font-medium text-muted-foreground">
                            {'•'.repeat(currentUsername?.length || 20)}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowUsername(!showUsername)}
                        className="ml-2 text-muted-foreground hover:text-foreground"
                        aria-label={showUsername ? 'Hide username' : 'Show username'}
                      >
                        {showUsername ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Strength Meter */}
                {currentUsername && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Strength</span>
                      <div className="flex items-center gap-2">
                        <StrengthIcon className={cn("w-4 h-4", strengthInfo.color)} />
                        <Badge variant="secondary" className={cn("card-flat", strengthInfo.color)}>
                          {strengthInfo.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={cn("h-2 rounded-full transition-all duration-300", strengthInfo.color)}
                        style={{ width: `${strength}%` }}
                      />
                    </div>
                    {strengthDetails && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          <strong>Time to crack:</strong> {strengthDetails.crack_times_display}
                        </p>
                        {strengthDetails.feedback.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-foreground">Suggestions:</p>
                            {strengthDetails.feedback.map((feedback, index) => (
                              <p key={index} className="text-xs text-muted-foreground">
                                • {feedback}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleCopy}
                    disabled={!currentUsername}
                    className="flex-1 btn-secondary"
                    variant="outline"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!currentUsername}
                    className="flex-1 btn-secondary"
                    variant="outline"
                  >
                    {saved ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                        Saved!
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                </div>

                {saveMessage && (
                  <div className={cn(
                    "p-3 rounded-lg text-sm",
                    saved 
                      ? "bg-green-50 border border-green-200 text-green-800" 
                      : "bg-red-50 border border-red-200 text-red-800"
                  )}>
                    {saveMessage}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.section>
            </div>
    </div>
  );
} 