// Example usage of the password module
import { 
  passwordStrength, 
  satisfiesPolicy, 
  validatePasswordStrength,
  determinePasswordHash,
  HashPurpose,
  type MasterPasswordPolicyOptions 
} from './index';

/**
 * Example: Complete password validation workflow
 */
export async function validateUserPassword(password: string, email: string) {
  // 1. Calculate password strength (0-4 scale)
  const strength = passwordStrength(password, email);
  console.log(`Password strength: ${strength}/4`);

  // 2. Define password policy
  const policy: MasterPasswordPolicyOptions = {
    minComplexity: 3,
    minLength: 8,
    requireUpper: true,
    requireLower: true,
    requireNumbers: true,
    requireSpecial: true,
    enforceOnLogin: false,
  };

  // 3. Check policy compliance
  const policyValid = satisfiesPolicy(password, strength, policy);
  console.log(`Policy compliant: ${policyValid}`);

  // 4. Get detailed validation results
  const validation = validatePasswordStrength(password, {
    minLength: policy.minLength,
    requireUpper: policy.requireUpper,
    requireLower: policy.requireLower,
    requireNumbers: policy.requireNumbers,
    requireSpecial: policy.requireSpecial,
  });

  console.log(`Validation errors:`, validation.errors);

  // 5. Generate password hash for storage
  const hash = await determinePasswordHash(
    email,
    { type: 'PBKDF2', iterations: 100000 },
    password,
    HashPurpose.LocalAuthorization
  );

  return {
    strength,
    policyValid,
    validation,
    hash,
    overall: policyValid && validation.isValid && strength >= policy.minComplexity
  };
}

/**
 * Example: Test different password strengths
 */
export function demonstratePasswordStrengths() {
  const testCases = [
    'password',           // Very weak (0)
    'password11',         // Weak (1)
    'Weakpass2',          // Fair (2)
    'GoodPass3!',         // Good (3)
    'VeryStrong123@#',    // Strong (4)
  ];

  const email = 'user@example.com';

  console.log('Password Strength Demonstration:');
  testCases.forEach(password => {
    const strength = passwordStrength(password, email);
    console.log(`"${password}" -> Strength: ${strength}/4`);
  });
}

/**
 * Example: Policy validation scenarios
 */
export function demonstratePolicyValidation() {
  const passwords = [
    'password',           // Fails: too weak, no upper, no numbers, no special
    'Password',           // Fails: no numbers, no special
    'Password123',        // Fails: no special characters
    'Password123!',       // Passes: meets all requirements
  ];

  const policy: MasterPasswordPolicyOptions = {
    minComplexity: 2,
    minLength: 8,
    requireUpper: true,
    requireLower: true,
    requireNumbers: true,
    requireSpecial: true,
    enforceOnLogin: false,
  };

  console.log('Policy Validation Demonstration:');
  passwords.forEach(password => {
    const strength = passwordStrength(password, 'user@example.com');
    const valid = satisfiesPolicy(password, strength, policy);
    console.log(`"${password}" -> Valid: ${valid} (Strength: ${strength})`);
  });
}

// Example usage:
// const result = await validateUserPassword('MySecurePassword123!', 'user@example.com');
// console.log('Overall valid:', result.overall); 