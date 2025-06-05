/**
 * KDF Configuration and Security Constants
 * Following 2024 OWASP recommendations and industry best practices
 */

export interface KdfSecurityConfig {
  /** Current recommended iteration count */
  current: number;
  /** Minimum acceptable iteration count for existing passwords */
  minimum: number;
  /** Legacy iteration count (for backward compatibility) */
  legacy: number;
}

/**
 * PBKDF2-HMAC-SHA256 Configuration
 * Updated to meet 2024 OWASP recommendations (minimum 600,000 iterations)
 */
export const PBKDF2_CONFIG: KdfSecurityConfig = {
  // 2024 OWASP recommended minimum for PBKDF2-HMAC-SHA256
  current: 600000,
  // Minimum acceptable for existing passwords (will trigger re-hash on login)
  minimum: 100000,
  // Legacy default (deprecated, for backward compatibility only)
  legacy: 100000,
};

/**
 * Argon2id Configuration (for future migration)
 * Following RFC 9106 and OWASP recommendations
 */
export const ARGON2_CONFIG = {
  // Memory cost in KiB (64 MB recommended for interactive use)
  memory: 65536,
  // Time cost (iterations)
  iterations: 3,
  // Parallelism factor
  parallelism: 4,
  // Salt length in bytes
  saltLength: 32,
  // Hash length in bytes
  hashLength: 32,
};

/**
 * Migration Configuration
 */
export const MIGRATION_CONFIG = {
  /** Whether to automatically re-hash passwords with weak iteration counts */
  autoRehashOnLogin: true,
  /** Whether to show migration notifications to users */
  showMigrationNotifications: true,
  /** Maximum time to wait for re-hashing (in milliseconds) */
  rehashTimeout: 10000,
  /** Whether Argon2 migration is enabled (future feature) */
  argon2MigrationEnabled: false,
};

/**
 * Get the appropriate iteration count for a given KDF type
 */
export function getRecommendedIterations(kdfType: 'PBKDF2' | 'Argon2id'): number {
  switch (kdfType) {
    case 'PBKDF2':
      return PBKDF2_CONFIG.current;
    case 'Argon2id':
      return ARGON2_CONFIG.iterations;
    default:
      return PBKDF2_CONFIG.current;
  }
}

/**
 * Check if a password hash needs to be upgraded
 */
export function needsRehash(kdfType: 'PBKDF2' | 'Argon2id', iterations?: number): boolean {
  if (!iterations) return true;
  
  switch (kdfType) {
    case 'PBKDF2':
      return iterations < PBKDF2_CONFIG.current;
    case 'Argon2id':
      // For future Argon2 implementation
      return false;
    default:
      return true;
  }
}

/**
 * Check if iterations are below minimum security threshold
 */
export function isBelowMinimumSecurity(kdfType: 'PBKDF2' | 'Argon2id', iterations?: number): boolean {
  if (!iterations) return true;
  
  switch (kdfType) {
    case 'PBKDF2':
      return iterations < PBKDF2_CONFIG.minimum;
    case 'Argon2id':
      // For future Argon2 implementation
      return false;
    default:
      return true;
  }
} 