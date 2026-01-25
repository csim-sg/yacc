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
import { IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { auditService } from '../services/audit.service';

// DTOs
class GetConversationAuditLogsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}

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
    @QueryParams() query: GetConversationAuditLogsQuery,
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
