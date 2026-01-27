/**
 * Password Validation Service
 * Validates passwords against security requirements
 */

/**
 * Validate password meets minimum requirements
 * 
 * ✅ AC 6 Requirements (from week1-product-owner-review.md):
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 number
 * 
 * @param password - Password to validate
 * @returns Validation result with success flag and error message if invalid
 */
export function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  // Minimum length check: 8 characters
  if (password.length < 8) {
    return {
      valid: false,
      error: 'Password must be at least 8 characters',
    };
  }

  // Uppercase letter check: at least 1
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least 1 uppercase letter',
    };
  }

  // Number check: at least 1
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least 1 number',
    };
  }

  return {
    valid: true,
  };
}
