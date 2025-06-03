import { useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { TauriAPI } from '@/lib/tauri';
import type { GeneratorType } from '@/types';

export function useGenerator() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    passwordConfig,
    passphraseConfig,
    usernameConfig,
    setCurrentPassword,
    setCurrentPassphrase,
    setCurrentUsername,
    addToHistory,
  } = useAppStore();

  const generatePassword = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const password = await TauriAPI.generatePassword(passwordConfig);
      setCurrentPassword(password);
      
      const strengthResult = await TauriAPI.calculatePasswordStrength(password);
      
      addToHistory({
        type: 'password',
        value: password,
        config: passwordConfig,
        strength: strengthResult.score,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      setError(errorMessage);
      throw err; // Re-throw for component handling
    } finally {
      setIsLoading(false);
    }
  }, [passwordConfig, setCurrentPassword, addToHistory]);

  const generatePassphrase = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const passphrase = await TauriAPI.generatePassphrase(passphraseConfig);
      setCurrentPassphrase(passphrase);
      
      addToHistory({
        type: 'passphrase',
        value: passphrase,
        config: passphraseConfig,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      setError(errorMessage);
      throw err; // Re-throw for component handling
    } finally {
      setIsLoading(false);
    }
  }, [passphraseConfig, setCurrentPassphrase, addToHistory]);

  const generateUsername = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Validate forwarded service configuration before attempting generation
      if (usernameConfig.type === 'Forwarded' && usernameConfig.service) {
        const service = usernameConfig.service;
        
        // Check for required fields based on service type
        if (service.type === 'Firefox' && !service.api_token) {
          throw new Error('Firefox forwarding requires an API token. Please configure your Firefox Relay API token in the service settings.');
        }
        if (service.type === 'DuckDuckGo' && !service.token) {
          throw new Error('DuckDuckGo forwarding requires a token. Please configure your DuckDuckGo Email Protection token.');
        }
        if (service.type === 'SimpleLogin' && !service.api_key) {
          throw new Error('SimpleLogin forwarding requires an API key. Please configure your SimpleLogin API key in the service settings.');
        }
        if (['AddyIo', 'Fastmail', 'ForwardEmail'].includes(service.type) && !service.api_token) {
          throw new Error(`${service.type} forwarding requires an API token. Please configure your ${service.type} API token in the service settings.`);
        }
        if (['AddyIo', 'ForwardEmail'].includes(service.type) && !service.domain) {
          throw new Error(`${service.type} forwarding requires a domain. Please configure your domain in the service settings.`);
        }
        if (['AddyIo', 'SimpleLogin'].includes(service.type) && !service.base_url) {
          throw new Error(`${service.type} forwarding requires a base URL. Please configure the base URL in the service settings.`);
        }
      }
      
      const username = await TauriAPI.generateUsername(usernameConfig);
      
      // Validate the generated username to ensure it's not an error sentinel or invalid
      if (!username || 
          username.trim() === '' || 
          username === 'username_generation_failed' ||
          username.includes('error') ||
          username.includes('failed')) {
        throw new Error('Username generation returned an invalid result. Please try again.');
      }
      
      // Additional validation based on username type
      if (usernameConfig.type === 'Word') {
        // Word-based usernames should not contain @ symbol
        if (username.includes('@')) {
          throw new Error('Invalid word-based username format received. Please try again.');
        }
      } else if (['Subaddress', 'Catchall', 'Forwarded'].includes(usernameConfig.type)) {
        // Email-based usernames should contain @ symbol and have valid email format
        if (!username.includes('@') || username.split('@').length !== 2) {
          throw new Error('Invalid email-based username format received. Please try again.');
        }
      }
      
      setCurrentUsername(username);
      
      addToHistory({
        type: 'username',
        value: username,
        config: usernameConfig,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      // Improve error messages for common forwarding issues
      let finalErrorMessage = errorMessage;
      if (errorMessage.includes('API configuration is incomplete')) {
        finalErrorMessage = 'Service configuration is incomplete. Please check that all required fields are filled in the forwarding service settings.';
      }
      
      setError(finalErrorMessage);
      throw new Error(finalErrorMessage); // Re-throw for component handling
    } finally {
      setIsLoading(false);
    }
  }, [usernameConfig, setCurrentUsername, addToHistory]);

  const generate = useCallback((type: GeneratorType) => {
    switch (type) {
      case 'password':
        return generatePassword();
      case 'passphrase':
        return generatePassphrase();
      case 'username':
        return generateUsername();
      default:
        return Promise.resolve();
    }
  }, [generatePassword, generatePassphrase, generateUsername]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      const result = await TauriAPI.copyToClipboard(text);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Copy failed';
      setError(errorMessage);
      throw new Error(errorMessage); // Re-throw for component handling
    }
  }, []);

  const savePasswordToFile = useCallback(async (password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const filePath = await TauriAPI.savePasswordToFile(password);
      return filePath;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Save failed';
      setError(errorMessage);
      throw err; // Re-throw for component handling
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    generate,
    generatePassword,
    generatePassphrase,
    generateUsername,
    copyToClipboard,
    savePasswordToFile,
    isLoading,
    error,
  };
} 