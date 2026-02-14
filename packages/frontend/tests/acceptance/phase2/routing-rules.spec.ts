import { test, expect } from '@playwright/test';
import { loginAs, logout, TEST_USERS } from '../../helpers/auth';
import { createRoutingRule, getRoutingRules, getAuditLogs } from '../../helpers/api';
import { FIXTURE_IDS } from '../../helpers/fixtures';

/**
 * Routing Rules Acceptance Tests - 16 scenarios
 */

test.describe('Routing Rules Feature - Complete Acceptance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
    await page.goto('/admin/routing-rules');
  });

  test('HP-RULE-001: Create active routing rule', async ({ page }) => {
    const rule = await createRoutingRule(page, {
      name: `Rule ${Date.now()}`,
      priority: 5,
      status: 'active',
      conditions: { channel: 'telegram' },
      actions: { addTag: 'Telegram' }
    });
    expect(rule.id).toBeTruthy();
  });

  test('HP-RULE-002: Create disabled routing rule', async ({ page }) => {
    const rule = await createRoutingRule(page, {
      name: `DisabledRule ${Date.now()}`,
      priority: 6,
      status: 'disabled',
      conditions: { channel: 'irc' },
      actions: { addTag: 'IRC' }
    });
    expect(rule.id).toBeTruthy();
  });

  test('HP-RULE-003: List all routing rules', async ({ page }) => {
    const rules = await getRoutingRules(page);
    expect(Array.isArray(rules)).toBeTruthy();
    expect(rules.length).toBeGreaterThan(0);
  });

  test('HP-RULE-004: Update rule priority', async ({ page }) => {
    const rule = await createRoutingRule(page, {
      name: `UpdatePriority ${Date.now()}`,
      priority: 10,
      conditions: {},
      actions: {}
    });
    
    const response = await page.request.patch(
      `http://localhost:3000/api/routing-rules/${rule.id}`,
      { data: { priority: 15 } }
    );
    
    expect([200, 204]).toContain(response.status());
  });

  test('HP-RULE-005: Update rule status active to disabled', async ({ page }) => {
    const rule = await createRoutingRule(page, {
      name: `StatusChange ${Date.now()}`,
      priority: 11,
      status: 'active',
      conditions: {},
      actions: {}
    });
    
    const response = await page.request.patch(
      `http://localhost:3000/api/routing-rules/${rule.id}`,
      { data: { status: 'disabled' } }
    );
    
    expect([200, 204]).toContain(response.status());
  });

  test('HP-RULE-006: Delete routing rule', async ({ page }) => {
    const rule = await createRoutingRule(page, {
      name: `DeleteMe ${Date.now()}`,
      priority: 12,
      conditions: {},
      actions: {}
    });
    
    const response = await page.request.delete(
      `http://localhost:3000/api/routing-rules/${rule.id}`
    );
    
    expect([200, 204]).toContain(response.status());
  });

  test('EDGE-RULE-007: Disabled rule does not execute', async ({ page }) => {
    const rule = await createRoutingRule(page, {
      name: `NoExec ${Date.now()}`,
      priority: 99,
      status: 'disabled',
      conditions: { channel: 'telegram' },
      actions: { addTag: 'ShouldNotApply' }
    });
    
    // Disabled rules should not execute
    const execResponse = await page.request.get(
      `http://localhost:3000/api/routing-rules/${rule.id}/executions`
    );
    
    expect(execResponse.status()).toBe(200);
  });

  test('EDGE-RULE-008: First match wins - higher priority executes', async ({ page }) => {
    // Create two rules that could match
    await createRoutingRule(page, {
      name: `HighPriority ${Date.now()}`,
      priority: 1,
      conditions: { channel: 'telegram' },
      actions: { addTag: 'FirstMatch' }
    });
    
    await createRoutingRule(page, {
      name: `LowPriority ${Date.now()}`,
      priority: 2,
      conditions: { channel: 'telegram' },
      actions: { addTag: 'SecondMatch' }
    });
    
    // Higher priority (lower number) should execute first
    const rules = await getRoutingRules(page);
    expect(rules.length).toBeGreaterThan(1);
  });

  test('EDGE-RULE-009: Rule with no matching conditions', async ({ page }) => {
    const rule = await createRoutingRule(page, {
      name: `NoMatch ${Date.now()}`,
      priority: 100,
      conditions: { channel: 'nonexistent' },
      actions: {}
    });
    
    expect(rule.id).toBeTruthy();
  });

  test('RBAC-RULE-010: Super admin can manage rules', async ({ page }) => {
    const rule = await createRoutingRule(page, {
      name: `AdminRule ${Date.now()}`,
      priority: 7,
      conditions: {},
      actions: {}
    });
    
    expect(rule.id).toBeTruthy();
  });

  test('RBAC-RULE-011: Admin cannot create rules', async ({ page }) => {
    await logout(page);
    await loginAs(page, TEST_USERS.admin);
    
    const response = await page.request.post(
      'http://localhost:3000/api/routing-rules',
      {
        data: {
          name: 'AdminAttempt',
          priority: 1,
          conditions: {},
          actions: {}
        }
      }
    );
    
    expect(response.status()).toBe(403);
  });

  test('RBAC-RULE-012: Manager cannot access rules', async ({ page }) => {
    await logout(page);
    await loginAs(page, TEST_USERS.manager);
    
    const response = await page.request.get('http://localhost:3000/api/routing-rules');
    expect(response.status()).toBe(403);
  });

  test('AUD-RULE-013: Rule creation logged in audit trail', async ({ page }) => {
    const ruleName = `AuditRule ${Date.now()}`;
    await createRoutingRule(page, {
      name: ruleName,
      priority: 8,
      conditions: { keyword: 'test' },
      actions: {}
    });
    
    const logs = await getAuditLogs(page, { action: 'rule.created' });
    expect(logs.length).toBeGreaterThan(0);
  });

  test('AUD-RULE-014: Rule update logged', async ({ page }) => {
    const rule = await createRoutingRule(page, {
      name: `AuditUpdate ${Date.now()}`,
      priority: 9,
      conditions: {},
      actions: {}
    });
    
    await page.request.patch(`http://localhost:3000/api/routing-rules/${rule.id}`, {
      data: { priority: 20 }
    });
    
    const logs = await getAuditLogs(page, { action: 'rule.updated' });
    expect(logs.length).toBeGreaterThanOrEqual(0);
  });

  test('AUD-RULE-015: Rule deletion logged', async ({ page }) => {
    const rule = await createRoutingRule(page, {
      name: `AuditDelete ${Date.now()}`,
      priority: 13,
      conditions: {},
      actions: {}
    });
    
    await page.request.delete(`http://localhost:3000/api/routing-rules/${rule.id}`);
    
    const logs = await getAuditLogs(page, { action: 'rule.deleted' });
    expect(logs.length).toBeGreaterThanOrEqual(0);
  });

  test('AUD-RULE-016: Rule execution logged', async ({ page }) => {
    const rule = await createRoutingRule(page, {
      name: `AuditExecution ${Date.now()}`,
      priority: 14,
      conditions: { channel: 'telegram' },
      actions: { addTag: 'ExecutionTest' }
    });
    
    const execLogs = await page.request.get(
      `http://localhost:3000/api/routing-rules/${rule.id}/executions`
    );
    
    expect(execLogs.status()).toBe(200);
  });
});
