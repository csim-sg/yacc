import { db } from '../../infrastructure/db/client.js';
import { users, passwordResetTokens } from '../../infrastructure/db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  hashPassword,
  verifyPassword,
  generateResetToken,
} from '../../infrastructure/auth/password.js';
import { emailService } from '../../infrastructure/email/email.service.js';

export class AuthService {
  /**
   * Register a new user (super admin only)
   */
  async register(email: string, password: string, name: string, role: string = 'user') {
    // Check if user exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      throw new Error('User already exists');
    }

    const passwordHash = hashPassword(password);

    const user = await db.insert(users).values({
      email,
      name,
      passwordHash,
      role: role as any, // Type cast for enum
      status: 'active',
    }).returning();

    return {
      id: user[0].id,
      email: user[0].email,
      name: user[0].name,
      role: user[0].role,
    };
  }

  /**
   * Login user and return user data
   */
  async login(email: string, password: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new Error('Account is disabled');
    }

    // Verify password
    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(id: number) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      // Return success even if user doesn't exist (security: no user enumeration)
      return { success: true, message: 'If email exists, reset link sent' };
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in database
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token: resetToken,
      expiresAt,
    });

    // Build reset link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send email
    await emailService.sendPasswordResetEmail(user.email, resetLink, resetToken);

    return {
      success: true,
      message: 'If email exists, reset link sent',
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string) {
    // Find valid reset token
    const resetTokenRecord = await db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.token, token),
    });

    if (!resetTokenRecord) {
      throw new Error('Invalid or expired reset token');
    }

    // Check if token is expired
    if (new Date() > resetTokenRecord.expiresAt) {
      throw new Error('Reset token has expired');
    }

    // Check if token was already used
    if (resetTokenRecord.usedAt) {
      throw new Error('Reset token has already been used');
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, resetTokenRecord.userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Hash new password
    const newPasswordHash = hashPassword(newPassword);

    // Update user password
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetTokenRecord.id));

    return { success: true, message: 'Password reset successfully' };
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    const newPasswordHash = hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, userId));

    return { success: true, message: 'Password updated' };
  }
}

export const authService = new AuthService();
