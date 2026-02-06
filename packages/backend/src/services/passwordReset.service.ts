/**
 * Password Reset Service
 * Handles password reset token generation, validation, and password reset logic
 */

import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { db } from '../config/db';
import { passwordResetTokens, users } from '../config/db';
import { eq, isNull, and, lt } from 'drizzle-orm';
import { validatePassword } from './passwordValidation.service';
import { auditService } from './audit.service';

/**
 * Generate a password reset token for user
 * Returns the raw token (only shown once to user via email)
 * Stores bcrypt hash in database
 */
export async function generateResetToken(
  userId: string,
  correlationId: string,
): Promise<string> {
  // Delete any existing valid tokens for this user
  await db
    .delete(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, userId),
        isNull(passwordResetTokens.usedAt),
        lt(passwordResetTokens.expiresAt, new Date()),
      ),
    );

  // Generate new token: 64-char hex (32 bytes = 64 hex chars)
  const token = randomBytes(32).toString('hex');

  // Hash token before storing
  const tokenHash = await bcrypt.hash(token, 12);

  // Token expires in 60 minutes
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  // Store hashed token in database
  await db.insert(passwordResetTokens).values({
    userId,
    token: tokenHash,
    expiresAt,
  });

  // Log action
  await auditService.logAction({
    action: 'password.reset_token_generated',
    entityType: 'conversation',
    entityId: userId,
    metadata: { expiresAt: expiresAt.toISOString() },
  });

  // Return raw token (only shown once)
  return token;
}

/**
 * Validate reset token - verify it's valid, not expired, not used
 * Returns userId if valid, throws if invalid/expired/used
 */
export async function validateAndGetUserId(
  token: string,
  correlationId: string,
): Promise<string> {
  // Basic format check
  if (!token || token.length !== 64 || !/^[a-f0-9]{64}$/.test(token)) {
    throw new Error('Invalid or expired token');
  }

  // Get all non-used tokens
  const records = await db
    .select()
    .from(passwordResetTokens)
    .where(isNull(passwordResetTokens.usedAt));

  // Compare each token hash with input (timing-safe comparison via bcrypt)
  for (const record of records) {
    try {
      const isMatch = await bcrypt.compare(token, record.token);

      if (isMatch) {
        // Check expiration
        if (new Date() > record.expiresAt) {
          throw new Error('Invalid or expired token');
        }

        // Log validation
        await auditService.logAction({
          action: 'password.reset_token_validated',
          entityType: 'conversation',
          entityId: record.userId,
        });

        return record.userId;
      }
    } catch (error) {
      // If bcrypt.compare fails, continue to next token
      // This handles the case where token doesn't match
      if (error instanceof Error && !error.message.includes('Invalid or expired token')) {
        continue;
      }
      throw error;
    }
  }

  // No matching token found
  throw new Error('Invalid or expired token');
}

/**
 * Reset password for user with valid token
 * Validates token, password, updates user, marks token as used
 */
export async function resetPassword(
  token: string,
  newPassword: string,
  correlationId: string,
): Promise<void> {
  // Validate token and get user ID
  const userId = await validateAndGetUserId(token, correlationId);

  // Validate password requirements
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    console.error(`Password validation failed for user ${userId}`, {
      correlationId,
      error: validation.error,
    });
    throw new Error(validation.error);
  }

  // Hash new password with bcrypt
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update user password
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId));

  // Find and mark token as used
  const record = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, userId),
        isNull(passwordResetTokens.usedAt),
      ),
    )
    .limit(1);

  if (record.length > 0) {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, record[0].id));
  }

  // Log successful reset
  await auditService.logAction({
    action: 'password.reset_successful',
    entityType: 'conversation',
    entityId: userId,
  });
}
