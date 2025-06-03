'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Copy, RefreshCw, Save, Eye, EyeOff, CheckCircle, AlertCircle, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useGenerator } from '@/hooks/useGenerator';
import { passphraseConfigSchema } from '@/lib/validations';
import { TauriAPI } from '@/lib/tauri';
import { cn } from '@/lib/utils';
import type { PassphraseConfig } from '@/types';

// Strength scoring constants
const MAX_STRENGTH = 100;
const STRENGTH_THRESHOLDS = {
  WEAK: MAX_STRENGTH * 0.25,    // 25 - corresponds to raw score 0-1
  FAIR: MAX_STRENGTH * 0.5,     // 50 - corresponds to raw score 1-2
  GOOD: MAX_STRENGTH * 0.75,    // 75 - corresponds to raw score 2-3
  STRONG: MAX_STRENGTH          // 100 - corresponds to raw score 3-4
} as const;

export function PassphraseGenerator() {
  const [showPassphrase, setShowPassphrase] = useState(true);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [strength, setStrength] = useState(0);
  const [strengthDetails, setStrengthDetails] = useState<{
    crack_times_display: string;
    feedback: string[];
  } | null>(null);
  
  const { 
    passphraseConfig, 
    setPassphraseConfig, 
    currentPassphrase 
  } = useAppStore();
  
  const { 
    generatePassphrase, 
    copyToClipboard, 
    savePasswordToFile,
    isLoading, 
    error 
  } = useGenerator();

  const form = useForm<PassphraseConfig>({
    resolver: zodResolver(passphraseConfigSchema),
    defaultValues: passphraseConfig,
  });

  // Watch form changes and update store
  useEffect(() => {
    const subscription = form.watch((value) => {
      setPassphraseConfig(value as PassphraseConfig);
    });
    return () => subscription.unsubscribe();
  }, [form, setPassphraseConfig]);

  // Generate initial passphrase
  useEffect(() => {
    if (!currentPassphrase) {
      generatePassphrase();
    }
  }, [currentPassphrase, generatePassphrase]);

  // Calculate passphrase strength when passphrase changes
  useEffect(() => {
    if (currentPassphrase) {
      TauriAPI.calculatePasswordStrength(currentPassphrase)
        .then((result) => {
          // Convert 0-4 scale to 0-100 percentage scale
          setStrength(result.score * (MAX_STRENGTH / 4));
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
  }, [currentPassphrase]);

  const handleCopy = async () => {
    if (currentPassphrase) {
      try {
        const success = await copyToClipboard(currentPassphrase);
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
    if (currentPassphrase) {
      try {
        const filePath = await savePasswordToFile(currentPassphrase);
        setSaved(true);
        setSaveMessage(`Passphrase saved to: ${filePath}`);
        toast.success('Passphrase saved successfully!', {
          description: `Saved to: ${filePath}`,
        });
        setTimeout(() => {
          setSaved(false);
          setSaveMessage('');
        }, 5000);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Save failed';
        setSaveMessage('Failed to save passphrase');
        toast.error('Failed to save passphrase', {
          description: errorMessage,
        });
        setTimeout(() => setSaveMessage(''), 3000);
      }
    }
  };

  const handleGenerate = async () => {
    try {
      await generatePassphrase();
      toast.success('Passphrase generated successfully!');
    } catch (error) {
      toast.error('Failed to generate passphrase', {
        description: error instanceof Error ? error.message : 'Generation failed',
        action: {
          label: 'Retry',
          onClick: () => handleGenerate(),
        },
      });
    }
  };

  const getStrengthLabel = (score: number) => {
    // Score is now 0-100 (converted from 0-4 scale)
    if (score < STRENGTH_THRESHOLDS.WEAK) return { label: 'Weak', color: 'strength-weak', icon: AlertCircle };
    if (score < STRENGTH_THRESHOLDS.FAIR) return { label: 'Fair', color: 'strength-fair', icon: AlertCircle };
    if (score < STRENGTH_THRESHOLDS.GOOD) return { label: 'Good', color: 'strength-good', icon: CheckCircle };
    return { label: 'Strong', color: 'strength-strong', icon: CheckCircle };
  };

  const strengthInfo = getStrengthLabel(strength);
  const StrengthIcon = strengthInfo.icon;

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
          Passphrase Generator
        </h1>
        <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
          Generate memorable yet secure passphrases using cryptographically random words. 
          Perfect for master passwords and high-security applications.
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
                  <Hash className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Word Count Slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="wordCount" className="text-sm font-medium text-foreground">
                    Number of Words
                  </Label>
                  <Badge variant="secondary" className="card-flat font-mono">
                    {form.watch('wordCount')} words
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Controller
                    name="wordCount"
                    control={form.control}
                    render={({ field }) => (
                      <Slider
                        id="wordCount"
                        min={3}
                        max={20}
                        step={1}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="w-full"
                        aria-describedby="wordCount-help"
                      />
                    )}
                  />
                  <p id="wordCount-help" className="text-xs text-muted-foreground">
                    Recommended: 4-6 words for most uses, 7+ for maximum security, up to 20 words supported
                  </p>
                </div>
              </div>

              {/* Word Separator */}
              <div className="space-y-3">
                <Label htmlFor="separator" className="text-sm font-medium text-foreground">
                  Word Separator
                </Label>
                <Input
                  id="separator"
                  {...form.register('separator')}
                  placeholder="Enter separator"
                  maxLength={5}
                  className="font-mono"
                  aria-describedby="separator-help"
                />
                <p id="separator-help" className="text-xs text-muted-foreground">
                  Character(s) to separate words. Common: - (dash), _ (underscore), . (period), space
                </p>
              </div>

              {/* Options */}
              <fieldset className="space-y-4">
                <legend className="text-sm font-medium text-foreground">Passphrase Options</legend>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center space-x-3">
                      <Controller
                        name="capitalize"
                        control={form.control}
                        render={({ field }) => (
                          <Switch
                            id="capitalize"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-describedby="capitalize-help"
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="capitalize" className="text-sm font-medium">
                          Capitalize Words
                        </Label>
                        <p id="capitalize-help" className="text-xs text-muted-foreground">
                          Capitalize the first letter of each word
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center space-x-3">
                      <Controller
                        name="includeNumbers"
                        control={form.control}
                        render={({ field }) => (
                          <Switch
                            id="includeNumbers"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-describedby="includeNumbers-help"
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="includeNumbers" className="text-sm font-medium">
                          Include Numbers
                        </Label>
                        <p id="includeNumbers-help" className="text-xs text-muted-foreground">
                          Add a random number to one of the words
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full card-elevated hover:card-elevated"
                size="lg"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                {isLoading ? 'Generating...' : 'Generate New Passphrase'}
              </Button>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm" role="alert">
                  <strong>Error:</strong> {error}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.section>

        {/* Generated Passphrase Panel */}
        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
          aria-labelledby="passphrase-title"
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle id="passphrase-title" className="flex items-center gap-3">
                <div className="card-flat p-2.5 rounded-lg bg-success/10">
                  <StrengthIcon className="w-5 h-5 text-success" aria-hidden="true" />
                </div>
                Generated Passphrase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Passphrase Display */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="passphrase-output" className="text-sm font-medium">
                    Your Passphrase
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                  >
                    {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                
                <div className="relative">
                  <Textarea
                    id="passphrase-output"
                    value={showPassphrase ? currentPassphrase || '' : '••••••••••••••••'}
                    readOnly
                    className="password-display resize-none min-h-[80px] text-base"
                    aria-describedby="passphrase-help"
                  />
                  <p id="passphrase-help" className="sr-only">
                    Generated passphrase. Use the copy button to copy to clipboard.
                  </p>
                </div>
              </div>

              {/* Passphrase Strength */}
              {currentPassphrase && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Passphrase Strength</Label>
                    <Badge 
                      variant="secondary" 
                      className={cn("card-flat", strengthInfo.color)}
                    >
                      <StrengthIcon className="w-3 h-3 mr-1" aria-hidden="true" />
                      {strengthInfo.label}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="strength-meter" role="progressbar" aria-valuenow={strength} aria-valuemin={0} aria-valuemax={100}>
                      <div 
                        className={cn("strength-bar", strengthInfo.color)}
                        style={{ width: `${strength}%` }}
                      />
                    </div>
                    
                    {strengthDetails && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>
                          <strong>Time to crack:</strong> {strengthDetails.crack_times_display}
                        </p>
                        {strengthDetails.feedback.length > 0 && (
                          <div>
                            <strong>Suggestions:</strong>
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                              {strengthDetails.feedback.map((feedback, index) => (
                                <li key={index}>{feedback}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Passphrase Info */}
              {currentPassphrase && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Passphrase Details</Label>
                  <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                    <div className="space-y-1">
                      <p><strong>Words:</strong> {form.watch('wordCount')}</p>
                      <p><strong>Separator:</strong> &quot;{form.watch('separator')}&quot;</p>
                    </div>
                    <div className="space-y-1">
                      <p><strong>Capitalized:</strong> {form.watch('capitalize') ? 'Yes' : 'No'}</p>
                      <p><strong>Numbers:</strong> {form.watch('includeNumbers') ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Button
                    onClick={handleCopy}
                    disabled={!currentPassphrase}
                    className="flex-1 card-elevated hover:card-elevated"
                    variant={copied ? "default" : "outline"}
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Passphrase
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleSave}
                    variant="outline"
                    className="card-flat hover:card-elevated"
                    disabled={!currentPassphrase || isLoading}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saved ? 'Saved!' : 'Save'}
                  </Button>
                </div>

                {/* Save Message */}
                {saveMessage && (
                  <div className={cn(
                    "p-3 rounded-lg text-sm",
                    saved 
                      ? "bg-success/10 border border-success/20 text-success" 
                      : "bg-destructive/10 border border-destructive/20 text-destructive"
                  )} role="alert">
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