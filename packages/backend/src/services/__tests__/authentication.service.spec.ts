/**
 * Authentication Service Unit Tests
 *
 * Tests the thin wrapper pattern for authentication operations.
 * All underlying services are mocked to verify delegation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authenticationService } from '../authentication.service';
import * as loginService from '../login.service';
import * as passwordResetService from '../passwordReset.service';
import * as usersService from '../users.service';

// Mock dependencies
vi.mock('../login.service');
vi.mock('../passwordReset.service');
vi.mock('../users.service');
vi.mock('../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AuthenticationService', () => {
  const correlationId = 'test-correlation-id';
  const testEmail = 'test@example.com';
  const testPassword = 'password123';
  const testToken = 'access-token-123';
  const testUserId = 'user-uuid-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('login', () => {
    it('should delegate to login.service with correct parameters', async () => {
      const mockResponse = {
        user: {
          id: testUserId,
          email: testEmail,
          name: 'Test User',
          role: 'user' as const,
          status: 'active' as const,
          emailVerified: true,
          createdAt: '2026-01-01T00:00:00Z',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      vi.mocked(loginService.login).mockResolvedValue(mockResponse);

      const result = await authenticationService.login(
        testEmail,
        testPassword,
        correlationId
      );

      expect(loginService.login).toHaveBeenCalledWith(
        { email: testEmail, password: testPassword },
        correlationId
      );
      expect(result).toEqual({
        user: mockResponse.user,
        accessToken: mockResponse.accessToken,
        refreshToken: mockResponse.refreshToken,
      });
    });

    it('should propagate login errors', async () => {
      const error = new Error('Invalid credentials');
      vi.mocked(loginService.login).mockRejectedValue(error);

      await expect(
        authenticationService.login(testEmail, testPassword, correlationId)
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should delegate to login.service with correct parameters', async () => {
      vi.mocked(loginService.logout).mockResolvedValue();

      await authenticationService.logout(testToken, correlationId);

      expect(loginService.logout).toHaveBeenCalledWith(testToken, correlationId);
    });

    it('should propagate logout errors', async () => {
      const error = new Error('Logout failed');
      vi.mocked(loginService.logout).mockRejectedValue(error);

      await expect(
        authenticationService.logout(testToken, correlationId)
      ).rejects.toThrow('Logout failed');
    });
  });

  describe('getSession', () => {
    it('should delegate to login.service with correct parameters', async () => {
      const mockSession = {
        user: {
          id: testUserId,
          email: testEmail,
          name: 'Test User',
          role: 'user' as const,
          status: 'active' as const,
          emailVerified: true,
          createdAt: '2026-01-01T00:00:00Z',
        },
        session: {
          id: 'session-123',
          expiresAt: '2026-01-02T00:00:00Z',
        },
      };

      vi.mocked(loginService.getSession).mockResolvedValue(mockSession);

      const result = await authenticationService.getSession(testToken, correlationId);

      expect(loginService.getSession).toHaveBeenCalledWith(testToken, correlationId);
      expect(result).toEqual(mockSession);
    });

    it('should propagate getSession errors', async () => {
      const error = new Error('Unauthorized');
      vi.mocked(loginService.getSession).mockRejectedValue(error);

      await expect(
        authenticationService.getSession(testToken, correlationId)
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('initiatePasswordReset', () => {
    it('should delegate to passwordReset.service with correct parameters', async () => {
      const mockToken = 'reset-token-abc123';
      vi.mocked(passwordResetService.generateResetToken).mockResolvedValue(mockToken);

      const result = await authenticationService.initiatePasswordReset(
        testUserId,
        correlationId
      );

      expect(passwordResetService.generateResetToken).toHaveBeenCalledWith(
        testUserId,
        correlationId
      );
      expect(result).toBe(mockToken);
    });

    it('should propagate password reset initiation errors', async () => {
      const error = new Error('User not found');
      vi.mocked(passwordResetService.generateResetToken).mockRejectedValue(error);

      await expect(
        authenticationService.initiatePasswordReset(testUserId, correlationId)
      ).rejects.toThrow('User not found');
    });
  });

  describe('completePasswordReset', () => {
    it('should delegate to passwordReset.service with correct parameters', async () => {
      const resetToken = 'valid-reset-token';
      const newPassword = 'NewPassword123!';

      vi.mocked(passwordResetService.resetPassword).mockResolvedValue();

      await authenticationService.completePasswordReset(
        resetToken,
        newPassword,
        correlationId
      );

      expect(passwordResetService.resetPassword).toHaveBeenCalledWith(
        resetToken,
        newPassword,
        correlationId
      );
    });

    it('should propagate password reset completion errors', async () => {
      const error = new Error('Invalid or expired token');
      vi.mocked(passwordResetService.resetPassword).mockRejectedValue(error);

      await expect(
        authenticationService.completePasswordReset(
          'invalid-token',
          'newPassword',
          correlationId
        )
      ).rejects.toThrow('Invalid or expired token');
    });
  });

  describe('getCurrentUser', () => {
    it('should delegate to users.service and return mapped user', async () => {
      const mockUser = {
        id: testUserId,
        email: testEmail,
        name: 'Test User',
        role: 'admin' as const,
        status: 'active' as const,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
      };

      vi.mocked(usersService.usersService.getUserById).mockResolvedValue(mockUser);

      const result = await authenticationService.getCurrentUser(testUserId);

      expect(usersService.usersService.getUserById).toHaveBeenCalledWith(testUserId);
      expect(result).toEqual({
        id: testUserId,
        email: testEmail,
        name: 'Test User',
        role: 'admin',
        status: 'active',
        emailVerified: false,
        createdAt: mockUser.createdAt,
      });
    });

    it('should return null when user not found', async () => {
      vi.mocked(usersService.usersService.getUserById).mockResolvedValue(null);

      const result = await authenticationService.getCurrentUser('nonexistent-id');

      expect(result).toBeNull();
    });
  });
});
