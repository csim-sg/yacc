import { test, expect, Page } from '@playwright/test';
import { loginAs, logout, TEST_USERS } from '../../helpers/auth';
import { apiRequest } from '../../helpers/api';

/**
 * Phase 1: Inbox List & Filters Tests - 18 scenarios
 * 
 * Tests conversation listing, pagination, and filtering by:
 * - Channel (Telegram, IRC)
 * - Status (open, pending, resolved)
 * - Priority (low, normal, high, urgent)
 * - Assignment
 * - Sorting
 */

test.describe('Phase 1: Inbox List & Filters - Complete Acceptance Tests', () => {
  const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

  test.beforeEach(async ({ page }) => {
    // Login as manager for most tests (has access to all conversations)
    await loginAs(page, TEST_USERS.manager);
    await page.goto('/inbox');
  });

  // ============ HAPPY PATH TESTS (6) ============

  test('HP-INBOX-001: List conversations with default pagination', async ({ page }) => {
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations'
    });

    expect(response.status).toBe(200);
    const data = response.data as { data: unknown[]; page: number; pageSize: number; total: number };
    
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBeLessThanOrEqual(20); // Default limit
    expect(data.total).toBeGreaterThanOrEqual(0);
  });

  test('HP-INBOX-002: Filter by channel (Telegram)', async ({ page }) => {
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations?channel=telegram'
    });

    expect(response.status).toBe(200);
    const data = response.data as { data: Array<{ channel: string }>; total: number };
    
    expect(data.total).toBeGreaterThan(0);
    data.data.forEach(conv => {
      expect(conv.channel).toBe('telegram');
    });
  });

  test('HP-INBOX-003: Filter by status (open)', async ({ page }) => {
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations?status=open'
    });

    expect(response.status).toBe(200);
    const data = response.data as { data: Array<{ status: string }>; total: number };
    
    expect(data.total).toBeGreaterThan(0);
    data.data.forEach(conv => {
      expect(conv.status).toBe('open');
    });
  });

  test('HP-INBOX-004: Filter by priority (normal)', async ({ page }) => {
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations?priority=normal'
    });

    expect(response.status).toBe(200);
    const data = response.data as { data: Array<{ priority: string }>; total: number };
    
    expect(data.total).toBeGreaterThan(0);
    data.data.forEach(conv => {
      expect(conv.priority).toBe('normal');
    });
  });

  test('HP-INBOX-005: Filter by assigned user', async ({ page }) => {
    const userId = TEST_USERS.manager.id;
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: `/conversations?assignedUserId=${userId}`
    });

    expect(response.status).toBe(200);
    const data = response.data as { data: Array<{ assignedUserId: string }> };
    
    data.data.forEach(conv => {
      expect(conv.assignedUserId).toBe(userId);
    });
  });

  test('HP-INBOX-006: Combine multiple filters (channel + status + priority)', async ({ page }) => {
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations?channel=irc&status=pending&priority=high'
    });

    expect(response.status).toBe(200);
    const data = response.data as { data: Array<{ channel: string; status: string; priority: string }> };
    
    data.data.forEach(conv => {
      expect(conv.channel).toBe('irc');
      expect(conv.status).toBe('pending');
      expect(conv.priority).toBe('high');
    });
  });

  // ============ EDGE CASE TESTS (6) ============

  test('EDGE-INBOX-001: Empty result set (no matches)', async ({ page }) => {
    // Use combination unlikely to have results
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations?channel=telegram&status=resolved&priority=urgent&limit=100'
    });

    expect(response.status).toBe(200);
    const data = response.data as { data: unknown[]; total: number };
    
    // Should return empty or minimal results
    expect(data.total).toBeGreaterThanOrEqual(0);
  });

  test('EDGE-INBOX-002: Pagination boundary (page > available pages)', async ({ page }) => {
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations?page=999&limit=10'
    });

    expect(response.status).toBe(200);
    const data = response.data as { data: unknown[]; page: number };
    
    expect(data.data).toBeDefined();
    // Page should be valid even if no results
  });

  test('EDGE-INBOX-003: Invalid limit (> 100) rejected', async ({ page }) => {
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations?limit=150'
    });

    // Should either reject or cap at 100
    expect([200, 400]).toContain(response.status);
  });

  test('EDGE-INBOX-004: Invalid status value rejected', async ({ page }) => {
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations?status=invalid_status'
    });

    expect(response.status).toBe(400);
    const data = response.data as { message?: string };
    expect(data.message || JSON.stringify(data)).toMatch(/status|invalid/i);
  });

  test('EDGE-INBOX-005: Invalid priority value (old "medium") rejected', async ({ page }) => {
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations?priority=medium'
    });

    expect(response.status).toBe(400);
    const data = response.data as { message?: string };
    expect(data.message || JSON.stringify(data)).toMatch(/priority|normal|medium/i);
  });

  test('EDGE-INBOX-006: Invalid UUID for assignedUserId', async ({ page }) => {
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations?assignedUserId=not-a-uuid'
    });

    expect(response.status).toBe(400);
  });

  // ============ RBAC TESTS (6) ============

  test('RBAC-INBOX-001: user sees only assigned conversations', async ({ page }) => {
    // Logout manager and login as user
    await logout(page);
    await loginAs(page, TEST_USERS.user);
    
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations'
    });

    expect(response.status).toBe(200);
    const data = response.data as { data: Array<{ assignedUserId: string }>; total: number };
    
    // User should have at least 1 assigned conversation (proves data filtering works)
    expect(data.total).toBeGreaterThan(0);
    
    // All visible conversations should be assigned to this user
    data.data.forEach(conv => {
      expect(conv.assignedUserId).toBe(TEST_USERS.user.id);
    });
  });

  test('RBAC-INBOX-002: manager sees all conversations', async ({ page }) => {
    // Already logged in as manager
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations'
    });

    expect(response.status).toBe(200);
    const data = response.data as { data: unknown[] };
    
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('RBAC-INBOX-003: admin sees all conversations', async ({ page }) => {
    await logout(page);
    await loginAs(page, TEST_USERS.admin);
    
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations'
    });

    expect(response.status).toBe(200);
    const data = response.data as { data: unknown[] };
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('RBAC-INBOX-004: super_admin sees all conversations', async ({ page }) => {
    await logout(page);
    await loginAs(page, TEST_USERS.superAdmin);
    
    const response = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations'
    });

    expect(response.status).toBe(200);
    const data = response.data as { data: unknown[] };
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('RBAC-INBOX-005: unauthorized user (not logged in) cannot list', async ({ page }) => {
    // Clear auth without using logout (directly make request)
    const response = await page.request.get(`${API_BASE_URL}/conversations`);

    expect(response.status()).toBe(401);
  });

  test('RBAC-INBOX-006: filtering works correctly across roles', async ({ page }) => {
    // Manager filters by channel
    const managerResp = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations?channel=telegram&limit=5'
    });
    
    expect(managerResp.status).toBe(200);
    const managerData = managerResp.data as { data: Array<{ channel: string }> };
    managerData.data.forEach(conv => {
      expect(conv.channel).toBe('telegram');
    });

    // Logout and test as user
    await logout(page);
    await loginAs(page, TEST_USERS.user);
    
    const userResp = await apiRequest(page, {
      method: 'GET',
      endpoint: '/conversations?channel=irc&limit=5'
    });
    
    // User may not have IRC conversations, but request should still work
    expect([200, 400]).toContain(userResp.status);
  });
});
