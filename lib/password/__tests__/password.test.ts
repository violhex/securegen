import { satisfiesPolicy } from '../policy';
import { passwordStrength } from '../strength';
import { validatePasswordStrength } from '../validate';
import { determinePasswordHash } from '../hash';
import { HashPurpose } from '../types';
import type { MasterPasswordPolicyOptions, KdfConfig } from '../types';

describe('Password Policy', () => {
  test('satisfies policy gives success', () => {
    const password = 'lkasfo!icbb$2323ALKJCO22';
    const options: MasterPasswordPolicyOptions = {
      minComplexity: 3,
      minLength: 5,
      requireUpper: true,
      requireLower: true,
      requireNumbers: true,
      requireSpecial: true,
      enforceOnLogin: false,
    };

    const result = satisfiesPolicy(password, 4, options);
    expect(result).toBe(true);
  });

  test('satisfies policy evaluates strength', () => {
    const password = 'password123';
    const options: MasterPasswordPolicyOptions = {
      minComplexity: 3,
      minLength: 0,
      requireUpper: false,
      requireLower: false,
      requireNumbers: false,
      requireSpecial: false,
      enforceOnLogin: false,
    };

    const result = satisfiesPolicy(password, 0, options);
    expect(result).toBe(false);
  });

  test('satisfies policy evaluates length', () => {
    const password = 'password123';
    const options: MasterPasswordPolicyOptions = {
      minComplexity: 0,
      minLength: 20,
      requireUpper: false,
      requireLower: false,
      requireNumbers: false,
      requireSpecial: false,
      enforceOnLogin: false,
    };

    const result = satisfiesPolicy(password, 0, options);
    expect(result).toBe(false);
  });

  test('satisfies policy evaluates upper case requirement', () => {
    const password = 'password123';
    const options: MasterPasswordPolicyOptions = {
      minComplexity: 0,
      minLength: 0,
      requireUpper: true,
      requireLower: false,
      requireNumbers: false,
      requireSpecial: false,
      enforceOnLogin: false,
    };

    const result = satisfiesPolicy(password, 0, options);
    expect(result).toBe(false);
  });

  test('satisfies policy evaluates lower case requirement', () => {
    const password = 'ABCDEFG123';
    const options: MasterPasswordPolicyOptions = {
      minComplexity: 0,
      minLength: 0,
      requireUpper: false,
      requireLower: true,
      requireNumbers: false,
      requireSpecial: false,
      enforceOnLogin: false,
    };

    const result = satisfiesPolicy(password, 0, options);
    expect(result).toBe(false);
  });

  test('satisfies policy evaluates numbers requirement', () => {
    const password = 'password';
    const options: MasterPasswordPolicyOptions = {
      minComplexity: 0,
      minLength: 0,
      requireUpper: false,
      requireLower: false,
      requireNumbers: true,
      requireSpecial: false,
      enforceOnLogin: false,
    };

    const result = satisfiesPolicy(password, 0, options);
    expect(result).toBe(false);
  });

  test('satisfies policy evaluates special characters requirement', () => {
    const password = 'Password123';
    const options: MasterPasswordPolicyOptions = {
      minComplexity: 0,
      minLength: 0,
      requireUpper: false,
      requireLower: false,
      requireNumbers: false,
      requireSpecial: true,
      enforceOnLogin: false,
    };

    const result = satisfiesPolicy(password, 0, options);
    expect(result).toBe(false);
  });
});

describe('Password Strength', () => {
  test('password strength calculation', () => {
    const cases = [
      { password: 'password', email: 'random@bitwarden.com', expected: 0 },
      { password: 'password11', email: 'random@bitwarden.com', expected: 1 },
      { password: 'Weakpass2', email: 'random@bitwarden.com', expected: 2 },
      { password: 'GoodPass3!', email: 'random@bitwarden.com', expected: 3 },
      { password: 'VeryStrong123@#', email: 'random@bitwarden.com', expected: 4 },
    ];

    cases.forEach(({ password, email, expected }) => {
      const result = passwordStrength(password, email, []);
      expect(result).toBe(expected);
    });
  });

  test('penalize email in password', () => {
    const password = 'asdfjkhkjwer!';

    const result1 = passwordStrength(password, 'random@bitwarden.com', []);
    expect(result1).toBe(4);

    const result2 = passwordStrength(password, 'asdfjkhkjwer@bitwarden.com', []);
    expect(result2).toBeLessThan(4); // Should be penalized
  });
});

describe('Password Validation', () => {
  test('validate password strength with requirements', () => {
    const result = validatePasswordStrength('Password123!', {
      minLength: 8,
      requireUpper: true,
      requireLower: true,
      requireNumbers: true,
      requireSpecial: true,
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('validate password strength with failures', () => {
    const result = validatePasswordStrength('pass', {
      minLength: 8,
      requireUpper: true,
      requireNumbers: true,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('Password Hashing', () => {
  test('determine password hash', async () => {
    const email = 'test@bitwarden.com';
    const password = 'password123';
    const kdf: KdfConfig = {
      type: 'PBKDF2',
      iterations: 100000,
    };

    const hash = await determinePasswordHash(email, kdf, password, HashPurpose.LocalAuthorization);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);

    // Same inputs should produce same hash
    const hash2 = await determinePasswordHash(email, kdf, password, HashPurpose.LocalAuthorization);
    expect(hash).toBe(hash2);
  });
}); 