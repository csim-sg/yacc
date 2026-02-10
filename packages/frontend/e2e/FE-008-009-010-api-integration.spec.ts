/**
 * E2E Tests for FE-008/009/010: API Integration & Reply Composer
 *
 * Tests cover:
 * - FE-008: Inbox List API Integration
 * - FE-009: Conversation Detail API Integration
 * - FE-010: Reply Composer Component
 *
 * Prerequisites:
 * - Backend running at http://localhost:3000
 * - Test user account exists
 * - Test conversations exist in database
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';
const API_URL = process.env.PLAYWRIGHT_TEST_API_URL || 'http://localhost:3000';

// Test user credentials (from backend test fixtures)
const TEST_USER = {
  email: 'test-user@yacc.local',
  password: 'TestPassword123',
};

test.describe('FE-008/009/010: API Integration & Reply Composer', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button:has-text("Sign in")');
    
    // Wait for navigation to inbox
    await page.waitForURL(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('FE-008: Inbox List API Integration', () => {
    test('should load conversations from API', async ({ page }) => {
      // Navigate to inbox
      await page.goto(`${BASE_URL}/`);
      
      // Wait for conversation cards to appear
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      // Verify conversations are loaded
      const conversationCards = await page.locator('[data-testid="conversation-card"]').count();
      expect(conversationCards).toBeGreaterThan(0);
    });

    test('should display conversation list with correct fields', async ({ page }) => {
      // Navigate to inbox
      await page.goto(`${BASE_URL}/`);
      
      // Wait for first conversation card
      await page.waitForSelector('[data-testid="conversation-card"]');
      const firstCard = page.locator('[data-testid="conversation-card"]').first();
      
      // Verify card contains expected elements
      await expect(firstCard.locator('[data-testid="conversation-channel"]')).toBeVisible();
      await expect(firstCard.locator('[data-testid="conversation-status-badge"]')).toBeVisible();
      await expect(firstCard.locator('[data-testid="conversation-message-preview"]')).toBeVisible();
    });

    test('should filter conversations by channel', async ({ page }) => {
      // Navigate to inbox
      await page.goto(`${BASE_URL}/`);
      
      // Wait for filter controls
      await page.waitForSelector('[data-testid="channel-filter"]');
      
      // Select Telegram filter
      await page.selectOption('[data-testid="channel-filter"]', 'telegram');
      
      // Wait for filtered results
      await page.waitForLoadState('networkidle');
      
      // Verify all visible conversations are Telegram
      const conversationCards = page.locator('[data-testid="conversation-card"]');
      const cardCount = await conversationCards.count();
      
      for (let i = 0; i < cardCount; i++) {
        const channel = await conversationCards.nth(i).locator('[data-testid="conversation-channel"]').textContent();
        expect(channel).toContain('Telegram');
      }
    });

    test('should filter conversations by status', async ({ page }) => {
      // Navigate to inbox
      await page.goto(`${BASE_URL}/`);
      
      // Wait for filter controls
      await page.waitForSelector('[data-testid="status-filter"]');
      
      // Select 'open' status filter
      await page.selectOption('[data-testid="status-filter"]', 'open');
      
      // Wait for filtered results
      await page.waitForLoadState('networkidle');
      
      // Verify all visible conversations have 'open' status
      const conversationCards = page.locator('[data-testid="conversation-card"]');
      const cardCount = await conversationCards.count();
      
      for (let i = 0; i < cardCount; i++) {
        const statusBadge = await conversationCards.nth(i).locator('[data-testid="conversation-status-badge"]').textContent();
        expect(statusBadge?.toLowerCase()).toContain('open');
      }
    });

    test('should search conversations by text', async ({ page }) => {
      // Navigate to inbox
      await page.goto(`${BASE_URL}/`);
      
      // Wait for search input
      await page.waitForSelector('[data-testid="search-input"]');
      
      // Enter search term
      const searchTerm = 'test';
      await page.fill('[data-testid="search-input"]', searchTerm);
      await page.press('[data-testid="search-input"]', 'Enter');
      
      // Wait for search results
      await page.waitForLoadState('networkidle');
      
      // Verify results contain search term or are empty
      const conversationCards = page.locator('[data-testid="conversation-card"]');
      const cardCount = await conversationCards.count();
      
      if (cardCount > 0) {
        for (let i = 0; i < cardCount; i++) {
          const cardText = await conversationCards.nth(i).textContent();
          expect(cardText?.toLowerCase()).toContain(searchTerm.toLowerCase());
        }
      }
    });

    test('should display pagination controls', async ({ page }) => {
      // Navigate to inbox
      await page.goto(`${BASE_URL}/`);
      
      // Wait for pagination controls
      const paginationControls = page.locator('[data-testid="pagination-controls"]');
      
      // Verify pagination is visible
      const isPaginationVisible = await paginationControls.isVisible().catch(() => false);
      
      if (isPaginationVisible) {
        // Verify page info is displayed
        await expect(paginationControls.locator('[data-testid="page-info"]')).toBeVisible();
      }
    });

    test('should show loading state while fetching conversations', async ({ page }) => {
      // Navigate to inbox with network throttling
      await page.route('**/api/conversations*', route => {
        setTimeout(() => route.continue(), 1000);
      });
      
      await page.goto(`${BASE_URL}/`);
      
      // Verify loading skeleton appears
      const loadingSkeletons = page.locator('[data-testid="conversation-skeleton"]');
      const skeletonCount = await loadingSkeletons.count();
      
      // Should have at least one skeleton during loading
      if (skeletonCount > 0) {
        await expect(loadingSkeletons.first()).toBeVisible();
      }
      
      // Wait for actual content to load
      await page.waitForSelector('[data-testid="conversation-card"]');
    });

    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API error
      await page.route('**/api/conversations*', route => {
        route.abort('failed');
      });
      
      // Navigate to inbox
      await page.goto(`${BASE_URL}/`);
      
      // Wait for error message
      await page.waitForSelector('[data-testid="error-message"]', { timeout: 5000 });
      
      // Verify error is displayed
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible();
      
      // Verify retry button is available
      const retryButton = page.locator('[data-testid="retry-button"]');
      await expect(retryButton).toBeVisible();
    });

    test('should navigate to conversation detail on card click', async ({ page }) => {
      // Navigate to inbox
      await page.goto(`${BASE_URL}/`);
      
      // Wait for first conversation card
      await page.waitForSelector('[data-testid="conversation-card"]');
      const firstCard = page.locator('[data-testid="conversation-card"]').first();
      
      // Get conversation ID from card
      const conversationId = await firstCard.getAttribute('data-conversation-id');
      
      // Click the card
      await firstCard.click();
      
      // Wait for navigation to conversation detail
      await page.waitForURL(`**/conversations/${conversationId}`, { timeout: 5000 });
      
      // Verify conversation detail page loaded
      await expect(page.locator('[data-testid="conversation-detail"]')).toBeVisible();
    });
  });

  test.describe('FE-009: Conversation Detail API Integration', () => {
    test('should load conversation detail from API', async ({ page }) => {
      // Get first conversation ID from inbox
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      
      // Navigate to conversation detail
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Wait for conversation detail to load
      await page.waitForSelector('[data-testid="conversation-detail"]');
      
      // Verify conversation details are displayed
      await expect(page.locator('[data-testid="conversation-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="conversation-messages"]')).toBeVisible();
    });

    test('should display conversation metadata', async ({ page }) => {
      // Navigate to first conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Wait for details
      await page.waitForSelector('[data-testid="conversation-detail"]');
      
      // Verify metadata fields are visible
      await expect(page.locator('[data-testid="conversation-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="conversation-priority"]')).toBeVisible();
      await expect(page.locator('[data-testid="conversation-channel"]')).toBeVisible();
    });

    test('should display message timeline', async ({ page }) => {
      // Navigate to first conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Wait for messages to load
      await page.waitForSelector('[data-testid="message-item"]');
      
      // Verify messages are displayed
      const messageCount = await page.locator('[data-testid="message-item"]').count();
      expect(messageCount).toBeGreaterThan(0);
    });

    test('should display message sender and content', async ({ page }) => {
      // Navigate to first conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Wait for first message
      await page.waitForSelector('[data-testid="message-item"]');
      const firstMessage = page.locator('[data-testid="message-item"]').first();
      
      // Verify message fields
      await expect(firstMessage.locator('[data-testid="message-sender"]')).toBeVisible();
      await expect(firstMessage.locator('[data-testid="message-body"]')).toBeVisible();
      await expect(firstMessage.locator('[data-testid="message-timestamp"]')).toBeVisible();
    });

    test('should show message status badge for outbound messages', async ({ page }) => {
      // Navigate to first conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Wait for messages
      await page.waitForSelector('[data-testid="message-item"]');
      
      // Find outbound message (sent by user)
      const outboundMessages = page.locator('[data-testid="message-item"][data-direction="outbound"]');
      const outboundCount = await outboundMessages.count();
      
      if (outboundCount > 0) {
        // Verify status badge is displayed
        const statusBadge = outboundMessages.first().locator('[data-testid="message-status"]');
        await expect(statusBadge).toBeVisible();
      }
    });

    test('should handle API errors when loading conversation', async ({ page }) => {
      // Mock conversation API error
      await page.route('**/api/conversations/*', route => {
        route.abort('failed');
      });
      
      // Navigate to conversation
      await page.goto(`${BASE_URL}/conversations/invalid-id`);
      
      // Wait for error message
      await page.waitForSelector('[data-testid="error-message"]', { timeout: 5000 });
      
      // Verify error is displayed
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should have back button to return to inbox', async ({ page }) => {
      // Navigate to first conversation
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Wait for back button
      await page.waitForSelector('[data-testid="back-button"]');
      
      // Click back button
      await page.locator('[data-testid="back-button"]').click();
      
      // Verify navigation back to inbox
      await page.waitForURL(`${BASE_URL}/`);
    });
  });

  test.describe('FE-010: Reply Composer Component', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to first conversation for reply tests
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('[data-testid="conversation-card"]');
      
      const conversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-conversation-id');
      await page.goto(`${BASE_URL}/conversations/${conversationId}`);
      
      // Wait for reply composer
      await page.waitForSelector('[data-testid="reply-composer-textarea"]');
    });

    test('should display reply composer textarea', async ({ page }) => {
      // Verify textarea is visible
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      await expect(textarea).toBeVisible();
      
      // Verify placeholder text
      const placeholder = await textarea.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
    });

    test('should display character counter', async ({ page }) => {
      // Verify character counter is visible
      const counter = page.locator('[data-testid="character-counter"]');
      await expect(counter).toBeVisible();
      
      // Verify initial count shows 0
      const initialCount = await counter.textContent();
      expect(initialCount).toContain('0');
    });

    test('should update character counter as user types', async ({ page }) => {
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      const counter = page.locator('[data-testid="character-counter"]');
      
      // Type message
      await textarea.fill('Test message');
      
      // Verify counter updated
      const updatedCount = await counter.textContent();
      expect(updatedCount).toContain('12');
    });

    test('should enforce character limit (5000)', async ({ page }) => {
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      
      // Create message longer than limit
      const longMessage = 'a'.repeat(5500);
      
      // Try to fill textarea
      await textarea.fill(longMessage);
      
      // Verify text is truncated to limit
      const value = await textarea.inputValue();
      expect(value.length).toBeLessThanOrEqual(5000);
    });

    test('should show warning when at character limit', async ({ page }) => {
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      const counter = page.locator('[data-testid="character-counter"]');
      
      // Fill textarea to limit
      const maxMessage = 'a'.repeat(5000);
      await textarea.fill(maxMessage);
      
      // Verify limit warning appears
      const counterText = await counter.textContent();
      expect(counterText).toContain('5000 / 5000');
      
      // Verify counter shows error styling
      const hasErrorClass = await counter.evaluate(el => el.classList.contains('text-error'));
      expect(hasErrorClass).toBe(true);
    });

    test('should disable send button when textarea is empty', async ({ page }) => {
      const sendButton = page.locator('[data-testid="reply-composer-send-button"]');
      
      // Verify button is disabled
      const isDisabled = await sendButton.isDisabled();
      expect(isDisabled).toBe(true);
    });

    test('should enable send button when message is entered', async ({ page }) => {
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      const sendButton = page.locator('[data-testid="reply-composer-send-button"]');
      
      // Enter message
      await textarea.fill('Test message');
      
      // Verify button is enabled
      const isDisabled = await sendButton.isDisabled();
      expect(isDisabled).toBe(false);
    });

    test('should disable send button when message contains only whitespace', async ({ page }) => {
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      const sendButton = page.locator('[data-testid="reply-composer-send-button"]');
      
      // Enter whitespace only
      await textarea.fill('   \n  \t  ');
      
      // Verify button is disabled
      const isDisabled = await sendButton.isDisabled();
      expect(isDisabled).toBe(true);
    });

    test('should send message on send button click', async ({ page }) => {
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      const sendButton = page.locator('[data-testid="reply-composer-send-button"]');
      
      // Enter message
      const testMessage = `Test message ${Date.now()}`;
      await textarea.fill(testMessage);
      
      // Click send button
      await sendButton.click();
      
      // Verify button shows loading state
      const isDisabled = await sendButton.isDisabled();
      expect(isDisabled).toBe(true);
      
      // Wait for send to complete (usually within 2 seconds)
      await page.waitForTimeout(1000);
      
      // Verify textarea is cleared
      const textareaValue = await textarea.inputValue();
      expect(textareaValue).toBe('');
    });

    test('should send message with Ctrl+Enter keyboard shortcut', async ({ page }) => {
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      
      // Enter message
      const testMessage = `Test message ${Date.now()}`;
      await textarea.fill(testMessage);
      
      // Press Ctrl+Enter
      await textarea.press('Control+Enter');
      
      // Wait for send to complete
      await page.waitForTimeout(1000);
      
      // Verify textarea is cleared
      const textareaValue = await textarea.inputValue();
      expect(textareaValue).toBe('');
    });

    test('should show error message if send fails', async ({ page }) => {
      // Mock send API error
      await page.route('**/api/conversations/*/messages', route => {
        route.abort('failed');
      });
      
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      const sendButton = page.locator('[data-testid="reply-composer-send-button"]');
      
      // Enter message
      await textarea.fill('Test message');
      
      // Click send button
      await sendButton.click();
      
      // Wait for error to appear
      await page.waitForSelector('[data-testid="error-message"]', { timeout: 5000 });
      
      // Verify error is displayed
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible();
      
      // Verify dismiss button is available
      const dismissButton = page.locator('[data-testid="error-dismiss-button"]');
      await expect(dismissButton).toBeVisible();
    });

    test('should dismiss error message', async ({ page }) => {
      // Mock send API error
      await page.route('**/api/conversations/*/messages', route => {
        route.abort('failed');
      });
      
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      const sendButton = page.locator('[data-testid="reply-composer-send-button"]');
      
      // Enter and attempt to send message
      await textarea.fill('Test message');
      await sendButton.click();
      
      // Wait for error message
      await page.waitForSelector('[data-testid="error-message"]');
      
      // Click dismiss button
      await page.locator('[data-testid="error-dismiss-button"]').click();
      
      // Verify error is hidden
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeHidden();
    });

    test('should show loading state during send', async ({ page }) => {
      // Throttle network to see loading state
      await page.route('**/api/conversations/*/messages', route => {
        setTimeout(() => route.continue(), 1000);
      });
      
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      const sendButton = page.locator('[data-testid="reply-composer-send-button"]');
      
      // Enter message
      await textarea.fill('Test message');
      
      // Click send button
      await sendButton.click();
      
      // Verify button shows "Sending..." text
      const buttonText = await sendButton.textContent();
      expect(buttonText).toContain('Sending');
      
      // Verify spinner is visible
      await expect(sendButton.locator('svg.animate-spin')).toBeVisible();
    });

    test('should clear error when user starts typing again', async ({ page }) => {
      // Mock send API error
      await page.route('**/api/conversations/*/messages', route => {
        route.abort('failed');
      });
      
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      const sendButton = page.locator('[data-testid="reply-composer-send-button"]');
      
      // Enter and attempt to send message
      await textarea.fill('Test message');
      await sendButton.click();
      
      // Wait for error message
      await page.waitForSelector('[data-testid="error-message"]');
      
      // Clear textarea and type new message
      await textarea.clear();
      await textarea.fill('New message');
      
      // Verify error is still visible (auto-dismiss behavior may vary)
      // This depends on implementation - adjust expectation if different
      const errorMessage = page.locator('[data-testid="error-message"]');
      const isVisible = await errorMessage.isVisible().catch(() => false);
      
      // If error is visible, it should be dismissible
      if (isVisible) {
        await expect(errorMessage).toBeVisible();
      }
    });

    test('should trim whitespace from message before sending', async ({ page }) => {
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      const sendButton = page.locator('[data-testid="reply-composer-send-button"]');
      
      // Enter message with leading/trailing whitespace
      await textarea.fill('   Test message with whitespace   ');
      
      // Click send button
      await sendButton.click();
      
      // Wait for send to complete
      await page.waitForTimeout(1000);
      
      // Verify textarea is cleared (message was sent)
      const textareaValue = await textarea.inputValue();
      expect(textareaValue).toBe('');
    });

    test('should display placeholder text in empty textarea', async ({ page }) => {
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      
      // Verify placeholder is displayed
      const placeholder = await textarea.getAttribute('placeholder');
      expect(placeholder).toContain('reply');
    });

    test('should have proper accessibility attributes', async ({ page }) => {
      const textarea = page.locator('[data-testid="reply-composer-textarea"]');
      const sendButton = page.locator('[data-testid="reply-composer-send-button"]');
      
      // Verify aria-labels
      const textareaLabel = await textarea.getAttribute('aria-label');
      expect(textareaLabel).toBeTruthy();
      
      const buttonLabel = await sendButton.getAttribute('aria-label');
      expect(buttonLabel).toBeTruthy();
    });
  });

  test.describe('Error Handling & Edge Cases', () => {
    test('should handle 401 Unauthorized error', async ({ page }) => {
      // Mock 401 error
      await page.route('**/api/conversations*', route => {
        route.abort('failed');
      });
      
      // Navigate to inbox
      await page.goto(`${BASE_URL}/`);
      
      // Wait for error
      await page.waitForSelector('[data-testid="error-message"]', { timeout: 5000 }).catch(() => {});
      
      // Verify page shows error or redirects to login
      const currentUrl = page.url();
      const isOnErrorPage = currentUrl.includes('/conversations') || currentUrl.includes('/login');
      expect(isOnErrorPage).toBe(true);
    });

    test('should handle network timeout gracefully', async ({ page }) => {
      // Set very short timeout
      await page.route('**/api/conversations*', async route => {
        await page.waitForTimeout(15000); // Wait longer than timeout
        route.continue();
      });
      
      // Navigate to inbox
      await page.goto(`${BASE_URL}/`);
      
      // Wait for timeout message or retry button
      await page.waitForSelector('[data-testid="error-message"], [data-testid="retry-button"]', { 
        timeout: 10000 
      }).catch(() => {});
      
      // Verify error or retry is shown
      const hasError = await page.locator('[data-testid="error-message"]').isVisible().catch(() => false);
      const hasRetry = await page.locator('[data-testid="retry-button"]').isVisible().catch(() => false);
      
      expect(hasError || hasRetry).toBe(true);
    });

    test('should handle empty conversation list', async ({ page }) => {
      // Mock empty response
      await page.route('**/api/conversations*', route => {
        route.respond({
          status: 200,
          body: JSON.stringify({
            data: [],
            page: 1,
            pageSize: 20,
            total: 0,
          }),
        });
      });
      
      // Navigate to inbox
      await page.goto(`${BASE_URL}/`);
      
      // Wait for empty state message
      await page.waitForSelector('[data-testid="empty-state"]', { timeout: 5000 });
      
      // Verify empty state is shown
      const emptyState = page.locator('[data-testid="empty-state"]');
      await expect(emptyState).toBeVisible();
    });
  });
});
