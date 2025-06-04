// Types for password module - following Bitwarden's patterns

export interface MasterPasswordPolicyOptions {
  minComplexity: number;
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
  enforceOnLogin: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export enum HashPurpose {
  LocalAuthorization = 'local_authorization',
  ServerAuthorization = 'server_authorization',
}

export interface KdfConfig {
  type: 'PBKDF2' | 'Argon2id';
  iterations?: number;
  memory?: number;
  parallelism?: number;
}

export interface UserLoginMethod {
  email: string;
  kdf: KdfConfig;
  clientId: string;
}

export interface LoginMethod {
  type: 'user' | 'api';
  user?: UserLoginMethod;
} 