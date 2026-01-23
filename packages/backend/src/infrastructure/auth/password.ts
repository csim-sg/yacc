import crypto from 'crypto';

/**
 * Hash a password using bcrypt-like algorithm
 * Note: In production, use proper bcrypt library
 */
export function hashPassword(password: string): string {
  // Simple PBKDF2 implementation for MVP (not for production)
  // In production, use bcrypt or argon2
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against its hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  const [salt, storedHash] = hash.split(':');
  if (!salt || !storedHash) {
    return false;
  }
  const computedHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  return computedHash === storedHash;
}

/**
 * Generate a random reset token
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a random verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
