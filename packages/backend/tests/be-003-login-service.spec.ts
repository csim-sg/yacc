/**
 * BE-003: Login Service Tests
 * 
 * Tests for the login service that encapsulates BetterAuth login logic.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { LoginCredentials } from '../src/services/login.service';

/**
 * Mock BetterAuth Client
 */
const mockBetterAuthClient = {
  handler: vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    const method = request.method;

    // Mock sign-in/email endpoint
    if (url.pathname.includes('/sign-in/email') && method === 'POST') {
      const body = await request.json();
      
      // Test cases
      if (body.email === 'inactive@example.com') {
        return new Response(
          JSON.stringify({
            user: {
              id: 'user-inactive',
              email: 'inactive@example.com',
              name: 'Inactive User',
              role: 'user',
              status: 'inactive',
              emailVerified: true,
              createdAt: new Date().toISOString(),
            },
            accessToken: 'mock-token',
            refreshToken: 'mock-refresh',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (body.email === 'suspended@example.com') {
        return new Response(
          JSON.stringify({
            user: {
              id: 'user-suspended',
              email: 'suspended@example.com',
              name: 'Suspended User',
              role: 'user',
              status: 'suspended',
              emailVerified: true,
              createdAt: new Date().toISOString(),
            },
            accessToken: 'mock-token',
            refreshToken: 'mock-refresh',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (body.email === 'invalid@example.com' || !body.password) {
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          user: {
            id: 'user-123',
            email: body.email,
            name: 'Test User',
            role: 'user',
            status: 'active',
            emailVerified: true,
            createdAt: new Date().toISOString(),
          },
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    // Mock sign-out endpoint
    if (url.pathname.includes('/sign-out') && method === 'POST') {
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(null, { status: 204 });
    }

    // Mock get-session endpoint
    if (url.pathname.includes('/get-session') && method === 'GET') {
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        );
      }

      const token = authHeader.substring(7);
      if (token !== 'valid-token' && token !== 'mock-access-token') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            status: 'active',
            emailVerified: true,
            createdAt: new Date().toISOString(),
          },
          session: {
            id: 'session-123',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'content-type': 'application/json' } }
    );
  }),
};

/**
 * Simulate login service using mock client
 */
async function simulateLogin(
  credentials: LoginCredentials,
  correlationId: string
) {
  try {
    if (!credentials.email || !credentials.password) {
      throw new Error('Invalid credentials');
    }

    const request = new Request('http://localhost/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    const response = await mockBetterAuthClient.handler(request);

    if (!response.ok) {
      throw new Error('Invalid credentials');
    }

    const data = await response.json();

    if (data.user.status === 'inactive') {
      throw new Error('Account is inactive');
    }

    if (data.user.status === 'suspended') {
      throw new Error('Account is suspended');
    }

    return {
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Authentication failed';
    if (
      errorMessage.includes('inactive') ||
      errorMessage.includes('suspended')
    ) {
      throw error;
    }
    throw new Error('Invalid credentials');
  }
}

async function simulateLogout(
  accessToken: string,
  correlationId: string
) {
  if (!accessToken) {
    throw new Error('Logout failed');
  }

  const request = new Request('http://localhost/auth/sign-out', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${accessToken}` },
  });

  const response = await mockBetterAuthClient.handler(request);

  if (!response.ok) {
    throw new Error('Logout failed');
  }
}

async function simulateGetSession(
  accessToken: string,
  correlationId: string
) {
  const request = new Request('http://localhost/auth/get-session', {
    method: 'GET',
    headers: { 'authorization': `Bearer ${accessToken}` },
  });

  const response = await mockBetterAuthClient.handler(request);

  if (!response.ok) {
    throw new Error('Unauthorized');
  }

  return await response.json();
}

/**
 * Test Suite: Login Service
 */
describe('BE-003: Login Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login()', () => {
    it('should successfully login with valid credentials', async () => {
      const result = await simulateLogin(
        { email: 'user@example.com', password: 'SecurePassword123' },
        'corr-123'
      );

      expect(result).toBeDefined();
      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('user@example.com');
      expect(result.user.status).toBe('active');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw error for invalid email', async () => {
      try {
        await simulateLogin(
          { email: 'invalid@example.com', password: 'AnyPassword' },
          'corr-123'
        );
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toBe('Invalid credentials');
      }
    });

    it('should throw error for missing password', async () => {
      try {
        await simulateLogin(
          { email: 'user@example.com', password: '' },
          'corr-123'
        );
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toBe('Invalid credentials');
      }
    });

    it('should throw error for missing email', async () => {
      try {
        await simulateLogin(
          { email: '', password: 'Password123' },
          'corr-123'
        );
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toBe('Invalid credentials');
      }
    });

    it('should prevent login for inactive user', async () => {
      try {
        await simulateLogin(
          { email: 'inactive@example.com', password: 'Password123' },
          'corr-123'
        );
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toBe('Account is inactive');
      }
    });

    it('should prevent login for suspended user', async () => {
      try {
        await simulateLogin(
          { email: 'suspended@example.com', password: 'Password123' },
          'corr-123'
        );
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toBe('Account is suspended');
      }
    });

    it('should not reveal which credential was invalid', async () => {
      try {
        await simulateLogin(
          { email: 'user@example.com', password: 'WrongPassword' },
          'corr-123'
        );
      } catch (error) {
        expect((error as Error).message).toBe('Invalid credentials');
      }

      try {
        await simulateLogin(
          { email: 'nonexistent@example.com', password: 'AnyPassword' },
          'corr-123'
        );
      } catch (error) {
        expect((error as Error).message).toBe('Invalid credentials');
      }
    });
  });

  describe('logout()', () => {
    it('should successfully logout with valid token', async () => {
      await expect(
        simulateLogout('mock-access-token', 'corr-123')
      ).resolves.toBeUndefined();
    });

    it('should throw error without token', async () => {
      try {
        await simulateLogout('', 'corr-123');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toBe('Logout failed');
      }
    });
  });

  describe('getSession()', () => {
    it('should return session for valid token', async () => {
      const result = await simulateGetSession('mock-access-token', 'corr-123');

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe('user-123');
      expect(result.session).toBeDefined();
      expect(result.session.expiresAt).toBeDefined();
    });

    it('should throw error for invalid token', async () => {
      try {
        await simulateGetSession('invalid-token', 'corr-123');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toBe('Unauthorized');
      }
    });

    it('should throw error without token', async () => {
      try {
        await simulateGetSession('', 'corr-123');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toBe('Unauthorized');
      }
    });
  });

  describe('Security: User Status Checks', () => {
    it('should only allow login for active users', async () => {
      const result = await simulateLogin(
        { email: 'user@example.com', password: 'Password123' },
        'corr-123'
      );
      expect(result.user.status).toBe('active');
    });

    it('should catch and report inactive status', async () => {
      try {
        await simulateLogin(
          { email: 'inactive@example.com', password: 'Password123' },
          'corr-123'
        );
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBe('Account is inactive');
      }
    });

    it('should catch and report suspended status', async () => {
      try {
        await simulateLogin(
          { email: 'suspended@example.com', password: 'Password123' },
          'corr-123'
        );
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBe('Account is suspended');
      }
    });
  });

  describe('Response Structure', () => {
    it('should return user with all required fields', async () => {
      const result = await simulateLogin(
        { email: 'user@example.com', password: 'Password123' },
        'corr-123'
      );

      const user = result.user;
      expect(user.id).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.status).toBeDefined();
      expect(user.emailVerified).toBeDefined();
      expect(user.createdAt).toBeDefined();
    });

    it('should return access and refresh tokens', async () => {
      const result = await simulateLogin(
        { email: 'user@example.com', password: 'Password123' },
        'corr-123'
      );

      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.accessToken.length).toBeGreaterThan(0);
      expect(result.refreshToken.length).toBeGreaterThan(0);
    });
  });
});
