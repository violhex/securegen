// Example usage of the password module
import { 
  passwordStrength, 
  satisfiesPolicy, 
  validatePasswordStrength,
  determinePasswordHash,
  validatePassword,
  HashPurpose,
  type MasterPasswordPolicyOptions,
  type PasswordHashResult,
  type LoginMethod
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

  // 5. Generate password hash with secure salt for storage
  const hashResult: PasswordHashResult = await determinePasswordHash(
    email,
    { type: 'PBKDF2', iterations: 600000 }, // Updated to 2024 OWASP recommendations
    password,
    HashPurpose.LocalAuthorization,
    undefined,
    true
  );

  return {
    strength,
    policyValid,
    validation,
    hashResult, // Contains both hash and salt
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

/**
 * Example: Secure password hashing and verification workflow
 */
export async function demonstrateSecurePasswordWorkflow() {
  const email = 'user@example.com';
  const password = 'MySecurePassword123!';
  const kdf = { type: 'PBKDF2' as const, iterations: 100000 };

  console.log('=== Secure Password Workflow Demonstration ===');

  // 1. Create password hash with secure random salt (for registration/password change)
  console.log('\n1. Creating password hash with secure salt...');
  const hashResult: PasswordHashResult = await determinePasswordHash(
    email,
    kdf,
    password,
    HashPurpose.LocalAuthorization,
    undefined,
    true
  );
  
  console.log(`Generated hash: ${hashResult.hash.substring(0, 20)}...`);
  console.log(`Generated salt: ${hashResult.salt.substring(0, 20)}...`);
  console.log(`Salt length: ${hashResult.salt.length} characters`);

  // 2. Store hash and salt (in real app, store these in database)
  const storedHash = hashResult.hash;
  const storedSalt = hashResult.salt;

  // 3. Verify password during login using stored salt
  console.log('\n2. Verifying password with stored salt...');
  const loginMethod: LoginMethod = {
    type: 'user',
    user: {
      email,
      kdf,
      clientId: 'example-client'
    }
  };

  const isValid = await validatePassword(loginMethod, password, storedHash, storedSalt);
  console.log(`Password verification result: ${isValid}`);

  // 4. Test with wrong password
  console.log('\n3. Testing with wrong password...');
  const isInvalid = await validatePassword(loginMethod, 'wrongpassword', storedHash, storedSalt);
  console.log(`Wrong password verification result: ${isInvalid}`);

  // 5. Demonstrate salt uniqueness
  console.log('\n4. Demonstrating salt uniqueness...');
  const hashResult2: PasswordHashResult = await determinePasswordHash(
    email,
    kdf,
    password,
    HashPurpose.LocalAuthorization,
    undefined,
    true
  );
  
  console.log(`Same password, different salt: ${hashResult.salt !== hashResult2.salt}`);
  console.log(`Same password, different hash: ${hashResult.hash !== hashResult2.hash}`);

  return {
    originalHash: hashResult,
    verificationSuccess: isValid,
    verificationFailure: isInvalid,
    saltUniqueness: hashResult.salt !== hashResult2.salt
  };
}

// Example usage:
// const result = await validateUserPassword('MySecurePassword123!', 'user@example.com');
// console.log('Overall valid:', result.overall);
// 
// const secureDemo = await demonstrateSecurePasswordWorkflow();
// console.log('Secure workflow completed:', secureDemo); 