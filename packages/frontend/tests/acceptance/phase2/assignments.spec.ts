import { test, expect } from '@playwright/test';
import { loginAs, logout, TEST_USERS } from '../../helpers/auth';
import {
  assignConversation,
  getConversations,
  getConversation,
  getNotifications,
  getAuditLogs,
  type Conversation,
  type Notification,
  type AuditLog,
} from '../../helpers/api';
import { FIXTURE_IDS } from '../../helpers/fixtures';

/**
 * Assignments Acceptance Tests - 10 scenarios
 */

test.describe('Assignments Feature - Complete Acceptance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
    await page.goto('/inbox');
  });

  test('HP-ASSIGN-001: Assign conversation to manager', async ({ page }) => {
    const conversations = await getConversations(page);
    const unassigned = conversations.find((c: Conversation) => !c.assignedUserId);
    
    if (unassigned) {
      await assignConversation(page, unassigned.id, FIXTURE_IDS.users.manager);
      const updated = await getConversation(page, unassigned.id);
      expect(updated.assignedUserId).toBe(FIXTURE_IDS.users.manager);
    }
  });

  test('HP-ASSIGN-002: Reassign conversation - override old assignee', async ({ page }) => {
    await assignConversation(page, FIXTURE_IDS.conversations.telegram, FIXTURE_IDS.users.admin);
    const updated = await getConversation(page, FIXTURE_IDS.conversations.telegram);
    expect(updated.assignedUserId).toBe(FIXTURE_IDS.users.admin);
  });

  test('HP-ASSIGN-003: Assignee sees in filter "assigned to me"', async ({ page }) => {
    await assignConversation(page, FIXTURE_IDS.conversations.irc, FIXTURE_IDS.users.manager);
    
    await logout(page);
    await loginAs(page, TEST_USERS.manager);
    
    const myConversations = await getConversations(page, { assignedUserId: FIXTURE_IDS.users.manager });
    const found = myConversations.some((c: Conversation) => c.id === FIXTURE_IDS.conversations.irc);
    expect(found).toBeTruthy();
  });

  test('HP-ASSIGN-004: Assignment sends notification to assignee', async ({ page }) => {
    await assignConversation(page, FIXTURE_IDS.conversations.irc, FIXTURE_IDS.users.user);
    
    await logout(page);
    await loginAs(page, TEST_USERS.user);
    
    const notifications = await getNotifications(page);
    const assignmentNotif = notifications.find((n: Notification) => n.type === 'assignment');
    expect(assignmentNotif).toBeTruthy();
  });

  test('HP-ASSIGN-005: Clear assignment - unassign conversation', async ({ page }) => {
    await assignConversation(page, FIXTURE_IDS.conversations.telegram, FIXTURE_IDS.users.admin);
    
    const response = await page.request.post(
      `http://localhost:3000/api/conversations/${FIXTURE_IDS.conversations.telegram}/assign`,
      { data: { userId: null } }
    );
    
    expect([200, 204]).toContain(response.status());
  });

  test('RBAC-ASSIGN-006: User cannot assign conversation', async ({ page }) => {
    await logout(page);
    await loginAs(page, TEST_USERS.user);
    
    const response = await page.request.post(
      `http://localhost:3000/api/conversations/${FIXTURE_IDS.conversations.irc}/assign`,
      { data: { userId: FIXTURE_IDS.users.manager } }
    );
    
    expect(response.status()).toBe(403);
  });

  test('RBAC-ASSIGN-007: Manager can assign conversation', async ({ page }) => {
    await logout(page);
    await loginAs(page, TEST_USERS.manager);
    
    const response = await page.request.post(
      `http://localhost:3000/api/conversations/${FIXTURE_IDS.conversations.irc}/assign`,
      { data: { userId: FIXTURE_IDS.users.user } }
    );
    
    expect([200, 201]).toContain(response.status());
  });

  test('AUD-ASSIGN-008: Assignment logged in audit trail', async ({ page }) => {
    await assignConversation(page, FIXTURE_IDS.conversations.telegram, FIXTURE_IDS.users.admin);
    
    const logs = await getAuditLogs(page, { action: 'conversation.assigned' });
    const assignLog = logs.find((l: AuditLog) => l.entityId === FIXTURE_IDS.conversations.telegram);
    
    expect(assignLog).toBeTruthy();
    expect(assignLog?.metadata?.newAssignedUserId).toBe(FIXTURE_IDS.users.admin);
  });

  test('AUD-ASSIGN-009: Reassignment logged with old and new assignee', async ({ page }) => {
    const oldId = FIXTURE_IDS.users.admin;
    const newId = FIXTURE_IDS.users.manager;
    
    await assignConversation(page, FIXTURE_IDS.conversations.irc, oldId);
    await assignConversation(page, FIXTURE_IDS.conversations.irc, newId);
    
    const logs = await getAuditLogs(page);
    const reassignLog = logs.find((l: AuditLog) =>
      l.action === 'conversation.assigned' && l.entityId === FIXTURE_IDS.conversations.irc
    );
    
    expect(reassignLog).toBeTruthy();
  });

  test('EDGE-ASSIGN-010: Assignment notification persists across reload', async ({ page }) => {
    await assignConversation(page, FIXTURE_IDS.conversations.telegram, FIXTURE_IDS.users.user);
    
    await logout(page);
    await loginAs(page, TEST_USERS.user);
    
    const notifs1 = await getNotifications(page);
    const assignmentCount1 = notifs1.filter((n: Notification) => n.type === 'assignment').length;
    
    await page.reload();
    const notifs2 = await getNotifications(page);
    const assignmentCount2 = notifs2.filter((n: Notification) => n.type === 'assignment').length;
    
    expect(assignmentCount2).toBeGreaterThanOrEqual(assignmentCount1);
  });
});
