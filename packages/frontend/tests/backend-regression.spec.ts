/**
 * Backend Phase 1 - Regression Test Suite
 * 
 * Critical tests that must pass before every release.
 * Based on .docs/04-qa-and-testing.md Section 4: Regression Test Suite
 * 
 * Test IDs:
 * - REGR_001: Login + Inbox Load
 * - REGR_002: Send Reply + Delivery Status (Phase 2)
 * - REGR_003: Telegram Inbound Message (Phase 2)
 * - REGR_004: IRC Inbound Message (Phase 2)
 * - REGR_005: Tag Conversation (Phase 2 - needs database setup)
 * - REGR_006: Assign + Notification (Phase 2 - needs database setup)
 * - REGR_007: Bulk Assign (Phase 2)
 * - REGR_008: Search + Filters (Phase 2)
 * - REGR_009: Message Retry (Phase 2)
 * - REGR_010: Audit Log Query + Export (Partial - export in Phase 2)
 * - REGR_011: WebSocket Reconnect (Phase 2)
 * - REGR_012: Rules Execution (Phase 2)
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:3000/api';

test.describe('Backend Phase 1 - Regression Test Suite', () => {
  
  test.describe('🔴 REGR_001: Login + Inbox Load (CRITICAL)', () => {
    let testEmail = '';
    let testPassword = 'RegressionTest123!';
    let authToken = '';

    test('should complete full login and inbox load workflow', async ({ request }) => {
      // Step 1: Register new user
      testEmail = `regr001-${Date.now()}@example.com`;
      
      const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: testEmail,
          password: testPassword,
          name: 'Regression Test User',
        },
      });

      expect(registerResponse.status()).toBe(201);
      const registerBody = await registerResponse.json();
      expect(registerBody.success).toBe(true);
      expect(registerBody.user.email).toBe(testEmail);

      // Step 2: Login with credentials
      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(loginResponse.status()).toBe(200);
      const loginBody = await loginResponse.json();
      expect(loginBody.success).toBe(true);
      expect(loginBody.token).toBeDefined();
      expect(loginBody.user.email).toBe(testEmail);
      
      authToken = loginBody.token;

      // Step 3: Load inbox (conversations list)
      const inboxResponse = await request.get(`${API_BASE_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(inboxResponse.status()).toBe(200);
      const inboxBody = await inboxResponse.json();
      expect(inboxBody.success).toBe(true);
      expect(inboxBody.data.conversations).toBeDefined();
      expect(Array.isArray(inboxBody.data.conversations)).toBe(true);

      // Step 4: Verify user session persists
      const meResponse = await request.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(meResponse.status()).toBe(200);
      const meBody = await meResponse.json();
      expect(meBody.user.email).toBe(testEmail);
    });

    test('should handle login failure gracefully', async ({ request }) => {
      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        },
      });

      expect([401, 404]).toContain(loginResponse.status());
      const body = await loginResponse.json();
      expect(body.error).toBeDefined();
    });

    test('should prevent inbox access without authentication', async ({ request }) => {
      const inboxResponse = await request.get(`${API_BASE_URL}/conversations`);

      expect(inboxResponse.status()).toBe(401);
    });
  });

  test.describe('🟠 REGR_010: Audit Log Query (IMPORTANT)', () => {
    let managerToken = '';
    let managerUserId = 0;

    test.beforeAll(async ({ request }) => {
      const managerEmail = `regr010-manager-${Date.now()}@example.com`;
      
      // Register manager
      await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: managerEmail,
          password: 'ManagerTest123!',
          name: 'Regression Manager',
        },
      });

      // Login as manager
      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: managerEmail,
          password: 'ManagerTest123!',
        },
      });

      const loginBody = await loginResponse.json();
      managerToken = loginBody.token;
      managerUserId = loginBody.user.id;
    });

    test('should query audit logs with filters', async ({ request }) => {
      // Query all audit logs
      const allLogsResponse = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(allLogsResponse.status()).toBe(200);
      const allLogsBody = await allLogsResponse.json();
      expect(allLogsBody.data.logs).toBeDefined();
      expect(allLogsBody.data.total).toBeGreaterThan(0);

      // Query filtered logs (login actions)
      const filteredResponse = await request.get(`${API_BASE_URL}/audit-logs?action=user_login`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(filteredResponse.status()).toBe(200);
      const filteredBody = await filteredResponse.json();
      
      // All returned logs should be login actions
      filteredBody.data.logs.forEach((log: any) => {
        expect(log.action).toBe('user_login');
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
      expect(page1Body.data.page).toBe(1);
      expect(page1Body.data.limit).toBe(5);
      expect(page1Body.data.logs.length).toBeLessThanOrEqual(5);
    });

    test('should query audit logs by date range', async ({ request }) => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 86400000);
      const tomorrow = new Date(today.getTime() + 86400000);

      const response = await request.get(
        `${API_BASE_URL}/audit-logs?dateFrom=${yesterday.toISOString()}&dateTo=${tomorrow.toISOString()}`,
        {
          headers: {
            Authorization: `Bearer ${managerToken}`,
          },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      
      // Logs should be within date range
      body.data.logs.forEach((log: any) => {
        const logDate = new Date(log.createdAt);
        expect(logDate.getTime()).toBeGreaterThanOrEqual(yesterday.getTime());
        expect(logDate.getTime()).toBeLessThanOrEqual(tomorrow.getTime());
      });
    });

    test('should enforce role-based access to audit logs', async ({ request }) => {
      // Create a regular user
      const userEmail = `regr010-user-${Date.now()}@example.com`;
      
      await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: userEmail,
          password: 'UserTest123!',
          name: 'Regular User',
        },
      });

      const userLogin = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: userEmail,
          password: 'UserTest123!',
        },
      });

      const userToken = (await userLogin.json()).token;

      // User role should NOT have access to audit logs
      const unauthorizedResponse = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(unauthorizedResponse.status()).toBe(403);
    });
  });

  test.describe('End-to-End Critical Path', () => {
    
    test('should complete full user journey: register → login → access resources → logout', async ({ request }) => {
      const journeyEmail = `journey-${Date.now()}@example.com`;
      const journeyPassword = 'JourneyTest123!';

      // Step 1: Register
      const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: journeyEmail,
          password: journeyPassword,
          name: 'Journey Test User',
        },
      });

      expect(registerResponse.status()).toBe(201);

      // Step 2: Login
      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: journeyEmail,
          password: journeyPassword,
        },
      });

      expect(loginResponse.status()).toBe(200);
      const { token } = await loginResponse.json();

      // Step 3: Access protected resource (conversations)
      const conversationsResponse = await request.get(`${API_BASE_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(conversationsResponse.status()).toBe(200);

      // Step 4: Access profile
      const meResponse = await request.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(meResponse.status()).toBe(200);

      // Step 5: Logout
      const logoutResponse = await request.post(`${API_BASE_URL}/auth/logout`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(logoutResponse.status()).toBe(200);
    });
  });

  test.describe('Error Recovery & Edge Cases', () => {
    
    test('should handle rapid successive requests', async ({ request }) => {
      const email = `rapid-${Date.now()}@example.com`;
      
      // Register user
      await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email,
          password: 'RapidTest123!',
          name: 'Rapid Test',
        },
      });

      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email,
          password: 'RapidTest123!',
        },
      });

      const { token } = await loginResponse.json();

      // Make 10 rapid requests
      const promises = Array(10).fill(null).map(() =>
        request.get(`${API_BASE_URL}/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed
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
        const response = await request.post(`${API_BASE_URL}/auth/register`, req);
        expect(response.status()).toBe(400);
      }
    });

    test('should handle concurrent user registrations', async ({ request }) => {
      const timestamp = Date.now();
      const users = [
        { email: `concurrent1-${timestamp}@test.com`, password: 'Test123!', name: 'User 1' },
        { email: `concurrent2-${timestamp}@test.com`, password: 'Test123!', name: 'User 2' },
        { email: `concurrent3-${timestamp}@test.com`, password: 'Test123!', name: 'User 3' },
      ];

      const promises = users.map(user =>
        request.post(`${API_BASE_URL}/auth/register`, { data: user })
      );

      const responses = await Promise.all(promises);
      
      // All registrations should succeed
      responses.forEach(response => {
        expect(response.status()).toBe(201);
      });
    });
  });

  test.describe('Data Integrity & Validation', () => {
    
    test('should maintain data consistency across requests', async ({ request }) => {
      const email = `integrity-${Date.now()}@example.com`;
      
      // Register
      const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email,
          password: 'IntegrityTest123!',
          name: 'Integrity Test User',
        },
      });

      const { user: registeredUser } = await registerResponse.json();

      // Login
      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email,
          password: 'IntegrityTest123!',
        },
      });

      const { user: loginUser, token } = await loginResponse.json();

      // Get profile
      const meResponse = await request.get(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const { user: profileUser } = await meResponse.json();

      // All user objects should have consistent data
      expect(loginUser.id).toBe(registeredUser.id);
      expect(profileUser.id).toBe(registeredUser.id);
      expect(loginUser.email).toBe(email);
      expect(profileUser.email).toBe(email);
      expect(loginUser.role).toBe('user');
      expect(profileUser.role).toBe('user');
    });

    test('should validate all enum fields', async ({ request }) => {
      const email = `enum-test-${Date.now()}@example.com`;
      
      await request.post(`${API_BASE_URL}/auth/register`, {
        data: { email, password: 'EnumTest123!', name: 'Enum Test' },
      });

      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: { email, password: 'EnumTest123!' },
      });

      const { token } = await loginResponse.json();

      // Test invalid status
      const statusResponse = await request.get(
        `${API_BASE_URL}/conversations?status=invalid_status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect([200, 400]).toContain(statusResponse.status());

      // Test invalid priority
      const priorityResponse = await request.get(
        `${API_BASE_URL}/conversations?priority=invalid_priority`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect([200, 400]).toContain(priorityResponse.status());

      // Test invalid channel
      const channelResponse = await request.get(
        `${API_BASE_URL}/conversations?channel=invalid_channel`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect([200, 400]).toContain(channelResponse.status());
    });
  });

  test.describe('Performance Benchmarks', () => {
    let perfToken = '';

    test.beforeAll(async ({ request }) => {
      const email = `perf-${Date.now()}@example.com`;
      
      await request.post(`${API_BASE_URL}/auth/register`, {
        data: { email, password: 'PerfTest123!', name: 'Perf Test' },
      });

      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: { email, password: 'PerfTest123!' },
      });

      perfToken = (await loginResponse.json()).token;
    });

    test('auth endpoints should respond within 500ms', async ({ request }) => {
      const email = `speed-${Date.now()}@example.com`;
      
      const start = Date.now();
      await request.post(`${API_BASE_URL}/auth/register`, {
        data: { email, password: 'SpeedTest123!', name: 'Speed Test' },
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });

    test('conversations list should respond within 1 second', async ({ request }) => {
      const start = Date.now();
      await request.get(`${API_BASE_URL}/conversations`, {
        headers: { Authorization: `Bearer ${perfToken}` },
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    test('audit logs should respond within 1 second', async ({ request }) => {
      // First create a manager user for audit log access
      const managerEmail = `perf-manager-${Date.now()}@example.com`;
      
      await request.post(`${API_BASE_URL}/auth/register`, {
        data: { email: managerEmail, password: 'ManagerTest123!', name: 'Perf Manager' },
      });

      const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
        data: { email: managerEmail, password: 'ManagerTest123!' },
      });

      const managerToken = (await loginResponse.json()).token;

      const start = Date.now();
      await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const duration = Date.now() - start;

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
        const response = await request.post(`${API_BASE_URL}/auth/login`, {
          data: {
            email: payload,
            password: 'anything',
          },
        });

        // Should return 400 or 401, not 500 (SQL error)
        expect([400, 401, 404]).toContain(response.status());
      }
    });

    test('should sanitize error messages (no sensitive data leakage)', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        },
      });

      const body = await response.json();
      const errorMessage = body.error.toLowerCase();
      
      // Error should not reveal database structure or internal paths
      expect(errorMessage).not.toContain('database');
      expect(errorMessage).not.toContain('postgresql');
      expect(errorMessage).not.toContain('/home/');
      expect(errorMessage).not.toContain('stack trace');
    });

    test('should never return password hashes', async ({ request }) => {
      const email = `security-${Date.now()}@example.com`;
      
      const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        data: { email, password: 'SecurityTest123!', name: 'Security Test' },
      });

      const registerBody = await registerResponse.json();
      const responseStr = JSON.stringify(registerBody).toLowerCase();
      
      expect(responseStr).not.toContain('passwordhash');
      expect(responseStr).not.toContain('password_hash');
      expect(responseStr).not.toContain('$2b$'); // bcrypt hash prefix
    });
  });
});
