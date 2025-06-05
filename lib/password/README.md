# Password Module

This module provides password-related functionality following Bitwarden's implementation patterns and system design. It includes password strength calculation, policy validation, hashing, and validation utilities.

## Structure

The module is organized following Bitwarden's modular approach:

```
password/
├── mod.ts           # Main module exports
├── types.ts         # TypeScript interfaces and types
├── policy.ts        # Password policy validation
├── strength.ts      # Password strength calculation using zxcvbn-ts
├── hash.ts          # Password hashing and KDF operations
├── validate.ts      # Password validation utilities
├── __tests__/       # Test files
└── README.md        # This documentation
```

## Features

### Password Strength Calculation

Uses the industry-standard `zxcvbn-ts` library (TypeScript rewrite of zxcvbn, same algorithm as Bitwarden) to calculate password strength on a scale of 0-4:

- **0**: Very weak (e.g., "password")
- **1**: Weak (e.g., "password11")
- **2**: Fair (e.g., "Weakpass2")
- **3**: Good (e.g., "GoodPass3!")
- **4**: Strong (e.g., "VeryStrong123@#")

```typescript
import { passwordStrength } from './password/strength';

const strength = passwordStrength('MyPassword123!', 'user@example.com');
console.log(strength); // 0-4
```

### Password Policy Validation

Validates passwords against configurable policies:

```typescript
import { satisfiesPolicy } from './password/policy';
import type { MasterPasswordPolicyOptions } from './password/types';

const policy: MasterPasswordPolicyOptions = {
  minComplexity: 3,
  minLength: 8,
  requireUpper: true,
  requireLower: true,
  requireNumbers: true,
  requireSpecial: true,
  enforceOnLogin: false,
};

const isValid = satisfiesPolicy('MyPassword123!', 4, policy);
```

### Password Hashing

Provides secure password hashing using PBKDF2 with cryptographically secure random salts:

```typescript
import { determinePasswordHash } from './password/hash';
import { HashPurpose, type PasswordHashResult } from './password/types';

// Generate new hash with secure random salt (for registration/password change)
const hashResult: PasswordHashResult = await determinePasswordHash(
  'user@example.com',
  { type: 'PBKDF2', iterations: 600000 }, // 2024 OWASP recommended minimum
  'password',
  HashPurpose.LocalAuthorization,
  undefined,
  true
);

console.log(hashResult.hash); // The password hash
console.log(hashResult.salt); // The cryptographically secure random salt
console.log(hashResult.iterations); // Iteration count used
console.log(hashResult.kdfType); // KDF algorithm used

// Verify password with existing salt (for login)
const verificationHash = await determinePasswordHash(
  'user@example.com',
  { type: 'PBKDF2', iterations: 600000 },
  'password',
  HashPurpose.LocalAuthorization,
  hashResult.salt // Use stored salt
);

const isValid = verificationHash === hashResult.hash;
```

### Password Validation

Comprehensive password validation with detailed error messages:

```typescript
import { validatePasswordStrength } from './password/validate';

const result = validatePasswordStrength('weak', {
  minLength: 8,
  requireUpper: true,
  requireNumbers: true,
});

console.log(result.isValid); // false
console.log(result.errors); // Array of error messages
```

### Password Migration

Automatic migration of existing passwords to stronger security parameters:

```typescript
import { 
  validatePasswordWithMigration, 
  analyzePasswordMigration,
  migratePasswordHash 
} from './password/validate';

// Enhanced validation with automatic migration
const result = await validatePasswordWithMigration(
  loginMethod,
  password,
  storedHash,
  storedSalt,
  storedHashResult
);

if (result.isValid && result.migratedHash) {
  // Password was automatically upgraded
  console.log('Password security upgraded');
  console.log('New hash:', result.migratedHash.hash);
  console.log('New iterations:', result.migratedHash.iterations);
  
  // Update stored hash with migrated version
  await updateStoredPassword(result.migratedHash);
}

// Manual migration analysis
const migrationInfo = analyzePasswordMigration(kdfConfig, hashResult);
if (migrationInfo.needsRehash) {
  console.log(`Migration needed: ${migrationInfo.reason}`);
  console.log(`Current: ${migrationInfo.currentIterations} iterations`);
  console.log(`Recommended: ${migrationInfo.recommendedIterations} iterations`);
}
```

## Key Design Principles

### Following Bitwarden's Patterns

1. **Modular Structure**: Each functionality is separated into its own module
2. **Type Safety**: Comprehensive TypeScript interfaces and types
3. **Security First**: Uses industry-standard libraries and algorithms
4. **Context Awareness**: Password strength considers user email and additional inputs
5. **Comprehensive Testing**: Extensive test coverage following Bitwarden's test patterns

### Security Features

1. **Email Penalization**: Passwords containing parts of the user's email are penalized
2. **Global Input Filtering**: Passwords containing "bitwarden", "bit", or "warden" are penalized
3. **OWASP-Compliant Hashing**: Uses PBKDF2 with 600,000 iterations (2024 OWASP minimum) and cryptographically secure random salts
4. **Cryptographic Salt Generation**: Each password hash uses a unique 256-bit random salt generated with `crypto.getRandomValues()`
5. **Automatic Migration**: Existing passwords are automatically re-hashed with stronger parameters upon login
6. **Backward Compatibility**: Supports both legacy email-based salts and new secure random salts
7. **Future-Ready**: Prepared for migration to Argon2id memory-hard algorithm
8. **Policy Enforcement**: Flexible policy system for organizational requirements
9. **Migration Tracking**: Comprehensive metadata tracking for security auditing

## Usage Examples

### Basic Password Strength Check

```typescript
import { passwordStrength } from './password';

// Basic strength check
const strength = passwordStrength('MyPassword123!', 'user@example.com');

// With additional context
const strengthWithContext = passwordStrength(
  'MyPassword123!',
  'user@example.com',
  ['company', 'project']
);
```

### Complete Password Validation

```typescript
import { 
  passwordStrength, 
  satisfiesPolicy, 
  validatePasswordStrength 
} from './password';

function validateUserPassword(password: string, email: string) {
  // Check strength
  const strength = passwordStrength(password, email);
  
  // Check policy compliance
  const policy = {
    minComplexity: 3,
    minLength: 8,
    requireUpper: true,
    requireLower: true,
    requireNumbers: true,
    requireSpecial: true,
    enforceOnLogin: false,
  };
  
  const policyValid = satisfiesPolicy(password, strength, policy);
  
  // Get detailed validation results
  const validation = validatePasswordStrength(password, {
    minLength: policy.minLength,
    requireUpper: policy.requireUpper,
    requireLower: policy.requireLower,
    requireNumbers: policy.requireNumbers,
    requireSpecial: policy.requireSpecial,
  });
  
  return {
    strength,
    policyValid,
    validation,
    overall: policyValid && validation.isValid && strength >= policy.minComplexity
  };
}
```

### Secure Password Hashing Workflow

```typescript
import { 
  determinePasswordHash, 
  validatePassword,
  HashPurpose,
  type PasswordHashResult,
  type LoginMethod 
} from './password';

// 1. Registration/Password Change: Generate hash with secure salt
async function registerUser(email: string, password: string) {
  const kdf = { type: 'PBKDF2' as const, iterations: 100000 };
  
  const hashResult: PasswordHashResult = await determinePasswordHash(
    email,
    kdf,
    password,
    HashPurpose.LocalAuthorization,
    undefined,
    true
  );
  
  // Store both hash and salt in your database
  await storeUserCredentials(email, {
    passwordHash: hashResult.hash,
    salt: hashResult.salt,
    kdf
  });
  
  return hashResult;
}

// 2. Login: Verify password using stored salt
async function loginUser(email: string, password: string) {
  // Retrieve stored credentials from database
  const credentials = await getUserCredentials(email);
  
  const loginMethod: LoginMethod = {
    type: 'user',
    user: {
      email,
      kdf: credentials.kdf,
      clientId: 'your-app-id'
    }
  };
  
  // Verify password with stored salt
  const isValid = await validatePassword(
    loginMethod,
    password,
    credentials.passwordHash,
    credentials.salt
  );
  
  return isValid;
}

// 3. Migration: Convert legacy hashes to secure salt approach
async function migrateUserPassword(email: string, password: string) {
  const loginMethod: LoginMethod = {
    type: 'user',
    user: {
      email,
      kdf: { type: 'PBKDF2', iterations: 100000 },
      clientId: 'your-app-id'
    }
  };
  
  // Get legacy credentials
  const legacyCredentials = await getLegacyUserCredentials(email);
  
  // Verify with legacy approach (no salt parameter)
  const isValidLegacy = await validatePassword(
    loginMethod,
    password,
    legacyCredentials.passwordHash
  );
  
  if (isValidLegacy) {
    // Generate new secure hash
    const newHashResult = await registerUser(email, password);
    
    // Update database with secure credentials
    await updateUserCredentials(email, newHashResult);
    
    return true;
  }
  
  return false;
}
```

## Dependencies

- `@zxcvbn-ts/core`: Password strength estimation library (TypeScript rewrite of zxcvbn)
- `@zxcvbn-ts/language-common`: Common language patterns for zxcvbn-ts
- `@zxcvbn-ts/language-en`: English language pack for zxcvbn-ts
- Web Crypto API: For secure hashing operations

## Testing

Run tests with:

```bash
npm test password
```

The test suite includes:
- Policy validation tests
- Password strength calculation tests
- Hashing functionality tests
- Validation utility tests

## Notes

- This implementation follows Bitwarden's patterns but is simplified for educational purposes
- In production, you would need more robust key management and encryption
- The hashing implementation uses Web Crypto API and is suitable for browser environments
- For Node.js environments, you might want to use the `crypto` module instead

## Future Enhancements

- Add Argon2id KDF support
- Implement proper key management
- Add password breach checking
- Implement password history validation
- Add more comprehensive policy options 