/**
 * Audit Controller
 * Handles audit log queries with routing-controllers
 */

import {
  JsonController,
  Get,
  QueryParams,
  Authorized,
} from 'routing-controllers';
import { IsOptional, IsInt, IsString, IsDateString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { auditService } from '@yacc/backend/domain/services/audit.service';

// DTOs
class QueryConversationAuditLogsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsUUID()
  conversationId!: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

@JsonController('/api/audit-logs')
@Authorized(['manager', 'admin', 'super_admin'])
export class AuditController {
  /**
   * GET /api/audit-logs
   * Query conversation audit logs (admin/manager only)
   */
  @Get('/')
  async queryConversationAuditLogs(
    @QueryParams() query: QueryConversationAuditLogsQuery
  ) {
    // Transform date strings to Date objects
    const params = {
      ...query,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    };

    const result = await auditService.queryConversationAuditLogs(params);
    return {
      success: true,
      data: result.logs,
      pagination: result.pagination,
    };
  }

}
