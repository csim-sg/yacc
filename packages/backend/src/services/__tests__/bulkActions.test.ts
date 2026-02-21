/**
 * Bulk Actions Service Tests
 *
 * Tests for bulk assign, bulk tag, and bulk status update operations
 * Covers:
 * - Valid operations
 * - Partial failures (some conversations not found)
 * - Input validation (max 100, empty array, invalid IDs)
 * - Audit logging
 * - Error handling
 */

import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { dbClient } from '../../infrastructure/db.client';
import { conversations } from '../../schemas/conversation.schema';
import type { Conversation } from '../../schemas/conversation.schema';
import { conversationTags } from '../../schemas/conversationTag.schema';
import { tags } from '../../schemas/tag.schema';
import { users } from '../../schemas/user.schema';
import { auditService } from '../../services/audit.service';
import {
  bulkAssign,
  bulkTag,
  bulkUpdateStatus,
} from '../../services/bulkActions.service';

// Mock audit service
vi.mock('../../services/audit.service', () => ({
  auditService: {
    logAction: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Bulk Actions Service', () => {
  let testConversations: Conversation[];
  let testTag: typeof tags.$inferSelect;
  let testUserId: string;
  let testUser2Id: string;

  beforeEach(async () => {
    // Create test users first (required for FK constraints on tags.createdById)
    testUserId = 'test-user-' + Math.random().toString(36).slice(2, 9);
    testUser2Id = 'test-user-' + Math.random().toString(36).slice(2, 9);

    // Insert test users
    await dbClient
      .insert(users)
      .values([
        {
          id: testUserId,
          email: `test-${testUserId}@example.com`,
          name: 'Test User 1',
          passwordHash: 'hashed',
          emailVerified: true,
        },
        {
          id: testUser2Id,
          email: `test-${testUser2Id}@example.com`,
          name: 'Test User 2',
          passwordHash: 'hashed',
          emailVerified: true,
        },
      ])
      .onConflictDoNothing();

    // Create test conversations
    const convResults = await dbClient
      .insert(conversations)
      .values([
        {
          channel: 'telegram',
          externalThreadId: `bulk-test-1-${Date.now()}`,
          status: 'open',
          priority: 'normal',
        },
        {
          channel: 'telegram',
          externalThreadId: `bulk-test-2-${Date.now()}`,
          status: 'pending',
          priority: 'high',
        },
        {
          channel: 'irc',
          externalThreadId: `bulk-test-3-${Date.now()}`,
          status: 'open',
          priority: 'low',
        },
      ])
      .returning();

    testConversations = convResults;

    // Create test tag (now that user exists)
    const tagResults = await dbClient
      .insert(tags)
      .values({
        name: `bulk-test-tag-${Date.now()}`,
        color: '#FF5733',
        createdById: testUserId,
      })
      .returning();

    testTag = tagResults[0];
  });

  afterEach(async () => {
    // Cleanup: delete test data to avoid FK constraint violations
    try {
      await dbClient
        .delete(conversationTags)
        .where(eq(conversationTags.tagId, testTag.id));
      
      await dbClient
        .delete(tags)
        .where(eq(tags.id, testTag.id));
      
      await dbClient
        .delete(conversations)
        .where(eq(conversations.channel, 'telegram'));
      
      await dbClient
        .delete(conversations)
        .where(eq(conversations.channel, 'irc'));
      
      await dbClient
        .delete(users)
        .where(eq(users.id, testUserId));
      
      await dbClient
        .delete(users)
        .where(eq(users.id, testUser2Id));
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('bulkAssign', () => {
    it('should successfully assign conversations to a user', async () => {
      // Use testUser2Id as assignee (real user in DB)
      const conversationIds = testConversations.map((c) => c.id);

      const result = await bulkAssign(conversationIds, testUserId, testUser2Id);

      expect(result.data.successCount).toBe(3);
      expect(result.data.failureCount).toBe(0);
      expect(result.data.failures).toHaveLength(0);

      // Verify assignments in database
      const updatedConvs = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.assignedUserId, testUser2Id));

      expect(updatedConvs).toHaveLength(3);
    });

    it('should handle partial failures when some conversations not found', async () => {
      // Use testUser2Id as assignee (real user in DB)
      const validId = testConversations[0].id;
      const invalidId = 'non-existent-' + Date.now();

      const result = await bulkAssign(
        [validId, invalidId],
        testUserId,
        testUser2Id
      );

      expect(result.data.successCount).toBe(1);
      expect(result.data.failureCount).toBe(1);
      expect(result.data.failures).toHaveLength(1);
      expect(result.data.failures[0].id).toBe(invalidId);
      expect(result.data.failures[0].reason).toContain('not found');
    });

    it('should enforce max 100 conversations limit', async () => {
      const tooMany = Array.from({ length: 101 }, (_, i) =>
        `conv-${i}-${Date.now()}`
      );

      const result = await bulkAssign(tooMany, testUserId, testUser2Id);

      expect(result.data.successCount).toBe(0);
      expect(result.data.failureCount).toBe(101);
      expect(result.data.failures).toHaveLength(101);
      expect(result.data.failures[0].reason).toContain('Max 100');
    });

    it('should handle empty conversation list', async () => {
      const result = await bulkAssign([], testUserId, testUser2Id);

      expect(result.data.successCount).toBe(0);
      expect(result.data.failureCount).toBe(0);
      expect(result.data.failures).toHaveLength(0);
    });

    it('should log audit events for each successful assignment', async () => {
      const conversationIds = testConversations.slice(0, 2).map((c) => c.id);

      await bulkAssign(conversationIds, testUserId, testUser2Id);

      expect(auditService.logAction).toHaveBeenCalledTimes(2);
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: testUserId,
          action: 'bulk_action_applied',
          entityType: 'conversation',
          metadata: expect.objectContaining({
            action: 'assign',
            assigneeId: testUser2Id,
            bulkOperation: true,
          }),
        })
      );
    });

    it('should accept null assigneeId for unassigning', async () => {
      // First assign to someone
      const conversationId = testConversations[0].id;

      await bulkAssign([conversationId], testUserId, testUser2Id);

      // Now unassign (assign to null)
      const result = await bulkAssign(
        [conversationId],
        testUserId,
        null as unknown as string
      );

      expect(result.data.successCount).toBe(1);
      expect(result.data.failureCount).toBe(0);

      // Verify unassigned
      const updated = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId));

      expect(updated[0].assignedUserId).toBeNull();
    });
  });

  describe('bulkTag', () => {
    it('should successfully tag conversations', async () => {
      const conversationIds = testConversations.map((c) => c.id);

      const result = await bulkTag(conversationIds, testTag.id, testUserId);

      expect(result.data.successCount).toBe(3);
      expect(result.data.failureCount).toBe(0);
      expect(result.data.failures).toHaveLength(0);

      // Verify tags attached
      const attachedTags = await dbClient
        .select()
        .from(conversationTags)
        .where(eq(conversationTags.tagId, testTag.id));

      expect(attachedTags).toHaveLength(3);
    });

    it('should skip if tag already attached', async () => {
      const conversationId = testConversations[0].id;

      // Attach once
      const result1 = await bulkTag(
        [conversationId],
        testTag.id,
        testUserId
      );
      expect(result1.data.successCount).toBe(1);

      // Attach again (should skip, not fail)
      const result2 = await bulkTag(
        [conversationId],
        testTag.id,
        testUserId
      );
      expect(result2.data.successCount).toBe(1);
      expect(result2.data.failures).toHaveLength(0);

      // Verify only one attachment
      const attachedTags = await dbClient
        .select()
        .from(conversationTags)
        .where(eq(conversationTags.tagId, testTag.id));

      expect(attachedTags).toHaveLength(1);
    });

    it('should return error if tag not found', async () => {
      const conversationIds = testConversations.map((c) => c.id);
      const invalidTagId = 99999;

      const result = await bulkTag(conversationIds, invalidTagId, testUserId);

      expect(result.data.successCount).toBe(0);
      expect(result.data.failureCount).toBe(3);
      expect(result.data.failures).toHaveLength(3);
      expect(result.data.failures[0].reason).toContain('Tag not found');
    });

    it('should handle partial failures with mixed valid/invalid conversations', async () => {
      const validId = testConversations[0].id;
      const invalidId = 'non-existent-' + Date.now();

      const result = await bulkTag([validId, invalidId], testTag.id, testUserId);

      expect(result.data.successCount).toBe(1);
      expect(result.data.failureCount).toBe(1);
      expect(result.data.failures).toHaveLength(1);

      // Verify valid one was tagged
      const attached = await dbClient
        .select()
        .from(conversationTags)
        .where(eq(conversationTags.tagId, testTag.id));

      expect(attached).toHaveLength(1);
      expect(attached[0].conversationId).toBe(validId);
    });

    it('should enforce max 100 conversations limit for tagging', async () => {
      const tooMany = Array.from({ length: 101 }, (_, i) =>
        `conv-${i}-${Date.now()}`
      );

      const result = await bulkTag(tooMany, testTag.id, testUserId);

      expect(result.data.successCount).toBe(0);
      expect(result.data.failureCount).toBe(101);
    });

     it('should log audit events for each successful tag', async () => {
       const conversationIds = testConversations.slice(0, 2).map((c) => c.id);

       await bulkTag(conversationIds, testTag.id, testUserId);

       expect(auditService.logAction).toHaveBeenCalledTimes(2);
       expect(auditService.logAction).toHaveBeenCalledWith(
         expect.objectContaining({
           actorId: testUserId,
           action: 'bulk_action_applied',
           entityType: 'conversation',
           entityId: expect.any(String),
           metadata: expect.objectContaining({
             action: 'tag',
             tagId: testTag.id,
             bulkOperation: true,
           }),
         })
       );
     });
  });

  describe('bulkUpdateStatus', () => {
    it('should successfully update conversation status', async () => {
      const conversationIds = testConversations.map((c) => c.id);

      const result = await bulkUpdateStatus(
        conversationIds,
        'resolved',
        testUserId
      );

      expect(result.data.successCount).toBe(3);
      expect(result.data.failureCount).toBe(0);
      expect(result.data.failures).toHaveLength(0);

      // Verify status updated
      const updated = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.status, 'resolved'));

      expect(updated.length).toBeGreaterThanOrEqual(3);
    });

    it('should reject invalid status values', async () => {
      const conversationIds = testConversations.map((c) => c.id);

      const result = await bulkUpdateStatus(
        conversationIds,
        'invalid_status' as unknown as 'open' | 'pending' | 'resolved',
        testUserId
      );

      expect(result.data.successCount).toBe(0);
      expect(result.data.failureCount).toBe(3);
      expect(result.data.failures[0].reason).toContain('Invalid status');
    });

    it('should handle partial failures for status update', async () => {
      const validId = testConversations[0].id;
      const invalidId = 'non-existent-' + Date.now();

      const result = await bulkUpdateStatus(
        [validId, invalidId],
        'pending',
        testUserId
      );

      expect(result.data.successCount).toBe(1);
      expect(result.data.failureCount).toBe(1);

      // Verify valid one was updated
      const updated = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, validId));

      expect(updated[0].status).toBe('pending');
    });

    it('should support all valid status values', async () => {
      const conversationId = testConversations[0].id;
      const statuses: Array<'open' | 'pending' | 'resolved'> = [
        'open',
        'pending',
        'resolved',
      ];

      for (const status of statuses) {
        const result = await bulkUpdateStatus([conversationId], status, testUserId);

        expect(result.data.successCount).toBe(1);
        expect(result.data.failures).toHaveLength(0);

        const updated = await dbClient
          .select()
          .from(conversations)
          .where(eq(conversations.id, conversationId));

        expect(updated[0].status).toBe(status);
      }
    });

    it('should enforce max 100 conversations limit for status', async () => {
      const tooMany = Array.from({ length: 101 }, (_, i) =>
        `conv-${i}-${Date.now()}`
      );

      const result = await bulkUpdateStatus(tooMany, 'resolved', testUserId);

      expect(result.data.successCount).toBe(0);
      expect(result.data.failureCount).toBe(101);
    });

    it('should log audit events with old and new status', async () => {
      const conversationId = testConversations[0].id;

      await bulkUpdateStatus([conversationId], 'resolved', testUserId);

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: testUserId,
          action: 'bulk_action_applied',
          entityType: 'conversation',
          metadata: expect.objectContaining({
            action: 'status',
            newStatus: 'resolved',
            bulkOperation: true,
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const conversationIds = testConversations.map((c) => c.id);

      // Even if there's an error, partial results should be returned
      const result = await bulkAssign(
        conversationIds,
        testUserId,
        testUser2Id
      );

      // Should have some result structure
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('successCount');
      expect(result.data).toHaveProperty('failureCount');
      expect(result.data).toHaveProperty('failures');
    });

    it('should handle null/undefined input gracefully', async () => {
      const result1 = await bulkAssign(
        null as unknown as string[],
        testUserId,
        testUser2Id
      );
      expect(result1.data.successCount).toBe(0);
      expect(result1.data.failureCount).toBe(0);

      const result2 = await bulkTag(
        undefined as unknown as string[],
        testTag.id,
        testUserId
      );
      expect(result2.data.successCount).toBe(0);
      expect(result2.data.failureCount).toBe(0);

      const result3 = await bulkUpdateStatus(
        [] as unknown as string[],
        'open',
        testUserId
      );
      expect(result3.data.successCount).toBe(0);
      expect(result3.data.failureCount).toBe(0);
    });
  });

  describe('Response Format', () => {
    it('should return consistent response structure', async () => {
      const conversationIds = testConversations.slice(0, 2).map((c) => c.id);

      const result = await bulkAssign(conversationIds, testUserId, testUser2Id);

      expect(result).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            successCount: expect.any(Number),
            failureCount: expect.any(Number),
            failures: expect.any(Array),
          }),
        })
      );

      expect(result.data.successCount + result.data.failureCount).toBe(2);
      expect(result.data.failures).toHaveLength(result.data.failureCount);
    });

    it('failure items should have id and reason', async () => {
      const validId = testConversations[0].id;
      const invalidId = 'non-existent-' + Date.now();

      const result = await bulkAssign(
        [validId, invalidId],
        testUserId,
        testUser2Id
      );

      expect(result.data.failures).toHaveLength(1);
      expect(result.data.failures[0]).toEqual(
        expect.objectContaining({
          id: invalidId,
          reason: expect.any(String),
        })
      );
    });
  });
});
