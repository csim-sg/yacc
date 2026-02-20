/**
 * Routing Rules Tests
 * Tests for routing rules CRUD operations and rules engine evaluation
 */

import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { CreateRoutingRuleRequest } from '../types/routingRules.types.js';
import { dbClient } from '../infrastructure/db.client.js';
import { rulesEngineService } from '../services/rules-engine.service.js';
import { routingRulesService } from '../services/routing-rules.service.js';
import { conversations } from '../schemas/conversation.schema.js';
import { routingRuleExecutions } from '../schemas/routingRuleExecution.schema.js';
import { tags } from '../schemas/tag.schema.js';
import { users } from '../schemas/user.schema.js';

// Simple hash for testing (in real code, use better-auth/crypto)
const TEST_PASSWORD_HASH = '$2a$10$gS7c7JG.0GKGhZUZkYZu9uTDGjDqzH8s6HGkJKm0hI9G/xN.KVF2m';

// Test data
let testUserId: string;
let testConversationId: string;
let _testTagId: number;
let testRuleId: string;

describe('Routing Rules Service', () => {
  beforeAll(async () => {
    // Create test user directly in DB
    const userResult = await dbClient
      .insert(users)
      .values({
        id: 'test-user-' + Date.now(),
        email: 'routing-test-' + Date.now() + '@test.com',
        name: 'Test Admin',
        passwordHash: TEST_PASSWORD_HASH,
        role: 'admin',
        status: 'active',
      })
      .returning();
    testUserId = userResult[0].id;

    // Create test conversation
    const convResult = await dbClient
      .insert(conversations)
      .values({
        channel: 'telegram',
        externalThreadId: 'test-thread-' + Date.now(),
        status: 'open',
        priority: 'normal',
      })
      .returning();
    testConversationId = convResult[0].id;

    // Create test tag
     const tagResult = await dbClient
       .insert(tags)
       .values({
         name: 'urgent-' + Date.now(),
         color: '#FF0000',
         createdById: testUserId,
       })
       .returning();
     _testTagId = tagResult[0].id;
  });

  afterAll(async () => {
    // Cleanup (in reverse dependency order)
    // Delete routing rule executions first
    await dbClient
      .delete(routingRuleExecutions)
      .where(eq(routingRuleExecutions.conversationId, testConversationId));

    // Delete routing rules (which will cascade delete executions if needed)
    const routingRulesTable = await import('../schemas/routingRule.schema.js').then(m => m.routingRules);
    await dbClient
      .delete(routingRulesTable)
      .where(eq(routingRulesTable.createdById, testUserId));

    // Delete tags
    await dbClient
      .delete(tags)
      .where(eq(tags.createdById, testUserId));

    // Delete conversations
    await dbClient
      .delete(conversations)
      .where(eq(conversations.id, testConversationId));

    // Delete users
    await dbClient
      .delete(users)
      .where(eq(users.id, testUserId));
  });

  // CRUD Tests
  describe('CRUD Operations', () => {
    it('should create a rule with valid conditions and actions', async () => {
      const request: CreateRoutingRuleRequest = {
        name: 'High Priority Routing',
        description: 'Route urgent messages to admin',
        status: 'active',
        priority: 10,
        conditions: [
          { field: 'channel', operator: 'eq', value: 'telegram' },
          { field: 'keyword', operator: 'contains', value: 'urgent' },
        ],
        actions: [
          { type: 'priority', value: 'high' },
          { type: 'assign', value: testUserId },
        ],
      };

      const rule = await routingRulesService.createRule(testUserId, request);

      expect(rule).toBeDefined();
      expect(rule.name).toBe('High Priority Routing');
      expect(rule.status).toBe('active');
      expect(rule.priority).toBe(10);

      testRuleId = rule.id;
    });

    it('should reject rule creation with no conditions', async () => {
      const request: CreateRoutingRuleRequest = {
        name: 'Invalid Rule',
        status: 'active',
        priority: 10,
        conditions: [],
        actions: [{ type: 'priority', value: 'high' }],
      };

      try {
        await routingRulesService.createRule(testUserId, request);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should reject rule creation with invalid priority', async () => {
      const request: CreateRoutingRuleRequest = {
        name: 'Invalid Rule',
        status: 'active',
        priority: 10000,
        conditions: [{ field: 'channel', operator: 'eq', value: 'telegram' }],
        actions: [{ type: 'priority', value: 'high' }],
      };

      try {
        await routingRulesService.createRule(testUserId, request);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should reject rule with non-existent user reference in assign action', async () => {
      const request: CreateRoutingRuleRequest = {
        name: 'Invalid Rule',
        status: 'active',
        priority: 10,
        conditions: [{ field: 'channel', operator: 'eq', value: 'telegram' }],
        actions: [{ type: 'assign', value: 'non-existent-user' }],
      };

      try {
        await routingRulesService.createRule(testUserId, request);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should reject rule with invalid regex pattern', async () => {
      const request: CreateRoutingRuleRequest = {
        name: 'Invalid Rule',
        status: 'active',
        priority: 10,
        conditions: [{ field: 'keyword', operator: 'regex', value: '[invalid(' }],
        actions: [{ type: 'priority', value: 'high' }],
      };

      try {
        await routingRulesService.createRule(testUserId, request);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should reject rule with invalid priority action value', async () => {
      const request: CreateRoutingRuleRequest = {
        name: 'Invalid Rule',
        status: 'active',
        priority: 10,
        conditions: [{ field: 'channel', operator: 'eq', value: 'telegram' }],
        actions: [{ type: 'priority', value: 'critical' }],
      };

      try {
        await routingRulesService.createRule(testUserId, request);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should list all rules', async () => {
      const rules = await routingRulesService.listRules();

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should update rule priority', async () => {
      const updated = await routingRulesService.updateRule(testUserId, testRuleId, {
        priority: 50,
      });

      expect(updated.priority).toBe(50);
    });

    it('should update rule status', async () => {
      const updated = await routingRulesService.updateRule(testUserId, testRuleId, {
        status: 'disabled',
      });

      expect(updated.status).toBe('disabled');
    });

     it('should update rule conditions', async () => {
       const newConditions: CreateRoutingRuleRequest['conditions'] = [
         { field: 'channel', operator: 'eq', value: 'irc' },
       ];

       const updated = await routingRulesService.updateRule(testUserId, testRuleId, {
         conditions: newConditions,
       });

       expect(updated.conditions).toBeDefined();
     });

    it('should reject update with invalid conditions', async () => {
      try {
        await routingRulesService.updateRule(testUserId, testRuleId, {
          conditions: [],
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should delete a rule', async () => {
      const result = await routingRulesService.deleteRule(testUserId, testRuleId);

      expect(result.success).toBe(true);

      // Verify rule is deleted
      try {
        await routingRulesService.getRule(testRuleId);
        expect.fail('Rule should have been deleted');
      } catch {
        // Expected
      }
    });

    it('should reject delete of non-existent rule', async () => {
      try {
        await routingRulesService.deleteRule(testUserId, 'non-existent-rule');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  // Execution Query Tests
  describe('Rule Execution Queries', () => {
    beforeAll(async () => {
      // Create a rule for execution testing
      const request: CreateRoutingRuleRequest = {
        name: 'Test Execution Rule',
        status: 'active',
        priority: 100,
        conditions: [{ field: 'channel', operator: 'eq', value: 'telegram' }],
        actions: [{ type: 'priority', value: 'high' }],
      };

      const rule = await routingRulesService.createRule(testUserId, request);
      testRuleId = rule.id;
    });

    it('should return paginated rule executions', async () => {
      const result = await routingRulesService.getRuleExecutions(testRuleId, 1, 50);

      expect(result).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
      expect(typeof result.total).toBe('number');
      expect(Array.isArray(result.executions)).toBe(true);
    });

    it('should limit page size to 100', async () => {
      const result = await routingRulesService.getRuleExecutions(testRuleId, 1, 500);

      expect(result.pageSize).toBeLessThanOrEqual(100);
    });

    it('should enforce minimum page size of 1', async () => {
      const result = await routingRulesService.getRuleExecutions(testRuleId, 1, 0);

      expect(result.pageSize).toBe(1);
    });
  });
});

describe('Rules Engine Service', () => {
  let testUserId: string;
  let testConversationId: string;
  let ruleId: string;

  beforeAll(async () => {
    // Create test user
    const userResult = await dbClient
      .insert(users)
      .values({
        id: 'engine-test-user-' + Date.now(),
        email: 'engine-test-' + Date.now() + '@test.com',
        name: 'Engine Test Admin',
        passwordHash: TEST_PASSWORD_HASH,
        role: 'admin',
        status: 'active',
      })
      .returning();
    testUserId = userResult[0].id;

    // Create test conversation
    const convResult = await dbClient
      .insert(conversations)
      .values({
        channel: 'telegram',
        externalThreadId: 'engine-test-thread-' + Date.now(),
        status: 'open',
        priority: 'normal',
      })
      .returning();
    testConversationId = convResult[0].id;

    // Create a test rule
    const request: CreateRoutingRuleRequest = {
      name: 'Engine Test Rule',
      status: 'active',
      priority: 10,
      conditions: [
        { field: 'channel', operator: 'eq', value: 'telegram' },
        { field: 'keyword', operator: 'contains', value: 'urgent' },
      ],
      actions: [{ type: 'priority', value: 'high' }],
    };

    const rule = await routingRulesService.createRule(testUserId, request);
    ruleId = rule.id;
  });

  afterAll(async () => {
    // Cleanup (in reverse dependency order)
    // Delete routing rule executions first
    await dbClient
      .delete(routingRuleExecutions)
      .where(eq(routingRuleExecutions.conversationId, testConversationId));

    // Delete routing rules (which will cascade delete executions if needed)
    const routingRulesTable = await import('../schemas/routingRule.schema.js').then(m => m.routingRules);
    await dbClient
      .delete(routingRulesTable)
      .where(eq(routingRulesTable.createdById, testUserId));

    // Delete conversations
    await dbClient
      .delete(conversations)
      .where(eq(conversations.id, testConversationId));

    // Delete users
    await dbClient
      .delete(users)
      .where(eq(users.id, testUserId));
  });

  describe('Rule Evaluation', () => {
    it('should match rule when all conditions are met', async () => {
      const result = await rulesEngineService.evaluateRulesForMessage(
        {
          conversationId: testConversationId,
          messageId: 'test-msg-1',
          channel: 'telegram',
          body: 'This is urgent',
          senderEmail: 'sender@example.com',
        },
        testUserId
      );

      expect(result).toBeDefined();
      expect(result?.ruleId).toBe(ruleId);
    });

    it('should not match when one condition fails', async () => {
      const result = await rulesEngineService.evaluateRulesForMessage(
        {
          conversationId: testConversationId,
          messageId: 'test-msg-2',
          channel: 'irc',
          body: 'This is urgent',
          senderEmail: 'sender@example.com',
        },
        testUserId
      );

      expect(result).toBeUndefined();
    });

    it('should handle keyword contains condition (case-insensitive)', async () => {
      const result = await rulesEngineService.evaluateRulesForMessage(
        {
          conversationId: testConversationId,
          messageId: 'test-msg-3',
          channel: 'telegram',
          body: 'Very URGENT situation',
          senderEmail: 'sender@example.com',
        },
        testUserId
      );

      expect(result).toBeDefined();
      expect(result?.ruleId).toBe(ruleId);
    });

    it('should return undefined when no rules match', async () => {
      // Use a unique channel that won't match any rules
      const result = await rulesEngineService.evaluateRulesForMessage(
        {
          conversationId: testConversationId,
          messageId: 'test-msg-4',
          channel: 'non-existent-channel-' + Date.now(),
          body: 'This is not important',
          senderEmail: 'sender@example.com',
        },
        testUserId
      );

      expect(result).toBeUndefined();
    });

    it('should handle regex matching', async () => {
      // Create a regex rule
      const request: CreateRoutingRuleRequest = {
        name: 'Regex Test Rule',
        status: 'active',
        priority: 20,
        conditions: [
          { field: 'keyword', operator: 'regex', value: '\\b(urgent|critical)\\b' },
        ],
        actions: [{ type: 'priority', value: 'urgent' }],
      };

      const rule = await routingRulesService.createRule(testUserId, request);

      const result = await rulesEngineService.evaluateRulesForMessage(
        {
          conversationId: testConversationId,
          messageId: 'test-msg-5',
          channel: 'telegram',
          body: 'This is critical',
          senderEmail: 'sender@example.com',
        },
        testUserId
      );

      expect(result).toBeDefined();

      // Cleanup
      await routingRulesService.deleteRule(testUserId, rule.id);
    });

    it('should apply priority action', async () => {
      // Verify conversation priority before
      const convBefore = await dbClient.query.conversations.findFirst({
        where: eq(conversations.id, testConversationId),
      });

      expect(convBefore?.priority).not.toBe('high');

      // Evaluate rule
      await rulesEngineService.evaluateRulesForMessage(
        {
          conversationId: testConversationId,
          messageId: 'test-msg-6',
          channel: 'telegram',
          body: 'urgent message',
          senderEmail: 'sender@example.com',
        },
        testUserId
      );

      // Verify priority was updated
      const convAfter = await dbClient.query.conversations.findFirst({
        where: eq(conversations.id, testConversationId),
      });

      expect(convAfter?.priority).toBe('high');
    });

    it('should handle first-match-wins strategy', async () => {
      // Create two rules with different priorities
      const rule1: CreateRoutingRuleRequest = {
        name: 'First Rule (lower priority)',
        status: 'active',
        priority: 5,
        conditions: [{ field: 'channel', operator: 'eq', value: 'telegram' }],
        actions: [{ type: 'priority', value: 'urgent' }],
      };

      const rule2: CreateRoutingRuleRequest = {
        name: 'Second Rule (higher priority)',
        status: 'active',
        priority: 10,
        conditions: [{ field: 'channel', operator: 'eq', value: 'telegram' }],
        actions: [{ type: 'priority', value: 'low' }],
      };

      const createdRule1 = await routingRulesService.createRule(testUserId, rule1);
      const createdRule2 = await routingRulesService.createRule(testUserId, rule2);

      const result = await rulesEngineService.evaluateRulesForMessage(
        {
          conversationId: testConversationId,
          messageId: 'test-msg-7',
          channel: 'telegram',
          body: 'test message',
          senderEmail: 'sender@example.com',
        },
        testUserId
      );

      // Should match the first rule (lower priority number = higher priority)
      expect(result?.ruleId).toBe(createdRule1.id);

      // Cleanup
      await routingRulesService.deleteRule(testUserId, createdRule1.id);
      await routingRulesService.deleteRule(testUserId, createdRule2.id);
    });
  });
});
