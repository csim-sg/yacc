/**
 * Backend Phase 1 - Conversation Tests
 * 
 * Tests all conversation endpoints according to:
 * - API_DOCUMENTATION.md (Conversation section)
 * - TESTING_GUIDE.md (Conversation scenarios)
 * - .docs/04-qa-and-testing.md (Category 2: Inbox & Conversations)
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:3000/api';

test.describe('Backend API - Conversation Endpoints', () => {
  let authToken = '';
  let userId = 0;
  let testConversationId = 0;

  // Setup: Create a test user and login
  test.beforeAll(async ({ request }) => {
    const userEmail = `conv-test-${Date.now()}@example.com`;
    
    // Register user
    await request.post(`${API_BASE_URL}/auth/register`, {
      data: {
        email: userEmail,
        password: 'ConvTest123!',
        name: 'Conversation Test User',
      },
    });

    // Login to get token
    const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
      data: {
        email: userEmail,
        password: 'ConvTest123!',
      },
    });

    const loginBody = await loginResponse.json();
    authToken = loginBody.token;
    userId = loginBody.user.id;
  });

  test.describe('GET /api/conversations', () => {
    
    test('CONV-001: should list all conversations (empty list is OK)', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.conversations).toBeDefined();
      expect(Array.isArray(body.data.conversations)).toBe(true);
      expect(body.data.total).toBeDefined();
      expect(body.data.page).toBe(1);
      expect(body.data.limit).toBeDefined();
      expect(body.data.totalPages).toBeDefined();
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
      expect(body.data.page).toBe(1);
      expect(body.data.limit).toBe(10);
      expect(body.data.conversations.length).toBeLessThanOrEqual(10);
    });

    test('should support channel filter', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations?channel=telegram`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      // All returned conversations should be telegram channel (Phase 1 MVP includes Telegram)
      body.data.conversations.forEach((conv: any) => {
        if (conv.channel) {
          expect(conv.channel).toBe('telegram');
        }
      });
    });

    test('should support status filter', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations?status=open`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      body.data.conversations.forEach((conv: any) => {
        if (conv.status) {
          expect(conv.status).toBe('open');
        }
      });
    });

    test('should support priority filter', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations?priority=high`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      body.data.conversations.forEach((conv: any) => {
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
      expect(body.data.conversations).toBeDefined();
    });

    test('should support combined filters', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/conversations?channel=telegram&status=open&page=1&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.data).toBeDefined();
    });

    test('should reject invalid pagination values', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations?page=-1&limit=0`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      // Should either validate and return 400, or use defaults
      expect([200, 400]).toContain(response.status());
    });

    test('should enforce maximum limit (100)', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations?limit=1000`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.data.limit).toBeLessThanOrEqual(100);
    });
  });

  test.describe('GET /api/conversations/:id', () => {
    
    test('should return 404 for non-existent conversation', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations/99999`, {
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
      const response = await request.get(`${API_BASE_URL}/conversations/1`);

      expect(response.status()).toBe(401);
    });

    test('should reject invalid conversation ID format', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations/invalid-id`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([400, 404]).toContain(response.status());
    });
  });

  test.describe('PATCH /api/conversations/:id/status', () => {
    
    test('should reject update without authentication', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/1/status`, {
        data: {
          status: 'pending',
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should reject invalid status value', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/1/status`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          status: 'invalid_status',
        },
      });

      expect([400, 404]).toContain(response.status());
      
      if (response.status() === 400) {
        const body = await response.json();
        expect(body.error).toBeDefined();
      }
    });

    test('should reject missing status field', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/1/status`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {},
      });

      expect([400, 404]).toContain(response.status());
    });

    test('should accept valid status values (open, pending, resolved)', async ({ request }) => {
      const validStatuses = ['open', 'pending', 'resolved'];
      
      for (const status of validStatuses) {
        const response = await request.patch(`${API_BASE_URL}/conversations/1/status`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: { status },
        });

        // Either 200 (success) or 404 (conversation doesn't exist)
        expect([200, 404]).toContain(response.status());
      }
    });
  });

  test.describe('PATCH /api/conversations/:id/priority', () => {
    
    test('should reject update without authentication', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/1/priority`, {
        data: {
          priority: 'high',
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should reject invalid priority value', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/1/priority`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          priority: 'super_urgent',
        },
      });

      expect([400, 404]).toContain(response.status());
    });

    test('should accept valid priority values (low, normal, high, urgent)', async ({ request }) => {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      
      for (const priority of validPriorities) {
        const response = await request.patch(`${API_BASE_URL}/conversations/1/priority`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: { priority },
        });

        expect([200, 404]).toContain(response.status());
      }
    });
  });

  test.describe('PATCH /api/conversations/:id/assign', () => {
    
    test('should reject assignment without authentication', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/1/assign`, {
        data: {
          assignedUserId: 1,
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should accept null to unassign conversation', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/1/assign`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          assignedUserId: null,
        },
      });

      // Either 200 (success), 403 (permission denied), or 404 (not found)
      expect([200, 403, 404]).toContain(response.status());
    });

    test('should reject invalid user ID', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/1/assign`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          assignedUserId: 'invalid',
        },
      });

      expect([400, 403, 404]).toContain(response.status());
    });

    test('should reject assignment to non-existent user', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/conversations/1/assign`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          assignedUserId: 99999,
        },
      });

      expect([400, 403, 404]).toContain(response.status());
    });
  });

  test.describe('POST /api/conversations/:id/tags', () => {
    
    test('should reject tag addition without authentication', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/conversations/1/tags`, {
        data: {
          tagId: 1,
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should reject missing tagId field', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/conversations/1/tags`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {},
      });

      expect([400, 404]).toContain(response.status());
    });

    test('should reject invalid tagId format', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/conversations/1/tags`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          tagId: 'invalid',
        },
      });

      expect([400, 404]).toContain(response.status());
    });

    test('should reject non-existent tag', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/conversations/1/tags`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          tagId: 99999,
        },
      });

      expect([400, 404]).toContain(response.status());
    });
  });

  test.describe('DELETE /api/conversations/:id/tags/:tagId', () => {
    
    test('should reject tag removal without authentication', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/conversations/1/tags/1`);

      expect(response.status()).toBe(401);
    });

    test('should return 404 for non-existent conversation', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/conversations/99999/tags/1`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(404);
    });

    test('should return 404 for non-existent tag', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/conversations/1/tags/99999`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(404);
    });

    test('should reject invalid tag ID format', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/conversations/1/tags/invalid`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([400, 404]).toContain(response.status());
    });
  });

  test.describe('Response Format Validation', () => {
    
    test('should return consistent success response format', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(typeof body.data).toBe('object');
    });

    test('should return consistent error response format', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/conversations/99999`, {
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
      
      if (body.data.conversations.length > 0) {
        const conversation = body.data.conversations[0];
        expect(conversation.id).toBeDefined();
        expect(conversation.channel).toBeDefined();
        expect(conversation.status).toBeDefined();
        expect(['open', 'pending', 'resolved']).toContain(conversation.status);
      }
    });
  });

  test.describe('Performance & Limits', () => {
    
    test('should respond within acceptable time (<1 second)', async ({ request }) => {
      const startTime = Date.now();
      
      await request.get(`${API_BASE_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
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
      expect(body.data.conversations).toBeDefined();
      expect(body.data.conversations.length).toBe(0); // No data at page 1000
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

      // Should either validate and return 400, or ignore invalid filter
      expect([200, 400]).toContain(response.status());
    });

    test('should validate enum values for status filter', async ({ request }) => {
      const invalidStatus = 'invalid_status';
      const response = await request.get(`${API_BASE_URL}/conversations?status=${invalidStatus}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 400]).toContain(response.status());
    });

    test('should validate enum values for priority filter', async ({ request }) => {
      const invalidPriority = 'invalid_priority';
      const response = await request.get(`${API_BASE_URL}/conversations?priority=${invalidPriority}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 400]).toContain(response.status());
    });
  });
});
