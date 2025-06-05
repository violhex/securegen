import type { LoginMethod, PasswordValidationResult, KdfConfig, PasswordHashResult, PasswordMigrationInfo } from './types';
import { HashPurpose } from './types';
import { determinePasswordHash } from './hash';
import { analyzePasswordMigration, shouldAutoMigrate, migratePasswordHash, getMigrationMessage } from './migration';

/**
 * Validate if the provided password matches the password hash.
 * Enhanced implementation supporting both legacy (email-based salt) and new (secure salt) approaches.
 * 
 * @param loginMethod - User login method containing email and KDF config
 * @param password - Password to validate
 * @param passwordHash - Expected password hash
 * @param salt - Optional salt for new secure approach (if not provided, falls back to email-based salt)
 */
export async function validatePassword(
  loginMethod: LoginMethod | null,
  password: string,
  passwordHash: string,
  salt?: string
): Promise<boolean> {
  if (!loginMethod || loginMethod.type !== 'user' || !loginMethod.user) {
    throw new Error('Not authenticated or invalid login method');
  }

  const { email, kdf } = loginMethod.user;
  
  if (salt) {
    // New secure approach: use provided salt
    const hash = await determinePasswordHash(
      email,
      kdf,
      password,
      HashPurpose.LocalAuthorization,
      salt
    );
    return hash === passwordHash;
  } else {
    // Legacy approach: for backward compatibility with existing hashes
    // This should be phased out in favor of the secure salt approach
    const hash = await determinePasswordHashLegacy(
      email,
      kdf,
      password,
      HashPurpose.LocalAuthorization
    );
    return hash === passwordHash;
  }
}

/**
 * Enhanced password validation with automatic migration support
 */
export async function validatePasswordWithMigration(
  loginMethod: LoginMethod | null,
  password: string,
  passwordHash: string,
  salt?: string,
  hashResult?: PasswordHashResult
): Promise<{
  isValid: boolean;
  migrationInfo?: PasswordMigrationInfo;
  migratedHash?: PasswordHashResult;
  migrationMessage?: string;
}> {
  if (!loginMethod || loginMethod.type !== 'user' || !loginMethod.user) {
    throw new Error('Not authenticated or invalid login method');
  }

  const { email, kdf } = loginMethod.user;
  
  // First, validate the password with current hash
  const isValid = await validatePassword(loginMethod, password, passwordHash, salt);
  
  if (!isValid) {
    return { isValid: false };
  }
  
  // Analyze if migration is needed
  const migrationInfo = analyzePasswordMigration(kdf, hashResult);
  const migrationMessage = getMigrationMessage(migrationInfo) || undefined;
  
  // If password is valid and migration is needed, perform automatic migration
  if (shouldAutoMigrate(migrationInfo)) {
    try {
      console.log('Performing automatic password hash migration:', {
        reason: migrationInfo.reason,
        currentIterations: migrationInfo.currentIterations,
        recommendedIterations: migrationInfo.recommendedIterations,
      });
      
      const migratedHash = await migratePasswordHash(
        email,
        password,
        kdf,
        HashPurpose.LocalAuthorization
      );
      
      return {
        isValid: true,
        migrationInfo,
        migratedHash,
        migrationMessage,
      };
    } catch (error) {
      console.error('Failed to migrate password hash:', error);
      // Return successful validation even if migration fails
      return {
        isValid: true,
        migrationInfo,
        migrationMessage: 'Password validation successful, but security upgrade failed. Please try again later.',
      };
    }
  }
  
  return {
    isValid: true,
    migrationInfo: migrationInfo.needsRehash ? migrationInfo : undefined,
    migrationMessage: migrationMessage || undefined,
  };
}

/**
 * Legacy password hash function for backward compatibility.
 * Uses email-based salt (DEPRECATED - use secure salt approach instead).
 */
async function determinePasswordHashLegacy(
  email: string,
  kdf: KdfConfig,
  password: string,
  purpose: HashPurpose
): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = encoder.encode(email.toLowerCase());

  if (kdf.type === 'PBKDF2') {
    const iterations = kdf.iterations || 100000; // Keep legacy default for backward compatibility
    
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBytes,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // Derive key using PBKDF2
    const masterKey = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256 // 32 bytes
    );

    // Derive hash for the specific purpose
    return deriveMasterKeyHashLegacy(masterKey, password, purpose);
  }

  throw new Error(`KDF type ${kdf.type} not implemented`);
}

/**
 * Legacy master key hash derivation for backward compatibility.
 */
async function deriveMasterKeyHashLegacy(
  masterKey: ArrayBuffer,
  password: string,
  purpose: HashPurpose
): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  
  // Import master key for HMAC
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    masterKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Create HMAC with password and purpose
  const purposeBytes = encoder.encode(purpose);
  const data = new Uint8Array(passwordBytes.length + purposeBytes.length);
  data.set(passwordBytes);
  data.set(purposeBytes, passwordBytes.length);

  const signature = await crypto.subtle.sign('HMAC', hmacKey, data);
  
  // Convert to base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Validate password against user key.
 * Enhanced implementation supporting both legacy and secure salt approaches.
 * 
 * @param loginMethod - User login method containing email and KDF config
 * @param password - Password to validate
 * @param encryptedUserKey - Encrypted user key
 * @param salt - Optional salt for new secure approach (if not provided, falls back to legacy approach)
 * 
 * Note: This is a simplified implementation. In production, you would need
 * proper key management and encryption/decryption logic.
 */
export async function validatePasswordUserKey(
  loginMethod: LoginMethod | null,
  password: string,
  encryptedUserKey: string,
  salt?: string
): Promise<string> {
  if (!loginMethod || loginMethod.type !== 'user' || !loginMethod.user) {
    throw new Error('Not authenticated or invalid login method');
  }

  const { email, kdf } = loginMethod.user;

  try {
    let masterKeyHash: string;
    
    if (salt) {
      // New secure approach: use provided salt
      masterKeyHash = await determinePasswordHash(
        email,
        kdf,
        password,
        HashPurpose.LocalAuthorization,
        salt
      );
    } else {
      // Legacy approach: for backward compatibility
      masterKeyHash = await determinePasswordHashLegacy(
        email,
        kdf,
        password,
        HashPurpose.LocalAuthorization
      );
    }

    // In a real implementation, you would:
    // 1. Decrypt the user key using the master key
    // 2. Verify the decrypted key matches the expected format
    // 3. Return the master key hash for local authorization
    
    // For now, we'll simulate this process
    if (!encryptedUserKey || encryptedUserKey.length === 0) {
      throw new Error('Invalid encrypted user key');
    }

    return masterKeyHash;
  } catch {
    throw new Error('Wrong password or invalid user key');
  }
}

/**
 * Comprehensive password validation with detailed results.
 * Custom implementation for better UX.
 */
export function validatePasswordStrength(
  password: string,
  requirements?: {
    minLength?: number;
    requireUpper?: boolean;
    requireLower?: boolean;
    requireNumbers?: boolean;
    requireSpecial?: boolean;
  }
): PasswordValidationResult {
  const errors: string[] = [];
  const reqs = requirements || {};

  if (reqs.minLength && password.length < reqs.minLength) {
    errors.push(`Password must be at least ${reqs.minLength} characters long`);
  }

  if (reqs.requireUpper && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (reqs.requireLower && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (reqs.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (reqs.requireSpecial && !/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
} 