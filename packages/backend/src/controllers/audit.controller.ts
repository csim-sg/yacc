/**
 * Audit Controller
 * Handles conversation-scoped audit log queries
 */

import {
  JsonController,
  Get,
  QueryParams,
  Authorized,
  Param,
} from 'routing-controllers';
import { auditService } from '../services/audit.service';
import { GetConversationAuditLogsRequest } from '@yacc/common/requests/audit/getConversationAuditLogs.request';

/**
 * Audit logs are conversation-scoped only
 * This controller provides endpoints to retrieve audit logs for specific conversations
 */
@JsonController('/api/conversations')
@Authorized(['manager', 'admin', 'super_admin'])
export class AuditController {
  /**
   * GET /api/conversations/:conversationId/audit-logs
   * Get audit logs for a specific conversation
   * Audit logs are conversation-scoped only, Manager+ access
   */
   @Get('/:conversationId/audit-logs')
   async getConversationAuditLogs(
     @Param('conversationId') conversationId: string,
     @QueryParams() query: GetConversationAuditLogsRequest,
   ) {
    const result = await auditService.getConversationAuditLogs({
      conversationId,
      page: query.page,
      limit: query.limit,
    });

    return {
      success: true,
      data: result.logs,
      pagination: result.pagination,
    };
  }
}
