/**
 * Backend Tier-1 — Regression Test Suite (frozen Java contract)
 *
 * Critical tests that must pass before every release, expressed on the
 * frozen canonical contract `.docs/migration/openapi.yaml` (ADR-023) as
 * implemented by the Java backend of record (`services/backend-java`).
 *
 * Test IDs:
 * - REGR_001: Sign-in + Inbox Load
 * - REGR_010: Audit Log Query
 * (REGR_002..009/011/012 remain the real-time/connector families owned by
 * their own suites — this file keeps the Phase-1 API regression surface.)
 *
 * PREREQ-ANG-003-S1 (issue #423): re-pointed from the Node-era surface
 * (`:3000`, `/auth/register`, `/auth/login`, `/auth/me`, `/auth/logout`,
 * `{success,data}` envelopes) to the frozen Java surface (`:8080`,
 * `/auth/sign-up/email`, `/auth/sign-in/email`, `/auth/get-session`,
 * `/auth/sign-out`, `BaseListResponse` envelopes, seeded fixture
 * identities). Permitted adaptation, NOT a suite weakening: every Node-era
 * case keeps an equivalent-or-stronger assertion (pre-registered
 * disposition in the PR).
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api';

// Seeded fixture identity (com.yacc.common.seed.DeterministicSeed).
const FIXTURE_MANAGER = { email: 'manager@yacc.local', password: 'admin123' };

test.describe('Backend Tier-1 — Regression Test Suite (frozen Java contract)', () => {

  test.describe('🔴 REGR_001: Sign-in + Inbox Load (CRITICAL)', () => {
    const testPassword = 'RegressionTest123!';

    test('should complete full registration, sign-in and inbox load workflow', async ({ request }) => {
      // Step 1: Self-register (frozen sign-up contract, 201).
      const testEmail = `regr001-${Date.now()}@example.com`;

      const signUpResponse = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: testEmail,
          password: testPassword,
          name: 'Regression Test User',
        },
      });

      expect(signUpResponse.status()).toBe(201);
      const signUpBody = await signUpResponse.json();
      expect(signUpBody.user.email).toBe(testEmail);
      expect(signUpBody.accessToken).toBeDefined();

      // Step 2: Sign in with credentials (frozen sign-in contract, 200).
      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(signInResponse.status()).toBe(200);
      const signInBody = await signInResponse.json();
      expect(signInBody.user.email).toBe(testEmail);
      expect(signInBody.accessToken).toBeDefined();
      expect(signInBody.refreshToken).toBeDefined();

      const authToken = signInBody.accessToken;

      // Step 3: Load inbox (conversations list, BaseListResponse).
      const inboxResponse = await request.get(`${API_BASE_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(inboxResponse.status()).toBe(200);
      const inboxBody = await inboxResponse.json();
      expect(Array.isArray(inboxBody.data)).toBe(true);

      // Step 4: Verify user session persists (frozen session contract).
      const sessionResponse = await request.get(`${API_BASE_URL}/auth/get-session`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(sessionResponse.status()).toBe(200);
      const sessionBody = await sessionResponse.json();
      expect(sessionBody.user.email).toBe(testEmail);
    });

    test('should handle sign-in failure gracefully', async ({ request }) => {
      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        },
      });

      // Uniform anti-enumeration 401 on the frozen contract.
      expect(signInResponse.status()).toBe(401);
      const body = await signInResponse.json();
      expect(body.error).toBeDefined();
    });

    test('should prevent inbox access without authentication', async ({ request }) => {
      const inboxResponse = await request.get(`${API_BASE_URL}/conversations`);

      expect(inboxResponse.status()).toBe(401);
    });
  });

  test.describe('🟠 REGR_010: Audit Log Query (IMPORTANT)', () => {
    let managerToken = '';

    test.beforeAll(async ({ request }) => {
      // Sign in as the seeded manager identity (real manager-role evidence).
      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: FIXTURE_MANAGER.email,
          password: FIXTURE_MANAGER.password,
        },
      });

      expect(signInResponse.status()).toBe(200);
      const signInBody = await signInResponse.json();
      managerToken = signInBody.accessToken;
    });

    test('should query audit logs with filters', async ({ request }) => {
      // Query all audit logs.
      const allLogsResponse = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(allLogsResponse.status()).toBe(200);
      const allLogsBody = await allLogsResponse.json();
      expect(Array.isArray(allLogsBody.data)).toBe(true);
      expect(allLogsBody.total).toBeGreaterThan(0);

      // Query filtered logs (sign-in actions — real rows from this suite).
      const filteredResponse = await request.get(`${API_BASE_URL}/audit-logs?action=user.login`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(filteredResponse.status()).toBe(200);
      const filteredBody = await filteredResponse.json();

      // All returned logs should be sign-in actions.
      filteredBody.data.forEach((log: Record<string, unknown>) => {
        expect(log.action).toBe('user.login');
      });
    });

    test('should query audit logs with pagination', async ({ request }) => {
      const page1Response = await request.get(`${API_BASE_URL}/audit-logs?page=1&limit=5`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(page1Response.status()).toBe(200);
      const page1Body = await page1Response.json();
      expect(page1Body.page).toBe(1);
      expect(page1Body.limit).toBe(5);
      expect(page1Body.data.length).toBeLessThanOrEqual(5);
    });

    test('should query audit logs by date range', async ({ request }) => {
      // The frozen contract parses zoneless ISO timestamps.
      const fmt = (d: Date) => d.toISOString().slice(0, 19);
      const yesterday = new Date(Date.now() - 86400000);
      const tomorrow = new Date(Date.now() + 86400000);

      const response = await request.get(
        `${API_BASE_URL}/audit-logs?dateFrom=${fmt(yesterday)}&dateTo=${fmt(tomorrow)}`,
        {
          headers: {
            Authorization: `Bearer ${managerToken}`,
          },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();

      // Logs should be within date range.
      body.data.forEach((log: Record<string, unknown>) => {
        const logDate = new Date(String(log.createdAt));
        expect(logDate.getTime()).toBeGreaterThanOrEqual(yesterday.getTime());
        expect(logDate.getTime()).toBeLessThanOrEqual(tomorrow.getTime());
      });
    });

    test('should enforce role-based access to audit logs', async ({ request }) => {
      // Self-register a plain user (frozen contract: role is always user).
      const userEmail = `regr010-user-${Date.now()}@example.com`;

      const signUpResponse = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: userEmail,
          password: 'UserTest123!',
          name: 'Regular User',
        },
      });
      expect(signUpResponse.status()).toBe(201);

      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: userEmail,
          password: 'UserTest123!',
        },
      });

      const userToken = (await signInResponse.json()).accessToken;

      // User role should NOT have access to audit logs.
      const unauthorizedResponse = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(unauthorizedResponse.status()).toBe(403);
    });
  });

  test.describe('End-to-End Critical Path', () => {

    test('should complete full user journey: sign-up → sign-in → access resources → sign-out', async ({ request }) => {
      const journeyEmail = `journey-${Date.now()}@example.com`;
      const journeyPassword = 'JourneyTest123!';

      // Step 1: Register.
      const signUpResponse = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: journeyEmail,
          password: journeyPassword,
          name: 'Journey Test User',
        },
      });

      expect(signUpResponse.status()).toBe(201);

      // Step 2: Sign in.
      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: journeyEmail,
          password: journeyPassword,
        },
      });

      expect(signInResponse.status()).toBe(200);
      const { accessToken } = await signInResponse.json();

      // Step 3: Access protected resource (conversations).
      const conversationsResponse = await request.get(`${API_BASE_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(conversationsResponse.status()).toBe(200);

      // Step 4: Access profile.
      const sessionResponse = await request.get(`${API_BASE_URL}/auth/get-session`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(sessionResponse.status()).toBe(200);

      // Step 5: Sign out.
      const signOutResponse = await request.post(`${API_BASE_URL}/auth/sign-out`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(signOutResponse.status()).toBe(200);
    });
  });

  test.describe('Error Recovery & Edge Cases', () => {

    test('should handle rapid successive requests', async ({ request }) => {
      const email = `rapid-${Date.now()}@example.com`;

      // Register user.
      await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email,
          password: 'RapidTest123!',
          name: 'Rapid Test',
        },
      });

      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email,
          password: 'RapidTest123!',
        },
      });

      const { accessToken } = await signInResponse.json();

      // Make 10 rapid requests.
      const promises = Array(10).fill(null).map(() =>
        request.get(`${API_BASE_URL}/conversations`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      );

      const responses = await Promise.all(promises);

      // All requests should succeed.
      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });
    });

    test('should handle malformed requests gracefully', async ({ request }) => {
      const malformedRequests = [
        // Missing required fields
        { data: { email: 'test@test.com' } },
        // Invalid email format
        { data: { email: 'not-an-email', password: 'Pass123!' } },
        // Empty payload
        { data: {} },
      ];

      for (const req of malformedRequests) {
        const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, req);
        expect(response.status()).toBe(400);
      }
    });

    test('should handle concurrent user registrations', async ({ request }) => {
      const timestamp = Date.now();
      const users = [
        { email: `concurrent1-${timestamp}@test.com`, password: 'Test12345!', name: 'User 1' },
        { email: `concurrent2-${timestamp}@test.com`, password: 'Test12345!', name: 'User 2' },
        { email: `concurrent3-${timestamp}@test.com`, password: 'Test12345!', name: 'User 3' },
      ];

      const promises = users.map(user =>
        request.post(`${API_BASE_URL}/auth/sign-up/email`, { data: user })
      );

      const responses = await Promise.all(promises);

      // All registrations should succeed.
      responses.forEach(response => {
        expect(response.status()).toBe(201);
      });
    });
  });

  test.describe('Data Integrity & Validation', () => {

    test('should maintain data consistency across requests', async ({ request }) => {
      const email = `integrity-${Date.now()}@example.com`;

      // Register.
      const signUpResponse = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email,
          password: 'IntegrityTest123!',
          name: 'Integrity Test User',
        },
      });

      const { user: registeredUser } = await signUpResponse.json();

      // Sign in.
      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email,
          password: 'IntegrityTest123!',
        },
      });

      const { user: signInUser, accessToken } = await signInResponse.json();

      // Get profile.
      const sessionResponse = await request.get(`${API_BASE_URL}/auth/get-session`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const { user: sessionUser } = await sessionResponse.json();

      // All user objects should have consistent data.
      expect(signInUser.id).toBe(registeredUser.id);
      expect(sessionUser.id).toBe(registeredUser.id);
      expect(signInUser.email).toBe(email);
      expect(sessionUser.email).toBe(email);
      expect(signInUser.role).toBe('user');
      expect(sessionUser.role).toBe('user');
    });

    test('should validate all enum fields', async ({ request }) => {
      const email = `enum-test-${Date.now()}@example.com`;

      await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: { email, password: 'EnumTest12345!', name: 'Enum Test' },
      });

      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: { email, password: 'EnumTest12345!' },
      });

      const { accessToken } = await signInResponse.json();

      // Test invalid status.
      const statusResponse = await request.get(
        `${API_BASE_URL}/conversations?status=invalid_status`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      expect(statusResponse.status()).toBe(400);

      // Test invalid priority.
      const priorityResponse = await request.get(
        `${API_BASE_URL}/conversations?priority=invalid_priority`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      expect(priorityResponse.status()).toBe(400);

      // Test invalid channel.
      const channelResponse = await request.get(
        `${API_BASE_URL}/conversations?channel=invalid_channel`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      expect(channelResponse.status()).toBe(400);
    });
  });

  test.describe('Performance Benchmarks', () => {
    let perfToken = '';

    test.beforeAll(async ({ request }) => {
      const email = `perf-${Date.now()}@example.com`;

      await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: { email, password: 'PerfTest12345!', name: 'Perf Test' },
      });

      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: { email, password: 'PerfTest12345!' },
      });

      perfToken = (await signInResponse.json()).accessToken;
    });

    test('sign-up endpoint should respond within 500ms', async ({ request }) => {
      const email = `speed-${Date.now()}@example.com`;

      const start = Date.now();
      const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: { email, password: 'SpeedTest123!', name: 'Speed Test' },
      });
      const duration = Date.now() - start;

      expect(response.status()).toBe(201);
      expect(duration).toBeLessThan(500);
    });

    test('conversations list should respond within 1 second', async ({ request }) => {
      const start = Date.now();
      const response = await request.get(`${API_BASE_URL}/conversations`, {
        headers: { Authorization: `Bearer ${perfToken}` },
      });
      const duration = Date.now() - start;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(1000);
    });

    test('audit logs should respond within 1 second', async ({ request }) => {
      // Manager+ surface: the seeded manager identity signs in.
      const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: { email: FIXTURE_MANAGER.email, password: FIXTURE_MANAGER.password },
      });

      const managerToken = (await signInResponse.json()).accessToken;

      const start = Date.now();
      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const duration = Date.now() - start;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(1000);
    });
  });

  test.describe('Security Regression Tests', () => {

    test('should prevent SQL injection in all endpoints', async ({ request }) => {
      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "admin'--",
        "' OR 1=1--",
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
          data: {
            email: payload,
            password: 'anything',
          },
        });

        // Should return 400 or 401, not 500 (SQL error).
        expect([400, 401]).toContain(response.status());
      }
    });

    test('should sanitize error messages (no sensitive data leakage)', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
        data: {
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        },
      });

      const body = await response.json();
      const errorMessage = String(body.error).toLowerCase();

      // Error should not reveal database structure or internal paths.
      expect(errorMessage).not.toContain('database');
      expect(errorMessage).not.toContain('postgresql');
      expect(errorMessage).not.toContain('/home/');
      expect(errorMessage).not.toContain('stack trace');
    });

    test('should never return password hashes', async ({ request }) => {
      const email = `security-${Date.now()}@example.com`;

      const signUpResponse = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: { email, password: 'SecurityTest123!', name: 'Security Test' },
      });

      const signUpBody = await signUpResponse.json();
      const responseStr = JSON.stringify(signUpBody).toLowerCase();

      expect(responseStr).not.toContain('passwordhash');
      expect(responseStr).not.toContain('password_hash');
      expect(responseStr).not.toContain('$2'); // bcrypt hash prefix family
    });
  });
});
