import { db } from '../../infrastructure/db/client.js';
import { auditLogs } from '../../infrastructure/db/schema.js';
import { desc, eq, and, gte, lte } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export interface LogAuditParams {
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export interface QueryAuditParams {
  page?: number;
  limit?: number;
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface QueryConversationAuditParams {
  page?: number;
  limit?: number;
  conversationId: string;
  actorId?: string;
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export class AuditService {
  /**
   * Log an audit event
   */
  async logAction(params: LogAuditParams) {
    const {
      actorId,
      action,
      entityType,
      entityId,
      metadata,
      ipAddress,
    } = params;

    try {
      await db.insert(auditLogs).values({
        actorId: actorId || null,
        action,
        entityType,
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
   * Query conversation audit logs with filters
   */
  async queryConversationAuditLogs(params: QueryConversationAuditParams) {
    const {
      page,
      limit,
      conversationId,
      actorId,
      action,
      dateFrom,
      dateTo,
    } = params;

    return this.queryAuditLogs({
      page,
      limit,
      actorId,
      action,
      dateFrom,
      dateTo,
      entityType: 'conversation',
      entityId: conversationId,
    });
  }

  /**
   * Query audit logs with filters
   */
  async queryAuditLogs(params: QueryAuditParams) {
    const {
      page = 1,
      limit = 50,
      actorId,
      action,
      entityType,
      entityId,
      dateFrom,
      dateTo,
    } = params;

    const offset = (page - 1) * limit;

    // Build where clauses
    const whereClauses: SQL<unknown>[] = [];

    if (actorId) {
      whereClauses.push(eq(auditLogs.actorId, actorId));
    }

    if (action) {
      whereClauses.push(eq(auditLogs.action, action));
    }

    if (entityType) {
      whereClauses.push(eq(auditLogs.entityType, entityType));
    }

    if (entityId) {
      whereClauses.push(eq(auditLogs.entityId, entityId));
    }

    if (dateFrom) {
      whereClauses.push(gte(auditLogs.createdAt, dateFrom));
    }

    if (dateTo) {
      whereClauses.push(lte(auditLogs.createdAt, dateTo));
    }

    const countResult = whereClauses.length > 0
      ? await db
          .select()
          .from(auditLogs)
          .where(and(...whereClauses))
      : await db
          .select()
          .from(auditLogs);
    const total = countResult.length;

    const logs = whereClauses.length > 0
      ? await db
          .select()
          .from(auditLogs)
          .where(and(...whereClauses))
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit)
          .offset(offset)
      : await db
          .select()
          .from(auditLogs)
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
  }

  /**
   * Get audit logs for a conversation
   */
  async getConversationAuditLogs(conversationId: string, page: number = 1) {
    return this.queryConversationAuditLogs({
      page,
      conversationId,
    });
  }

  /**
   * Get audit logs for a specific actor
   */
  async getActorAuditLogs(actorId: string, page: number = 1) {
    return this.queryAuditLogs({
      page,
      actorId,
    });
  }

  /**
   * Get audit logs for a date range
   */
  async getAuditLogsByDateRange(dateFrom: Date, dateTo: Date, page: number = 1) {
    return this.queryAuditLogs({
      page,
      dateFrom,
      dateTo,
    });
  }
}

export const auditService = new AuditService();
