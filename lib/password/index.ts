// Password module - following Bitwarden's modular structure
export { satisfiesPolicy, type MasterPasswordPolicyOptions } from './policy';
export { validatePassword, validatePasswordUserKey, validatePasswordStrength } from './validate';
export { passwordStrength } from './strength';
export { determinePasswordHash } from './hash';

// Re-export types for convenience
export type { 
  PasswordValidationResult, 
  KdfConfig, 
  LoginMethod, 
  UserLoginMethod 
} from './types';
export { HashPurpose } from './types'; 