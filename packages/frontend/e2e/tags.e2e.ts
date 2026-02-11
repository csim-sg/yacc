/**
 * BE-P2-001 (E2E): Tags CRUD + Conversation Tagging
 *
 * Notes:
 * - This suite exercises backend endpoints through Playwright's APIRequestContext.
 * - Real-time validation uses a Socket.io client subscribing to a conversation room.
 * - Fixture IDs are seeded by `packages/backend/scripts/seed-test-fixtures.ts`.
 */

import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';

const BACKEND_URL_RAW =
  process.env.PLAYWRIGHT_TEST_API_URL ||
  process.env.VITE_API_URL ||
  'http://localhost:3000';

const BACKEND_ORIGIN = BACKEND_URL_RAW.replace(/\/api\/?$/, '');
const WS_ORIGIN = (process.env.PLAYWRIGHT_TEST_WS_URL || process.env.VITE_WS_URL || BACKEND_ORIGIN)
  .replace(/^ws:\/\//, 'http://')
  .replace(/^wss:\/\//, 'https://')
  .replace(/\/api\/?$/, '');

const FIXTURE = {
  users: {
    superAdmin: { email: 'admin@yacc.local', password: 'admin123' },
    admin: { email: 'admin2@yacc.local', password: 'admin123' },
    manager: { email: 'manager@yacc.local', password: 'admin123' },
    user: { email: 'user@yacc.local', password: 'admin123' },
  },
  ids: {
    userId: '00000000-0000-0000-0000-000000000004',
    telegramConversationId: '00000000-0000-0000-0000-000000001001',
    ircConversationId: '00000000-0000-0000-0000-000000001002',
  },
} as const;

type AuthedContext = {
  api: APIRequestContext;
  cookieHeader: string;
};

function uniqueTagName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function signIn(api: APIRequestContext, email: string, password: string): Promise<string> {
  const body = { email, password };

  // Primary: backend BetterAuth controller is mounted at /auth
  let res = await api.post('/auth/sign-in/email', { data: body });
  if (res.status() === 404) {
    // Fallback for environments that mount auth under /api/auth
    res = await api.post('/api/auth/sign-in/email', { data: body });
  }

  expect(res.ok()).toBeTruthy();

  const headers = res.headers();
  return headers['set-cookie'] || '';
}

async function createAuthedContext(email: string, password: string): Promise<AuthedContext> {
  const api = await playwrightRequest.newContext({ baseURL: BACKEND_ORIGIN });
  const cookieHeader = await signIn(api, email, password);
  return { api, cookieHeader };
}

async function createTag(api: APIRequestContext, params: { name: string; color?: string }): Promise<number> {
  const res = await api.post('/api/tags', { data: params });
  expect(res.status()).toBe(201);
  const json = (await res.json()) as { data?: { id?: number; name?: string; color?: string } };
  expect(json.data?.id).toBeTruthy();
  expect(json.data?.name).toBe(params.name);
  if (params.color) {
    expect(json.data?.color).toBe(params.color);
  }
  return json.data!.id!;
}

async function addTagToConversation(api: APIRequestContext, conversationId: string, tagId: unknown) {
  return api.post(`/api/conversations/${conversationId}/tags`, {
    data: { tagId },
  });
}

async function removeTagFromConversation(api: APIRequestContext, conversationId: string, tagId: number) {
  return api.delete(`/api/conversations/${conversationId}/tags/${tagId}`);
}

test.describe('BE-P2-001: Tags CRUD + Conversation Tagging (Playwright E2E)', () => {
  test('UI smoke: tags render as badges in inbox + conversation (data-testid selectors)', async ({ page }) => {
    const conversationId = FIXTURE.ids.telegramConversationId;
    const tagId = 123;
    const tagName = 'VIP';

    // AuthContext session bootstrap (mocked)
    await page.route('**/api/auth/get-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: FIXTURE.ids.userId,
          email: 'mocked-user@yacc.local',
          role: 'ADMIN',
        }),
      });
    });

    // Inbox list (mocked)
    await page.route('**/api/conversations**', async (route) => {
      // Allow conversation detail calls to be handled by the more specific route below
      const url = route.request().url();
      if (url.includes(`/api/conversations/${conversationId}`)) {
        return route.fallback();
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: conversationId,
              channel: 'telegram',
              externalThreadId: 'tg-mock-101',
              title: 'Mock Support Thread',
              status: 'open',
              priority: 'medium',
              assignedUserId: null,
              assignedUserName: null,
              tags: [{ id: String(tagId), name: tagName, color: '#2563EB' }],
              participants: [],
              unreadCount: 0,
              latestMessagePreview: 'Preview',
              latestMessageAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      });
    });

    // Conversation detail (mocked)
    await page.route(`**/api/conversations/${conversationId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: conversationId,
            channel: 'telegram',
            externalThreadId: 'tg-mock-101',
            title: 'Mock Support Thread',
            status: 'open',
            priority: 'medium',
            assignedUserId: null,
            tags: [{ id: String(tagId), name: tagName, color: '#2563EB' }],
            participants: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route(`**/api/conversations/${conversationId}/messages**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          page: 1,
          pageSize: 50,
          total: 0,
        }),
      });
    });

    await page.goto('/inbox');
    await page.waitForSelector('[data-testid="conversation-card"]');

    const inboxTag = page.locator('[data-testid="conversation-card"] [data-testid="conversation-tag"]').first();
    await expect(inboxTag).toHaveText(tagName);

    await page.locator('[data-testid="conversation-card"]').first().click();
    await page.waitForSelector('[data-testid="conversation-detail"]');

    const convoTag = page.locator('[data-testid="conversation-tags"] [data-testid="conversation-tag"]').first();
    await expect(convoTag).toHaveText(tagName);
  });

  test('Tag creation flow: admin can create and list tags', async () => {
    const { api } = await createAuthedContext(FIXTURE.users.admin.email, FIXTURE.users.admin.password);

    const tagName = uniqueTagName('e2e-tag');
    const tagId = await createTag(api, { name: tagName, color: '#AABBCC' });

    const listRes = await api.get('/api/tags');
    expect(listRes.status()).toBe(200);
    const listJson = (await listRes.json()) as { data: Array<{ id: number; name: string; color: string }> };
    const found = listJson.data.find((t) => t.id === tagId);
    expect(found?.name).toBe(tagName);
  });

  test('Validation: invalid color and invalid name are rejected (400)', async () => {
    const { api } = await createAuthedContext(FIXTURE.users.admin.email, FIXTURE.users.admin.password);

    const badColor = await api.post('/api/tags', { data: { name: uniqueTagName('e2e-bad-color'), color: '#GGGGGG' } });
    expect(badColor.status()).toBe(400);

    const emptyName = await api.post('/api/tags', { data: { name: '   ', color: '#112233' } });
    expect(emptyName.status()).toBe(400);

    const tooLongName = await api.post('/api/tags', { data: { name: 'a'.repeat(256), color: '#112233' } });
    expect(tooLongName.status()).toBe(400);
  });

  test('Tag assignment flow: add tag to conversation and verify it persists via GET /api/conversations/:id', async () => {
    const { api } = await createAuthedContext(FIXTURE.users.admin.email, FIXTURE.users.admin.password);

    const tagId = await createTag(api, { name: uniqueTagName('e2e-assign'), color: '#0EA5E9' });
    const addRes = await addTagToConversation(api, FIXTURE.ids.telegramConversationId, tagId);
    expect(addRes.status()).toBe(201);

    const convoRes = await api.get(`/api/conversations/${FIXTURE.ids.telegramConversationId}`);
    expect(convoRes.status()).toBe(200);
    const convoJson = (await convoRes.json()) as { data: { tags?: Array<{ id: number; name: string; color: string }> } };
    expect(convoJson.data.tags?.some((t) => t.id === tagId)).toBe(true);
  });

  test('Multi-tag management: add two tags, remove one, verify remaining tags returned', async () => {
    const { api } = await createAuthedContext(FIXTURE.users.admin.email, FIXTURE.users.admin.password);

    const tagId1 = await createTag(api, { name: uniqueTagName('e2e-multi-1'), color: '#22C55E' });
    const tagId2 = await createTag(api, { name: uniqueTagName('e2e-multi-2'), color: '#F97316' });

    const add1 = await addTagToConversation(api, FIXTURE.ids.telegramConversationId, tagId1);
    expect(add1.status()).toBe(201);
    const add2 = await addTagToConversation(api, FIXTURE.ids.telegramConversationId, tagId2);
    expect(add2.status()).toBe(201);

    const remove1 = await removeTagFromConversation(api, FIXTURE.ids.telegramConversationId, tagId1);
    expect(remove1.status()).toBe(200);
    const removeJson = (await remove1.json()) as { data?: { tags?: Array<{ id: number }> } };
    expect(removeJson.data?.tags?.some((t) => t.id === tagId1)).toBe(false);
    expect(removeJson.data?.tags?.some((t) => t.id === tagId2)).toBe(true);
  });

  test('Real-time: conversation.updated is emitted to subscribed Socket.io client on tag change', async () => {
    const { api, cookieHeader } = await createAuthedContext(FIXTURE.users.admin.email, FIXTURE.users.admin.password);

    const socket: Socket = io(WS_ORIGIN, {
      transports: ['websocket'],
      auth: { token: 'test' },
      extraHeaders: cookieHeader ? { Cookie: cookieHeader } : undefined,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Socket connect timeout')), 5000);
        socket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        socket.on('connect_error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Subscription timeout')), 5000);
        socket.emit('subscribe.conversation', FIXTURE.ids.telegramConversationId);
        socket.on('conversation.subscribed', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      const tagId = await createTag(api, { name: uniqueTagName('e2e-rt'), color: '#7C3AED' });

      const eventPromise = new Promise<{ conversationId: string; updatedFields: Record<string, unknown> }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('conversation.updated not received')), 8000);
        socket.once('conversation.updated', (payload) => {
          clearTimeout(timeout);
          resolve(payload as { conversationId: string; updatedFields: Record<string, unknown> });
        });
      });

      const addRes = await addTagToConversation(api, FIXTURE.ids.telegramConversationId, tagId);
      expect(addRes.status()).toBe(201);

      const payload = await eventPromise;
      expect(payload.conversationId).toBe(FIXTURE.ids.telegramConversationId);
      expect(payload.updatedFields).toHaveProperty('tags');
    } finally {
      socket.disconnect();
    }
  });

  test('RBAC + errors: user cannot tag unassigned conversation; invalid/nonexistent IDs are handled', async () => {
    // Admin assigns IRC conversation to user so user has one allowed conversation.
    const admin = await createAuthedContext(FIXTURE.users.admin.email, FIXTURE.users.admin.password);
    const assignRes = await admin.api.patch(`/api/conversations/${FIXTURE.ids.ircConversationId}/assign`, {
      data: { assignedUserId: FIXTURE.ids.userId },
    });
    expect(assignRes.status()).toBe(200);

    const tagId = await createTag(admin.api, { name: uniqueTagName('e2e-rbac'), color: '#EF4444' });

    const user = await createAuthedContext(FIXTURE.users.user.email, FIXTURE.users.user.password);

    const forbidden = await addTagToConversation(user.api, FIXTURE.ids.telegramConversationId, tagId);
    expect(forbidden.status()).toBe(403);

    const allowed = await addTagToConversation(user.api, FIXTURE.ids.ircConversationId, tagId);
    expect(allowed.status()).toBe(201);

    const invalidTagId = await addTagToConversation(admin.api, FIXTURE.ids.telegramConversationId, 'not-a-number');
    expect(invalidTagId.status()).toBe(400);

    const missingTag = await addTagToConversation(admin.api, FIXTURE.ids.telegramConversationId, 999999);
    expect(missingTag.status()).toBe(404);

    const missingConversation = await addTagToConversation(admin.api, '00000000-0000-0000-0000-00000000DEAD', tagId);
    expect(missingConversation.status()).toBe(404);

    const removeNotPresent = await removeTagFromConversation(admin.api, FIXTURE.ids.telegramConversationId, 999999);
    // Graceful behavior: still 200 if conversation exists and tag exists is required for 404; 999999 likely 404
    expect([200, 404]).toContain(removeNotPresent.status());
  });
});
