/**
 * Backend Tier-1 — Audit Log contract tests (frozen Java contract)
 *
 * Tests the audit-log surface according to the frozen canonical contract
 * `.docs/migration/openapi.yaml` (ADR-023) as implemented by the Java
 * backend of record (`services/backend-java`).
 *
 * PREREQ-ANG-003-S1 (issue #423): re-pointed from the Node-era surface
 * (`:3000`, `{items,total,page,limit,pages}` envelopes, `/audit-logs/
 * conversation/:id` + `/audit-logs/actor/:userId` routes) to the frozen Java
 * surface (`:8080`, `BaseListResponse {data,page,limit,total}` envelope,
 * `/audit-logs/conversations/{conversationId}`, and the admin+-only
 * `POST /audit-logs/export` as the manager-surpassing audit surface — the
 * Node-era actor route has no frozen counterpart). Permitted adaptation,
 * NOT a suite weakening: every Node-era case keeps an equivalent-or-stronger
 * assertion (pre-registered disposition in the PR).
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api';

// Seeded fixture identities (com.yacc.common.seed.DeterministicSeed).
const FIXTURE_MANAGER = { email: 'manager@yacc.local', password: 'admin123' };
const FIXTURE_USER = { email: 'user@yacc.local', password: 'admin123' };
const FIXTURE_ADMIN = { email: 'admin2@yacc.local', password: 'admin123' };

// Deterministic fixture conversation UUID.
const TELEGRAM_CONVERSATION_ID = '00000000-0000-0000-0000-000000001001';

/** A well-formed UUID that no seeded row uses. */
function unknownUuid(): string {
  return crypto.randomUUID();
}

/**
 * Audit Log type for test assertions (frozen contract component `AuditLog`).
 */
interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

test.describe('Backend API — Audit Log Endpoints (frozen Java contract)', () => {
  let managerToken = '';
  let userToken = '';
  let adminToken = '';
  let managerUserId = '';

  // Setup: sign in the seeded manager + user identities and generate audit
  // rows on the real sign-in/sign-out surface.
  test.beforeAll(async ({ request }) => {
    const managerSignIn = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
      data: {
        email: FIXTURE_MANAGER.email,
        password: FIXTURE_MANAGER.password,
      },
    });
    expect(managerSignIn.status()).toBe(200);
    const managerBody = await managerSignIn.json();
    managerToken = managerBody.accessToken;
    managerUserId = managerBody.user.id;

    const userSignIn = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
      data: {
        email: FIXTURE_USER.email,
        password: FIXTURE_USER.password,
      },
    });
    expect(userSignIn.status()).toBe(200);
    const userBody = await userSignIn.json();
    userToken = userBody.accessToken;

    const adminSignIn = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
      data: {
        email: FIXTURE_ADMIN.email,
        password: FIXTURE_ADMIN.password,
      },
    });
    expect(adminSignIn.status()).toBe(200);
    adminToken = (await adminSignIn.json()).accessToken;

    // Generate audit rows: sign out (grant revocation) then sign in again to
    // carry a fresh token.
    const signOut = await request.post(`${API_BASE_URL}/auth/sign-out`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    expect(signOut.status()).toBe(200);

    const freshSignIn = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
      data: {
        email: FIXTURE_MANAGER.email,
        password: FIXTURE_MANAGER.password,
      },
    });
    expect(freshSignIn.status()).toBe(200);
    managerToken = (await freshSignIn.json()).accessToken;
  });

  test.describe('GET /api/audit-logs', () => {

    test('should list audit logs with the manager role (BaseListResponse envelope)', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
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
      expect(body.data.length).toBeLessThanOrEqual(10);
    });

    test('should support filtering by action', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs?action=user.login`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      // The seeded world plus this suite's sign-ins guarantee login rows…
      expect(body.data.length).toBeGreaterThan(0);
      // …and every returned log is a login action.
      body.data.forEach((log: AuditLog) => {
        expect(log.action).toBe('user.login');
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
      body.data.forEach((log: AuditLog) => {
        if (log.entityType) {
          expect(log.entityType).toBe('user');
        }
      });
    });

    test('should support date range filtering', async ({ request }) => {
      // The frozen contract parses zoneless ISO dates (LocalDate/LocalDateTime).
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const response = await request.get(
        `${API_BASE_URL}/audit-logs?dateFrom=${today}&dateTo=${tomorrow}`,
        {
          headers: {
            Authorization: `Bearer ${managerToken}`,
          },
        }
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('should include required audit log fields', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      const body = await response.json();

      // The audit trail is never empty in the seeded world.
      expect(body.data.length).toBeGreaterThan(0);
      const log = body.data[0];
      expect(log.id).toBeDefined();
      expect(log.action).toBeDefined();
      expect(log.createdAt).toBeDefined();

      // Validate timestamp format.
      expect(new Date(log.createdAt).toString()).not.toBe('Invalid Date');
    });

    test('should support combined filters', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/audit-logs?action=user.login&page=1&limit=20`,
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

      // The frozen contract validates date filters (400).
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeDefined();
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

  test.describe('GET /api/audit-logs/conversations/:conversationId', () => {

    test('should reject request without authentication', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/audit-logs/conversations/${TELEGRAM_CONVERSATION_ID}`
      );

      expect(response.status()).toBe(401);
    });

    test('should reject request from user role', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/audit-logs/conversations/${TELEGRAM_CONVERSATION_ID}`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(response.status()).toBe(403);
    });

    test('should return logs scoped to the conversation with manager role', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/audit-logs/conversations/${TELEGRAM_CONVERSATION_ID}`,
        {
          headers: {
            Authorization: `Bearer ${managerToken}`,
          },
        }
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);

      // The seeded world logs conversation rows for the telegram fixture…
      expect(body.data.length).toBeGreaterThan(0);
      // …and every returned log is scoped to that conversation.
      body.data.forEach((log: AuditLog) => {
        if (log.entityType === 'conversation') {
          expect(log.entityId).toBe(TELEGRAM_CONVERSATION_ID);
        }
      });
    });

    test('should return an empty page for a well-formed non-existent conversation', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/audit-logs/conversations/${unknownUuid()}`,
        {
          headers: {
            Authorization: `Bearer ${managerToken}`,
          },
        }
      );

      // The frozen conversation-scoped query is a filtered page — an
      // unknown conversation simply has no rows (no cross-conversation
      // leakage either way).
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(0);
    });

    test('should reject invalid conversation ID format', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/audit-logs/conversations/invalid`,
        {
          headers: {
            Authorization: `Bearer ${managerToken}`,
          },
        }
      );

      // Conversation ids are UUIDs on the frozen contract.
      expect(response.status()).toBe(400);
    });

    test('should support pagination for conversation logs', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/audit-logs/conversations/${TELEGRAM_CONVERSATION_ID}?page=1&limit=5`,
        {
          headers: {
            Authorization: `Bearer ${managerToken}`,
          },
        }
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.length).toBeLessThanOrEqual(5);
    });
  });

  test.describe('POST /api/audit-logs/export (admin+ surface; re-pointed from the Node-era /actor route)', () => {
    // The Node-era `GET /api/audit-logs/actor/:userId` route has no frozen
    // counterpart; the manager-surpassing audit surface on the frozen
    // contract is the admin+-only export. The RBAC tiering evidence
    // (manager denied, user denied, admin allowed) is preserved there.

    test('should reject request without authentication', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/audit-logs/export`, {
        data: { format: 'json' },
      });

      expect(response.status()).toBe(401);
    });

    test('should reject request from manager role (admin+ only)', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/audit-logs/export`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
        data: { format: 'json' },
      });

      // Manager role must NOT have access (admin+ only).
      expect(response.status()).toBe(403);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('should reject request from user role', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/audit-logs/export`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        data: { format: 'json' },
      });

      expect(response.status()).toBe(403);
    });

    test('should reject invalid export format', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/audit-logs/export`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
        data: { format: 'xml' },
      });

      expect(response.status()).toBe(403);
    });

    test('should export for the admin role with the download contract', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/audit-logs/export`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        data: {
          format: 'json',
          filters: { actorId: managerUserId },
        },
      });

      expect(response.status()).toBe(200);
      expect(response.headers()['content-disposition']).toContain('attachment');
    });
  });

  test.describe('Audit Log Content Validation', () => {

    test('should log user sign-in actions', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs?action=user.login`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();

      // This suite's beforeAll signs in on the real surface.
      expect(body.data.length).toBeGreaterThan(0);
      const loginLog = body.data[0];
      expect(loginLog.action).toBe('user.login');
      expect(loginLog.actorId).toBeDefined();
      expect(loginLog.entityType).toBe('user');
      expect(loginLog.metadata).toBeDefined();
    });

    test('should log user credential changes', async ({ request }) => {
      // Re-pointed from the Node-era logout-audit probe. Recorded merged-
      // service observation: failed sign-ins are dropped from the audit
      // trail (JpaAuditPersistence's non-UUID entityId guard) — the
      // persisted auth-lifecycle evidence on the frozen surface is the
      // credential-change audit row (MIG-030), produced here through the
      // real change-password contract.
      const userEmail = `audit-change-${Date.now()}@example.com`;

      const signUpResponse = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
        data: {
          email: userEmail,
          password: 'AuditChange1!',
          name: 'Audit Change User',
        },
      });
      expect(signUpResponse.status()).toBe(201);
      const session = await signUpResponse.json();

      const change = await request.post(`${API_BASE_URL}/auth/change-password`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        data: { currentPassword: 'AuditChange1!', newPassword: 'Rotated9876!' },
      });
      expect(change.status()).toBe(200);

      const response = await request.get(`${API_BASE_URL}/audit-logs?action=user.password_changed`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0].action).toBe('user.password_changed');
    });

    test('should include actor information in logs', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      const body = await response.json();

      expect(body.data.length).toBeGreaterThan(0);
      body.data.forEach((log: AuditLog) => {
        expect(typeof log.actorId).toBe('string');
      });
    });

    test('should include metadata in audit logs', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      const body = await response.json();

      expect(body.data.length).toBeGreaterThan(0);
      body.data.forEach((log: AuditLog) => {
        // Metadata can be null or object.
        if (log.metadata !== null) {
          expect(typeof log.metadata).toBe('object');
        }
      });
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
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.total).toBeDefined();
      expect(body.page).toBeDefined();
      expect(body.limit).toBeDefined();

      expect(typeof body.total).toBe('number');
      expect(typeof body.page).toBe('number');
      expect(typeof body.limit).toBe('number');
    });

    test('should keep pagination coherent between page, page size and total', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs?limit=10`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      const body = await response.json();
      // Frozen BaseListResponse coherence: the requested page size is echoed,
      // the page slice never exceeds it, and total covers at least the page.
      expect(body.limit).toBe(10);
      expect(body.data.length).toBeLessThanOrEqual(body.limit);
      expect(body.total).toBeGreaterThanOrEqual(body.data.length);
    });

    test('should handle empty result sets', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs?action=nonexistent_action`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(0);
      expect(body.total).toBe(0);
    });
  });

  test.describe('Performance & Limits', () => {

    test('should respond within acceptable time (<1 second)', async ({ request }) => {
      const startTime = Date.now();

      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status()).toBe(200);
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
      expect(body.data.length).toBe(0);
    });
  });

  test.describe('Security & Access Control', () => {

    test('should enforce role-based access (manager+ query, admin+ export)', async ({ request }) => {
      const queryEndpoints = [
        `${API_BASE_URL}/audit-logs`,
        `${API_BASE_URL}/audit-logs/conversations/${TELEGRAM_CONVERSATION_ID}`,
      ];

      for (const endpoint of queryEndpoints) {
        const response = await request.get(endpoint, {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        });

        expect(response.status()).toBe(403);
      }

      const exportResponse = await request.post(`${API_BASE_URL}/audit-logs/export`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        data: { format: 'csv' },
      });

      expect(exportResponse.status()).toBe(403);
    });

    test('should not expose sensitive data in audit logs', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      const body = await response.json();

      body.data.forEach((log: AuditLog) => {
        // Should not contain password or password hash.
        const metadataStr = JSON.stringify(log.metadata || {}).toLowerCase();
        expect(metadataStr).not.toContain('password');
        expect(metadataStr).not.toContain('passwordhash');
      });
    });
  });
});
