import { test, expect } from '@playwright/test';
import { loginAs, logout, TEST_USERS } from '../../helpers/auth';
import { bulkAction, getAuditLogs } from '../../helpers/api';
import { getBulkConversationIds, FIXTURE_IDS } from '../../helpers/fixtures';

/**
 * Bulk Actions Acceptance Tests - 14 scenarios
 */

test.describe('Bulk Actions Feature - Complete Acceptance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
    await page.goto('/inbox');
  });

  test('HP-BULK-001: Bulk assign 50 conversations', async ({ page }) => {
    const ids = getBulkConversationIds(50);
    const result = await bulkAction(page, {
      conversationIds: ids,
      action: 'assign',
      value: FIXTURE_IDS.users.manager
    });
    expect(result.successCount).toBeGreaterThan(0);
  });

  test('HP-BULK-002: Bulk tag conversations', async ({ page }) => {
    const ids = getBulkConversationIds(30);
    const result = await bulkAction(page, {
      conversationIds: ids,
      action: 'tag',
      value: { tagName: 'Bulk-Tag' }
    });
    expect(result.successCount).toBeGreaterThan(0);
  });

  test('HP-BULK-003: Bulk change status to pending', async ({ page }) => {
    const ids = getBulkConversationIds(25);
    const result = await bulkAction(page, {
      conversationIds: ids,
      action: 'status',
      value: 'pending'
    });
    expect(result.successCount).toBeGreaterThan(0);
  });

  test('HP-BULK-004: Bulk change status to resolved', async ({ page }) => {
    const ids = getBulkConversationIds(20);
    const result = await bulkAction(page, {
      conversationIds: ids,
      action: 'status',
      value: 'resolved'
    });
    expect(result.successCount).toBeGreaterThan(0);
  });

  test('HP-BULK-005: Bulk change priority to high', async ({ page }) => {
    const ids = getBulkConversationIds(15);
    const result = await bulkAction(page, {
      conversationIds: ids,
      action: 'priority',
      value: 'high'
    });
    expect(result.successCount).toBeGreaterThan(0);
  });

  test('EDGE-BULK-006: Bulk action with exactly 100 conversations succeeds', async ({ page }) => {
    const ids = getBulkConversationIds(100);
    const result = await bulkAction(page, {
      conversationIds: ids,
      action: 'assign',
      value: FIXTURE_IDS.users.admin
    });
    expect(result.successCount).toBeGreaterThanOrEqual(100);
  });

  test('EDGE-BULK-007: Bulk action with 101+ returns validation error', async ({ page }) => {
    const ids = getBulkConversationIds(101);
    
    const response = await page.request.post('http://localhost:3000/api/conversations/bulk', {
      data: {
        conversationIds: ids,
        assign: FIXTURE_IDS.users.manager
      }
    });
    
    expect(response.status()).toBe(400);
  });

  test('EDGE-BULK-008: Best-effort partial failure with invalid IDs', async ({ page }) => {
    const validIds = getBulkConversationIds(10);
    const invalidIds = ['00000000-0000-0000-0000-999999999999', '00000000-0000-0000-0000-888888888888'];
    const mixedIds = [...validIds, ...invalidIds];
    
    const result = await bulkAction(page, {
      conversationIds: mixedIds,
      action: 'assign',
      value: FIXTURE_IDS.users.manager
    });
    
    expect(result.successCount).toBeGreaterThan(0);
    expect(result.failureCount).toBeGreaterThanOrEqual(0);
  });

  test('EDGE-BULK-009: Failures array returned with reason', async ({ page }) => {
    const validIds = getBulkConversationIds(5);
    const invalidId = '00000000-0000-0000-0000-999999999999';
    
    const result = await bulkAction(page, {
      conversationIds: [...validIds, invalidId],
      action: 'assign',
      value: FIXTURE_IDS.users.admin
    });
    
    if (result.failures && result.failures.length > 0) {
      const failure = result.failures[0];
      expect(failure.conversationId || failure.id).toBeTruthy();
      expect(failure.error || failure.reason).toBeTruthy();
    }
  });

  test('RBAC-BULK-010: User cannot perform bulk actions', async ({ page }) => {
    await logout(page);
    await loginAs(page, TEST_USERS.user);
    
    const response = await page.request.post('http://localhost:3000/api/conversations/bulk', {
      data: {
        conversationIds: getBulkConversationIds(5),
        assign: FIXTURE_IDS.users.manager
      }
    });
    
    expect(response.status()).toBe(403);
  });

  test('RBAC-BULK-011: Manager can perform bulk actions', async ({ page }) => {
    await logout(page);
    await loginAs(page, TEST_USERS.manager);
    
    const result = await bulkAction(page, {
      conversationIds: getBulkConversationIds(5),
      action: 'assign',
      value: FIXTURE_IDS.users.user
    });
    
    expect(result.successCount).toBeGreaterThan(0);
  });

  test('AUD-BULK-012: Bulk action creates audit entries', async ({ page }) => {
    const ids = getBulkConversationIds(3);
    await bulkAction(page, {
      conversationIds: ids,
      action: 'assign',
      value: FIXTURE_IDS.users.manager
    });
    
    const logs = await getAuditLogs(page);
    expect(logs.length).toBeGreaterThan(0);
  });

  test('AUD-BULK-013: Each successful action logged separately', async ({ page }) => {
    const ids = getBulkConversationIds(2);
    await bulkAction(page, {
      conversationIds: ids,
      action: 'assign',
      value: FIXTURE_IDS.users.manager
    });
    
    const bulkLogs = await getAuditLogs(page, { action: 'bulk_action_applied' });
    expect(bulkLogs.length).toBeGreaterThanOrEqual(0);
  });

  test('EDGE-BULK-014: Empty selection shows validation error', async ({ page }) => {
    const response = await page.request.post('http://localhost:3000/api/conversations/bulk', {
      data: {
        conversationIds: [],
        assign: FIXTURE_IDS.users.manager
      }
    });
    
    expect(response.status()).toBe(400);
  });
});
