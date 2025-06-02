'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Copy, RefreshCw, Save, Eye, EyeOff, CheckCircle, AlertCircle, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useGenerator } from '@/hooks/useGenerator';
import { passwordConfigSchema } from '@/lib/validations';
import { TauriAPI } from '@/lib/tauri';
import { cn } from '@/lib/utils';
import type { PasswordConfig } from '@/types';

export function PasswordGenerator() {
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [strength, setStrength] = useState(0);
  const [strengthDetails, setStrengthDetails] = useState<{
    crack_times_display: string;
    feedback: string[];
  } | null>(null);
  
  const { 
    passwordConfig, 
    setPasswordConfig, 
    currentPassword
  } = useAppStore();
  
  const { 
    generatePassword, 
    copyToClipboard, 
    savePasswordToFile,
    isLoading
  } = useGenerator();

  const form = useForm<PasswordConfig>({
    resolver: zodResolver(passwordConfigSchema),
    defaultValues: passwordConfig,
  });

  // Watch form changes and update store
  useEffect(() => {
    const subscription = form.watch((value) => {
      setPasswordConfig(value as PasswordConfig);
    });
    return () => subscription.unsubscribe();
  }, [form, setPasswordConfig]);

  // Generate initial password
  useEffect(() => {
    if (!currentPassword) {
      generatePassword();
    }
  }, [currentPassword, generatePassword]);

  // Calculate password strength when password changes
  useEffect(() => {
    if (currentPassword) {
      TauriAPI.calculatePasswordStrength(currentPassword)
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
  }, [currentPassword]);

  const handleCopy = async () => {
    if (currentPassword) {
      try {
        const success = await copyToClipboard(currentPassword);
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
    if (currentPassword) {
      try {
        const filePath = await savePasswordToFile(currentPassword);
        setSaved(true);
        setSaveMessage(`Password saved to: ${filePath}`);
        toast.success('Password saved successfully!', {
          description: `Saved to: ${filePath}`,
        });
        setTimeout(() => {
          setSaved(false);
          setSaveMessage('');
        }, 5000);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Save failed';
        setSaveMessage('Failed to save password');
        toast.error('Failed to save password', {
          description: errorMessage,
        });
        setTimeout(() => setSaveMessage(''), 3000);
      }
    }
  };

  const handleGenerate = async () => {
    try {
      await generatePassword();
      toast.success('Password generated successfully!');
    } catch (error) {
      toast.error('Failed to generate password', {
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

  const adjustMinValue = (field: 'min_lowercase' | 'min_uppercase' | 'min_number' | 'min_special', delta: number) => {
    const currentValue = (form.watch(field) as number) || 0;
    const maxAllowed = getMaxAllowedForField(field);
    const newValue = Math.max(0, Math.min(maxAllowed, currentValue + delta));
    form.setValue(field, newValue === 0 ? undefined : newValue);
  };

  const calculateTotalMinimums = () => {
    const config = form.watch();
    const min_lowercase = config.lowercase ? (config.min_lowercase || 0) : 0;
    const min_uppercase = config.uppercase ? (config.min_uppercase || 0) : 0;
    const min_number = config.numbers ? (config.min_number || 0) : 0;
    const min_special = config.special ? (config.min_special || 0) : 0;
    return min_lowercase + min_uppercase + min_number + min_special;
  };

  const getMaxAllowedForField = (field: 'min_lowercase' | 'min_uppercase' | 'min_number' | 'min_special') => {
    const currentValue = form.watch(field) || 0;
    const currentLength = form.watch('length');
    const totalOtherMins = calculateTotalMinimums() - currentValue;
    return Math.max(0, currentLength - totalOtherMins);
  };

  const totalMinimums = calculateTotalMinimums();
  const currentLength = form.watch('length');
  const hasMinimumError = totalMinimums > currentLength;



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
          Password Generator
        </h1>
        <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
          Generate cryptographically secure passwords using Bitwarden&apos;s proven algorithms. 
          Customize every aspect to meet your security requirements.
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
                  <RefreshCw className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Length Slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="length" className="text-sm font-medium text-foreground">
                    Password Length
                  </Label>
                  <Badge variant="secondary" className="card-flat font-mono">
                    {form.watch('length')} characters
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Slider
                    id="length"
                    min={4}
                    max={128}
                    step={1}
                    value={[form.watch('length')]}
                    onValueChange={(value) => form.setValue('length', value[0])}
                    className="w-full"
                    aria-describedby="length-help"
                  />
                  <p id="length-help" className="text-xs text-muted-foreground">
                    Recommended: 12-16 characters for most uses, 20+ for high security
                  </p>
                  {hasMinimumError && (
                    <p className="text-xs text-destructive">
                      Password length ({currentLength}) must be at least {totalMinimums} (sum of all minimums)
                    </p>
                  )}
                </div>
              </div>

              {/* Character Sets */}
              <fieldset className="space-y-4">
                <legend className="text-sm font-medium text-foreground">Character Sets</legend>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center space-x-3">
                      <Switch
                        id="uppercase"
                        checked={form.watch('uppercase')}
                        onCheckedChange={(checked) => {
                          form.setValue('uppercase', checked);
                          // Clear minimum when disabling character set
                          if (!checked) {
                            form.setValue('min_uppercase', undefined);
                          }
                        }}
                        aria-describedby="uppercase-help"
                      />
                      <div>
                        <Label htmlFor="uppercase" className="text-sm font-medium">
                          Uppercase Letters
                        </Label>
                        <p id="uppercase-help" className="text-xs text-muted-foreground">
                          A-Z (26 characters)
                        </p>
                      </div>
                    </div>
                    {form.watch('uppercase') && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Min:</Label>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => adjustMinValue('min_uppercase', -1)}
                            disabled={!form.watch('min_uppercase')}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-xs font-mono">
                            {form.watch('min_uppercase') || 0}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => adjustMinValue('min_uppercase', 1)}
                            disabled={(form.watch('min_uppercase') || 0) >= getMaxAllowedForField('min_uppercase')}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center space-x-3">
                      <Switch
                        id="lowercase"
                        checked={form.watch('lowercase')}
                        onCheckedChange={(checked) => {
                          form.setValue('lowercase', checked);
                          if (!checked) {
                            form.setValue('min_lowercase', undefined);
                          }
                        }}
                        aria-describedby="lowercase-help"
                      />
                      <div>
                        <Label htmlFor="lowercase" className="text-sm font-medium">
                          Lowercase Letters
                        </Label>
                        <p id="lowercase-help" className="text-xs text-muted-foreground">
                          a-z (26 characters)
                        </p>
                      </div>
                    </div>
                    {form.watch('lowercase') && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Min:</Label>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => adjustMinValue('min_lowercase', -1)}
                            disabled={!form.watch('min_lowercase')}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-xs font-mono">
                            {form.watch('min_lowercase') || 0}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => adjustMinValue('min_lowercase', 1)}
                            disabled={(form.watch('min_lowercase') || 0) >= getMaxAllowedForField('min_lowercase')}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center space-x-3">
                      <Switch
                        id="numbers"
                        checked={form.watch('numbers')}
                        onCheckedChange={(checked) => {
                          form.setValue('numbers', checked);
                          if (!checked) {
                            form.setValue('min_number', undefined);
                          }
                        }}
                        aria-describedby="numbers-help"
                      />
                      <div>
                        <Label htmlFor="numbers" className="text-sm font-medium">
                          Numbers
                        </Label>
                        <p id="numbers-help" className="text-xs text-muted-foreground">
                          0-9 (10 characters)
                        </p>
                      </div>
                    </div>
                    {form.watch('numbers') && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Min:</Label>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => adjustMinValue('min_number', -1)}
                            disabled={!form.watch('min_number')}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-xs font-mono">
                            {form.watch('min_number') || 0}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => adjustMinValue('min_number', 1)}
                            disabled={(form.watch('min_number') || 0) >= getMaxAllowedForField('min_number')}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center space-x-3">
                      <Switch
                        id="special"
                        checked={form.watch('special')}
                        onCheckedChange={(checked) => {
                          form.setValue('special', checked);
                          if (!checked) {
                            form.setValue('min_special', undefined);
                          }
                        }}
                        aria-describedby="special-help"
                      />
                      <div>
                        <Label htmlFor="special" className="text-sm font-medium">
                          Special Characters
                        </Label>
                        <p id="special-help" className="text-xs text-muted-foreground">
                          !@#$%^&* (8 characters)
                        </p>
                      </div>
                    </div>
                    {form.watch('special') && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Min:</Label>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => adjustMinValue('min_special', -1)}
                            disabled={!form.watch('min_special')}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-xs font-mono">
                            {form.watch('min_special') || 0}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => adjustMinValue('min_special', 1)}
                            disabled={(form.watch('min_special') || 0) >= getMaxAllowedForField('min_special')}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </fieldset>

              {/* Advanced Options */}
              <fieldset className="space-y-4">
                <legend className="text-sm font-medium text-foreground">Advanced Options</legend>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center space-x-3">
                      <Switch
                        id="avoid-ambiguous"
                        checked={form.watch('avoid_ambiguous')}
                        onCheckedChange={(checked) => 
                          form.setValue('avoid_ambiguous', checked)
                        }
                        aria-describedby="ambiguous-help"
                      />
                      <div>
                        <Label htmlFor="avoid-ambiguous" className="text-sm font-medium">
                          Avoid Ambiguous Characters
                        </Label>
                        <p id="ambiguous-help" className="text-xs text-muted-foreground">
                          Excludes I, O, l, 0, 1
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={isLoading || hasMinimumError}
                className="w-full card-elevated hover:card-elevated"
                size="lg"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                {isLoading ? 'Generating...' : 'Generate New Password'}
              </Button>


            </CardContent>
          </Card>
        </motion.section>

        {/* Generated Password Panel */}
        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
          aria-labelledby="password-title"
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle id="password-title" className="flex items-center gap-3">
                <div className="card-flat p-2.5 rounded-lg bg-success/10">
                  <StrengthIcon className="w-5 h-5 text-success" aria-hidden="true" />
                </div>
                Generated Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Password Display */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password-output" className="text-sm font-medium">
                    Your Password
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                
                <div className="relative">
                  <Textarea
                    id="password-output"
                    value={showPassword ? currentPassword || '' : '••••••••••••••••'}
                    readOnly
                    className="password-display resize-none min-h-[80px] text-base"
                    aria-describedby="password-help"
                  />
                  <p id="password-help" className="sr-only">
                    Generated password. Use the copy button to copy to clipboard.
                  </p>
                </div>
              </div>

              {/* Password Strength */}
              {currentPassword && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Password Strength</Label>
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
                          <strong>Crack Time:</strong> {strengthDetails.crack_times_display}
                        </p>
                        {strengthDetails.feedback.length > 0 && (
                          <div>
                            <strong>Suggestions:</strong>
                            <ul className="list-disc list-inside mt-1">
                              {strengthDetails.feedback.map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleCopy}
                  disabled={!currentPassword}
                  className="flex-1 card-elevated hover:card-elevated"
                  variant={copied ? "default" : "outline"}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                
                <Button
                  onClick={handleSave}
                  disabled={!currentPassword}
                  className="flex-1 card-elevated hover:card-elevated"
                  variant={saved ? "default" : "outline"}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saved ? 'Saved!' : 'Save'}
                </Button>
              </div>

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
            </CardContent>
          </Card>
        </motion.section>
      </div>
    </div>
  );
} 