import zxcvbn from 'zxcvbn';

const GLOBAL_INPUTS: string[] = ['bitwarden', 'bit', 'warden'];

/**
 * Calculate password strength using zxcvbn library.
 * Following Bitwarden's implementation pattern.
 */
export function passwordStrength(
  password: string,
  email: string,
  additionalInputs: string[] = []
): number {
  const inputs = emailToUserInputs(email);
  inputs.push(...additionalInputs);

  const arr = [...inputs, ...GLOBAL_INPUTS];

  const result = zxcvbn(password, arr);
  return result.score;
}

/**
 * Extract user inputs from email address for password strength calculation.
 * Following Bitwarden's implementation pattern.
 */
function emailToUserInputs(email: string): string[] {
  const parts = email.split('@');
  if (parts.length < 2) {
    return [];
  }

  const prefix = parts[0];
  return prefix
    .trim()
    .toLowerCase()
    .split(/[^a-zA-Z0-9]/)
    .filter(part => part.length > 0);
} 