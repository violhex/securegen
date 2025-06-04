# Password Module

This module provides password-related functionality following Bitwarden's implementation patterns and system design. It includes password strength calculation, policy validation, hashing, and validation utilities.

## Structure

The module is organized following Bitwarden's modular approach:

```
password/
├── mod.ts           # Main module exports
├── types.ts         # TypeScript interfaces and types
├── policy.ts        # Password policy validation
├── strength.ts      # Password strength calculation using zxcvbn
├── hash.ts          # Password hashing and KDF operations
├── validate.ts      # Password validation utilities
├── __tests__/       # Test files
└── README.md        # This documentation
```

## Features

### Password Strength Calculation

Uses the industry-standard `zxcvbn` library (same as Bitwarden) to calculate password strength on a scale of 0-4:

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

Provides secure password hashing using PBKDF2 (with Web Crypto API):

```typescript
import { determinePasswordHash } from './password/hash';
import { HashPurpose } from './password/types';

const hash = await determinePasswordHash(
  'user@example.com',
  { type: 'PBKDF2', iterations: 100000 },
  'password',
  HashPurpose.LocalAuthorization
);
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
3. **Secure Hashing**: Uses PBKDF2 with configurable iterations
4. **Policy Enforcement**: Flexible policy system for organizational requirements

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

## Dependencies

- `zxcvbn`: Password strength estimation library
- `@types/zxcvbn`: TypeScript types for zxcvbn
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