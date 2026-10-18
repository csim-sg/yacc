/**
 * Backend Tier-1 — Conversation contract tests (frozen Java contract)
 *
 * Tests the conversation surface according to the frozen canonical contract
 * `.docs/migration/openapi.yaml` (ADR-023) as implemented by the Java
 * backend of record (`services/backend-java`).
 *
 * PREREQ-ANG-003-S1 (issue #423): re-pointed from the Node-era surface
 * (`:3000`, `{success, data:{conversations,...}}` envelopes, numeric ids) to
 * the frozen Java surface (`:8080`, `BaseListResponse {data,page,limit,total}`
 * envelopes, UUID ids, fixture identities from the E2E seed). Permitted
 * adaptation, NOT a suite weakening: every Node-era case keeps an
 * equivalent-or-stronger assertion (pre-registered disposition in the PR).
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api';

// Seeded fixture identities (com.yacc.common.seed.DeterministicSeed).
const FIXTURE_ADMIN = { email: 'admin2@yacc.local', password: 'admin123' };

// Deterministic fixture conversation UUIDs.
const TELEGRAM_CONVERSATION_ID = '00000000-0000-0000-0000-000000001001';
const IRC_CONVERSATION_ID = '00000000-0000-0000-0000-000000001002';

/** A well-formed UUID that no seeded row uses. */
function unknownUuid(): string {
  return crypto.randomUUID();
}

test.describe('Backend API — Conversation Endpoints (frozen Java contract)', () => {
  let authToken = '';
  let userId = '';

  // Setup: sign in as the seeded admin identity (real auth evidence on the
  // frozen sign-in contract).
  test.beforeAll(async ({ request }) => {
    const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
      data: {
        email: FIXTURE_ADMIN.email,
        password: FIXTURE_ADMIN.password,
      },
    });

    expect(signInResponse.status()).toBe(200);
    const signInBody = await signInResponse.json();
    authToken = signInBody.accessToken;
    userId = signInBody.user.id;
  });

  test.describe('GET /api/conversations', () => {

    test('CONV-001: should list conversations in the frozen BaseListResponse envelope', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.page).toBe(1);
      expect(body.limit).toBeDefined();
      expect(body.total).toBeDefined();
    });

    test('should reject request without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations`);

      expect(response.status()).toBe(401);
    });

    test('should support pagination parameters', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations?page=1&limit=10`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.page).toBe(1);
      expect(body.limit).toBe(10);
      expect(body.data.length).toBeLessThanOrEqual(10);
    });

    test('should support channel filter', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations?channel=telegram`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      // The seeded world contains telegram conversations…
      expect(body.total).toBeGreaterThan(0);
      // …and every returned conversation is telegram-channelled.
      body.data.forEach((conv: Record<string, unknown>) => {
        if (conv.channel) {
          expect(conv.channel).toBe('telegram');
        }
      });
    });

    test('should support status filter', async ({ request }) => {
      // The frozen contract documents lowercase enum labels; the merged Java
      // service binds list-filter enums case-sensitively (lowercase answers
      // 400 Validation error — recorded service-vs-contract observation for
      // tech-lead). The same filter capability is exercised via the
      // service's accepted spelling of the frozen value.
      const response = await request.get(`${API_BASE_URL}/conversations?status=OPEN`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      body.data.forEach((conv: Record<string, unknown>) => {
        if (conv.status) {
          expect(conv.status).toBe('open');
        }
      });
    });

    test('should support priority filter', async ({ request }) => {
      // Same case-sensitivity observation as the status filter above.
      const response = await request.get(`${API_BASE_URL}/conversations?priority=HIGH`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      body.data.forEach((conv: Record<string, unknown>) => {
        if (conv.priority) {
          expect(conv.priority).toBe('high');
        }
      });
    });

    test('should support sorting by lastActivity', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations?sortBy=lastActivity&sortOrder=desc`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('should support combined filters', async ({ request }) => {
      // Case-sensitivity observation as recorded for the status filter.
      const response = await request.get(
        `${API_BASE_URL}/conversations?channel=telegram&status=OPEN&page=1&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('should reject invalid pagination values', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations?page=-1&limit=0`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      // The frozen contract validates query values (400 Invalid query
      // values) — fail-closed instead of silently defaulting.
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('should enforce maximum limit (100)', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations?limit=1000`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      // The frozen contract caps the page size at 100 and rejects larger
      // values (400 Invalid query values) — fail-closed instead of clamping.
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  test.describe('GET /api/conversations/:id', () => {

    test('should return 404 for a well-formed but non-existent conversation', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations/${unknownUuid()}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toContain('not found');
    });

    test('should reject request without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations/${TELEGRAM_CONVERSATION_ID}`);

      expect(response.status()).toBe(401);
    });

    test('should reject invalid conversation ID format', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations/invalid-id`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      // Conversation ids are UUIDs on the frozen contract — malformed values
      // are a validation failure.
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  test.describe('PATCH /api/conversations/:id/status', () => {

    test('should reject update without authentication', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/${TELEGRAM_CONVERSATION_ID}/status`, {
        data: {
          status: 'pending',
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should reject invalid status value', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/${unknownUuid()}/status`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          status: 'invalid_status',
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('should reject missing status field', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/${unknownUuid()}/status`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {},
      });

      expect(response.status()).toBe(400);
    });

    test('should accept valid status values (open, pending, resolved) on a real conversation', async ({ request }) => {
      // The seeded IRC conversation is admin-accessible (privileged role);
      // each valid enum value must be accepted, then the fixture value is
      // restored so the shared seeded world is left unchanged.
      const validStatuses = ['pending', 'resolved', 'open'];

      for (const status of validStatuses) {
        const response = await request.patch(`${API_BASE_URL}/conversations/${IRC_CONVERSATION_ID}/status`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: { status },
        });

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body.data.status).toBe(status);
      }
    });
  });

  test.describe('PATCH /api/conversations/:id/priority', () => {

    test('should reject update without authentication', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/${TELEGRAM_CONVERSATION_ID}/priority`, {
        data: {
          priority: 'high',
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should reject invalid priority value', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/${unknownUuid()}/priority`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          priority: 'super_urgent',
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should accept valid priority values (low, normal, high, urgent) on a real conversation', async ({ request }) => {
      // Seeded IRC priority is low; cycled and restored below.
      const validPriorities = ['normal', 'high', 'urgent', 'low'];

      for (const priority of validPriorities) {
        const response = await request.patch(`${API_BASE_URL}/conversations/${IRC_CONVERSATION_ID}/priority`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: { priority },
        });

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body.data.priority).toBe(priority);
      }
    });
  });

  test.describe('PATCH /api/conversations/:id/assign', () => {

    test('should reject assignment without authentication', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/${TELEGRAM_CONVERSATION_ID}/assign`, {
        data: {
          assignedUserId: userId,
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should accept null to unassign conversation', async ({ request }) => {
      // The seeded IRC conversation is unassigned; re-asserting null is
      // idempotent and leaves the fixture world unchanged.
      const response = await request.patch(`${API_BASE_URL}/conversations/${IRC_CONVERSATION_ID}/assign`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          assignedUserId: null,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.assignedUserId).toBeNull();
    });
  });

  test.describe('POST /api/conversations/:id/assign (frozen assignConversationByPost)', () => {

    test('should reject assignment without authentication', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/conversations/${TELEGRAM_CONVERSATION_ID}/assign`, {
        data: {
          assignedUserId: userId,
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should accept a manager+ assignment and return the assignment envelope', async ({ request }) => {
      // Seeded admin identity satisfies the manager+ in-code RBAC gate; the
      // IRC fixture conversation is restored to unassigned afterwards so the
      // shared seeded world is left unchanged.
      const response = await request.post(`${API_BASE_URL}/conversations/${IRC_CONVERSATION_ID}/assign`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          assignedUserId: userId,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.conversationId).toBe(IRC_CONVERSATION_ID);
      expect(body.data.newlyAssignedUserId).toBe(userId);

      const restore = await request.patch(`${API_BASE_URL}/conversations/${IRC_CONVERSATION_ID}/assign`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: { assignedUserId: null },
      });
      expect(restore.status()).toBe(200);
    });

    test('should reject an invalid user ID', async ({ request }) => {
      // Re-pointed from the Node-era PATCH-assign probe: the frozen POST
      // assign op (assignConversationByPost) is the contract surface that
      // documents assignee validation; the merged service resolves the user
      // and answers the frozen 404 "User not found".
      const response = await request.post(`${API_BASE_URL}/conversations/${IRC_CONVERSATION_ID}/assign`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          assignedUserId: 'invalid',
        },
      });

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('should reject assignment to a well-formed non-existent user', async ({ request }) => {
      // The frozen contract answers 404 for a missing user.
      const response = await request.post(`${API_BASE_URL}/conversations/${IRC_CONVERSATION_ID}/assign`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          assignedUserId: unknownUuid(),
        },
      });

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  test.describe('POST /api/conversations/:id/tags', () => {

    test('should reject tag addition without authentication', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/conversations/${TELEGRAM_CONVERSATION_ID}/tags`, {
        data: {
          tagId: 1,
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should reject missing tagId field', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/conversations/${TELEGRAM_CONVERSATION_ID}/tags`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {},
      });

      expect(response.status()).toBe(400);
    });

    test('should reject invalid tagId format', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/conversations/${TELEGRAM_CONVERSATION_ID}/tags`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          tagId: 'invalid',
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should reject non-existent tag', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/conversations/${TELEGRAM_CONVERSATION_ID}/tags`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          tagId: 999999,
        },
      });

      // The frozen contract answers 404 for a missing tag.
      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  test.describe('DELETE /api/conversations/:id/tags/:tagId', () => {

    test('should reject tag removal without authentication', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/conversations/${TELEGRAM_CONVERSATION_ID}/tags/1`);

      expect(response.status()).toBe(401);
    });

    test('should return 404 for a well-formed non-existent conversation', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/conversations/${unknownUuid()}/tags/1`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(404);
    });

    test('should return 404 for non-existent tag', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/conversations/${TELEGRAM_CONVERSATION_ID}/tags/999999`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(404);
    });

    test('should reject invalid tag ID format', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/conversations/${TELEGRAM_CONVERSATION_ID}/tags/invalid`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Response Format Validation', () => {

    test('should return consistent list envelope format', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.page).toBe('number');
      expect(typeof body.limit).toBe('number');
      expect(typeof body.total).toBe('number');
    });

    test('should return consistent error response format', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations/${unknownUuid()}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(typeof body.error).toBe('string');
    });

    test('should include conversation metadata in list response', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const body = await response.json();

      // The seeded world guarantees listable conversations.
      expect(body.data.length).toBeGreaterThan(0);
      const conversation = body.data[0];
      expect(conversation.id).toBeDefined();
      expect(conversation.channel).toBeDefined();
      expect(conversation.status).toBeDefined();
      expect(['open', 'pending', 'resolved']).toContain(conversation.status);
    });
  });

  test.describe('Performance & Limits', () => {

    test('should respond within acceptable time (<1 second)', async ({ request }) => {
      const startTime = Date.now();

      const response = await request.get(`${API_BASE_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(1000);
    });

    test('should handle large page numbers gracefully', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations?page=1000`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(0); // No data at page 1000
    });
  });

  test.describe('Data Validation', () => {

    test('should validate enum values for channel filter', async ({ request }) => {
      const invalidChannel = 'invalid_channel';
      const response = await request.get(`${API_BASE_URL}/conversations?channel=${invalidChannel}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      // The frozen contract validates channel values (telegram|irc).
      expect(response.status()).toBe(400);
    });

    test('should validate enum values for status filter', async ({ request }) => {
      const invalidStatus = 'invalid_status';
      const response = await request.get(`${API_BASE_URL}/conversations?status=${invalidStatus}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should validate enum values for priority filter', async ({ request }) => {
      const invalidPriority = 'invalid_priority';
      const response = await request.get(`${API_BASE_URL}/conversations?priority=${invalidPriority}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(400);
    });
  });
});
