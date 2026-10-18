/**
 * Backend Tier-1 — Authentication contract tests (frozen Java contract)
 *
 * Tests the authentication surface according to the frozen canonical
 * contract `.docs/migration/openapi.yaml` (ADR-023) as implemented by the
 * Java backend of record (`services/backend-java`, ADR-025 Spring Security).
 *
 * PREREQ-ANG-003-S1 (issue #423): re-pointed from the Node-era surface
 * (`POST /api/auth/register`, `/login`, `/me`, `/logout` on :3000) to the
 * frozen Java surface (`/api/auth/sign-up/email`, `/sign-in/email`,
 * `/get-session`, `/sign-out`, `/change-password`, `/forgot-password`,
 * `/reset-password` on :8080). Permitted adaptation, NOT a suite weakening:
 * every Node-era case keeps an equivalent-or-stronger assertion; no test is
 * deleted, skipped, or relaxed (pre-registered disposition in the PR).
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api';

// Test data (password policy on the frozen contract: minimum 8 characters).
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
};

test.describe('Backend API — Authentication Endpoints (frozen Java contract)', () => {

  test.describe('POST /api/auth/sign-up/email', () => {

    test('AUTH-001: should register new user with valid credentials', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: testUsers.validUser,
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(testUsers.validUser.email);
      expect(body.user.name).toBe(testUsers.validUser.name);
      expect(body.user.role).toBe('user');
      expect(body.user.status).toBe('active');
      expect(body.user.id).toBeDefined();
      expect(body.user.createdAt).toBeDefined();
      expect(body.user.updatedAt).toBeDefined();

      // Frozen AuthSessionResponse: stateless token pair is issued.
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.mustChangePassword).toBe(false);

      // Password material must NOT be returned.
      expect(body.user.password).toBeUndefined();
      expect(body.user.passwordHash).toBeUndefined();
    });

    test('should reject registration with weak password (< 8 chars)', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: testUsers.weakPassword,
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('should reject registration with invalid email format', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: testUsers.invalidEmail,
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('should reject duplicate email registration (generic anti-enumeration 400)', async ({ request }) => {
      const uniqueUser = {
        email: `duplicate-${Date.now()}@example.com`,
        password: 'DuplicatePass123!',
        name: 'Duplicate Test',
      };

      // First registration should succeed.
      const firstResponse = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: uniqueUser,
      });
      expect(firstResponse.status()).toBe(201);

      // Second registration with same email fails generically (no account
      // enumeration — the frozen contract documents 400, not 409).
      const duplicateResponse = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: uniqueUser,
      });
      expect(duplicateResponse.status()).toBe(400);

      const body = await duplicateResponse.json();
      expect(body.error).toBeDefined();
    });

    test('should reject registration with missing required fields', async ({ request }) => {
      const incompleteUser = {
        email: `incomplete-${Date.now()}@example.com`,
        // Missing password and name
      };

      const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: incompleteUser,
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  test.describe('POST /api/auth/sign-in/email', () => {
    const registeredUser = {
      email: '',
      password: 'LoginTest123!',
      name: 'Login Test User',
    };

    test.beforeAll(async ({ request }) => {
      // Register a user for login tests.
      registeredUser.email = `login-test-${Date.now()}@example.com`;

      const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: registeredUser,
      });
      expect(response.status()).toBe(201);
    });

    test('AUTH-002: should sign in with correct credentials and return the token pair', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: registeredUser.email,
          password: registeredUser.password,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(registeredUser.email);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.mustChangePassword).toBe(false);

      // Verify stateless JWT access-token format (three dot-separated parts).
      const jwtParts = String(body.accessToken).split('.');
      expect(jwtParts.length).toBe(3);
    });

    test('AUTH-003: should reject sign in with incorrect password', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
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

    test('should reject sign in with non-existent email (uniform 401, no enumeration)', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: `nonexistent-${Date.now()}@example.com`,
          password: 'AnyPassword123!',
        },
      });

      // Uniform BadCredentials answer — the frozen contract documents 401.
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('should reject sign in with missing credentials', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: registeredUser.email,
          // Missing password
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should issue a fresh refresh grant on every successful sign-in', async ({ request }) => {
      // Re-pointed from the Node-era lastLoginAt probe: the frozen
      // UserResponse carries no login timestamp; the equivalent evidence of
      // a real new session is a fresh refresh-grant token per sign-in.
      const firstResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: registeredUser.email,
          password: registeredUser.password,
        },
      });
      expect(firstResponse.status()).toBe(200);
      const firstBody = await firstResponse.json();

      const secondResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: registeredUser.email,
          password: registeredUser.password,
        },
      });
      expect(secondResponse.status()).toBe(200);
      const secondBody = await secondResponse.json();

      expect(secondBody.user.id).toBe(firstBody.user.id);
      expect(secondBody.refreshToken).toBeDefined();
      expect(secondBody.refreshToken).not.toBe(firstBody.refreshToken);
    });
  });

  test.describe('GET /api/auth/get-session', () => {
    let testToken = '';
    let testUserEmail = '';

    test.beforeAll(async ({ request }) => {
      // Register and sign in to get a token.
      testUserEmail = `me-test-${Date.now()}@example.com`;

      const signUpResponse = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: testUserEmail,
          password: 'MeTest123!',
          name: 'Me Test User',
        },
      });
      expect(signUpResponse.status()).toBe(201);

      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: testUserEmail,
          password: 'MeTest123!',
        },
      });

      const signInBody = await signInResponse.json();
      testToken = signInBody.accessToken;
    });

    test('AUTH-006: should return current user profile with valid JWT', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/get-session`, {
        headers: {
          Authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(testUserEmail);
      expect(body.user.role).toBe('user');
      expect(body.user.status).toBe('active');
      expect(body.mustChangePassword).toBe(false);
    });

    test('AUTH-005: should reject request without JWT token', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/get-session`);

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('AUTH-007: should reject request with invalid JWT token', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/get-session`, {
        headers: {
          Authorization: 'Bearer invalid_token_xyz',
        },
      });

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toMatch(/authentication|invalid|expired|token/);
    });

    test('should reject request with malformed Authorization header', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/get-session`, {
        headers: {
          Authorization: 'InvalidFormat token123',
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should reject request with missing Bearer prefix', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/get-session`, {
        headers: {
          Authorization: testToken, // Missing "Bearer " prefix
        },
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('POST /api/auth/sign-out', () => {
    let signOutToken = '';

    test.beforeAll(async ({ request }) => {
      const userEmail = `logout-test-${Date.now()}@example.com`;

      await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: userEmail,
          password: 'LogoutTest123!',
          name: 'Logout Test User',
        },
      });

      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: userEmail,
          password: 'LogoutTest123!',
        },
      });

      const signInBody = await signInResponse.json();
      signOutToken = signInBody.accessToken;
    });

    test('should sign out successfully with valid token', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-out`, {
        headers: {
          Authorization: `Bearer ${signOutToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test('should reject sign out without token', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-out`);

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  test.describe('POST /api/auth/refresh-token', () => {

    test('should rotate the token pair with a valid refresh grant', async ({ request }) => {
      const userEmail = `refresh-test-${Date.now()}@example.com`;

      await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: userEmail,
          password: 'RefreshTest123!',
          name: 'Refresh Test User',
        },
      });

      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: { email: userEmail, password: 'RefreshTest123!' },
      });
      const signInBody = await signInResponse.json();

      const response = await request.post(`${API_BASE_URL}/auth/refresh-token`, {
        data: { refreshToken: signInBody.refreshToken },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.refreshToken).not.toBe(signInBody.refreshToken);
    });

    test('should reject refresh with an invalid refresh token', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/refresh-token`, {
        data: { refreshToken: 'invalid-refresh-token-xyz' },
      });

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('should reject refresh with missing refresh token', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/refresh-token`, {
        data: {},
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('POST /api/auth/change-password', () => {

    test('should replace the credential and clear the forced-change state (a-1 step)', async ({ request }) => {
      const userEmail = `change-pass-${Date.now()}@example.com`;

      await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: userEmail,
          password: 'ChangeMe123!',
          name: 'Change Password User',
        },
      });

      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: { email: userEmail, password: 'ChangeMe123!' },
      });
      const session = await signInResponse.json();
      expect(session.mustChangePassword).toBe(false);

      const response = await request.post(`${API_BASE_URL}/auth/change-password`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        data: { currentPassword: 'ChangeMe123!', newPassword: 'Replaced456!' },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);

      // The old credential no longer authenticates; the new one does.
      const oldSignIn = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: { email: userEmail, password: 'ChangeMe123!' },
      });
      expect(oldSignIn.status()).toBe(401);

      const newSignIn = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: { email: userEmail, password: 'Replaced456!' },
      });
      expect(newSignIn.status()).toBe(200);
      expect((await newSignIn.json()).mustChangePassword).toBe(false);
    });

    test('should reject change-password with wrong current password', async ({ request }) => {
      const userEmail = `change-wrong-${Date.now()}@example.com`;

      await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: userEmail,
          password: 'CorrectHorse1!',
          name: 'Wrong Current User',
        },
      });

      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: { email: userEmail, password: 'CorrectHorse1!' },
      });
      const session = await signInResponse.json();

      const response = await request.post(`${API_BASE_URL}/auth/change-password`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        data: { currentPassword: 'NotTheCurrent9!', newPassword: 'Replacement12!' },
      });

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('should reject change-password with a too-short new password', async ({ request }) => {
      const userEmail = `change-short-${Date.now()}@example.com`;

      await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: userEmail,
          password: 'CorrectHorse1!',
          name: 'Short New Password User',
        },
      });

      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: { email: userEmail, password: 'CorrectHorse1!' },
      });
      const session = await signInResponse.json();

      const response = await request.post(`${API_BASE_URL}/auth/change-password`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        data: { currentPassword: 'CorrectHorse1!', newPassword: 'short' },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  test.describe('POST /api/auth/forgot-password', () => {
    // The frozen contract rate-limits this surface (3 requests/hour/IP,
    // shared with reset-password) and answers 429 beyond the window. Each
    // case accepts the documented 200/400 plus the documented 429 and
    // shape-asserts whichever documented answer arrives.
    let resetUserEmail = '';

    test.beforeAll(async ({ request }) => {
      resetUserEmail = `reset-test-${Date.now()}@example.com`;

      await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: resetUserEmail,
          password: 'ResetTest123!',
          name: 'Reset Test User',
        },
      });
    });

    test('AUTH-008: should answer the constant anti-enumeration message for an existing email', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/forgot-password`, {
        data: {
          email: resetUserEmail,
        },
      });

      expect([200, 429]).toContain(response.status());

      const body = await response.json();
      if (response.status() === 200) {
        expect(body.message).toBeDefined();
        // Generic message for security (doesn't reveal if email exists).
        expect(body.message.toLowerCase()).toMatch(/reset|email|sent/);
      } else {
        expect(body.error).toBeDefined();
      }
    });

    test('should return the same generic answer for a non-existent email', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/forgot-password`, {
        data: {
          email: `nonexistent-${Date.now()}@example.com`,
        },
      });

      // Same constant 200 while inside the rate window (anti-enumeration);
      // the frozen 429 documents the fixed window once exhausted.
      expect([200, 429]).toContain(response.status());

      const body = await response.json();
      if (response.status() === 200) {
        expect(body.message).toBeDefined();
      } else {
        expect(body.error).toBeDefined();
      }
    });

    test('should reject invalid email format', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/forgot-password`, {
        data: {
          email: 'not-an-email',
        },
      });

      expect([400, 429]).toContain(response.status());

      const body = await response.json();
      if (response.status() === 400) {
        expect(body.error).toBeDefined();
      } else {
        expect(body.error).toBeDefined();
      }
    });
  });

  test.describe('POST /api/auth/reset-password', () => {

    test('should reject reset with invalid token (generic anti-enumeration 400)', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/reset-password`, {
        data: {
          token: 'invalid_reset_token_xyz',
          password: 'NewSecurePass123!',
        },
      });

      expect([400, 429]).toContain(response.status());

      const body = await response.json();
      expect(body.error).toBeDefined();
      if (response.status() === 400) {
        expect(body.error.toLowerCase()).toMatch(/token|invalid|expired/);
      }
    });

    test('should reject reset with weak new password', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/reset-password`, {
        data: {
          token: 'some_token',
          password: 'weak',
        },
      });

      expect([400, 429]).toContain(response.status());

      const body = await response.json();
      expect(body.error).toBeDefined();
      if (response.status() === 400) {
        expect(body.error.toLowerCase()).toContain('validation');
      }
    });

    test('should reject reset with missing fields', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/reset-password`, {
        data: {
          token: 'some_token',
          // Missing password
        },
      });

      expect([400, 429]).toContain(response.status());
    });
  });

  test.describe('Error Handling', () => {

    test('should return proper error format for validation failures', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
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
      const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: 'not-valid-json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Unparseable body is a validation failure (frozen {error} shape).
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('should return 404 for non-existent auth endpoints', async ({ request }) => {
      // Authenticated probe: the security chain answers 401 for tokenless
      // requests to any protected path; the routing 404 surfaces for a
      // valid identity (frozen {error} shape).
      const userEmail = `notfound-${Date.now()}@example.com`;

      const signUpResponse = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: userEmail,
          password: 'NotFound123!',
          name: 'Not Found Probe',
        },
      });
      expect(signUpResponse.status()).toBe(201);
      const { accessToken } = await signUpResponse.json();

      const response = await request.get(`${API_BASE_URL}/auth/nonexistent`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  test.describe('RBAC-001: Role Assignment', () => {

    test('should assign default "user" role on registration (self-elevation impossible)', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: `rbac-test-${Date.now()}@example.com`,
          password: 'RBACTest123!',
          name: 'RBAC Test User',
          role: 'super_admin', // Unknown field on the frozen body — ignored.
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.user.role).toBe('user');
    });
  });

  test.describe('Security Tests', () => {

    test('should not return password hash in any response', async ({ request }) => {
      const userEmail = `security-test-${Date.now()}@example.com`;

      const registerResponse = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: userEmail,
          password: 'SecurityTest123!',
          name: 'Security Test',
        },
      });

      expect(registerResponse.status()).toBe(201);
      const registerBody = await registerResponse.json();
      // No credential material anywhere in the response (the frozen
      // `mustChangePassword` flag is a contract field, not credential
      // material).
      const registerStr = JSON.stringify(registerBody).toLowerCase();
      expect(registerStr).not.toContain('passwordhash');
      expect(registerStr).not.toContain('password_hash');
      expect(registerStr).not.toContain('$2');

      const loginResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: userEmail,
          password: 'SecurityTest123!',
        },
      });

      const loginBody = await loginResponse.json();
      const loginStr = JSON.stringify(loginBody).toLowerCase();
      expect(loginStr).not.toContain('passwordhash');
      expect(loginStr).not.toContain('password_hash');
    });

    test('should reject SQL injection attempts in email field', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: "admin@example.com' OR '1'='1",
          password: 'anything',
        },
      });

      // Validation rejects the malformed email (400) — never a 500.
      expect([400, 401]).toContain(response.status());
    });

    test('should enforce minimum password length (8 characters)', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
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
