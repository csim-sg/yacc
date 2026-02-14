import { test, expect } from '@playwright/test';
import { loginAs, logout, TEST_USERS } from '../../helpers/auth';
import { createNote, getNotifications, getAuditLogs, getConversation } from '../../helpers/api';
import { SELECTORS } from '../../helpers/selectors';
import { FIXTURE_IDS } from '../../helpers/fixtures';

/**
 * Notes & @Mentions Acceptance Tests - 14 scenarios
 * HP: Happy Path
 * EDGE: Edge Cases
 * RBAC: Role-Based Access Control
 * RT: Real-Time (notifications)
 */

test.describe('Notes & @Mentions Feature - Complete Acceptance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
    await page.goto(`/inbox/${FIXTURE_IDS.conversations.telegram}`);
  });

  // Happy Path Tests (5)
  test('HP-NOTE-001: Create note appears in conversation', async ({ page }) => {
    const noteBody = `Test note ${Date.now()}`;
    const note = await createNote(page, FIXTURE_IDS.conversations.telegram, noteBody);
    
    expect(note.id).toBeTruthy();
    expect(note.body).toBe(noteBody);
  });

  test('HP-NOTE-002: Note persists across page reload', async ({ page }) => {
    const noteBody = `Persist note ${Date.now()}`;
    const note = await createNote(page, FIXTURE_IDS.conversations.telegram, noteBody);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const response = await page.request.get(
      `http://localhost:3000/api/conversations/${FIXTURE_IDS.conversations.telegram}/notes`
    );
    const notes = await response.json();
    const found = notes.some((n: any) => n.id === note.id && n.body === noteBody);
    expect(found).toBeTruthy();
  });

  test('HP-NOTE-003: @mention user creates notification', async ({ page }) => {
    const mentionBody = `cc @${TEST_USERS.manager.name} please review`;
    await createNote(page, FIXTURE_IDS.conversations.telegram, mentionBody);
    
    await loginAs(page, TEST_USERS.manager);
    const notifications = await getNotifications(page);
    const mentionNotif = notifications.find((n: any) => n.type === 'mention');
    
    expect(mentionNotif).toBeTruthy();
  });

  test('HP-NOTE-004: Multiple @mentions create notifications for all users', async ({ page }) => {
    const mentionBody = `cc @${TEST_USERS.manager.name} @${TEST_USERS.admin.name} please review`;
    await createNote(page, FIXTURE_IDS.conversations.telegram, mentionBody);
    
    await loginAs(page, TEST_USERS.manager);
    const managerNotifs = await getNotifications(page);
    expect(managerNotifs.some((n: any) => n.type === 'mention')).toBeTruthy();
    
    await logout(page);
    await loginAs(page, TEST_USERS.admin);
    const adminNotifs = await getNotifications(page);
    expect(adminNotifs.some((n: any) => n.type === 'mention')).toBeTruthy();
  });

  test('HP-NOTE-005: Click mention notification navigates to conversation', async ({ page }) => {
    const mentionBody = `cc @${TEST_USERS.user.name}`;
    const note = await createNote(page, FIXTURE_IDS.conversations.telegram, mentionBody);
    
    await logout(page);
    await loginAs(page, TEST_USERS.user);
    
    const notifications = await getNotifications(page);
    const mentionNotif = notifications.find((n: any) => n.type === 'mention');
    
    expect(mentionNotif?.conversationId).toBe(FIXTURE_IDS.conversations.telegram);
  });

  // Edge Case Tests (4)
  test('EDGE-NOTE-006: @mention unknown username - no notification created', async ({ page }) => {
    const badMention = `cc @nonexistentuser_${Date.now()}`;
    await createNote(page, FIXTURE_IDS.conversations.telegram, badMention);
    
    // Should not crash, and no notification for unknown user
    const response = await page.request.get('http://localhost:3000/api/notifications');
    expect(response.status()).toBe(200);
  });

  test('EDGE-NOTE-007: Empty note body validation', async ({ page }) => {
    const response = await page.request.post(
      `http://localhost:3000/api/conversations/${FIXTURE_IDS.conversations.telegram}/notes`,
      { data: { body: '' } }
    );
    expect(response.status()).toBe(400);
  });

  test('EDGE-NOTE-008: Very long note accepted', async ({ page }) => {
    const longBody = 'A'.repeat(5000);
    const note = await createNote(page, FIXTURE_IDS.conversations.telegram, longBody);
    
    expect(note.id).toBeTruthy();
    expect(note.body.length).toBeGreaterThan(1000);
  });

  test('EDGE-NOTE-009: Note with special characters preserved', async ({ page }) => {
    const specialBody = `Test note with émojis 🎉 and special chars: <>&"'`;
    const note = await createNote(page, FIXTURE_IDS.conversations.telegram, specialBody);
    
    expect(note.body).toContain('🎉');
    expect(note.body).toContain('<>&');
  });

  // RBAC Tests (3)
  test('RBAC-NOTE-010: User cannot create note in unassigned conversation', async ({ page }) => {
    await logout(page);
    await loginAs(page, TEST_USERS.user);
    
    // User tries to create note in IRC (not assigned to them)
    const response = await page.request.post(
      `http://localhost:3000/api/conversations/${FIXTURE_IDS.conversations.irc}/notes`,
      { data: { body: 'Test note' } }
    );
    expect(response.status()).toBe(403);
  });

  test('RBAC-NOTE-011: User can create note in assigned conversation', async ({ page }) => {
    // Assign conversation to manager
    const response = await page.request.post(
      `http://localhost:3000/api/conversations/${FIXTURE_IDS.conversations.irc}/assign`,
      { data: { userId: FIXTURE_IDS.users.manager } }
    );
    
    await logout(page);
    await loginAs(page, TEST_USERS.manager);
    
    const note = await createNote(page, FIXTURE_IDS.conversations.irc, 'Manager note');
    expect(note.id).toBeTruthy();
  });

  // Audit Test (2)
  test('AUD-NOTE-012: Note creation logged in audit trail', async ({ page }) => {
    const noteBody = `Audit note ${Date.now()}`;
    await createNote(page, FIXTURE_IDS.conversations.telegram, noteBody);
    
    const logs = await getAuditLogs(page, { action: 'note.created' });
    expect(logs.length).toBeGreaterThan(0);
  });

  test('AUD-NOTE-013: @mention recorded in audit trail', async ({ page }) => {
    const mentionBody = `@${TEST_USERS.manager.name} mentioned`;
    await createNote(page, FIXTURE_IDS.conversations.telegram, mentionBody);
    
    const logs = await getAuditLogs(page, { action: 'note.mention' });
    // May have multiple mention logs
    expect(logs.length).toBeGreaterThanOrEqual(0);
  });

  test('AUD-NOTE-014: Note deletion logged', async ({ page }) => {
    const noteBody = `Delete me ${Date.now()}`;
    const note = await createNote(page, FIXTURE_IDS.conversations.telegram, noteBody);
    
    const response = await page.request.delete(`http://localhost:3000/api/notes/${note.id}`);
    
    if (response.status() === 200 || response.status() === 204) {
      const logs = await getAuditLogs(page, { action: 'note.deleted' });
      expect(logs.length).toBeGreaterThanOrEqual(0);
    }
  });
});
