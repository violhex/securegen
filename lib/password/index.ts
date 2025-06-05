// Password module - following Bitwarden's modular structure
export { satisfiesPolicy, type MasterPasswordPolicyOptions } from './policy';
export { validatePassword, validatePasswordUserKey, validatePasswordStrength, validatePasswordWithMigration } from './validate';
export { passwordStrength } from './strength';
export { determinePasswordHash } from './hash';

// Migration and configuration exports
export { 
  analyzePasswordMigration, 
  migratePasswordHash, 
  shouldAutoMigrate, 
  getMigrationMessage,
  estimateMigrationTime,
  validateMigratedHash,
  createMigrationReport
} from './migration';
export { 
  getRecommendedIterations, 
  needsRehash, 
  isBelowMinimumSecurity,
  PBKDF2_CONFIG,
  ARGON2_CONFIG,
  MIGRATION_CONFIG
} from './config';

// Re-export types for convenience
export type { 
  PasswordValidationResult, 
  KdfConfig, 
  LoginMethod, 
  UserLoginMethod,
  PasswordHashResult,
  PasswordMigrationInfo
} from './types';
export { HashPurpose } from './types'; 