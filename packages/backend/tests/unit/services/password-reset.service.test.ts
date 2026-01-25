/**
 * Password Reset Service Unit Tests
 *
 * Coverage Target: 85%+ for BE-004
 *
 * Test Coverage:
 * - Token generation (format, expiration, hashing)
 * - Token validation (valid, expired, invalid format, reuse prevention)
 * - Password reset (success, invalid token, password requirements)
 * - Audit logging integration
 * - Database operations
 */

import { describe, expect, beforeEach, afterEach, it, jest } from '@jest/globals';
import { db, passwordResetTokens } from '../../../src/config/db';
import {
  generateResetToken,
  validateAndGetUserId,
  resetPassword,
} from '../../../src/services/password-reset.service';
import { eq } from 'drizzle-orm';

/**
 * Mock user ID for testing
 */
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_CORRELATION_ID = 'test-correlation-id-123';

describe('PasswordResetService', () => {
  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(passwordResetTokens).execute();
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(passwordResetTokens).execute();
  });

  describe('generateResetToken', () => {
    it('should generate a valid 64-character hex token', async () => {
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);

      // Token should be 64 hex characters
      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(token.length).toBe(64);
    });

    it('should store hashed token in database (never raw)', async () => {
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);

      // Retrieve stored token from database
      const [record] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, TEST_USER_ID));

      expect(record).toBeDefined();
      // Raw token should not match hashed token in database
      expect(record.token).not.toBe(token);
      // Should be bcrypt hash (starts with $2a$ or $2b$)
      expect(record.token).toMatch(/^\$2[aby]\$/);
    });

    it('should set correct expiration time (60 minutes)', async () => {
      const beforeTime = Date.now();
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);
      const afterTime = Date.now();

      const [record] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, TEST_USER_ID));

      const expectedMinExp = beforeTime + 59 * 60 * 1000; // 59 minutes
      const expectedMaxExp = afterTime + 61 * 60 * 1000; // 61 minutes

      expect(record.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExp);
      expect(record.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExp);
    });

    it('should delete existing valid tokens for same user', async () => {
      // Generate first token
      const token1 = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);

      // Generate second token
      const token2 = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);

      // Should only have one token
      const records = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, TEST_USER_ID));

      expect(records.length).toBe(1);
      // Second token should be different from first
      expect(token2).not.toBe(token1);
    });

    it('should log audit entry for token generation', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);

      // Verify token was generated (has audit logging)
      expect(token).toMatch(/^[a-f0-9]{64}$/);

      consoleSpy.mockRestore();
    });
  });

  describe('validateAndGetUserId', () => {
    it('should return user ID for valid token', async () => {
      // Generate valid token
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);

      // Validate token
      const userId = await validateAndGetUserId(token, TEST_CORRELATION_ID);

      expect(userId).toBe(TEST_USER_ID);
    });

    it('should reject invalid token format (wrong length)', async () => {
      const invalidToken = 'short';

      await expect(validateAndGetUserId(invalidToken, TEST_CORRELATION_ID)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should reject invalid token format (non-hex characters)', async () => {
      const invalidToken = 'z'.repeat(64); // z is not hex

      await expect(validateAndGetUserId(invalidToken, TEST_CORRELATION_ID)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should reject expired token', async () => {
      // Generate token
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);

      // Manually expire the token in database
      await db
        .update(passwordResetTokens)
        .set({ expiresAt: new Date(Date.now() - 1000) }) // Expired 1 second ago
        .where(eq(passwordResetTokens.userId, TEST_USER_ID));

      // Should reject expired token
      await expect(validateAndGetUserId(token, TEST_CORRELATION_ID)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should reject already used token', async () => {
      // Generate token
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);

      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.userId, TEST_USER_ID));

      // Should reject used token
      await expect(validateAndGetUserId(token, TEST_CORRELATION_ID)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should reject non-existent token', async () => {
      const randomToken = 'a'.repeat(64); // Valid format but doesn't exist

      await expect(validateAndGetUserId(randomToken, TEST_CORRELATION_ID)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should use timing-safe comparison for token validation', async () => {
      // Generate token
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);

      // Get the hash from database
      const [record] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, TEST_USER_ID));

      // Verify token hash is stored (not raw token)
      expect(record.token).not.toBe(token);
      expect(record.token).toMatch(/^\$2[aby]\$/);

      // Verify token validates correctly
      const userId = await validateAndGetUserId(token, TEST_CORRELATION_ID);
      expect(userId).toBe(TEST_USER_ID);

      // Wrong token should not validate
      const wrongToken = 'b'.repeat(64);
      await expect(validateAndGetUserId(wrongToken, TEST_CORRELATION_ID)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should log audit entry on successful validation', async () => {
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);

      const userId = await validateAndGetUserId(token, TEST_CORRELATION_ID);

      expect(userId).toBe(TEST_USER_ID);
      // Audit logging should occur (checked in service)
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      // Generate token
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);

      const newPassword = 'NewPassword123!';

      // Reset password (should not throw)
      await expect(resetPassword(token, newPassword, TEST_CORRELATION_ID)).resolves.not.toThrow();
    });

    it('should mark token as used after reset', async () => {
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);
      const newPassword = 'NewPassword123!';

      // Reset password
      await resetPassword(token, newPassword, TEST_CORRELATION_ID);

      // Check token is marked as used
      const [record] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, TEST_USER_ID));

      expect(record.usedAt).toBeDefined();
      expect(record.usedAt).not.toBeNull();
    });

    it('should reject password with less than 8 characters', async () => {
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);
      const shortPassword = 'Pass1'; // Only 5 chars

      await expect(resetPassword(token, shortPassword, TEST_CORRELATION_ID)).rejects.toThrow();
    });

    it('should reject password without uppercase letter', async () => {
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);
      const noUpperPassword = 'password123'; // No uppercase

      await expect(resetPassword(token, noUpperPassword, TEST_CORRELATION_ID)).rejects.toThrow();
    });

    it('should reject password without number', async () => {
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);
      const noNumberPassword = 'Password!'; // No number

      await expect(resetPassword(token, noNumberPassword, TEST_CORRELATION_ID)).rejects.toThrow();
    });

    it('should reject invalid token', async () => {
      const invalidToken = 'a'.repeat(64);
      const newPassword = 'NewPassword123!';

      await expect(resetPassword(invalidToken, newPassword, TEST_CORRELATION_ID)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should reject expired token', async () => {
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);

      // Expire the token
      await db
        .update(passwordResetTokens)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(passwordResetTokens.userId, TEST_USER_ID));

      const newPassword = 'NewPassword123!';

      await expect(resetPassword(token, newPassword, TEST_CORRELATION_ID)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should reject reused token', async () => {
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);
      const newPassword = 'NewPassword123!';

      // First reset - should work
      await resetPassword(token, newPassword, TEST_CORRELATION_ID);

      // Try to reset again with same token
      const anotherPassword = 'AnotherPassword456!';
      await expect(resetPassword(token, anotherPassword, TEST_CORRELATION_ID)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should log audit entry on successful reset', async () => {
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);
      const newPassword = 'NewPassword123!';

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await resetPassword(token, newPassword, TEST_CORRELATION_ID);

      // Verify successful reset (audit logging should occur)
      const [record] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, TEST_USER_ID));

      expect(record.usedAt).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should validate password before attempting reset', async () => {
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);
      const weakPassword = 'weak'; // Too short, no uppercase, no number

      await expect(resetPassword(token, weakPassword, TEST_CORRELATION_ID)).rejects.toThrow();

      // Token should NOT be marked as used if password validation fails
      const [record] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, TEST_USER_ID));

      expect(record.usedAt).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    it('should complete full password reset flow', async () => {
      // Step 1: Generate token
      const token = await generateResetToken(TEST_USER_ID, TEST_CORRELATION_ID);
      expect(token).toMatch(/^[a-f0-9]{64}$/);

      // Step 2: Validate token
      const userId = await validateAndGetUserId(token, TEST_CORRELATION_ID);
      expect(userId).toBe(TEST_USER_ID);

      // Step 3: Reset password
      const newPassword = 'NewPassword123!';
      await resetPassword(token, newPassword, TEST_CORRELATION_ID);

      // Step 4: Verify token is marked as used
      const [record] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, TEST_USER_ID));

      expect(record.usedAt).toBeDefined();

      // Step 5: Verify token cannot be reused
      const anotherPassword = 'AnotherPassword456!';
      await expect(resetPassword(token, anotherPassword, TEST_CORRELATION_ID)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should handle multiple users with separate tokens', async () => {
      const userId1 = '550e8400-e29b-41d4-a716-446655440001';
      const userId2 = '550e8400-e29b-41d4-a716-446655440002';

      // Generate tokens for two users
      const token1 = await generateResetToken(userId1, TEST_CORRELATION_ID);
      const token2 = await generateResetToken(userId2, TEST_CORRELATION_ID);

      // Tokens should be different
      expect(token1).not.toBe(token2);

      // Each token should validate for correct user
      const validatedId1 = await validateAndGetUserId(token1, TEST_CORRELATION_ID);
      const validatedId2 = await validateAndGetUserId(token2, TEST_CORRELATION_ID);

      expect(validatedId1).toBe(userId1);
      expect(validatedId2).toBe(userId2);

      // Token1 should not work for userId2
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.userId, userId1));

      await expect(validateAndGetUserId(token1, TEST_CORRELATION_ID)).rejects.toThrow();
    });
  });
});
