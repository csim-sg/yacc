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
import { IsOptional, IsInt, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { auditService } from '@yacc/backend/domain/services/audit.service';

// DTOs
class QueryAuditLogsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  actorId?: number;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  entityId?: number;

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
   * Query audit logs (admin/manager only)
   */
  @Get('/')
  async queryAuditLogs(@QueryParams() query: QueryAuditLogsQuery) {
    // Transform date strings to Date objects
    const params = {
      ...query,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    };

    const result = await auditService.queryAuditLogs(params);
    return {
      success: true,
      data: result.logs,
      pagination: result.pagination,
    };
  }

  /**
   * GET /api/audit-logs/export
   * Export audit logs as CSV (admin/manager only)
   */
  @Get('/export')
  async exportAuditLogs(@QueryParams() query: QueryAuditLogsQuery) {
    // Transform date strings to Date objects
    const params = {
      ...query,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    };

    const csv = await auditService.exportAuditLogs(params);
    
    // Return CSV data with proper headers
    return {
      success: true,
      data: csv,
      contentType: 'text/csv',
      filename: `audit-logs-${new Date().toISOString()}.csv`,
    };
  }
}
