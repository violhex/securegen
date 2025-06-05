import type { KdfConfig, PasswordHashResult, PasswordMigrationInfo } from './types';
import { needsRehash, isBelowMinimumSecurity, getRecommendedIterations, MIGRATION_CONFIG } from './config';
import { determinePasswordHash } from './hash';
import { HashPurpose } from './types';

/**
 * Analyze if a password hash needs migration
 */
export function analyzePasswordMigration(
  kdfConfig: KdfConfig,
  hashResult?: PasswordHashResult
): PasswordMigrationInfo {
  const currentIterations = hashResult?.iterations || kdfConfig.iterations;
  const recommendedIterations = getRecommendedIterations(kdfConfig.type);
  const needsMigration = needsRehash(kdfConfig.type, currentIterations);
  const isBelowMinimum = isBelowMinimumSecurity(kdfConfig.type, currentIterations);
  
  let reason: PasswordMigrationInfo['reason'];
  if (isBelowMinimum) {
    reason = 'weak_iterations';
  } else if (needsMigration) {
    reason = 'security_upgrade';
  } else if (kdfConfig.type !== 'PBKDF2' && kdfConfig.type !== 'Argon2id') {
    reason = 'deprecated_kdf';
  }
  
  return {
    needsRehash: needsMigration,
    isBelowMinimum,
    currentIterations,
    recommendedIterations,
    reason,
  };
}

/**
 * Migrate a password hash to use stronger security parameters
 */
export async function migratePasswordHash(
  email: string,
  password: string,
  currentKdf: KdfConfig,
  purpose: HashPurpose = HashPurpose.LocalAuthorization,
  targetKdf?: Partial<KdfConfig>
): Promise<PasswordHashResult> {
  // Create upgraded KDF configuration
  const upgradedKdf: KdfConfig = {
    type: targetKdf?.type || currentKdf.type,
    iterations: targetKdf?.iterations || getRecommendedIterations(currentKdf.type),
    memory: targetKdf?.memory || currentKdf.memory,
    parallelism: targetKdf?.parallelism || currentKdf.parallelism,
  };
  
  // Generate new hash with upgraded parameters
  const result = await determinePasswordHash(
    email,
    upgradedKdf,
    password,
    purpose,
    undefined,
    true
  );
  
  return result as PasswordHashResult;
}

/**
 * Check if automatic migration should be performed
 */
export function shouldAutoMigrate(migrationInfo: PasswordMigrationInfo): boolean {
  if (!MIGRATION_CONFIG.autoRehashOnLogin) {
    return false;
  }
  
  // Always migrate if below minimum security threshold
  if (migrationInfo.isBelowMinimum) {
    return true;
  }
  
  // Migrate if using deprecated KDF
  if (migrationInfo.reason === 'deprecated_kdf') {
    return true;
  }
  
  // Optionally migrate for security upgrades
  return migrationInfo.needsRehash;
}

/**
 * Get migration notification message for users
 */
export function getMigrationMessage(migrationInfo: PasswordMigrationInfo): string | null {
  if (!MIGRATION_CONFIG.showMigrationNotifications || !migrationInfo.needsRehash) {
    return null;
  }
  
  switch (migrationInfo.reason) {
    case 'weak_iterations':
      return 'Your password security is being upgraded to meet current standards. This may take a moment.';
    case 'security_upgrade':
      return 'Upgrading your password security to the latest recommendations.';
    case 'deprecated_kdf':
      return 'Migrating your password to use a more secure algorithm.';
    default:
      return 'Updating your password security settings.';
  }
}

/**
 * Estimate migration time based on iteration count difference
 */
export function estimateMigrationTime(migrationInfo: PasswordMigrationInfo): number {
  if (!migrationInfo.needsRehash) {
    return 0;
  }
  
  const iterationDifference = migrationInfo.recommendedIterations - (migrationInfo.currentIterations || 0);
  
  // Rough estimate: 1ms per 1000 additional iterations (very approximate)
  const estimatedMs = Math.max(1000, (iterationDifference / 1000) * 1);
  
  return Math.min(estimatedMs, MIGRATION_CONFIG.rehashTimeout);
}

/**
 * Validate that a migrated hash meets security requirements
 */
export function validateMigratedHash(
  hashResult: PasswordHashResult,
  targetKdf: KdfConfig
): boolean {
  // Check that iterations meet or exceed target
  if (hashResult.iterations && targetKdf.iterations) {
    if (hashResult.iterations < targetKdf.iterations) {
      return false;
    }
  }
  
  // Check that KDF type matches target
  if (hashResult.kdfType !== targetKdf.type) {
    return false;
  }
  
  // Check that hash and salt are present
  if (!hashResult.hash || !hashResult.salt) {
    return false;
  }
  
  return true;
}

/**
 * Create a migration report for logging/debugging
 */
export function createMigrationReport(
  before: { kdf: KdfConfig; hash?: PasswordHashResult },
  after: PasswordHashResult,
  migrationInfo: PasswordMigrationInfo
): {
  success: boolean;
  beforeIterations: number | undefined;
  afterIterations: number | undefined;
  iterationIncrease: number;
  migrationReason: string;
  timestamp: number;
} {
  const beforeIterations = before.hash?.iterations || before.kdf.iterations;
  const afterIterations = after.iterations;
  const iterationIncrease = (afterIterations || 0) - (beforeIterations || 0);
  
  return {
    success: validateMigratedHash(after, { type: after.kdfType || 'PBKDF2', iterations: afterIterations }),
    beforeIterations,
    afterIterations,
    iterationIncrease,
    migrationReason: migrationInfo.reason || 'unknown',
    timestamp: Date.now(),
  };
} 