import { test, expect } from '@playwright/test';
import { loginAs, logout, TEST_USERS } from '../../helpers/auth';
import { createTag, getTags, applyTag, removeTag, getConversations, getConversation, getAuditLogs } from '../../helpers/api';
import { SELECTORS } from '../../helpers/selectors';
import { FIXTURE_IDS } from '../../helpers/fixtures';

/**
 * Tags Acceptance Tests - 12 scenarios
 * HP: Happy Path (primary workflow)
 * EDGE: Edge Cases (boundaries, idempotency, empty states)
 * RBAC: Role-Based Access Control
 * AUD: Audit Logging
 */

test.describe('Tags Feature - Complete Acceptance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
    await page.goto('/inbox');
  });

  // Happy Path Tests (4)
  test('HP-TAG-001: Create tag with valid name and color', async ({ page }) => {
    const tagName = `HPTag-${Date.now()}`;
    const tag = await createTag(page, { name: tagName, color: '#FF5733' });
    expect(tag.id).toBeTruthy();
    expect(tag.name).toBe(tagName);
    expect(tag.color).toBe('#FF5733');
  });

  test('HP-TAG-002: List all tags', async ({ page }) => {
    const tags = await getTags(page);
    expect(Array.isArray(tags)).toBeTruthy();
    expect(tags.length).toBeGreaterThan(0);
  });

  test('HP-TAG-003: Apply tag to conversation', async ({ page }) => {
    const tags = await getTags(page);
    const testTag = tags[0];
    const conversation = await getConversation(page, FIXTURE_IDS.conversations.telegram);
    
    await applyTag(page, conversation.id, testTag.id);
    const updated = await getConversation(page, conversation.id);
    expect(updated.tags).toContain(testTag.id);
  });

  test('HP-TAG-004: Remove tag from conversation', async ({ page }) => {
    const tags = await getTags(page);
    const testTag = tags[0];
    const conversation = await getConversation(page, FIXTURE_IDS.conversations.irc);
    
    await applyTag(page, conversation.id, testTag.id);
    await removeTag(page, conversation.id, testTag.id);
    
    const updated = await getConversation(page, conversation.id);
    const tagIds = updated.tags || [];
    expect(!tagIds.includes(testTag.id) || tagIds.length === 0).toBeTruthy();
  });

  // Edge Case Tests (4)
  test('EDGE-TAG-005: Duplicate tag name validation', async ({ page }) => {
    const tagName = `DupTag-${Date.now()}`;
    await createTag(page, { name: tagName, color: '#000000' });
    
    const response = await page.request.post('http://localhost:3000/api/tags', {
      data: { name: tagName, color: '#FFFFFF' }
    });
    expect([400, 409]).toContain(response.status());
  });

  test('EDGE-TAG-006: Apply tag idempotent - applying same tag twice', async ({ page }) => {
    const tags = await getTags(page);
    const testTag = tags[0];
    const conversation = await getConversation(page, FIXTURE_IDS.conversations.telegram);
    
    await applyTag(page, conversation.id, testTag.id);
    await applyTag(page, conversation.id, testTag.id);
    
    const updated = await getConversation(page, conversation.id);
    const count = (updated.tags || []).filter((id: string) => id === testTag.id).length;
    expect(count).toBe(1); // Should only appear once
  });

  test('EDGE-TAG-007: Remove tag not present returns 200', async ({ page }) => {
    const tags = await getTags(page);
    const testTag = tags[tags.length - 1];
    const conversation = await getConversation(page, FIXTURE_IDS.conversations.irc);
    
    const response = await page.request.delete(
      `http://localhost:3000/api/conversations/${conversation.id}/tags/${testTag.id}`
    );
    expect([200, 204]).toContain(response.status());
  });

  test('EDGE-TAG-008: Filter conversations by tag returns only tagged', async ({ page }) => {
    const tags = await getTags(page);
    const testTag = tags[0];
    const conversation = await getConversation(page, FIXTURE_IDS.conversations.telegram);
    
    await applyTag(page, conversation.id, testTag.id);
    const filtered = await getConversations(page, { tag: testTag.id });
    
    const found = filtered.some((c: any) => c.id === conversation.id);
    expect(found).toBeTruthy();
  });

  // RBAC Tests (3)
  test('RBAC-TAG-009: User cannot create tag', async ({ page }) => {
    await logout(page);
    await loginAs(page, TEST_USERS.user);
    
    const response = await page.request.post('http://localhost:3000/api/tags', {
      data: { name: `UserTag-${Date.now()}`, color: '#FF0000' }
    });
    expect(response.status()).toBe(403);
  });

  test('RBAC-TAG-010: User cannot apply tag to unassigned conversation', async ({ page }) => {
    const tags = await getTags(page);
    const testTag = tags[0];
    
    await logout(page);
    await loginAs(page, TEST_USERS.user);
    
    // User tries to apply tag to conversation they're not assigned to
    const response = await page.request.post(
      `http://localhost:3000/api/conversations/${FIXTURE_IDS.conversations.irc}/tags`,
      { data: { tagId: testTag.id } }
    );
    expect(response.status()).toBe(403);
  });

  test('RBAC-TAG-011: Super admin can always apply/remove tags', async ({ page }) => {
    const tags = await getTags(page);
    const testTag = tags[0];
    const conversation = await getConversation(page, FIXTURE_IDS.conversations.irc);
    
    await applyTag(page, conversation.id, testTag.id);
    const updated = await getConversation(page, conversation.id);
    expect(updated.tags).toContain(testTag.id);
  });

  // Audit Test (1)
  test('AUD-TAG-012: Tag operations logged in audit trail', async ({ page }) => {
    const tagName = `AuditTag-${Date.now()}`;
    await createTag(page, { name: tagName, color: '#00FF00' });
    
    const logs = await getAuditLogs(page, { action: 'tag.created' });
    const createdLog = logs.find((l: any) => l.metadata?.tagName === tagName);
    
    expect(createdLog).toBeTruthy();
    expect(createdLog?.actorId).toBe(FIXTURE_IDS.users.superAdmin);
  });
});
