import type { HashPurpose, KdfConfig, PasswordHashResult } from './types';
import { getRecommendedIterations } from './config';

/**
 * Generate a cryptographically secure random salt.
 */
function generateSecureSalt(): string {
  const saltBytes = new Uint8Array(32); // 256-bit salt
  crypto.getRandomValues(saltBytes);
  return btoa(String.fromCharCode(...saltBytes));
}

/**
 * Determine password hash using KDF and purpose with secure random salt.
 * Following Bitwarden's implementation pattern with enhanced security.
 * 
 * @param email - User email (for backward compatibility, not used in salt generation)
 * @param kdf - Key derivation function configuration
 * @param password - User password
 * @param purpose - Hash purpose (local or server authorization)
 * @param existingSalt - Optional existing salt for verification (if not provided, generates new one)
 * @returns Promise resolving to hash string or PasswordHashResult with hash and salt
 */
export async function determinePasswordHash(
  email: string,
  kdf: KdfConfig,
  password: string,
  purpose: HashPurpose,
  existingSalt?: string
): Promise<string>;
export async function determinePasswordHash(
  email: string,
  kdf: KdfConfig,
  password: string,
  purpose: HashPurpose,
  existingSalt: undefined,
  returnSalt: true
): Promise<PasswordHashResult>;
export async function determinePasswordHash(
  email: string,
  kdf: KdfConfig,
  password: string,
  purpose: HashPurpose,
  existingSalt?: string,
  returnSalt?: boolean
): Promise<string | PasswordHashResult> {
  // Use existing salt for verification, or generate new secure salt
  const salt = existingSalt || generateSecureSalt();
  
  // Derive master key using KDF with secure salt
  const masterKey = await deriveMasterKey(password, salt, kdf);
  
  // Derive hash for the specific purpose
  const hash = await deriveMasterKeyHash(masterKey, password, purpose);
  
  // Return hash and salt for storage, or just hash for verification
  if (returnSalt || !existingSalt) {
    const iterations = kdf.iterations || getRecommendedIterations(kdf.type);
    return { 
      hash, 
      salt,
      iterations,
      kdfType: kdf.type,
      createdAt: Date.now()
    };
  }
  
  return hash;
}

/**
 * Derive master key from password using KDF with secure salt.
 * Enhanced implementation using cryptographically secure salt.
 */
async function deriveMasterKey(
  password: string,
  salt: string,
  kdf: KdfConfig
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  // Decode the base64 salt back to bytes
  const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));

  if (kdf.type === 'PBKDF2') {
    // Use configured iterations or fall back to 2024 OWASP recommended minimum (600,000)
    const iterations = kdf.iterations || getRecommendedIterations('PBKDF2');
    
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBytes,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // Derive key using PBKDF2
    return crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256 // 32 bytes
    );
  }

  // Fallback for other KDF types (simplified)
  throw new Error(`KDF type ${kdf.type} not implemented`);
}

/**
 * Derive master key hash for specific purpose.
 * Simplified implementation following Bitwarden's pattern.
 */
async function deriveMasterKeyHash(
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