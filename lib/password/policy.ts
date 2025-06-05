import type { MasterPasswordPolicyOptions } from './types';

// Optimized regex patterns for password validation
const NUMBERS_REGEX = /\d/;

// Comprehensive special character set including:
// - Basic symbols: !@#$%^&*
// - Parentheses and brackets: ()[]{}
// - Mathematical operators: +-=
// - Punctuation: ;':".,<>/?
// - Other symbols: \|~`_
const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;

/**
 * Validate the provided password passes the provided Master Password Requirements Policy.
 * Following Bitwarden's implementation pattern with enhanced input validation and optimized character checking.
 */
export function satisfiesPolicy(
  password: string,
  strength: number,
  policy: MasterPasswordPolicyOptions
): boolean {
  // Input validation: password
  if (typeof password !== 'string') {
    throw new Error('Password must be a string');
  }
  if (password.length === 0) {
    return false; // Empty password never satisfies policy
  }

  // Input validation: strength
  if (typeof strength !== 'number' || isNaN(strength)) {
    throw new Error('Strength must be a valid number');
  }
  if (strength < 0 || strength > 100) {
    throw new Error('Strength must be between 0 and 100');
  }

  // Input validation: policy
  if (!policy || typeof policy !== 'object') {
    throw new Error('Policy must be a valid object');
  }

  // Validate required policy properties
  const requiredProps = ['minComplexity', 'minLength', 'requireUpper', 'requireLower', 'requireNumbers', 'requireSpecial'];
  for (const prop of requiredProps) {
    if (!(prop in policy)) {
      throw new Error(`Policy missing required property: ${prop}`);
    }
  }

  // Validate policy property types
  if (typeof policy.minComplexity !== 'number' || isNaN(policy.minComplexity) || policy.minComplexity < 0) {
    throw new Error('Policy minComplexity must be a non-negative number');
  }
  if (typeof policy.minLength !== 'number' || isNaN(policy.minLength) || policy.minLength < 0) {
    throw new Error('Policy minLength must be a non-negative number');
  }
  if (typeof policy.requireUpper !== 'boolean') {
    throw new Error('Policy requireUpper must be a boolean');
  }
  if (typeof policy.requireLower !== 'boolean') {
    throw new Error('Policy requireLower must be a boolean');
  }
  if (typeof policy.requireNumbers !== 'boolean') {
    throw new Error('Policy requireNumbers must be a boolean');
  }
  if (typeof policy.requireSpecial !== 'boolean') {
    throw new Error('Policy requireSpecial must be a boolean');
  }

  // Policy validation logic (original implementation)
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

  // Optimized number validation using regex
  if (policy.requireNumbers && !NUMBERS_REGEX.test(password)) {
    return false;
  }

  // Optimized special character validation with expanded character set using regex
  if (policy.requireSpecial && !SPECIAL_CHARS_REGEX.test(password)) {
    return false;
  }

  return true;
}

// Re-export the type for convenience
export type { MasterPasswordPolicyOptions }; 