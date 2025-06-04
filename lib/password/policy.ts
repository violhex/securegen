import type { MasterPasswordPolicyOptions } from './types';

/**
 * Validate the provided password passes the provided Master Password Requirements Policy.
 * Following Bitwarden's implementation pattern.
 */
export function satisfiesPolicy(
  password: string,
  strength: number,
  policy: MasterPasswordPolicyOptions
): boolean {
  if (policy.minComplexity > 0 && policy.minComplexity > strength) {
    return false;
  }

  if (policy.minLength > 0 && policy.minLength > password.length) {
    return false;
  }

  if (policy.requireUpper && password.toLowerCase() === password) {
    return false;
  }

  if (policy.requireLower && password.toUpperCase() === password) {
    return false;
  }

  if (policy.requireNumbers && !password.split('').some(c => /\d/.test(c))) {
    return false;
  }

  if (policy.requireSpecial && !password.split('').some(c => '!@#$%^&*'.includes(c))) {
    return false;
  }

  return true;
}

// Re-export the type for convenience
export type { MasterPasswordPolicyOptions }; 