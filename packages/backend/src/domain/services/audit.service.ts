import { db } from '../../infrastructure/db/client.js';
import { auditLogs } from '../../infrastructure/db/schema.js';
import { desc, eq, and, gte, lte } from 'drizzle-orm';

export interface LogAuditParams {
  actorId?: number;
  action: string;
  entityType: string;
  entityId: number;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

export interface QueryAuditParams {
  page?: number;
  limit?: number;
  actorId?: number;
  action?: string;
  entityType?: string;
  entityId?: number;
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
    } catch (error: any) {
      console.error('❌ Failed to log audit action:', error);
      // Don't throw - audit failures shouldn't break application
      return { success: false, error: error.message };
    }
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
    const whereClauses: any[] = [];

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

    // Get total count
    let countQuery = db
      .select()
      .from(auditLogs);

    if (whereClauses.length > 0) {
      countQuery = countQuery.where(and(...whereClauses)) as any;
    }

    const countResult = await (countQuery as any);
    const total = countResult.length;

    // Get logs
    let query = db
      .select()
      .from(auditLogs);

    if (whereClauses.length > 0) {
      query = query.where(and(...whereClauses)) as any;
    }

    const logs = await query
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
  async getConversationAuditLogs(conversationId: number, page: number = 1) {
    return this.queryAuditLogs({
      page,
      entityType: 'conversation',
      entityId: conversationId,
    });
  }

  /**
   * Get audit logs for a specific actor
   */
  async getActorAuditLogs(actorId: number, page: number = 1) {
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
