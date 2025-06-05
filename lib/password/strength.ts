import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en';

// Initialize zxcvbn-ts with language packages
const options = {
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  translations: zxcvbnEnPackage.translations,
};
zxcvbnOptions.setOptions(options);

const GLOBAL_INPUTS: string[] = [
  // Application-specific terms
  'securegen', 'secure', 'gen', 'generator', 'pwgen',
  
  // Password-related terms users might include
  'password', 'pass', 'pwd', 'passphrase', 'phrase',
  'username', 'user', 'login', 'auth', 'account',
  
  // Security-related terms
  'security', 'encrypt', 'hash', 'salt', 'key', 'secret',
  'crypto', 'random', 'strength', 'strong', 'weak',
  
  // Common generator terms
  'generate', 'create', 'make', 'build', 'new', 'fresh',
  'auto', 'random', 'unique', 'custom', 'special',
  
  // Application context terms
  'desktop', 'app', 'application', 'tool', 'utility',
  'manager', 'vault', 'store', 'save', 'export'
];

/**
 * Calculate password strength using zxcvbn-ts library.
 * Following Bitwarden's implementation pattern with enhanced validation and error handling.
 * 
 * @param password - The password to analyze (must be a non-empty string)
 * @param email - User's email address for context (must be a string)
 * @param additionalInputs - Additional context strings to consider (must be an array of strings)
 * @returns Password strength score (0-4) where 0 is weakest and 4 is strongest
 * @throws Error if input validation fails or zxcvbn-ts analysis encounters an error
 */
export function passwordStrength(
  password: string,
  email: string,
  additionalInputs: string[] = []
): number {
  // Input validation
  if (typeof password !== 'string') {
    throw new Error('Password must be a string');
  }
  
  if (password.length === 0) {
    throw new Error('Password cannot be empty');
  }
  
  if (typeof email !== 'string') {
    throw new Error('Email must be a string');
  }
  
  if (!Array.isArray(additionalInputs)) {
    throw new Error('Additional inputs must be an array');
  }
  
  // Validate that all additional inputs are strings
  for (let i = 0; i < additionalInputs.length; i++) {
    if (typeof additionalInputs[i] !== 'string') {
      throw new Error(`Additional input at index ${i} must be a string, got ${typeof additionalInputs[i]}`);
    }
  }
  
  try {
    // Extract user inputs from email (handles empty email gracefully)
    const inputs = emailToUserInputs(email);
    inputs.push(...additionalInputs);

    const arr = [...inputs, ...GLOBAL_INPUTS];

    // Perform password strength analysis
    const result = zxcvbn(password, arr);
    
    // Validate zxcvbn-ts result
    if (typeof result.score !== 'number' || result.score < 0 || result.score > 4) {
      throw new Error('Invalid password strength score returned from analysis');
    }
    
    return result.score;
  } catch (error) {
    // Handle zxcvbn-ts errors or other unexpected errors
    if (error instanceof Error) {
      // Re-throw validation errors as-is
      if (error.message.includes('must be') || error.message.includes('cannot be') || error.message.includes('Invalid password strength')) {
        throw error;
      }
      
      // Wrap zxcvbn-ts or other unexpected errors with context
      throw new Error(`Password strength analysis failed: ${error.message}`);
    }
    
    // Handle non-Error objects
    throw new Error(`Password strength analysis failed with unexpected error: ${String(error)}`);
  }
}

/**
 * Extract user inputs from email address for password strength calculation.
 * Enhanced with robust email validation and comprehensive edge case handling.
 * 
 * @param email - Email address to extract inputs from
 * @returns Array of meaningful string inputs derived from email prefix, or empty array if email is invalid
 */
function emailToUserInputs(email: string): string[] {
  try {
    // Handle empty, null, undefined, or non-string inputs
    if (!email || typeof email !== 'string') {
      return [];
    }
    
    const trimmedEmail = email.trim();
    
    // Handle empty or whitespace-only email after trimming
    if (trimmedEmail.length === 0) {
      return [];
    }
    
    // Basic email format validation using regex
    // This regex validates basic email structure: localpart@domain
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return [];
    }
    
    // Additional validation: check for common email format issues
    if (trimmedEmail.includes('..') || // consecutive dots
        trimmedEmail.startsWith('.') || // starts with dot
        trimmedEmail.endsWith('.') ||   // ends with dot
        trimmedEmail.includes('@.') ||  // @ followed by dot
        trimmedEmail.includes('.@')) {  // dot followed by @
      return [];
    }
    
    const parts = trimmedEmail.split('@');
    
    // Validate email structure (should have exactly 2 parts after split)
    if (parts.length !== 2) {
      return [];
    }
    
    const [localPart, domainPart] = parts;
    
    // Validate local part (prefix)
    if (!localPart || localPart.length === 0 || localPart.length > 64) {
      return [];
    }
    
    // Validate domain part
    if (!domainPart || domainPart.length === 0 || domainPart.length > 253) {
      return [];
    }
    
    // Check for valid domain structure (must contain at least one dot)
    if (!domainPart.includes('.')) {
      return [];
    }
    
    // Extract meaningful parts from email local part
    const rawInputs = localPart
      .toLowerCase()
      .split(/[^a-zA-Z0-9]/) // Split on non-alphanumeric characters
      .filter(part => part.length > 0); // Remove empty parts
    
    // Filter and process inputs for relevance
    const meaningfulInputs = rawInputs
      .filter(part => part.length >= 2) // Minimum 2 characters for relevance
      .filter(part => part.length <= 20) // Maximum 20 characters to avoid very long tokens
      .filter(part => !/^\d+$/.test(part)) // Exclude purely numeric strings (less meaningful)
      .filter(part => !isCommonEmailPattern(part)) // Exclude common email patterns
      .slice(0, 5); // Limit to first 5 meaningful parts to avoid overwhelming the analysis
    
    // Remove duplicates while preserving order
    const uniqueInputs = [...new Set(meaningfulInputs)];
    
    return uniqueInputs;
  } catch (error) {
    // If any error occurs during email processing, return empty array
    // This ensures the function is resilient and doesn't break password strength calculation
    if (process.env.NODE_ENV === 'development') {
      console.warn('Error processing email for password strength analysis:', error);
    }
    return [];
  }
}

/**
 * Check if a string is a common email pattern that should be excluded from password analysis.
 * These patterns are typically not meaningful for password strength calculation.
 * 
 * @param part - String part to check
 * @returns True if the part is a common email pattern that should be excluded
 */
function isCommonEmailPattern(part: string): boolean {
  const commonPatterns = [
    // Common email prefixes
    'no', 'reply', 'noreply', 'admin', 'info', 'support', 'help', 'contact',
    'mail', 'email', 'test', 'demo', 'temp', 'temporary', 'example',
    
    // Common number patterns
    '123', '456', '789', '000', '111', '222', '333', '444', '555',
    '666', '777', '888', '999', '12', '34', '56', '78', '90',
    
    // Common short words that add little value
    'me', 'my', 'the', 'and', 'or', 'at', 'in', 'on', 'to', 'of',
    'is', 'it', 'be', 'do', 'go', 'we', 'he', 'she', 'you', 'they'
  ];
  
  return commonPatterns.includes(part.toLowerCase());
} 