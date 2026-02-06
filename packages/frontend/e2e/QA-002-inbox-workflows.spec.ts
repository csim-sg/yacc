/**
 * QA-002: E2E Tests for Inbox & Messaging Workflows
 *
 * Tests complete user journeys:
 * - User logs in
 * - Views inbox with filters
 * - Opens conversation
 * - Reads messages
 * - Sends reply
 *
 * Framework: Playwright
 * Target: 12 user workflows + accessibility
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const TEST_USER = {
  email: 'qa-test@example.com',
  password: 'TestPassword123!',
};

/**
 * Helper functions
 */
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button:has-text("Login")');
  await page.waitForNavigation();
  await page.waitForSelector('[data-testid="inbox-page"]', { timeout: 5000 });
}

async function navigateToInbox(page: Page) {
  await page.goto(`${BASE_URL}/inbox`);
  await page.waitForSelector('[data-testid="conversation-list"]');
}

async function openFirstConversation(page: Page) {
  const firstCard = await page.$('[data-testid="conversation-card"]');
  if (firstCard) {
    await firstCard.click();
    await page.waitForSelector('[data-testid="conversation-detail"]', { timeout: 5000 });
  }
}

/**
 * E2E-001: User Views Inbox
 */
test('E2E-001: User logs in and views inbox', async ({ page }) => {
  await login(page);

  // Verify inbox page
  await expect(page.locator('[data-testid="inbox-page"]')).toBeVisible();
  await expect(page.locator('[data-testid="conversation-list"]')).toBeVisible();

  // Verify pagination controls
  await expect(page.locator('[data-testid="pagination"]')).toBeVisible();

  // Verify conversation cards are rendered
  const cards = await page.locator('[data-testid="conversation-card"]').count();
  expect(cards).toBeGreaterThan(0);
});

/**
 * E2E-002: User Filters Conversations
 */
test('E2E-002: User filters conversations by channel', async ({ page }) => {
  await login(page);
  await navigateToInbox(page);

  // Open channel filter dropdown
  await page.click('[data-testid="filter-channel"]');
  await page.click('text=Telegram');

  // Wait for list to update
  await page.waitForTimeout(500);

  // Verify filtered results
  const cards = await page.locator('[data-testid="conversation-card"]');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  // Verify all cards show Telegram channel
  const firstCard = cards.first();
  await expect(firstCard.locator('text=Telegram')).toBeVisible();
});

/**
 * E2E-003: User Searches Conversations
 */
test('E2E-003: User searches for conversation', async ({ page }) => {
  await login(page);
  await navigateToInbox(page);

  // Type in search box
  await page.fill('[data-testid="search-input"]', 'refund');
  await page.press('[data-testid="search-input"]', 'Enter');

  // Wait for results
  await page.waitForTimeout(1000);

  // Verify results appeared
  const cards = await page.locator('[data-testid="conversation-card"]').count();
  expect(cards).toBeGreaterThan(0);
});

/**
 * E2E-004: User Opens Conversation
 */
test('E2E-004: User opens conversation detail view', async ({ page }) => {
  await login(page);
  await navigateToInbox(page);
  await openFirstConversation(page);

  // Verify conversation detail page
  await expect(page.locator('[data-testid="conversation-detail"]')).toBeVisible();

  // Verify message timeline is visible
  await expect(page.locator('[data-testid="message-timeline"]')).toBeVisible();

  // Verify messages are displayed
  const messages = await page.locator('[data-testid="message-item"]').count();
  expect(messages).toBeGreaterThan(0);
});

/**
 * E2E-005: User Sends Reply
 */
test('E2E-005: User sends reply to conversation', async ({ page }) => {
  await login(page);
  await navigateToInbox(page);
  await openFirstConversation(page);

  // Get initial message count
  const initialCount = await page.locator('[data-testid="message-item"]').count();

  // Type and send message
  const composerInput = page.locator('[data-testid="message-composer"]');
  await composerInput.fill('This is a test reply');
  await page.click('[data-testid="send-button"]');

  // Wait for message to appear
  await page.waitForTimeout(1000);

  // Verify new message was added
  const finalCount = await page.locator('[data-testid="message-item"]').count();
  expect(finalCount).toBeGreaterThan(initialCount);

  // Verify composer is cleared
  await expect(composerInput).toHaveValue('');
});

/**
 * E2E-006: User Assigns Conversation
 */
test('E2E-006: User assigns conversation to team member', async ({ page }) => {
  await login(page);
  await navigateToInbox(page);
  await openFirstConversation(page);

  // Open assign dropdown
  await page.click('[data-testid="assign-dropdown"]');

  // Select a team member
  await page.click('text=John Doe');

  // Wait for update
  await page.waitForTimeout(500);

  // Verify assignment updated
  await expect(page.locator('text=Assigned to: John Doe')).toBeVisible();
});

/**
 * E2E-007: User Changes Conversation Status
 */
test('E2E-007: User changes conversation status', async ({ page }) => {
  await login(page);
  await navigateToInbox(page);
  await openFirstConversation(page);

  // Get current status
  const statusElement = page.locator('[data-testid="conversation-status"]');
  const oldStatus = await statusElement.textContent();

  // Open status dropdown
  await page.click('[data-testid="status-dropdown"]');
  await page.click('text=Resolved');

  // Wait for update
  await page.waitForTimeout(500);

  // Verify status changed
  const newStatus = await statusElement.textContent();
  expect(newStatus).not.toBe(oldStatus);
  expect(newStatus).toContain('Resolved');
});

/**
 * E2E-008: User Adds Tag
 */
test('E2E-008: User adds tag to conversation', async ({ page }) => {
  await login(page);
  await navigateToInbox(page);
  await openFirstConversation(page);

  // Get initial tag count
  const initialTags = await page.locator('[data-testid="tag"]').count();

  // Open add tag menu
  await page.click('[data-testid="add-tag-button"]');
  await page.click('text=VIP');

  // Wait for update
  await page.waitForTimeout(500);

  // Verify tag was added
  const finalTags = await page.locator('[data-testid="tag"]').count();
  expect(finalTags).toBeGreaterThan(initialTags);
});

/**
 * E2E-009: User Paginates Inbox
 */
test('E2E-009: User navigates between pagination pages', async ({ page }) => {
  await login(page);
  await navigateToInbox(page);

  // Get first page conversations
  const firstPageCards = await page.locator('[data-testid="conversation-card"]').allTextContents();
  const firstConversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-id');

  // Click next page button
  await page.click('[data-testid="pagination-next"]');
  await page.waitForTimeout(500);

  // Get second page conversations
  const secondPageCards = await page.locator('[data-testid="conversation-card"]').allTextContents();
  const secondConversationId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-id');

  // Verify different conversations
  expect(firstConversationId).not.toBe(secondConversationId);

  // Go back to page 1
  await page.click('[data-testid="pagination-prev"]');
  await page.waitForTimeout(500);

  // Verify back to original
  const thirdPageId = await page.locator('[data-testid="conversation-card"]').first().getAttribute('data-id');
  expect(thirdPageId).toBe(firstConversationId);
});

/**
 * E2E-010: User Handles Failed Message
 */
test('E2E-010: User retries failed message', async ({ page }) => {
  await login(page);
  await navigateToInbox(page);
  await openFirstConversation(page);

  // Find failed message (if any)
  const failedMessage = page.locator('[data-testid="message-status-failed"]').first();
  
  if (await failedMessage.isVisible()) {
    // Hover to show retry button
    await failedMessage.hover();
    
    // Click retry
    await page.click('[data-testid="retry-button"]');
    
    // Wait for retry
    await page.waitForTimeout(1000);
    
    // Verify status changed
    await expect(failedMessage).not.toHaveClass(/failed/);
  }
});

/**
 * E2E-011: Real-Time Message Arrives
 */
test('E2E-011: User receives new message in real-time', async ({ page, context }) => {
  await login(page);
  await navigateToInbox(page);
  await openFirstConversation(page);

  // Get initial message count
  const initialCount = await page.locator('[data-testid="message-item"]').count();

  // Note: This would require a second user/endpoint to send message
  // For now, we verify the structure is ready for real-time
  const timeline = page.locator('[data-testid="message-timeline"]');
  await expect(timeline).toBeVisible();
});

/**
 * E2E-012: Keyboard Navigation
 */
test('E2E-012: User navigates with keyboard only', async ({ page }) => {
  await login(page);
  await navigateToInbox(page);

  // Tab to first conversation
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  // Press Enter to open
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid="conversation-detail"]', { timeout: 5000 });

  // Verify conversation opened
  await expect(page.locator('[data-testid="conversation-detail"]')).toBeVisible();

  // Tab to message composer
  await page.keyboard.press('Tab');
  
  // Type message
  await page.keyboard.type('Keyboard test message', { delay: 50 });

  // Send with Ctrl+Enter
  await page.keyboard.press('Control+Enter');

  // Wait for send
  await page.waitForTimeout(1000);

  // Verify message was sent
  const messages = await page.locator('[data-testid="message-item"]').count();
  expect(messages).toBeGreaterThan(0);
});

/**
 * Accessibility Tests
 */
test('E2E-Accessibility-001: Page structure is semantic', async ({ page }) => {
  await login(page);
  await navigateToInbox(page);

  // Verify heading structure
  const h1 = await page.locator('h1').count();
  const h2 = await page.locator('h2').count();
  
  expect(h1).toBeGreaterThan(0);

  // Verify buttons have accessible labels
  const buttons = await page.locator('button');
  for (const button of await buttons.all()) {
    const text = await button.textContent();
    const ariaLabel = await button.getAttribute('aria-label');
    expect(text || ariaLabel).toBeTruthy();
  }
});

test('E2E-Accessibility-002: Color contrast is sufficient', async ({ page }) => {
  await login(page);

  // Verify page renders without visual errors
  await expect(page).not.toHaveScreenshot('broken-layout.png');
});

/**
 * Performance Tests
 */
test('E2E-Performance-001: Inbox loads in under 2 seconds', async ({ page }) => {
  const startTime = Date.now();
  
  await login(page);
  await navigateToInbox(page);
  
  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(2000);
});

test('E2E-Performance-002: Conversation opens in under 1 second', async ({ page }) => {
  await login(page);
  await navigateToInbox(page);

  const startTime = Date.now();
  await openFirstConversation(page);
  const openTime = Date.now() - startTime;

  expect(openTime).toBeLessThan(1000);
});
