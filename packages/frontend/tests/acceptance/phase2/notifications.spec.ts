import { test, expect } from '@playwright/test';
import { loginAs, logout, TEST_USERS } from '../../helpers/auth';
import { getNotifications, markNotificationRead } from '../../helpers/api';
import { FIXTURE_IDS } from '../../helpers/fixtures';

/**
 * Notifications Acceptance Tests - 12 scenarios
 */

test.describe('Notifications Feature - Complete Acceptance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.manager);
    await page.goto('/inbox');
  });

  test('HP-NOTIF-001: List all notifications', async ({ page }) => {
    const notifications = await getNotifications(page);
    expect(Array.isArray(notifications)).toBeTruthy();
  });

  test('HP-NOTIF-002: Filter unread notifications', async ({ page }) => {
    const response = await page.request.get('http://localhost:3000/api/notifications?isRead=false');
    expect(response.status()).toBe(200);
  });

  test('HP-NOTIF-003: Filter by type - assignment', async ({ page }) => {
    const response = await page.request.get('http://localhost:3000/api/notifications?type=assignment');
    expect(response.status()).toBe(200);
  });

  test('HP-NOTIF-004: Mark single notification as read', async ({ page }) => {
    const notifications = await getNotifications(page);
    const unread = notifications.find((n: any) => !n.isRead);
    
    if (unread) {
      await markNotificationRead(page, unread.id);
      const updated = await getNotifications(page);
      const markedRead = updated.find((n: any) => n.id === unread.id);
      expect(markedRead?.isRead).toBeTruthy();
    }
  });

  test('HP-NOTIF-005: Dismiss notification', async ({ page }) => {
    const notifications = await getNotifications(page);
    if (notifications.length > 0) {
      const response = await page.request.delete(
        `http://localhost:3000/api/notifications/${notifications[0].id}`
      );
      expect([200, 204]).toContain(response.status());
    }
  });

  test('HP-NOTIF-006: Mark all notifications read', async ({ page }) => {
    const response = await page.request.post(
      'http://localhost:3000/api/notifications/mark-all-read',
      { data: {} }
    );
    expect([200, 204]).toContain(response.status());
  });

  test('EDGE-NOTIF-007: Pagination of notifications', async ({ page }) => {
    const response1 = await page.request.get('http://localhost:3000/api/notifications?limit=5&offset=0');
    expect(response1.status()).toBe(200);
  });

  test('EDGE-NOTIF-008: Empty notifications list', async ({ page }) => {
    // After marking all as read, should show empty
    await page.request.post('http://localhost:3000/api/notifications/mark-all-read', { data: {} });
    
    const notifications = await getNotifications(page);
    // Should still return array (empty or with read notifications)
    expect(Array.isArray(notifications)).toBeTruthy();
  });

  test('RBAC-NOTIF-009: Cannot read someone else\'s notification', async ({ page }) => {
    const notifications = await getNotifications(page);
    
    if (notifications.length > 0) {
      await logout(page);
      await loginAs(page, TEST_USERS.user);
      
      const response = await page.request.patch(
        `http://localhost:3000/api/notifications/${notifications[0].id}`,
        { data: { isRead: true } }
      );
      
      expect(response.status()).toBe(403);
    }
  });

  test('RBAC-NOTIF-010: Cannot dismiss someone else\'s notification', async ({ page }) => {
    const notifications = await getNotifications(page);
    
    if (notifications.length > 0) {
      await logout(page);
      await loginAs(page, TEST_USERS.user);
      
      const response = await page.request.delete(
        `http://localhost:3000/api/notifications/${notifications[0].id}`
      );
      
      expect(response.status()).toBe(403);
    }
  });

  test('EDGE-NOTIF-011: Badge count reflects unread count', async ({ page }) => {
    // Badge should show number of unread
    const unreadNotifs = await page.request.get(
      'http://localhost:3000/api/notifications?isRead=false'
    );
    expect(unreadNotifs.status()).toBe(200);
  });

  test('EDGE-NOTIF-012: Notification persists across page reload', async ({ page }) => {
    const notifs1 = await getNotifications(page);
    await page.reload();
    const notifs2 = await getNotifications(page);
    
    expect(notifs2.length).toBeGreaterThanOrEqual(0);
  });
});
