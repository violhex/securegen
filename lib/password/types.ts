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

export interface PasswordHashResult {
  hash: string;
  salt: string;
  /** Iteration count used for this hash (for migration tracking) */
  iterations?: number;
  /** KDF type used for this hash */
  kdfType?: 'PBKDF2' | 'Argon2id';
  /** Timestamp when hash was created */
  createdAt?: number;
}

export interface PasswordMigrationInfo {
  /** Whether the password needs re-hashing */
  needsRehash: boolean;
  /** Whether the current iterations are below minimum security threshold */
  isBelowMinimum: boolean;
  /** Current iteration count */
  currentIterations?: number;
  /** Recommended iteration count */
  recommendedIterations: number;
  /** Migration reason */
  reason?: 'weak_iterations' | 'deprecated_kdf' | 'security_upgrade';
} 