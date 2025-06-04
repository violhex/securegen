export interface PasswordConfig {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  special: boolean;
  avoid_ambiguous: boolean;
  min_lowercase?: number;
  min_uppercase?: number;
  min_number?: number;
  min_special?: number;
}

export interface PassphraseConfig {
  wordCount: number;
  separator: string;
  capitalize: boolean;
  includeNumbers: boolean;
}

export interface UsernameConfig {
  type: 'Word' | 'Subaddress' | 'Catchall' | 'Forwarded';
  
  // Word variant options
  capitalize?: boolean;
  include_number?: boolean;
  strength?: 'Basic' | 'Standard' | 'Strong' | 'Maximum';
  
  // Subaddress variant options
  email?: string;
  append_type?: 'Random' | 'WebsiteName';
  website?: string;
  
  // Catchall variant options
  domain?: string;
  
  // Forwarded variant options
  service?: {
    type: 'AddyIo' | 'DuckDuckGo' | 'Firefox' | 'Fastmail' | 'ForwardEmail' | 'SimpleLogin';
    api_token?: string;
    domain?: string;
    base_url?: string;
    token?: string;
    api_key?: string;
  };
  forwarded_website?: string;
}

export interface GeneratedItem {
  id: string;
  type: 'password' | 'passphrase' | 'username';
  value: string;
  config: PasswordConfig | PassphraseConfig | UsernameConfig;
  strength?: number;
  createdAt: Date;
}

export type GeneratorType = 'password' | 'passphrase' | 'username' | 'history' | 'settings'; 