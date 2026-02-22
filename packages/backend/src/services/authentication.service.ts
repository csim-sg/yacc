/**
 * Authentication Service
 *
 * Thin wrapper that consolidates all authentication-related operations.
 * Delegates to existing specialized services:
 * - login.service.ts: Login/logout/session operations
 * - passwordReset.service.ts: Password reset flow
 * - users.service.ts: User retrieval
 *
 * This service provides a single entry point for auth controllers,
 * following the thin wrapper pattern approved in ADR-005 Addendum-2.
 *
 * @see ADR-005 Addendum-2 - Auth Service Consolidation
 */

import type { AuthUser } from '../types/auth.types';
import { logger } from '../infrastructure/logger';
import { login, logout, getSession, type LoginResponse } from './login.service';
import { generateResetToken, resetPassword } from './passwordReset.service';
import { usersService } from './users.service';

/**
 * Session information returned after successful login
 */
export interface SessionInfo {
  user: LoginResponse['user'];
  accessToken: string;
  refreshToken: string;
}

/**
 * Session details for authenticated user
 */
export interface SessionDetails {
  user: LoginResponse['user'];
  session: {
    id: string;
    expiresAt: string;
  };
}

/**
 * Reset token information
 */
export interface ResetTokenInfo {
  token: string;
  userId: string;
}

/**
 * Authentication Service
 *
 * Provides a unified interface for all authentication operations.
 * Each method delegates to the appropriate specialized service.
 */
export class AuthenticationService {
  /**
   * Perform email/password login
   *
   * @param email - User email
   * @param password - User password
   * @param correlationId - Request correlation ID for tracing
   * @returns Session info with user and tokens
   * @throws Error if login fails
   */
  async login(
    email: string,
    password: string,
    correlationId: string
  ): Promise<SessionInfo> {
    logger.debug(
      { correlationId, email },
      'AuthenticationService.login: delegating to login.service'
    );

    const response = await login({ email, password }, correlationId);

    return {
      user: response.user,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    };
  }

  /**
   * Logout user and invalidate session
   *
   * @param accessToken - User's access token
   * @param correlationId - Request correlation ID for tracing
   */
  async logout(accessToken: string, correlationId: string): Promise<void> {
    logger.debug(
      { correlationId },
      'AuthenticationService.logout: delegating to login.service'
    );

    await logout(accessToken, correlationId);
  }

  /**
   * Get current session for authenticated user
   *
   * @param accessToken - User's access token
   * @param correlationId - Request correlation ID for tracing
   * @returns Session details with user and expiration
   */
  async getSession(
    accessToken: string,
    correlationId: string
  ): Promise<SessionDetails> {
    logger.debug(
      { correlationId },
      'AuthenticationService.getSession: delegating to login.service'
    );

    return getSession(accessToken, correlationId);
  }

  /**
   * Initiate password reset for an email address
   *
   * Generates a reset token and (in production) sends reset email.
   * Always returns a token for testing purposes.
   *
   * @param userId - User ID to reset password for
   * @param correlationId - Request correlation ID for tracing
   * @returns Reset token (only shown once)
   */
  async initiatePasswordReset(
    userId: string,
    correlationId: string
  ): Promise<string> {
    logger.debug(
      { correlationId, userId },
      'AuthenticationService.initiatePasswordReset: delegating to passwordReset.service'
    );

    return generateResetToken(userId, correlationId);
  }

  /**
   * Complete password reset with token
   *
   * Validates token and updates user password.
   *
   * @param token - Reset token from email
   * @param newPassword - New password to set
   * @param correlationId - Request correlation ID for tracing
   */
  async completePasswordReset(
    token: string,
    newPassword: string,
    correlationId: string
  ): Promise<void> {
    logger.debug(
      { correlationId },
      'AuthenticationService.completePasswordReset: delegating to passwordReset.service'
    );

    await resetPassword(token, newPassword, correlationId);
  }

  /**
   * Get current user by ID
   *
   * Used for session validation and user retrieval.
   *
   * @param userId - User ID
   * @returns User object or null if not found
   */
  async getCurrentUser(userId: string): Promise<AuthUser | null> {
    logger.debug(
      { userId },
      'AuthenticationService.getCurrentUser: delegating to users.service'
    );

    const user = await usersService.getUserById(userId);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      emailVerified: false, // Default for now
      createdAt: user.createdAt,
    };
  }
}

/**
 * Singleton instance for use in controllers
 */
export const authenticationService = new AuthenticationService();
