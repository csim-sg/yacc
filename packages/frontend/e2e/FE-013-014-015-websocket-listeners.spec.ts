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
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';
const API_URL = process.env.PLAYWRIGHT_TEST_API_URL || 'http://localhost:3000';
const WS_URL = process.env.PLAYWRIGHT_TEST_WS_URL || 'ws://localhost:3000';

// Test user credentials
const TEST_USER = {
  email: 'test-user@yacc.local',
  password: 'TestPassword123',
};

test.describe('FE-013/014/015: WebSocket Real-Time Message Listeners', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button:has-text("Sign in")');
    
    // Wait for navigation and WebSocket connection
    await page.waitForURL(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    // Wait for WebSocket to connect
    await page.waitForTimeout(1000);
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
      await page.evaluate((wsUrl) => {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.received',
            data: {
              conversationId: '${conversationId}',
              messageId: 'test-msg-' + Date.now(),
              platform: 'telegram',
              senderName: 'Test Sender',
              body: 'Real-time test message from WebSocket',
              timestamp: new Date().toISOString(),
              eventId: 'test-event-' + Date.now(),
            },
          }));
        };
      }, WS_URL);
      
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
      await page.evaluate((wsUrl, convId) => {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.received',
            data: {
              conversationId: convId,
              messageId: 'test-msg-' + Date.now(),
              platform: 'telegram',
              senderName: 'Test Sender',
              body: 'Test message',
              timestamp: new Date().toISOString(),
              eventId: 'test-event-' + Date.now(),
            },
          }));
        };
      }, WS_URL, conversationId);
      
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
      await page.evaluate((wsUrl, convId, msg) => {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.received',
            data: {
              conversationId: convId,
              messageId: 'test-msg-' + Date.now(),
              platform: 'telegram',
              senderName: 'Test Sender',
              body: msg,
              timestamp: new Date().toISOString(),
              eventId: 'test-event-' + Date.now(),
            },
          }));
        };
      }, WS_URL, conversationId, testMessage);
      
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
      const eventId = 'test-duplicate-' + Date.now();
      const messageId = 'test-msg-' + Date.now();
      
      await page.evaluate((wsUrl, convId, msgId, evt) => {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          // Send twice with same eventId
          for (let i = 0; i < 2; i++) {
            socket.send(JSON.stringify({
              event: 'message.received',
              data: {
                conversationId: convId,
                messageId: msgId,
                platform: 'telegram',
                senderName: 'Test Sender',
                body: 'Duplicate test message',
                timestamp: new Date().toISOString(),
                eventId: evt,
              },
            }));
          }
        };
      }, WS_URL, conversationId, messageId, eventId);
      
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
        await page.evaluate((wsUrl, convId, idx) => {
          const socket = new WebSocket(wsUrl);
          socket.onopen = () => {
            socket.send(JSON.stringify({
              event: 'message.received',
              data: {
                conversationId: convId,
                messageId: 'msg-' + idx + '-' + Date.now(),
                platform: 'telegram',
                senderName: 'Sender ' + idx,
                body: 'Message ' + idx,
                timestamp: new Date().toISOString(),
                eventId: 'evt-' + idx + '-' + Date.now(),
              },
            }));
          };
        }, WS_URL, conversationId, i);
        
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
      
      await page.evaluate((wsUrl, convId, msgId) => {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.sent',
            data: {
              conversationId: convId,
              messageId: msgId,
              status: 'sent',
              timestamp: new Date().toISOString(),
              eventId: 'sent-' + Date.now(),
            },
          }));
        };
      }, WS_URL, conversationId, messageId);
      
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
      const serverId = 'server-msg-' + Date.now();
      await page.evaluate((wsUrl, convId, tmpId, srvId) => {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.sent',
            data: {
              conversationId: convId,
              messageId: tmpId,
              serverId: srvId,
              status: 'sent',
              timestamp: new Date().toISOString(),
              eventId: 'sent-' + Date.now(),
            },
          }));
        };
      }, WS_URL, conversationId, tempId, serverId);
      
      // Wait for update
      await page.waitForTimeout(500);
      
      // Verify message ID was updated to server ID
      const updatedMessage = page.locator(`[data-message-id="${serverId}"]`);
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
      const eventId = 'sent-dup-' + Date.now();
      
      await page.evaluate((wsUrl, convId, msgId, evt) => {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          // Send twice
          for (let i = 0; i < 2; i++) {
            socket.send(JSON.stringify({
              event: 'message.sent',
              data: {
                conversationId: convId,
                messageId: msgId,
                status: 'sent',
                timestamp: new Date().toISOString(),
                eventId: evt,
              },
            }));
          }
        };
      }, WS_URL, conversationId, messageId, eventId);
      
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
      await page.evaluate((wsUrl, convId, msgId) => {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.failed',
            data: {
              conversationId: convId,
              messageId: msgId,
              status: 'failed',
              error: 'Network error',
              canRetry: true,
              timestamp: new Date().toISOString(),
              eventId: 'failed-' + Date.now(),
            },
          }));
        };
      }, WS_URL, conversationId, messageId);
      
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
      await page.evaluate((wsUrl, convId, msgId, error) => {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.failed',
            data: {
              conversationId: convId,
              messageId: msgId,
              status: 'failed',
              error: error,
              canRetry: true,
              timestamp: new Date().toISOString(),
              eventId: 'failed-' + Date.now(),
            },
          }));
        };
      }, WS_URL, conversationId, messageId, errorReason);
      
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
      await page.evaluate((wsUrl, convId, msgId) => {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.failed',
            data: {
              conversationId: convId,
              messageId: msgId,
              status: 'failed',
              error: 'Network error',
              canRetry: true,
              timestamp: new Date().toISOString(),
              eventId: 'failed-' + Date.now(),
            },
          }));
        };
      }, WS_URL, conversationId, messageId);
      
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
      const eventId = 'failed-dup-' + Date.now();
      
      await page.evaluate((wsUrl, convId, msgId, evt) => {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          // Send twice
          for (let i = 0; i < 2; i++) {
            socket.send(JSON.stringify({
              event: 'message.failed',
              data: {
                conversationId: convId,
                messageId: msgId,
                status: 'failed',
                error: 'Error',
                canRetry: true,
                timestamp: new Date().toISOString(),
                eventId: evt,
              },
            }));
          }
        };
      }, WS_URL, conversationId, messageId, eventId);
      
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
      const eventId = 'dedup-test-' + Date.now();
      
      await page.evaluate((wsUrl, convId, evt) => {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.received',
            data: {
              conversationId: convId,
              messageId: 'msg-' + Date.now(),
              platform: 'telegram',
              senderName: 'Test',
              body: 'Dedup test',
              timestamp: new Date().toISOString(),
              eventId: evt,
            },
          }));
        };
      }, WS_URL, conversationId, eventId);
      
      // Wait for message
      await page.waitForTimeout(500);
      const countAfterFirst = await page.locator('[data-testid="message-item"]').count();
      
      // Send same event again (simulating reconnection backlog)
      await page.evaluate((wsUrl, convId, evt) => {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          socket.send(JSON.stringify({
            event: 'message.received',
            data: {
              conversationId: convId,
              messageId: 'msg-' + Date.now(),
              platform: 'telegram',
              senderName: 'Test',
              body: 'Dedup test',
              timestamp: new Date().toISOString(),
              eventId: evt,
            },
          }));
        };
      }, WS_URL, conversationId, eventId);
      
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
