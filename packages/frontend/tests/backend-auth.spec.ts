/**
 * Backend Phase 1 - Authentication Tests
 * 
 * Tests all authentication endpoints according to:
 * - API_DOCUMENTATION.md (Auth section)
 * - TESTING_GUIDE.md (Auth scenarios)
 * - .docs/04-qa-and-testing.md (Category 1: Auth)
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:3000/api';

// Test data
const testUsers = {
  validUser: {
    email: `qa-user-${Date.now()}@example.com`,
    password: 'SecurePass123!',
    name: 'QA Test User',
  },
  weakPassword: {
    email: `qa-weak-${Date.now()}@example.com`,
    password: 'weak',
    name: 'Weak Password User',
  },
  invalidEmail: {
    email: 'not-an-email',
    password: 'Pass123!',
    name: 'Invalid Email',
  },
  existingUser: {
    email: 'test@example.com',
    password: 'password123',
    name: 'Existing User',
  },
};

test.describe('Backend API - Authentication Endpoints', () => {
  
  test.describe('POST /api/auth/register', () => {
    
    test('AUTH-001: should register new user with valid credentials', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: testUsers.validUser,
      });

      expect(response.status()).toBe(201);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(testUsers.validUser.email);
      expect(body.user.name).toBe(testUsers.validUser.name);
      expect(body.user.role).toBe('user');
      expect(body.user.status).toBe('active');
      expect(body.user.id).toBeDefined();
      expect(body.user.createdAt).toBeDefined();
      expect(body.user.updatedAt).toBeDefined();
      
      // Password should NOT be returned
      expect(body.user.password).toBeUndefined();
      expect(body.user.passwordHash).toBeUndefined();
    });

    test('should reject registration with weak password (< 6 chars)', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: testUsers.weakPassword,
      });

      expect(response.status()).toBe(400);
      
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toContain('password');
    });

    test('should reject registration with invalid email format', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: testUsers.invalidEmail,
      });

      expect(response.status()).toBe(400);
      
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toContain('email');
    });

    test('should reject duplicate email registration', async ({ request }) => {
      const uniqueUser = {
        email: `duplicate-${Date.now()}@example.com`,
        password: 'DuplicatePass123!',
        name: 'Duplicate Test',
      };

      // First registration should succeed
      const firstResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        data: uniqueUser,
      });
      expect(firstResponse.status()).toBe(201);

      // Second registration with same email should fail
      const duplicateResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        data: uniqueUser,
      });
      expect([400, 409]).toContain(duplicateResponse.status());
      
      const body = await duplicateResponse.json();
      expect(body.error).toBeDefined();
    });

    test('should reject registration with missing required fields', async ({ request }) => {
      const incompleteUser = {
        email: `incomplete-${Date.now()}@example.com`,
        // Missing password and name
      };

      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: incompleteUser,
      });

      expect(response.status()).toBe(400);
      
      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  test.describe('POST /api/auth/login', () => {
    let registeredUser = {
      email: '',
      password: 'LoginTest123!',
      name: 'Login Test User',
    };
    let authToken = '';

    test.beforeAll(async ({ request }) => {
      // Register a user for login tests
      registeredUser.email = `login-test-${Date.now()}@example.com`;
      
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: registeredUser,
      });
      expect(response.status()).toBe(201);
    });

    test('AUTH-002: should login with correct credentials and return JWT token', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: registeredUser.email,
          password: registeredUser.password,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(registeredUser.email);
      expect(body.token).toBeDefined();
      expect(body.token.length).toBeGreaterThan(20);
      expect(body.expiresIn).toBe('7d');
      
      // Verify JWT format (three parts separated by dots)
      const jwtParts = body.token.split('.');
      expect(jwtParts.length).toBe(3);
      
      authToken = body.token;
    });

    test('AUTH-003: should reject login with incorrect password', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: registeredUser.email,
          password: 'WrongPassword123!',
        },
      });

      expect(response.status()).toBe(401);
      
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toMatch(/invalid|credentials/);
    });

    test('should reject login with non-existent email', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: `nonexistent-${Date.now()}@example.com`,
          password: 'AnyPassword123!',
        },
      });

      expect([401, 404]).toContain(response.status());
      
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('should reject login with missing credentials', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: registeredUser.email,
          // Missing password
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should update lastLoginAt timestamp on successful login', async ({ request }) => {
      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: registeredUser.email,
          password: registeredUser.password,
        },
      });

      const body = await loginResponse.json();
      expect(body.user.lastLoginAt).toBeDefined();
      
      // lastLoginAt should be recent (within last 5 seconds)
      const lastLogin = new Date(body.user.lastLoginAt);
      const now = new Date();
      const diffSeconds = (now.getTime() - lastLogin.getTime()) / 1000;
      expect(diffSeconds).toBeLessThan(5);
    });
  });

  test.describe('GET /api/auth/me', () => {
    let testToken = '';
    let testUserId = 0;

    test.beforeAll(async ({ request }) => {
      // Register and login to get a token
      const userEmail = `me-test-${Date.now()}@example.com`;
      
      await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: userEmail,
          password: 'MeTest123!',
          name: 'Me Test User',
        },
      });

      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: userEmail,
          password: 'MeTest123!',
        },
      });

      const loginBody = await loginResponse.json();
      testToken = loginBody.token;
      testUserId = loginBody.user.id;
    });

    test('AUTH-006: should return current user profile with valid JWT', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.user).toBeDefined();
      expect(body.user.id).toBe(testUserId);
      expect(body.user.email).toContain('@example.com');
      expect(body.user.role).toBe('user');
      expect(body.user.status).toBe('active');
    });

    test('AUTH-005: should reject request without JWT token', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/me`);

      expect(response.status()).toBe(401);
      
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('AUTH-007: should reject request with invalid JWT token', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: 'Bearer invalid_token_xyz',
        },
      });

      expect(response.status()).toBe(401);
      
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toMatch(/invalid|expired|token/);
    });

    test('should reject request with malformed Authorization header', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: 'InvalidFormat token123',
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should reject request with missing Bearer prefix', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: testToken, // Missing "Bearer " prefix
        },
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('POST /api/auth/logout', () => {
    let logoutToken = '';

    test.beforeAll(async ({ request }) => {
      const userEmail = `logout-test-${Date.now()}@example.com`;
      
      await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: userEmail,
          password: 'LogoutTest123!',
          name: 'Logout Test User',
        },
      });

      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: userEmail,
          password: 'LogoutTest123!',
        },
      });

      const loginBody = await loginResponse.json();
      logoutToken = loginBody.token;
    });

    test('should logout successfully with valid token', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/logout`, {
        headers: {
          Authorization: `Bearer ${logoutToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.message).toMatch(/logout|success/i);
    });

    test('should reject logout without token', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/logout`);

      expect(response.status()).toBe(401);
      
      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  test.describe('POST /api/auth/forgot-password', () => {
    let resetUserEmail = '';

    test.beforeAll(async ({ request }) => {
      resetUserEmail = `reset-test-${Date.now()}@example.com`;
      
      await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: resetUserEmail,
          password: 'ResetTest123!',
          name: 'Reset Test User',
        },
      });
    });

    test('AUTH-008: should send password reset request for existing email', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/forgot-password`, {
        data: {
          email: resetUserEmail,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.message).toBeDefined();
      
      // Generic message for security (doesn't reveal if email exists)
      expect(body.message.toLowerCase()).toMatch(/reset|email|sent/);
    });

    test('should return same generic response for non-existent email', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/forgot-password`, {
        data: {
          email: `nonexistent-${Date.now()}@example.com`,
        },
      });

      // Should still return 200 (security - don't reveal if email exists)
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.message).toBeDefined();
    });

    test('should reject invalid email format', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/forgot-password`, {
        data: {
          email: 'not-an-email',
        },
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('POST /api/auth/reset-password', () => {
    
    test('should reject reset with invalid token', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/reset-password`, {
        data: {
          token: 'invalid_reset_token_xyz',
          newPassword: 'NewSecurePass123!',
        },
      });

      expect([400, 401]).toContain(response.status());
      
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toMatch(/token|invalid|expired/);
    });

    test('should reject reset with weak new password', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/reset-password`, {
        data: {
          token: 'some_token',
          newPassword: 'weak',
        },
      });

      expect(response.status()).toBe(400);
      
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toContain('password');
    });

    test('should reject reset with missing fields', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/reset-password`, {
        data: {
          token: 'some_token',
          // Missing newPassword
        },
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Error Handling', () => {
    
    test('should return proper error format for validation failures', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: 'bad-email',
          password: 'short',
        },
      });

      expect(response.status()).toBe(400);
      
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(typeof body.error).toBe('string');
    });

    test('should handle malformed JSON gracefully', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: 'not-valid-json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Should return 400 for malformed request
      expect([400, 500]).toContain(response.status());
    });

    test('should return 404 for non-existent auth endpoints', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/nonexistent`);

      expect(response.status()).toBe(404);
    });
  });

  test.describe('RBAC-001: Role Assignment', () => {
    
    test('should assign default "user" role on registration', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: `rbac-test-${Date.now()}@example.com`,
          password: 'RBACTest123!',
          name: 'RBAC Test User',
        },
      });

      const body = await response.json();
      expect(body.user.role).toBe('user');
    });
  });

  test.describe('Security Tests', () => {
    
    test('should not return password hash in any response', async ({ request }) => {
      const userEmail = `security-test-${Date.now()}@example.com`;
      
      const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: userEmail,
          password: 'SecurityTest123!',
          name: 'Security Test',
        },
      });

      const registerBody = await registerResponse.json();
      expect(registerBody.user.password).toBeUndefined();
      expect(registerBody.user.passwordHash).toBeUndefined();

      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: userEmail,
          password: 'SecurityTest123!',
        },
      });

      const loginBody = await loginResponse.json();
      expect(loginBody.user.password).toBeUndefined();
      expect(loginBody.user.passwordHash).toBeUndefined();
    });

    test('should reject SQL injection attempts in email field', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: "admin@example.com' OR '1'='1",
          password: 'anything',
        },
      });

      // Should either return 400 (validation) or 401 (not found)
      expect([400, 401, 404]).toContain(response.status());
    });

    test('should enforce minimum password length (6 characters)', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: `short-pass-${Date.now()}@example.com`,
          password: '12345', // Only 5 chars
          name: 'Short Password User',
        },
      });

      expect(response.status()).toBe(400);
    });
  });
});
