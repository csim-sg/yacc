import { desc, eq, and } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';
import { auditLogs } from '../schemas/auditLog.schema';

/**
 * Log audit action parameters
 * Supports multi-entity audit logging (conversation, rule, user, message, integration, etc.)
 */
export interface LogAuditParams {
  actorId?: string;
  action: string;
  entityType: 'conversation' | 'rule' | 'user' | 'message' | 'notification' | 'tag' | 'integration';
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  correlationId?: string;
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
    * Log an audit event for any entity type (conversation, rule, user, etc.)
    * Supports multi-entity audit logging
    */
    async logAction(params: LogAuditParams) {
      const { actorId, action, entityType, entityId, metadata, ipAddress } = params;

      // Validate entityType
      const validEntityTypes = ['conversation', 'rule', 'user', 'message', 'notification', 'tag', 'integration'];
      if (!validEntityTypes.includes(entityType)) {
        logger.error({ entityType }, 'Audit log error: invalid entityType');
        return { success: false, error: `Invalid entityType: ${entityType}` };
      }

     try {
       await dbClient.insert(auditLogs).values({
         actorId: actorId || null,
         action,
         entityType,
         entityId,
         metadata: metadata || null,
         ipAddress: ipAddress || null,
       });

       return { success: true };
     } catch (error: unknown) {
       const message = error instanceof Error ? error.message : 'Unknown error';
       logger.error(
         {
           error: message,
           action,
           entityType,
           entityId,
           actorId,
         },
         'Failed to log audit action'
       );
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
      const countResult = await dbClient
        .select()
        .from(auditLogs)
        .where(whereClause);
      const total = countResult.length;

      // Get logs for this conversation
      const logs = await dbClient
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
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, conversationId },
        'Failed to query audit logs'
      );
      throw new Error(message);
    }
  }
}

export const auditService = new AuditService();
