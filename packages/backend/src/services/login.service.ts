/**
 * Login Service
 *
 * Handles email/password authentication and session creation.
 * Encapsulates BetterAuth login logic for use in controllers.
 */

import { betterAuthClient } from '../infrastructure/better-auth.client';
import { logger } from '../infrastructure/logger';

/**
 * Login credentials from client
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Login response containing user and tokens
 */
export interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'super_admin' | 'admin' | 'manager' | 'user';
    status: 'active' | 'inactive' | 'suspended';
    emailVerified: boolean;
    createdAt: string;
    lastLoginAt?: string;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Perform email/password login
 *
 * @param credentials - Email and password
 * @param correlationId - Request correlation ID for tracing
 * @returns Login response with user and tokens
 * @throws Error if login fails (invalid credentials, user inactive, etc.)
 */
export async function login(
  credentials: LoginCredentials,
  correlationId: string
): Promise<LoginResponse> {
  try {
    // Validate input
    if (!credentials.email || !credentials.password) {
      logger.warn({ correlationId }, 'Login attempt with missing credentials');
      throw new Error('Invalid credentials');
    }

    // Create a Request object for BetterAuth handler
    const request = new Request('http://localhost/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    });

    // Call BetterAuth handler
    const response = await betterAuthClient.handler(request);

    // Handle error responses
    if (!response.ok) {
      logger.warn(
        { correlationId, email: credentials.email, status: response.status },
        'Login failed'
      );
      throw new Error('Invalid credentials');
    }

    // Parse response
    const data = await response.json();

    // Validate response structure
    if (!data.user || !data.accessToken || !data.refreshToken) {
      logger.error(
        { correlationId },
        'Unexpected BetterAuth response structure'
      );
      throw new Error('Authentication service error');
    }

    // Check user status
    if (data.user.status === 'inactive') {
      logger.warn(
        { correlationId, userId: data.user.id },
        'Login attempt with inactive user'
      );
      throw new Error('Account is inactive');
    }

    if (data.user.status === 'suspended') {
      logger.warn(
        { correlationId, userId: data.user.id },
        'Login attempt with suspended user'
      );
      throw new Error('Account is suspended');
    }

    logger.info(
      { correlationId, userId: data.user.id, email: data.user.email },
      'User logged in successfully'
    );

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        status: data.user.status,
        emailVerified: data.user.emailVerified,
        createdAt: data.user.createdAt,
        lastLoginAt: data.user.lastLoginAt,
      },
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  } catch (error) {
    // Don't expose error details to prevent user enumeration
    const errorMessage =
      error instanceof Error ? error.message : 'Authentication failed';
    logger.error(
      { correlationId, error: errorMessage },
      'Login error'
    );

    // Throw generic error to client
    if (
      errorMessage.includes('inactive') ||
      errorMessage.includes('suspended')
    ) {
      throw error;
    }
    throw new Error('Invalid credentials');
  }
}

/**
 * Logout user and invalidate session
 *
 * @param accessToken - User's access token
 * @param correlationId - Request correlation ID for tracing
 */
export async function logout(
  accessToken: string,
  correlationId: string
): Promise<void> {
  try {
    if (!accessToken) {
      logger.warn({ correlationId }, 'Logout attempt without token');
      throw new Error('Invalid token');
    }

    // Create a Request object for BetterAuth handler
    const request = new Request('http://localhost/auth/sign-out', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${accessToken}`,
      },
    });

    // Call BetterAuth handler
    const response = await betterAuthClient.handler(request);

    if (!response.ok) {
      logger.warn(
        { correlationId, status: response.status },
        'Logout failed'
      );
      throw new Error('Logout failed');
    }

    logger.info({ correlationId }, 'User logged out successfully');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Logout failed';
    logger.error(
      { correlationId, error: errorMessage },
      'Logout error'
    );
    throw error;
  }
}

/**
 * Get current session for authenticated user
 *
 * @param accessToken - User's access token
 * @param correlationId - Request correlation ID for tracing
 * @returns Session information with user and expiration
 */
export async function getSession(
  accessToken: string,
  correlationId: string
): Promise<{
  user: LoginResponse['user'];
  session: { id: string; expiresAt: string };
}> {
  try {
    if (!accessToken) {
      logger.warn({ correlationId }, 'Get session attempt without token');
      throw new Error('Invalid token');
    }

    // Create a Request object for BetterAuth handler
    const request = new Request('http://localhost/auth/get-session', {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${accessToken}`,
      },
    });

    // Call BetterAuth handler
    const response = await betterAuthClient.handler(request);

    if (!response.ok) {
      logger.warn(
        { correlationId, status: response.status },
        'Get session failed'
      );
      throw new Error('Unauthorized');
    }

    // Parse response
    const data = await response.json();

    if (!data.user || !data.session) {
      logger.error(
        { correlationId },
        'Unexpected BetterAuth session response'
      );
      throw new Error('Session retrieval failed');
    }

    logger.debug(
      { correlationId, userId: data.user.id },
      'Session retrieved successfully'
    );

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        status: data.user.status,
        emailVerified: data.user.emailVerified,
        createdAt: data.user.createdAt,
        lastLoginAt: data.user.lastLoginAt,
      },
      session: {
        id: data.session.id,
        expiresAt: data.session.expiresAt,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Session retrieval failed';
    logger.error(
      { correlationId, error: errorMessage },
      'Get session error'
    );
    throw new Error('Unauthorized');
  }
}
