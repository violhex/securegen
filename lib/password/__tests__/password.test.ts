import { satisfiesPolicy } from '../policy';
import { passwordStrength } from '../strength';
import { validatePasswordStrength } from '../validate';
import { determinePasswordHash } from '../hash';
import { analyzePasswordMigration, migratePasswordHash } from '../migration';
import { getRecommendedIterations, needsRehash } from '../config';
import { HashPurpose } from '../types';
import type { MasterPasswordPolicyOptions, KdfConfig, PasswordHashResult } from '../types';

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

  // Input validation tests
  describe('Input Validation', () => {
    const validPolicy: MasterPasswordPolicyOptions = {
      minComplexity: 3,
      minLength: 8,
      requireUpper: true,
      requireLower: true,
      requireNumbers: true,
      requireSpecial: true,
      enforceOnLogin: false,
    };

    test('throws error for non-string password', () => {
      expect(() => satisfiesPolicy(123 as unknown as string, 50, validPolicy)).toThrow('Password must be a string');
      expect(() => satisfiesPolicy(null as unknown as string, 50, validPolicy)).toThrow('Password must be a string');
      expect(() => satisfiesPolicy(undefined as unknown as string, 50, validPolicy)).toThrow('Password must be a string');
      expect(() => satisfiesPolicy({} as unknown as string, 50, validPolicy)).toThrow('Password must be a string');
    });

    test('returns false for empty password', () => {
      const result = satisfiesPolicy('', 50, validPolicy);
      expect(result).toBe(false);
    });

    test('throws error for invalid strength values', () => {
      expect(() => satisfiesPolicy('password123', 'invalid' as unknown as number, validPolicy)).toThrow('Strength must be a valid number');
      expect(() => satisfiesPolicy('password123', NaN, validPolicy)).toThrow('Strength must be a valid number');
      expect(() => satisfiesPolicy('password123', null as unknown as number, validPolicy)).toThrow('Strength must be a valid number');
      expect(() => satisfiesPolicy('password123', undefined as unknown as number, validPolicy)).toThrow('Strength must be a valid number');
    });

    test('throws error for strength values outside valid range', () => {
      expect(() => satisfiesPolicy('password123', -1, validPolicy)).toThrow('Strength must be between 0 and 100');
      expect(() => satisfiesPolicy('password123', 101, validPolicy)).toThrow('Strength must be between 0 and 100');
      expect(() => satisfiesPolicy('password123', -50, validPolicy)).toThrow('Strength must be between 0 and 100');
      expect(() => satisfiesPolicy('password123', 150, validPolicy)).toThrow('Strength must be between 0 and 100');
    });

    test('accepts valid strength values', () => {
      expect(() => satisfiesPolicy('Password123!', 0, validPolicy)).not.toThrow();
      expect(() => satisfiesPolicy('Password123!', 50, validPolicy)).not.toThrow();
      expect(() => satisfiesPolicy('Password123!', 100, validPolicy)).not.toThrow();
    });

    test('throws error for invalid policy object', () => {
      expect(() => satisfiesPolicy('password123', 50, null as unknown as MasterPasswordPolicyOptions)).toThrow('Policy must be a valid object');
      expect(() => satisfiesPolicy('password123', 50, undefined as unknown as MasterPasswordPolicyOptions)).toThrow('Policy must be a valid object');
      expect(() => satisfiesPolicy('password123', 50, 'invalid' as unknown as MasterPasswordPolicyOptions)).toThrow('Policy must be a valid object');
      expect(() => satisfiesPolicy('password123', 50, 123 as unknown as MasterPasswordPolicyOptions)).toThrow('Policy must be a valid object');
    });

    test('throws error for policy missing required properties', () => {
      const incompletePolicy = {
        minComplexity: 3,
        minLength: 8,
        // Missing other required properties
      };

      expect(() => satisfiesPolicy('password123', 50, incompletePolicy as unknown as MasterPasswordPolicyOptions)).toThrow('Policy missing required property: requireUpper');
    });

    test('throws error for invalid policy property types', () => {
      const invalidPolicy1 = {
        ...validPolicy,
        minComplexity: 'invalid' as unknown as number,
      };
      expect(() => satisfiesPolicy('password123', 50, invalidPolicy1)).toThrow('Policy minComplexity must be a non-negative number');

      const invalidPolicy2 = {
        ...validPolicy,
        minLength: -5,
      };
      expect(() => satisfiesPolicy('password123', 50, invalidPolicy2)).toThrow('Policy minLength must be a non-negative number');

      const invalidPolicy3 = {
        ...validPolicy,
        requireUpper: 'true' as unknown as boolean,
      };
      expect(() => satisfiesPolicy('password123', 50, invalidPolicy3)).toThrow('Policy requireUpper must be a boolean');

      const invalidPolicy4 = {
        ...validPolicy,
        requireNumbers: 1 as unknown as boolean,
      };
      expect(() => satisfiesPolicy('password123', 50, invalidPolicy4)).toThrow('Policy requireNumbers must be a boolean');
    });

    test('throws error for negative policy values', () => {
      const negativeComplexityPolicy = {
        ...validPolicy,
        minComplexity: -1,
      };
      expect(() => satisfiesPolicy('password123', 50, negativeComplexityPolicy)).toThrow('Policy minComplexity must be a non-negative number');

      const negativeLengthPolicy = {
        ...validPolicy,
        minLength: -10,
      };
      expect(() => satisfiesPolicy('password123', 50, negativeLengthPolicy)).toThrow('Policy minLength must be a non-negative number');
    });

    test('accepts valid policy with zero values', () => {
      const zeroPolicy: MasterPasswordPolicyOptions = {
        minComplexity: 0,
        minLength: 0,
        requireUpper: false,
        requireLower: false,
        requireNumbers: false,
        requireSpecial: false,
        enforceOnLogin: false,
      };

      expect(() => satisfiesPolicy('password123', 50, zeroPolicy)).not.toThrow();
      const result = satisfiesPolicy('password123', 50, zeroPolicy);
      expect(result).toBe(true);
    });

    test('handles NaN in policy values', () => {
      const nanComplexityPolicy = {
        ...validPolicy,
        minComplexity: NaN,
      };
      expect(() => satisfiesPolicy('password123', 50, nanComplexityPolicy)).toThrow('Policy minComplexity must be a non-negative number');

      const nanLengthPolicy = {
        ...validPolicy,
        minLength: NaN,
      };
      expect(() => satisfiesPolicy('password123', 50, nanLengthPolicy)).toThrow('Policy minLength must be a non-negative number');
    });

    test('validates all required policy properties are present', () => {
      const requiredProps = ['minComplexity', 'minLength', 'requireUpper', 'requireLower', 'requireNumbers', 'requireSpecial'];
      
      requiredProps.forEach(prop => {
        const incompletePolicy = { ...validPolicy };
        delete (incompletePolicy as Record<string, unknown>)[prop];
        
        expect(() => satisfiesPolicy('password123', 50, incompletePolicy as unknown as MasterPasswordPolicyOptions))
          .toThrow(`Policy missing required property: ${prop}`);
      });
    });
  });

  // Optimized character validation tests
  describe('Optimized Character Validation', () => {
    const basePolicy: MasterPasswordPolicyOptions = {
      minComplexity: 0,
      minLength: 0,
      requireUpper: false,
      requireLower: false,
      requireNumbers: false,
      requireSpecial: false,
      enforceOnLogin: false,
    };

    test('optimized number validation works correctly', () => {
      const numberPolicy = { ...basePolicy, requireNumbers: true };
      
      // Should pass with numbers
      expect(satisfiesPolicy('password1', 50, numberPolicy)).toBe(true);
      expect(satisfiesPolicy('pass2word', 50, numberPolicy)).toBe(true);
      expect(satisfiesPolicy('123password', 50, numberPolicy)).toBe(true);
      expect(satisfiesPolicy('password789', 50, numberPolicy)).toBe(true);
      
      // Should fail without numbers
      expect(satisfiesPolicy('password', 50, numberPolicy)).toBe(false);
      expect(satisfiesPolicy('PASSWORD', 50, numberPolicy)).toBe(false);
      expect(satisfiesPolicy('pass!word', 50, numberPolicy)).toBe(false);
    });

    test('expanded special character set validation', () => {
      const specialPolicy = { ...basePolicy, requireSpecial: true };
      
      // Test basic symbols
      expect(satisfiesPolicy('password!', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password@', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password#', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password$', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password%', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password^', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password&', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password*', 50, specialPolicy)).toBe(true);
      
      // Test parentheses and brackets
      expect(satisfiesPolicy('password(', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password)', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password[', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password]', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password{', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password}', 50, specialPolicy)).toBe(true);
      
      // Test mathematical operators
      expect(satisfiesPolicy('password+', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password-', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password=', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password_', 50, specialPolicy)).toBe(true);
      
      // Test punctuation
      expect(satisfiesPolicy('password;', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy("password'", 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password:', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password"', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password\\', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password|', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password,', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password.', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password<', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password>', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password/', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password?', 50, specialPolicy)).toBe(true);
      
      // Test other symbols
      expect(satisfiesPolicy('password~', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('password`', 50, specialPolicy)).toBe(true);
      
      // Should fail without special characters
      expect(satisfiesPolicy('password', 50, specialPolicy)).toBe(false);
      expect(satisfiesPolicy('PASSWORD', 50, specialPolicy)).toBe(false);
      expect(satisfiesPolicy('password123', 50, specialPolicy)).toBe(false);
      expect(satisfiesPolicy('Password123', 50, specialPolicy)).toBe(false);
    });

    test('performance comparison - regex vs split/some approach', () => {
      const specialPolicy = { ...basePolicy, requireSpecial: true };
      const numberPolicy = { ...basePolicy, requireNumbers: true };
      const longPassword = 'a'.repeat(1000) + '!'; // Long password with special char at end
      const longPasswordWithNumber = 'a'.repeat(1000) + '1'; // Long password with number at end
      
      // These should complete quickly with regex approach
      const start = performance.now();
      
      // Test special character validation
      expect(satisfiesPolicy(longPassword, 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('a'.repeat(1000), 50, specialPolicy)).toBe(false);
      
      // Test number validation
      expect(satisfiesPolicy(longPasswordWithNumber, 50, numberPolicy)).toBe(true);
      expect(satisfiesPolicy('a'.repeat(1000), 50, numberPolicy)).toBe(false);
      
      const end = performance.now();
      const duration = end - start;
      
      // Should complete very quickly (under 10ms for these operations)
      expect(duration).toBeLessThan(10);
    });

    test('special characters in middle of password', () => {
      const specialPolicy = { ...basePolicy, requireSpecial: true };
      
      expect(satisfiesPolicy('pass!word', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('pa@ssword', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('p#assword', 50, specialPolicy)).toBe(true);
      expect(satisfiesPolicy('!password', 50, specialPolicy)).toBe(true);
    });

    test('numbers in middle of password', () => {
      const numberPolicy = { ...basePolicy, requireNumbers: true };
      
      expect(satisfiesPolicy('pass1word', 50, numberPolicy)).toBe(true);
      expect(satisfiesPolicy('pa2ssword', 50, numberPolicy)).toBe(true);
      expect(satisfiesPolicy('p3assword', 50, numberPolicy)).toBe(true);
      expect(satisfiesPolicy('4password', 50, numberPolicy)).toBe(true);
    });

    test('combined requirements work correctly', () => {
      const combinedPolicy: MasterPasswordPolicyOptions = {
        ...basePolicy,
        requireNumbers: true,
        requireSpecial: true,
        requireUpper: true,
        requireLower: true,
      };
      
      // Should pass with all requirements
      expect(satisfiesPolicy('Password123!', 50, combinedPolicy)).toBe(true);
      expect(satisfiesPolicy('MyP@ssw0rd', 50, combinedPolicy)).toBe(true);
      expect(satisfiesPolicy('Str0ng#Pass', 50, combinedPolicy)).toBe(true);
      
      // Should fail missing requirements
      expect(satisfiesPolicy('password123!', 50, combinedPolicy)).toBe(false); // No uppercase
      expect(satisfiesPolicy('PASSWORD123!', 50, combinedPolicy)).toBe(false); // No lowercase
      expect(satisfiesPolicy('Password!', 50, combinedPolicy)).toBe(false); // No numbers
      expect(satisfiesPolicy('Password123', 50, combinedPolicy)).toBe(false); // No special chars
    });
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
  test('determine password hash with secure salt', async () => {
    const email = 'test@bitwarden.com';
    const password = 'password123';
    const kdf: KdfConfig = {
      type: 'PBKDF2',
      iterations: 600000, // Updated to 2024 OWASP recommendations
    };

    // Test new secure approach - should return hash and salt
    const result = await determinePasswordHash(email, kdf, password, HashPurpose.LocalAuthorization, undefined, true);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result.hash).toBeDefined();
    expect(result.salt).toBeDefined();
    expect(typeof result.hash).toBe('string');
    expect(typeof result.salt).toBe('string');
    expect(result.hash.length).toBeGreaterThan(0);
    expect(result.salt.length).toBeGreaterThan(0);

    // Test verification with existing salt
    const verificationHash = await determinePasswordHash(email, kdf, password, HashPurpose.LocalAuthorization, result.salt);
    expect(verificationHash).toBe(result.hash);

    // Different passwords should produce different hashes with same salt
    const differentResult = await determinePasswordHash(email, kdf, 'differentpassword', HashPurpose.LocalAuthorization, result.salt);
    expect(differentResult).not.toBe(result.hash);
  });

  test('secure salt generation produces unique salts', async () => {
    const email = 'test@bitwarden.com';
    const password = 'password123';
    const kdf: KdfConfig = {
      type: 'PBKDF2',
      iterations: 600000, // Updated to 2024 OWASP recommendations
    };

    // Generate multiple hashes - should have different salts
    const result1 = await determinePasswordHash(email, kdf, password, HashPurpose.LocalAuthorization, undefined, true);
    const result2 = await determinePasswordHash(email, kdf, password, HashPurpose.LocalAuthorization, undefined, true);
    
    expect(result1.salt).not.toBe(result2.salt);
    expect(result1.hash).not.toBe(result2.hash);
  });

  test('hash result includes migration metadata', async () => {
    const email = 'test@bitwarden.com';
    const password = 'password123';
    const kdf: KdfConfig = {
      type: 'PBKDF2',
      iterations: 600000,
    };

    const result = await determinePasswordHash(email, kdf, password, HashPurpose.LocalAuthorization, undefined, true) as PasswordHashResult;
    
    expect(result.iterations).toBe(600000);
    expect(result.kdfType).toBe('PBKDF2');
    expect(result.createdAt).toBeDefined();
    expect(typeof result.createdAt).toBe('number');
  });
});

describe('Password Migration', () => {
  test('analyzePasswordMigration detects weak iterations', () => {
    const weakKdf: KdfConfig = {
      type: 'PBKDF2',
      iterations: 100000, // Below current recommendation
    };

    const migrationInfo = analyzePasswordMigration(weakKdf);
    
    expect(migrationInfo.needsRehash).toBe(true);
    expect(migrationInfo.currentIterations).toBe(100000);
    expect(migrationInfo.recommendedIterations).toBe(600000);
    expect(migrationInfo.reason).toBe('security_upgrade');
  });

  test('analyzePasswordMigration detects very weak iterations', () => {
    const veryWeakKdf: KdfConfig = {
      type: 'PBKDF2',
      iterations: 50000, // Below minimum threshold
    };

    const migrationInfo = analyzePasswordMigration(veryWeakKdf);
    
    expect(migrationInfo.needsRehash).toBe(true);
    expect(migrationInfo.isBelowMinimum).toBe(true);
    expect(migrationInfo.reason).toBe('weak_iterations');
  });

  test('analyzePasswordMigration accepts current recommendations', () => {
    const currentKdf: KdfConfig = {
      type: 'PBKDF2',
      iterations: 600000,
    };

    const migrationInfo = analyzePasswordMigration(currentKdf);
    
    expect(migrationInfo.needsRehash).toBe(false);
    expect(migrationInfo.isBelowMinimum).toBe(false);
  });

  test('migratePasswordHash upgrades iteration count', async () => {
    const email = 'test@bitwarden.com';
    const password = 'password123';
    const weakKdf: KdfConfig = {
      type: 'PBKDF2',
      iterations: 100000,
    };

    const migratedResult = await migratePasswordHash(email, password, weakKdf);
    
    expect(migratedResult.iterations).toBe(600000);
    expect(migratedResult.kdfType).toBe('PBKDF2');
    expect(migratedResult.hash).toBeDefined();
    expect(migratedResult.salt).toBeDefined();
  });

  test('needsRehash function works correctly', () => {
    expect(needsRehash('PBKDF2', 100000)).toBe(true);
    expect(needsRehash('PBKDF2', 600000)).toBe(false);
    expect(needsRehash('PBKDF2', 700000)).toBe(false);
    expect(needsRehash('PBKDF2', undefined)).toBe(true);
  });

  test('getRecommendedIterations returns correct values', () => {
    expect(getRecommendedIterations('PBKDF2')).toBe(600000);
    expect(getRecommendedIterations('Argon2id')).toBe(3);
  });
}); 