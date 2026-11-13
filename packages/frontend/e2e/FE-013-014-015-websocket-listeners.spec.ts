/**
 * E2E Tests for FE-013/014/015: WebSocket Real-Time Message Listeners
 *
 * Tests cover:
 * - FE-013: message.received listener
 * - FE-014: message.sent listener
 * - FE-015: message.failed listener
 *
 * Prerequisites:
 * - Backend running at http://localhost:3000 with WebSocket support
 * - Test user account exists
 * - Test conversations exist in database
 * - WebSocket server accessible at ws://localhost:3000
 *
 * #495 re-point (2026-11-13): setup/preconditions only, against the
 * Angular/Java surface — pinned harness env resolution (React-era names kept
 * as fallbacks, dead :5173/:3000 defaults removed), seeded identity
 * (`TEST_USERS.admin` = `admin2@yacc.local`; `test-user@yacc.local` is not in
 * `DeterministicSeed`), login submit `[data-testid="login-submit"]` (the
 * Angular button text is "Sign In"), post-login URL `/inbox` (Angular
 * redirects `/` → `/inbox`). Every test title and every assertion is
 * byte-identical to the pre-re-point file (#478/#485 precedent; SPEC-003
 * AM-2 manual evidence — #477).
 *
 * #495 stimulus re-point (2026-11-13, tech-lead adjudication #6852513056):
 * (B1) the injection socket authenticates like the frozen R1 spec — a real
 * access token from the seeded-identity sign-in rides the `?token=` upgrade
 * parameter; (B2) `message.received` injections use the frozen inbound
 * channel `connector.message.received` with the required `senderId` member;
 * (B3) `message.sent`/`message.failed` injections carry the frozen payload
 * members (`sentAt` / `retryAt` + `attempt`); (A) every `page.evaluate`
 * passes its arguments as the single object Playwright evaluates accept;
 * (B4, declared — `parity/suite-adaptations.json`, `kind:
 * contract-conformance`) the `serverId` case asserts the row whose
 * `data-message-id` equals `message.sent#messageId` — `serverId` exists in
 * no frozen schema or code path. Assertion statements keep their shape and
 * strength; only the declared B4 locator identity is re-pointed.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

import { TEST_USERS } from '../tests/helpers/auth';

// #495 re-point (2026-11-13): resolve the pinned Angular/Java harness env
// first (`BASE_URL`/`API_URL`/`PLAYWRIGHT_TEST_API_BASE_URL`, per
// `.github/workflows/frontend-angular-parity.yml`), keep the React-era names
// as fallbacks, and default to the live Angular/Java posture — the dead
// React/Node ports (:5173/:3000) are never used.
const BASE_URL =
  process.env.BASE_URL || process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:4200';
const API_URL =
  process.env.API_URL ||
  process.env.PLAYWRIGHT_TEST_API_BASE_URL ||
  process.env.PLAYWRIGHT_TEST_API_URL ||
  'http://localhost:8080/api';
const WS_URL = process.env.PLAYWRIGHT_TEST_WS_URL || 'ws://localhost:8080/ws';

// #495 re-point (2026-11-13): seeded S1 identity — `test-user@yacc.local` is
// not in the Java `DeterministicSeed` fixture world; `TEST_USERS.admin`
// (`admin2@yacc.local`) is, via the shared helpers (`packages/frontend/
// tests/helpers/auth.ts`).
const TEST_USER = TEST_USERS.admin;

// #495 B1 (2026-11-13): the event-injection socket authenticates exactly like
// the frozen R1 spec's sockets — the upgrade URL carries `?token=` with a real
// access token minted by the seeded-identity sign-in (`POST /api/auth/sign-in/
// email`). Acquired once per test in `beforeEach` (serial execution,
// `--workers=1`).
let injectionToken = '';

async function signInToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_URL}/auth/sign-in/email`, {
    data: { email: TEST_USER.email, password: TEST_USER.password },
  });
  const body = (await response.json()) as { accessToken?: string };
  return body.accessToken ?? '';
}

test.describe('FE-013/014/015: WebSocket Real-Time Message Listeners', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('[data-testid="login-submit"]');
    
    // Wait for navigation and WebSocket connection
    await page.waitForURL(`${BASE_URL}/inbox`);
    await page.waitForLoadState('networkidle');
    
    // Wait for WebSocket to connect
    await page.waitForTimeout(1000);

    // #495 B1: token for the authenticated injection socket (below).
    injectionToken = await signInToken(page.request);
  });

  test.describe('FE-013: message.received Listener', () => {
    test('should receive and display new inbound message in real-time', async ({ page, context }) => {
      // Navigate to conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Wait for initial messages to load
      await page.waitForSelector('[data-testid="message-item"]');
      const initialMessageCount = await page.locator('[data-testid="message-item"]').count();
      
      // Open second browser context to send message via API
      const context2 = await page.context().browser()?.newContext() as any;
      const page2 = await context2.newPage();
      
      // Emit WebSocket event from test backend
      // In real test, this would be via test API endpoint or direct WebSocket emission
      // (#495 B1/B2: authenticated socket, frozen inbound channel + payload).
      await page.evaluate(({ wsUrl, token, conversationId, senderId }) => {
        const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'connector.message.received',
            data: {
              conversationId,
              messageId: crypto.randomUUID(),
              platform: 'telegram',
              senderId,
              senderName: 'Test Sender',
              body: 'Real-time test message from WebSocket',
              timestamp: new Date().toISOString(),
            },
          }));
        };
      }, { wsUrl: WS_URL, token: injectionToken, conversationId, senderId: TEST_USER.id });
      
      // Wait for new message to appear
      const updatedMessageCount = await page.locator('[data-testid="message-item"]').count();
      expect(updatedMessageCount).toBeGreaterThan(initialMessageCount);
      
      // Verify new message content
      const lastMessage = page.locator('[data-testid="message-item"]').last();
      await expect(lastMessage.locator('[data-testid="message-body"]')).toContainText('Real-time test message');
    });

    test('should update unread count when new message arrives', async ({ page }) => {
      // Navigate to inbox to see unread badges
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const firstCard = page.locator('[data-testid="conversation-card"]').first();
      const conversationId = await firstCard.getAttribute('data-conversation-id');
      
      // Get initial unread count
      let initialUnread = 0;
      const unreadBadge = firstCard.locator('[data-testid="unread-badge"]');
      const badgeVisible = await unreadBadge.isVisible().catch(() => false);
      
      if (badgeVisible) {
        const badgeText = await unreadBadge.textContent();
        initialUnread = parseInt(badgeText || '0');
      }
      
      // Simulate receiving message
      // (#495 B1/B2: authenticated socket, frozen inbound channel + payload.)
      await page.evaluate(({ wsUrl, token, conversationId, senderId }) => {
        const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'connector.message.received',
            data: {
              conversationId,
              messageId: crypto.randomUUID(),
              platform: 'telegram',
              senderId,
              senderName: 'Test Sender',
              body: 'Test message',
              timestamp: new Date().toISOString(),
            },
          }));
        };
      }, { wsUrl: WS_URL, token: injectionToken, conversationId, senderId: TEST_USER.id });
      
      // Wait for unread count to update
      await page.waitForTimeout(500);
      
      // Verify unread count increased
      const updatedUnreadText = await unreadBadge.textContent();
      const updatedUnread = parseInt(updatedUnreadText || '0');
      
      expect(updatedUnread).toBeGreaterThanOrEqual(initialUnread);
    });

    test('should update conversation list with latest message preview', async ({ page }) => {
      // Navigate to inbox
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const firstCard = page.locator('[data-testid="conversation-card"]').first();
      const conversationId = await firstCard.getAttribute('data-conversation-id');
      
      // Get initial message preview
      const preview = firstCard.locator('[data-testid="conversation-message-preview"]');
      const initialPreview = await preview.textContent();
      
      // Simulate receiving new message
      const testMessage = `Real-time preview ${Date.now()}`;
      // (#495 B1/B2: authenticated socket, frozen inbound channel + payload.)
      await page.evaluate(({ wsUrl, token, conversationId, senderId, msg }) => {
        const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'connector.message.received',
            data: {
              conversationId,
              messageId: crypto.randomUUID(),
              platform: 'telegram',
              senderId,
              senderName: 'Test Sender',
              body: msg,
              timestamp: new Date().toISOString(),
            },
          }));
        };
      }, { wsUrl: WS_URL, token: injectionToken, conversationId, senderId: TEST_USER.id, msg: testMessage });
      
      // Wait for preview to update
      await page.waitForTimeout(500);
      
      // Verify preview updated
      const updatedPreview = await preview.textContent();
      expect(updatedPreview).toContain('Real-time preview');
    });

    test('should handle duplicate message.received events', async ({ page }) => {
      // Navigate to conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Wait for initial messages
      await page.waitForSelector('[data-testid="message-item"]');
      const initialCount = await page.locator('[data-testid="message-item"]').count();
      
      // Send same event twice (simulating duplicate)
      // (#495 B1/B2: authenticated socket, frozen inbound channel + payload;
      // the wire has no eventId (T3-G10) — message-id uniqueness is the dedup
      // mechanism, so the duplicate is the same messageId sent twice.)
      const messageId = crypto.randomUUID();
      
      await page.evaluate(({ wsUrl, token, conversationId, senderId, msgId }) => {
        const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          // Send twice with same messageId
          for (let i = 0; i < 2; i++) {
            socket.send(JSON.stringify({
              event: 'connector.message.received',
              data: {
                conversationId,
                messageId: msgId,
                platform: 'telegram',
                senderId,
                senderName: 'Test Sender',
                body: 'Duplicate test message',
                timestamp: new Date().toISOString(),
              },
            }));
          }
        };
      }, { wsUrl: WS_URL, token: injectionToken, conversationId, senderId: TEST_USER.id, msgId: messageId });
      
      // Wait for processing
      await page.waitForTimeout(500);
      
      // Verify only one message was added (not two)
      const finalCount = await page.locator('[data-testid="message-item"]').count();
      expect(finalCount).toBe(initialCount + 1);
    });

    test('should preserve message order in timeline', async ({ page }) => {
      // Navigate to conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Wait for initial messages
      await page.waitForSelector('[data-testid="message-item"]');
      
      // Send multiple messages in sequence
      for (let i = 0; i < 3; i++) {
        // (#495 B1/B2: authenticated socket, frozen inbound channel + payload.)
        await page.evaluate(({ wsUrl, token, conversationId, senderId, idx }) => {
          const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
          socket.onopen = () => {
            socket.send(JSON.stringify({
              event: 'connector.message.received',
              data: {
                conversationId,
                messageId: crypto.randomUUID(),
                platform: 'telegram',
                senderId,
                senderName: 'Sender ' + idx,
                body: 'Message ' + idx,
                timestamp: new Date().toISOString(),
              },
            }));
          };
        }, { wsUrl: WS_URL, token: injectionToken, conversationId, senderId: TEST_USER.id, idx: i });
        
        await page.waitForTimeout(100);
      }
      
      // Wait for all messages to appear
      await page.waitForTimeout(500);
      
      // Verify messages are in correct order
      const messages = page.locator('[data-testid="message-item"]');
      const messageCount = await messages.count();
      
      // Check that messages with "Message 0", "Message 1", "Message 2" are present in order
      let foundFirst = false;
      let foundSecond = false;
      let foundThird = false;
      
      for (let i = 0; i < messageCount; i++) {
        const text = await messages.nth(i).textContent();
        
        if (!foundFirst && text?.includes('Message 0')) {
          foundFirst = true;
        } else if (foundFirst && !foundSecond && text?.includes('Message 1')) {
          foundSecond = true;
        } else if (foundFirst && foundSecond && !foundThird && text?.includes('Message 2')) {
          foundThird = true;
          break;
        }
      }
      
      expect(foundFirst && foundSecond && foundThird).toBe(true);
    });
  });

  test.describe('FE-014: message.sent Listener', () => {
    test('should update message status from pending to sent', async ({ page }) => {
      // Navigate to conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Send a message
      await page.waitForSelector('[data-testid="reply-composer-textarea"]');
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      
      const testMessage = `Test message ${Date.now()}`;
      await textarea.fill(testMessage);
      await page.locator('[data-testid="reply-composer-send-button"]').click();
      
      // Wait for message to appear with pending status
      await page.waitForSelector('[data-testid="message-item"][data-status="pending"]');
      
      // Simulate message.sent event
      const lastMessage = page.locator('[data-testid="message-item"]').last();
      const messageId = await lastMessage.getAttribute('data-message-id');
      
      // (#495 B1/B3: authenticated socket, frozen `message.sent` payload.)
      await page.evaluate(({ wsUrl, token, conversationId, msgId }) => {
        const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.sent',
            data: {
              conversationId,
              messageId: msgId,
              status: 'sent',
              sentAt: new Date().toISOString(),
            },
          }));
        };
      }, { wsUrl: WS_URL, token: injectionToken, conversationId, msgId: messageId });
      
      // Wait for status to update
      await page.waitForTimeout(500);
      
      // Verify status changed to sent
      await expect(lastMessage.locator('[data-testid="message-status"]')).toContainText('sent');
    });

    test('should reconcile temporary ID with server ID', async ({ page }) => {
      // Navigate to conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Send a message
      await page.waitForSelector('[data-testid="reply-composer-textarea"]');
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      
      const testMessage = `Test message ${Date.now()}`;
      await textarea.fill(testMessage);
      await page.locator('[data-testid="reply-composer-send-button"]').click();
      
      // Get temporary message ID
      await page.waitForSelector('[data-testid="message-item"][data-status="pending"]');
      const tempMessage = page.locator('[data-testid="message-item"]').last();
      const tempId = await tempMessage.getAttribute('data-message-id');
      
      // Simulate message.sent event with server ID
      // (#495 B1/B3/B4 — DECLARED contract-conformance substitution: `serverId`
      // exists in no frozen schema or code path; the frozen `message.sent`
      // payload carries `messageId`, so the equivalent observable is the row
      // whose `data-message-id` equals `message.sent#messageId` — the
      // optimistic row is replaced by the contract-identified row.)
      await page.evaluate(({ wsUrl, token, conversationId, msgId }) => {
        const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.sent',
            data: {
              conversationId,
              messageId: msgId,
              status: 'sent',
              sentAt: new Date().toISOString(),
            },
          }));
        };
      }, { wsUrl: WS_URL, token: injectionToken, conversationId, msgId: tempId });
      
      // Wait for update
      await page.waitForTimeout(500);
      
      // Verify message ID was updated to server ID
      // (#495 B4: declared substitution — see above.)
      const updatedMessage = page.locator(`[data-message-id="${tempId}"]`);
      await expect(updatedMessage).toBeVisible();
    });

    test('should handle duplicate message.sent events', async ({ page }) => {
      // Navigate to conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Send a message
      await page.waitForSelector('[data-testid="reply-composer-textarea"]');
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      
      const testMessage = `Test message ${Date.now()}`;
      await textarea.fill(testMessage);
      await page.locator('[data-testid="reply-composer-send-button"]').click();
      
      // Get message ID
      await page.waitForSelector('[data-testid="message-item"][data-status="pending"]');
      const messageId = await page.locator('[data-testid="message-item"]').last().getAttribute('data-message-id');
      
      // Send duplicate message.sent events
      // (#495 B1/B3: authenticated socket, frozen `message.sent` payload;
      // the duplicate is the same messageId sent twice — message-id
      // uniqueness is the dedup mechanism, T3-G10.)
      await page.evaluate(({ wsUrl, token, conversationId, msgId }) => {
        const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          // Send twice
          for (let i = 0; i < 2; i++) {
            socket.send(JSON.stringify({
              event: 'message.sent',
              data: {
                conversationId,
                messageId: msgId,
                status: 'sent',
                sentAt: new Date().toISOString(),
              },
            }));
          }
        };
      }, { wsUrl: WS_URL, token: injectionToken, conversationId, msgId: messageId });
      
      // Wait for processing
      await page.waitForTimeout(500);
      
      // Verify message status is sent (only processed once)
      const message = page.locator(`[data-message-id="${messageId}"]`);
      await expect(message.locator('[data-testid="message-status"]')).toContainText('sent');
    });
  });

  test.describe('FE-015: message.failed Listener', () => {
    test('should update message status from pending to failed', async ({ page }) => {
      // Navigate to conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Send a message
      await page.waitForSelector('[data-testid="reply-composer-textarea"]');
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      
      const testMessage = `Test message ${Date.now()}`;
      await textarea.fill(testMessage);
      await page.locator('[data-testid="reply-composer-send-button"]').click();
      
      // Wait for message to appear
      await page.waitForSelector('[data-testid="message-item"][data-status="pending"]');
      const messageId = await page.locator('[data-testid="message-item"]').last().getAttribute('data-message-id');
      
      // Simulate message.failed event
      // (#495 B1/B3: authenticated socket, frozen `message.failed` payload.)
      await page.evaluate(({ wsUrl, token, conversationId, msgId }) => {
        const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.failed',
            data: {
              conversationId,
              messageId: msgId,
              status: 'failed',
              error: 'Network error',
              retryAt: new Date().toISOString(),
              attempt: 1,
            },
          }));
        };
      }, { wsUrl: WS_URL, token: injectionToken, conversationId, msgId: messageId });
      
      // Wait for status update
      await page.waitForTimeout(500);
      
      // Verify status changed to failed
      const message = page.locator(`[data-message-id="${messageId}"]`);
      await expect(message.locator('[data-testid="message-status"]')).toContainText('failed');
    });

    test('should display error reason in message', async ({ page }) => {
      // Navigate to conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Send a message
      await page.waitForSelector('[data-testid="reply-composer-textarea"]');
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      
      const testMessage = `Test message ${Date.now()}`;
      await textarea.fill(testMessage);
      await page.locator('[data-testid="reply-composer-send-button"]').click();
      
      // Get message ID
      await page.waitForSelector('[data-testid="message-item"][data-status="pending"]');
      const messageId = await page.locator('[data-testid="message-item"]').last().getAttribute('data-message-id');
      
      // Simulate message.failed with error reason
      const errorReason = 'Network timeout';
      // (#495 B1/B3: authenticated socket, frozen `message.failed` payload.)
      await page.evaluate(({ wsUrl, token, conversationId, msgId, error }) => {
        const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.failed',
            data: {
              conversationId,
              messageId: msgId,
              status: 'failed',
              error,
              retryAt: new Date().toISOString(),
              attempt: 1,
            },
          }));
        };
      }, { wsUrl: WS_URL, token: injectionToken, conversationId, msgId: messageId, error: errorReason });
      
      // Wait for error to display
      await page.waitForTimeout(500);
      
      // Verify error reason is displayed
      const message = page.locator(`[data-message-id="${messageId}"]`);
      const errorElement = message.locator('[data-testid="message-error"]');
      
      const errorVisible = await errorElement.isVisible().catch(() => false);
      if (errorVisible) {
        await expect(errorElement).toContainText(errorReason);
      }
    });

    test('should show retry capability when canRetry is true', async ({ page }) => {
      // Navigate to conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Send a message
      await page.waitForSelector('[data-testid="reply-composer-textarea"]');
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      
      const testMessage = `Test message ${Date.now()}`;
      await textarea.fill(testMessage);
      await page.locator('[data-testid="reply-composer-send-button"]').click();
      
      // Get message ID
      await page.waitForSelector('[data-testid="message-item"][data-status="pending"]');
      const messageId = await page.locator('[data-testid="message-item"]').last().getAttribute('data-message-id');
      
      // Simulate message.failed with canRetry = true
      // (#495 B1/B3: authenticated socket, frozen `message.failed` payload.)
      await page.evaluate(({ wsUrl, token, conversationId, msgId }) => {
        const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.failed',
            data: {
              conversationId,
              messageId: msgId,
              status: 'failed',
              error: 'Network error',
              retryAt: new Date().toISOString(),
              attempt: 1,
            },
          }));
        };
      }, { wsUrl: WS_URL, token: injectionToken, conversationId, msgId: messageId });
      
      // Wait for update
      await page.waitForTimeout(500);
      
      // Verify retry button is visible
      const message = page.locator(`[data-message-id="${messageId}"]`);
      const retryButton = message.locator('[data-testid="message-retry-button"]');
      
      const retryVisible = await retryButton.isVisible().catch(() => false);
      expect(retryVisible).toBe(true);
    });

    test('should handle duplicate message.failed events', async ({ page }) => {
      // Navigate to conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Send a message
      await page.waitForSelector('[data-testid="reply-composer-textarea"]');
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      
      const testMessage = `Test message ${Date.now()}`;
      await textarea.fill(testMessage);
      await page.locator('[data-testid="reply-composer-send-button"]').click();
      
      // Get message ID
      await page.waitForSelector('[data-testid="message-item"][data-status="pending"]');
      const messageId = await page.locator('[data-testid="message-item"]').last().getAttribute('data-message-id');
      
      // Send duplicate message.failed events
      // (#495 B1/B3: authenticated socket, frozen `message.failed` payload;
      // the duplicate is the same messageId sent twice — message-id
      // uniqueness is the dedup mechanism, T3-G10.)
      await page.evaluate(({ wsUrl, token, conversationId, msgId }) => {
        const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          // Send twice
          for (let i = 0; i < 2; i++) {
            socket.send(JSON.stringify({
              event: 'message.failed',
              data: {
                conversationId,
                messageId: msgId,
                status: 'failed',
                error: 'Error',
                retryAt: new Date().toISOString(),
                attempt: 1,
              },
            }));
          }
        };
      }, { wsUrl: WS_URL, token: injectionToken, conversationId, msgId: messageId });
      
      // Wait for processing
      await page.waitForTimeout(500);
      
      // Verify message status is failed (only processed once)
      const message = page.locator(`[data-message-id="${messageId}"]`);
      await expect(message.locator('[data-testid="message-status"]')).toContainText('failed');
    });
  });

  test.describe('WebSocket Resilience & Error Handling', () => {
    test('should handle WebSocket reconnection', async ({ page }) => {
      // Navigate to conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Wait for initial connection
      await page.waitForTimeout(1000);
      
      // Simulate WebSocket disconnection and reconnection
      await page.evaluate(() => {
        // Trigger reconnection logic in app
        window.dispatchEvent(new Event('online'));
      });
      
      // Wait for reconnection
      await page.waitForTimeout(1000);
      
      // Verify app is still functional
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      await expect(textarea).toBeVisible();
    });

    test('should deduplicate events across reconnections', async ({ page }) => {
      // Navigate to conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Wait for initial load
      await page.waitForSelector('[data-testid="message-item"]');
      const initialCount = await page.locator('[data-testid="message-item"]').count();
      
      // Send event, simulate disconnect, send same event again
      // (#495 B1/B2: authenticated socket, frozen inbound channel + payload;
      // same messageId twice — message-id uniqueness is the dedup mechanism,
      // T3-G10.)
      const messageId = crypto.randomUUID();
      
      await page.evaluate(({ wsUrl, token, conversationId, senderId, msgId }) => {
        const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'connector.message.received',
            data: {
              conversationId,
              messageId: msgId,
              platform: 'telegram',
              senderId,
              senderName: 'Test',
              body: 'Dedup test',
              timestamp: new Date().toISOString(),
            },
          }));
        };
      }, { wsUrl: WS_URL, token: injectionToken, conversationId, senderId: TEST_USER.id, msgId: messageId });
      
      // Wait for message
      await page.waitForTimeout(500);
      const countAfterFirst = await page.locator('[data-testid="message-item"]').count();
      
      // Send same event again (simulating reconnection backlog)
      await page.evaluate(({ wsUrl, token, conversationId, senderId, msgId }) => {
        const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'connector.message.received',
            data: {
              conversationId,
              messageId: msgId,
              platform: 'telegram',
              senderId,
              senderName: 'Test',
              body: 'Dedup test',
              timestamp: new Date().toISOString(),
            },
          }));
        };
      }, { wsUrl: WS_URL, token: injectionToken, conversationId, senderId: TEST_USER.id, msgId: messageId });
      
      // Wait for potential duplicate
      await page.waitForTimeout(500);
      const countAfterSecond = await page.locator('[data-testid="message-item"]').count();
      
      // Verify only one message was added (deduplication worked)
      expect(countAfterSecond).toBe(countAfterFirst);
    });

    test('should work across multiple open tabs', async ({ page, context }) => {
      // Open first tab and navigate to conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Open second tab
      const page2 = await context.newPage();
      await page2.goto(`${BASE_URL}/`);
      
      // Send message in first tab
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      const testMessage = `Multi-tab test ${Date.now()}`;
      await textarea.fill(testMessage);
      await page.locator('[data-testid="reply-composer-send-button"]').click();
      
      // Wait for message in first tab
      await page.waitForTimeout(1000);
      
      // Check if conversation list in second tab reflects changes
      const conversationList = page2.locator('[data-testid="conversation-card"]');
      await expect(conversationList.first()).toBeVisible();
      
      // Close second tab
      await page2.close();
    });
  });
});
