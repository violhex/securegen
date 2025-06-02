import { invoke } from '@tauri-apps/api/tauri';
import { writeText } from '@tauri-apps/api/clipboard';
import { save } from '@tauri-apps/api/dialog';
import { writeTextFile } from '@tauri-apps/api/fs';
import type { PasswordConfig, PassphraseConfig, UsernameConfig } from '@/types';

// Matches the exact Rust backend PasswordGeneratorRequest structure
// Note: Rust uses snake_case internally but serde converts to camelCase for JSON
interface TauriPasswordGeneratorRequest {
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  special: boolean;
  length: number;
  avoidAmbiguous: boolean;
  minLowercase?: number;
  minUppercase?: number;
  minNumber?: number;
  minSpecial?: number;
}

interface TauriPassphraseRequest {
  num_words: number;
  word_separator: string;
  capitalize: boolean;
  include_number: boolean;
}

// Updated to match exact Rust enum structure after backend improvements
type TauriUsernameRequest = 
  | {
      Word: {
        capitalize: boolean;
        include_number: boolean;
      };
    }
  | {
      Subaddress: {
        type: 'Random' | { WebsiteName: { website: string } };
        email: string;
      };
    }
  | {
      Catchall: {
        type: 'Random' | { WebsiteName: { website: string } };
        domain: string;
      };
    }
  | {
      Forwarded: {
        service: 
          | { AddyIo: { api_token: string; domain: string; base_url: string } }
          | { DuckDuckGo: { token: string } }
          | { Firefox: { api_token: string } }
          | { Fastmail: { api_token: string } }
          | { ForwardEmail: { api_token: string; domain: string } }
          | { SimpleLogin: { api_key: string; base_url: string } };
        website?: string;
      };
    };

interface PasswordStrength {
  score: number;
  crack_times_display: string;
  feedback: string[];
}

export class TauriAPI {
  static async generatePassword(config: PasswordConfig): Promise<string> {
    try {
      // Direct conversion to backend request format
      const tauriRequest: TauriPasswordGeneratorRequest = {
        lowercase: config.lowercase,
        uppercase: config.uppercase,
        numbers: config.numbers,
        special: config.special,
        length: config.length,
        avoidAmbiguous: config.avoid_ambiguous,
        minLowercase: config.min_lowercase,
        minUppercase: config.min_uppercase,
        minNumber: config.min_number,
        minSpecial: config.min_special,
      };
      

      
      return await invoke('generate_password', { request: tauriRequest });
    } catch (error) {
      // Re-throw error to let higher-level error handling manage it
      throw error;
    }
  }

  static async generatePassphrase(config: PassphraseConfig): Promise<string> {
    try {
      const tauriRequest: TauriPassphraseRequest = {
        num_words: config.wordCount,
        word_separator: config.separator,
        capitalize: config.capitalize,
        include_number: config.includeNumbers,
      };
      
      return await invoke('generate_passphrase', { request: tauriRequest });
    } catch (error) {
      console.error('Failed to generate passphrase:', error);
      return this.fallbackPassphraseGeneration(config);
    }
  }

  static async generateUsername(config: UsernameConfig): Promise<string> {
    try {
      let tauriRequest: TauriUsernameRequest;
      
      switch (config.type) {
        case 'Word':
          tauriRequest = {
            Word: {
              capitalize: config.capitalize ?? true,
              include_number: config.include_number ?? false,
            }
          };
          break;
          
        case 'Subaddress':
          if (!config.email) {
            throw new Error('Email is required for subaddress type');
          }
          
          const subaddressType = config.append_type === 'WebsiteName' && config.website 
            ? { WebsiteName: { website: config.website } }
            : 'Random' as const;
            
          tauriRequest = {
            Subaddress: {
              type: subaddressType,
              email: config.email,
            }
          };
          break;
          
        case 'Catchall':
          if (!config.domain) {
            throw new Error('Domain is required for catchall type');
          }
          
          const catchallType = config.append_type === 'WebsiteName' && config.website 
            ? { WebsiteName: { website: config.website } }
            : 'Random' as const;
            
          tauriRequest = {
            Catchall: {
              type: catchallType,
              domain: config.domain,
            }
          };
          break;
          
        case 'Forwarded':
          if (!config.service) {
            throw new Error('Service configuration is required for forwarded type');
          }
          
          let serviceConfig: Extract<TauriUsernameRequest, { Forwarded: unknown }>['Forwarded']['service'];
          
          switch (config.service.type) {
            case 'AddyIo':
              serviceConfig = {
                AddyIo: {
                  api_token: config.service.api_token || '',
                  domain: config.service.domain || '',
                  base_url: config.service.base_url || 'https://app.addy.io',
                }
              };
              break;
              
            case 'DuckDuckGo':
              serviceConfig = {
                DuckDuckGo: {
                  token: config.service.token || '',
                }
              };
              break;
              
            case 'Firefox':
              serviceConfig = {
                Firefox: {
                  api_token: config.service.api_token || '',
                }
              };
              break;
              
            case 'Fastmail':
              serviceConfig = {
                Fastmail: {
                  api_token: config.service.api_token || '',
                }
              };
              break;
              
            case 'ForwardEmail':
              serviceConfig = {
                ForwardEmail: {
                  api_token: config.service.api_token || '',
                  domain: config.service.domain || '',
                }
              };
              break;
              
            case 'SimpleLogin':
              serviceConfig = {
                SimpleLogin: {
                  api_key: config.service.api_key || '',
                  base_url: config.service.base_url || 'https://app.simplelogin.io',
                }
              };
              break;
              
            default:
              throw new Error('Unsupported forwarding service');
          }
          
          tauriRequest = {
            Forwarded: {
              service: serviceConfig,
              website: config.forwarded_website,
            }
          };
          break;
          
        default:
          throw new Error('Unsupported username type');
      }
      
      return await invoke('generate_username', { request: tauriRequest });
    } catch (error) {
      console.error('Failed to generate username:', error);
      return 'username_generation_failed';
    }
  }

  static async copyToClipboard(text: string): Promise<boolean> {
    try {
      await writeText(text);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  static async exportToFile(content: string, defaultName: string): Promise<void> {
    try {
      const filePath = await save({
        filters: [{
          name: 'Text',
          extensions: ['txt']
        }],
        defaultPath: defaultName,
      });
      
      if (filePath) {
        await writeTextFile(filePath, content);
      }
    } catch (error) {
      console.error('Failed to export file:', error);
      throw error;
    }
  }

  static async calculatePasswordStrength(password: string): Promise<PasswordStrength> {
    try {
      return await invoke('calculate_password_strength', { password });
    } catch (error) {
      console.error('Failed to calculate password strength:', error);
      const fallbackScore = this.fallbackStrengthCalculation(password);
      return {
        score: fallbackScore,
        crack_times_display: this.getStrengthDescription(fallbackScore),
        feedback: this.getStrengthFeedback(password),
      };
    }
  }

  static async savePasswordToFile(password: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `password_${timestamp}.txt`;
    await this.exportToFile(password, fileName);
    return fileName;
  }

  private static fallbackPasswordGeneration(config: PasswordConfig): string {
    const chars = {
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      numbers: '0123456789',
      special: '!@#$%^&*',
    };

    const ambiguous = 'Il1O0';
    
    let charset = '';
    if (config.lowercase) charset += chars.lowercase;
    if (config.uppercase) charset += chars.uppercase;
    if (config.numbers) charset += chars.numbers;
    if (config.special) charset += chars.special;
    
    if (config.avoid_ambiguous) {
      charset = charset.split('').filter(char => !ambiguous.includes(char)).join('');
    }
    
    if (!charset) {
      charset = chars.lowercase + chars.uppercase + chars.numbers;
    }
    
    let password = '';
    for (let i = 0; i < config.length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }

  private static fallbackPassphraseGeneration(config: PassphraseConfig): string {
    const words = [
      'correct', 'horse', 'battery', 'staple', 'mountain', 'river', 'forest', 'ocean',
      'sunrise', 'freedom', 'journey', 'mystery', 'adventure', 'discovery', 'harmony',
      'tranquil', 'serenity', 'courage', 'wisdom', 'balance', 'creative', 'inspire',
      'brilliant', 'peaceful', 'vibrant', 'golden', 'crystal', 'silver', 'diamond',
      'emerald', 'sapphire', 'rainbow', 'thunder', 'lightning', 'breeze', 'whisper'
    ];
    
    const selectedWords = [];
    for (let i = 0; i < config.wordCount; i++) {
      let word = words[Math.floor(Math.random() * words.length)];
      if (config.capitalize) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      }
      selectedWords.push(word);
    }
    
    let passphrase = selectedWords.join(config.separator);
    
    if (config.includeNumbers) {
      passphrase += Math.floor(Math.random() * 1000);
    }
    
    return passphrase;
  }

  private static fallbackStrengthCalculation(password: string): number {
    let score = 0;
    
    // Length bonus
    score += Math.min(password.length * 4, 50);
    
    // Character variety bonus
    if (/[a-z]/.test(password)) score += 5;
    if (/[A-Z]/.test(password)) score += 5;
    if (/[0-9]/.test(password)) score += 5;
    if (/[^A-Za-z0-9]/.test(password)) score += 10;
    
    // Length penalties for short passwords
    if (password.length < 8) score -= 20;
    if (password.length < 6) score -= 30;
    
    return Math.max(0, Math.min(100, score));
  }

  private static getStrengthDescription(score: number): string {
    if (score < 30) return 'Very weak - could be cracked instantly';
    if (score < 60) return 'Weak - could be cracked in minutes';
    if (score < 80) return 'Good - could take days to crack';
    return 'Strong - would take years to crack';
  }

  private static getStrengthFeedback(password: string): string[] {
    const feedback = [];
    
    if (password.length < 12) {
      feedback.push('Consider using a longer password');
    }
    
    if (!/[a-z]/.test(password)) {
      feedback.push('Add lowercase letters');
    }
    
    if (!/[A-Z]/.test(password)) {
      feedback.push('Add uppercase letters');
    }
    
    if (!/[0-9]/.test(password)) {
      feedback.push('Add numbers');
    }
    
    if (!/[^A-Za-z0-9]/.test(password)) {
      feedback.push('Add special characters');
    }
    
    return feedback;
  }
} 