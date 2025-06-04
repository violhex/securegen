import type { LoginMethod, PasswordValidationResult } from './types';
import { HashPurpose } from './types';
import { determinePasswordHash } from './hash';

/**
 * Validate if the provided password matches the password hash.
 * Following Bitwarden's implementation pattern.
 */
export async function validatePassword(
  loginMethod: LoginMethod | null,
  password: string,
  passwordHash: string
): Promise<boolean> {
  if (!loginMethod || loginMethod.type !== 'user' || !loginMethod.user) {
    throw new Error('Not authenticated or invalid login method');
  }

  const { email, kdf } = loginMethod.user;
  
  const hash = await determinePasswordHash(
    email,
    kdf,
    password,
    HashPurpose.LocalAuthorization
  );

  return hash === passwordHash;
}

/**
 * Validate password against user key.
 * Following Bitwarden's implementation pattern.
 * 
 * Note: This is a simplified implementation. In production, you would need
 * proper key management and encryption/decryption logic.
 */
export async function validatePasswordUserKey(
  loginMethod: LoginMethod | null,
  password: string,
  encryptedUserKey: string
): Promise<string> {
  if (!loginMethod || loginMethod.type !== 'user' || !loginMethod.user) {
    throw new Error('Not authenticated or invalid login method');
  }

  const { email, kdf } = loginMethod.user;

  try {
    // Derive master key from password
    const masterKeyHash = await determinePasswordHash(
      email,
      kdf,
      password,
      HashPurpose.LocalAuthorization
    );

    // In a real implementation, you would:
    // 1. Decrypt the user key using the master key
    // 2. Verify the decrypted key matches the expected format
    // 3. Return the master key hash for local authorization
    
    // For now, we'll simulate this process
    if (!encryptedUserKey || encryptedUserKey.length === 0) {
      throw new Error('Invalid encrypted user key');
    }

    return masterKeyHash;
  } catch (error) {
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