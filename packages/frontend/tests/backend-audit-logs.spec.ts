/**
 * Backend Phase 1 - Audit Log Tests
 * 
 * Tests all audit log endpoints according to:
 * - API_DOCUMENTATION.md (Audit Log section)
 * - TESTING_GUIDE.md (Audit log scenarios)
 * - .docs/04-qa-and-testing.md (Category 9: Admin & Audit)
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:3000/api';

test.describe('Backend API - Audit Log Endpoints', () => {
  let managerToken = '';
  let userToken = '';
  let managerUserId = 0;
  let regularUserId = 0;

  // Setup: Create a manager and regular user
  test.beforeAll(async ({ request }) => {
    // Create manager user
    const managerEmail = `manager-audit-${Date.now()}@example.com`;
    await request.post(`${API_BASE_URL}/auth/register`, {
      data: {
        email: managerEmail,
        password: 'ManagerTest123!',
        name: 'Manager Test User',
      },
    });

    const managerLogin = await request.post(`${API_BASE_URL}/auth/login`, {
      data: {
        email: managerEmail,
        password: 'ManagerTest123!',
      },
    });

    const managerBody = await managerLogin.json();
    managerToken = managerBody.token;
    managerUserId = managerBody.user.id;

    // Create regular user
    const userEmail = `user-audit-${Date.now()}@example.com`;
    await request.post(`${API_BASE_URL}/auth/register`, {
      data: {
        email: userEmail,
        password: 'UserTest123!',
        name: 'User Test',
      },
    });

    const userLogin = await request.post(`${API_BASE_URL}/auth/login`, {
      data: {
        email: userEmail,
        password: 'UserTest123!',
      },
    });

    const userBody = await userLogin.json();
    userToken = userBody.token;
    regularUserId = userBody.user.id;

    // Generate some audit log entries by logging in/out
    await request.post(`${API_BASE_URL}/auth/logout`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    // Login again to get fresh token
    const freshLogin = await request.post(`${API_BASE_URL}/auth/login`, {
      data: {
        email: managerEmail,
        password: 'ManagerTest123!',
      },
    });
    managerToken = (await freshLogin.json()).token;
  });

  test.describe('GET /api/audit-logs', () => {
    
    test('should list audit logs with manager role', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.items).toBeDefined();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.total).toBeDefined();
      expect(body.page).toBeDefined();
      expect(body.limit).toBeDefined();
    });

    test('should reject request without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs`);

      expect(response.status()).toBe(401);
    });

    test('should reject request from user role (insufficient permissions)', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.status()).toBe(403);
      
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toMatch(/permission|insufficient|forbidden/);
    });

    test('should support pagination parameters', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs?page=1&limit=10`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.page).toBe(1);
      expect(body.limit).toBe(10);
      expect(body.items.length).toBeLessThanOrEqual(10);
    });

    test('should support filtering by action', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs?action=user_login`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      // All returned logs should have action="user_login"
      body.items.forEach((log: any) => {
        expect(log.action).toBe('user_login');
      });
    });

    test('should support filtering by entity type', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs?entityType=user`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      body.items.forEach((log: any) => {
        if (log.entityType) {
          expect(log.entityType).toBe('user');
        }
      });
    });

    test('should support date range filtering', async ({ request }) => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      
      const response = await request.get(
        `${API_BASE_URL}/audit-logs?dateFrom=${today}T00:00:00Z&dateTo=${tomorrow}T23:59:59Z`,
        {
          headers: {
            Authorization: `Bearer ${managerToken}`,
          },
        }
      );

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.items).toBeDefined();
    });

    test('should include required audit log fields', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      const body = await response.json();
      
      if (body.items.length > 0) {
        const log = body.items[0];
        expect(log.id).toBeDefined();
        expect(log.actorId).toBeDefined();
        expect(log.action).toBeDefined();
        expect(log.entityType).toBeDefined();
        expect(log.createdAt).toBeDefined();
        
        // Validate timestamp format
        expect(new Date(log.createdAt).toString()).not.toBe('Invalid Date');
      }
    });

    test('should support combined filters', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/audit-logs?action=user_login&page=1&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${managerToken}`,
          },
        }
      );

      expect(response.status()).toBe(200);
    });

    test('should handle invalid date format gracefully', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/audit-logs?dateFrom=invalid-date`,
        {
          headers: {
            Authorization: `Bearer ${managerToken}`,
          },
        }
      );

      // Should either validate and return 400, or ignore invalid filter
      expect([200, 400]).toContain(response.status());
    });

    test('should enforce maximum limit', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs?limit=1000`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.limit).toBeLessThanOrEqual(100);
    });
  });

  test.describe('GET /api/audit-logs/conversation/:id', () => {
    
    test('should reject request without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs/conversation/1`);

      expect(response.status()).toBe(401);
    });

    test('should reject request from user role', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs/conversation/1`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.status()).toBe(403);
    });

    test('should return logs for specific conversation with manager role', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs/conversation/1`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      // Either 200 (logs found) or 404 (conversation doesn't exist)
      expect([200, 404]).toContain(response.status());
      
      if (response.status() === 200) {
        const body = await response.json();
        expect(body.items).toBeDefined();
        
        // All logs should be for conversation ID 1
        body.items.forEach((log: any) => {
          if (log.entityType === 'conversation') {
            expect(log.entityId).toBe(1);
          }
        });
      }
    });

    test('should return 404 for non-existent conversation', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs/conversation/99999`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      // Should return 404 or 200 with empty logs
      expect([200, 404]).toContain(response.status());
    });

    test('should reject invalid conversation ID format', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs/conversation/invalid`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect([400, 404]).toContain(response.status());
    });

    test('should support pagination for conversation logs', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs/conversation/1?page=1&limit=5`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect([200, 404]).toContain(response.status());
      
      if (response.status() === 200) {
        const body = await response.json();
        expect(body.items.length).toBeLessThanOrEqual(5);
      }
    });
  });

  test.describe('GET /api/audit-logs/actor/:userId', () => {
    
    test('should reject request without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs/actor/1`);

      expect(response.status()).toBe(401);
    });

    test('should reject request from manager role (admin+ only)', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs/actor/${managerUserId}`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      // Manager role should NOT have access (admin+ only)
      expect(response.status()).toBe(403);
      
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('should reject request from user role', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs/actor/${regularUserId}`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.status()).toBe(403);
    });

    test('should reject invalid user ID format', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs/actor/invalid`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect([400, 403]).toContain(response.status());
    });

    test('should return 404 for non-existent user', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs/actor/99999`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      // Should return 403 (manager can't access) or 404
      expect([403, 404]).toContain(response.status());
    });
  });

  test.describe('Audit Log Content Validation', () => {
    
    test('should log user login actions', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs?action=user_login`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      
      if (body.items.length > 0) {
        const loginLog = body.items[0];
        expect(loginLog.action).toBe('user_login');
        expect(loginLog.actorId).toBeDefined();
        expect(loginLog.entityType).toBe('user');
        expect(loginLog.metadata).toBeDefined();
      }
    });

    test('should log user logout actions', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs?action=user_logout`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      
      if (body.items.length > 0) {
        const logoutLog = body.items[0];
        expect(logoutLog.action).toBe('user_logout');
      }
    });

    test('should include actor information in logs', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      const body = await response.json();
      
      if (body.items.length > 0) {
        body.items.forEach((log: any) => {
          expect(log.actorId).toBeDefined();
          expect(typeof log.actorId).toBe('number');
        });
      }
    });

    test('should include metadata in audit logs', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      const body = await response.json();
      
      if (body.items.length > 0) {
        body.items.forEach((log: any) => {
          // Metadata can be null or object
          if (log.metadata !== null) {
            expect(typeof log.metadata).toBe('object');
          }
        });
      }
    });
  });

  test.describe('Response Format & Pagination', () => {
    
    test('should return consistent response format', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

       const body = await response.json();
      expect(body.items).toBeDefined();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.total).toBeDefined();
      expect(body.page).toBeDefined();
      expect(body.limit).toBeDefined();
      
      expect(typeof body.total).toBe('number');
      expect(typeof body.page).toBe('number');
      expect(typeof body.limit).toBe('number');
      expect(typeof body.pages).toBe('number');
    });

    test('should calculate total pages correctly', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs?limit=10`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      const body = await response.json();
      const expectedPages = Math.ceil(body.total / body.limit);
      expect(body.pages).toBe(expectedPages);
    });

    test('should handle empty result sets', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs?action=nonexistent_action`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.items).toBeDefined();
      expect(body.items.length).toBe(0);
      expect(body.total).toBe(0);
    });
  });

  test.describe('Performance & Limits', () => {
    
    test('should respond within acceptable time (<1 second)', async ({ request }) => {
      const startTime = Date.now();
      
      await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(1000);
    });

    test('should handle large page numbers gracefully', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs?page=1000`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.items.length).toBe(0);
    });
  });

  test.describe('Security & Access Control', () => {
    
    test('should enforce role-based access (manager+ only)', async ({ request }) => {
      const endpoints = [
        '/api/audit-logs',
        '/api/audit-logs/conversation/1',
        '/api/audit-logs/actor/1',
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(`${API_BASE_URL.replace('/api', '')}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        });

        expect(response.status()).toBe(403);
      }
    });

    test('should not expose sensitive data in audit logs', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      const body = await response.json();
      
      body.items.forEach((log: any) => {
        // Should not contain password or password hash
        const metadataStr = JSON.stringify(log.metadata || {}).toLowerCase();
        expect(metadataStr).not.toContain('password');
        expect(metadataStr).not.toContain('passwordhash');
      });
    });
  });
});
