import { db } from '../../infrastructure/db/client.js';
import { auditLogs } from '../../infrastructure/db/schema.js';
import { desc, eq, and } from 'drizzle-orm';

/**
 * Log audit action parameters
 * Audit logs are conversation-scoped only
 */
export interface LogAuditParams {
  actorId?: string;
  action: string;
  entityType: 'conversation';
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Get conversation audit logs parameters
 */
export interface GetConversationAuditLogsParams {
  conversationId: string;
  page?: number;
  limit?: number;
}

export class AuditService {
  /**
   * Log an audit event for a conversation
   * Only conversation entity types are allowed per conversation-only scope
   */
  async logAction(params: LogAuditParams) {
    const { actorId, action, entityType, entityId, metadata, ipAddress } = params;

    // Enforce conversation-only scope
    if (entityType !== 'conversation') {
      console.error(
        '❌ Audit log error: entityType must be "conversation", got:',
        entityType,
      );
      return { success: false, error: 'Invalid entityType: only conversation allowed' };
    }

    try {
      await db.insert(auditLogs).values({
        actorId: actorId || null,
        action,
        entityType: 'conversation',
        entityId,
        metadata: metadata || null,
        ipAddress: ipAddress || null,
      });

      return { success: true };
    } catch (error: unknown) {
      console.error('❌ Failed to log audit action:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      // Don't throw - audit failures shouldn't break application
      return { success: false, error: message };
    }
  }

  /**
   * Get audit logs for a specific conversation
   * This is the only query method available as audit logs are conversation-scoped
   */
  async getConversationAuditLogs(params: GetConversationAuditLogsParams) {
    const { conversationId, page = 1, limit = 50 } = params;
    const offset = (page - 1) * limit;

    try {
      // Build where clause - only conversation entity type and specific conversation ID
      const whereClause = and(
        eq(auditLogs.entityType, 'conversation'),
        eq(auditLogs.entityId, conversationId),
      );

      // Get total count for this conversation
      const countResult = await db
        .select()
        .from(auditLogs)
        .where(whereClause);
      const total = countResult.length;

      // Get logs for this conversation
      const logs = await db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: unknown) {
      console.error('❌ Failed to query audit logs:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(message);
    }
  }
}

export const auditService = new AuditService();
