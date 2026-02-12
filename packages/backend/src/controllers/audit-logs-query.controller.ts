/**
 * Audit Logs Query Controller
 * 
 * Endpoints for querying and exporting audit logs
 * RBAC: manager+ only for viewing, admin+ for export
 */

import { JsonController, Post, Param, Body, Res, Authorized } from 'routing-controllers';
import type { Response } from 'express';
import {
  queryAuditLogs,
  queryConversationAuditLogs,
  exportAuditLogs,
} from '../services/audit-logs-query.service';
import type { AuditLogQueryFilters, AuditLogExportRequest } from '../types/audit-logs-query.types';
import { logger } from '../infrastructure/logger';

@JsonController('/api/audit-logs')
export class AuditLogsQueryController {
  /**
   * POST /api/audit-logs/query
   * 
   * Query audit logs with optional filtering and pagination
   * 
   * Request body:
   * {
   *   actorId?: string,
   *   action?: string,
   *   entityType?: string,
   *   entityId?: string,
   *   dateFrom?: Date | string,
   *   dateTo?: Date | string,
   *   page?: number,
   *   limit?: number
   * }
   * 
   * Returns: { items, total, page, limit, pages }
   */
  @Post('/query')
  @Authorized(['manager', 'admin', 'super_admin'])
  async queryLogs(
    @Body() filters: AuditLogQueryFilters,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const result = await queryAuditLogs(filters);
      return res.status(200).json(result);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMsg }, 'Failed to query audit logs');
      return res.status(500).json({ error: 'Failed to query audit logs' });
    }
  }

  /**
   * POST /api/audit-logs/conversations/:conversationId/query
   * 
   * Query audit logs for a specific conversation
   * 
   * Returns audit entries where entityId = conversationId
   * Same pagination/filtering as main query endpoint
   */
  @Post('/conversations/:conversationId/query')
  @Authorized(['manager', 'admin', 'super_admin'])
  async queryConversationLogs(
    @Param('conversationId') conversationId: string,
    @Body() filters: Omit<AuditLogQueryFilters, 'entityId'>,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const result = await queryConversationAuditLogs(conversationId, filters);
      return res.status(200).json(result);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        { conversationId, error: errorMsg },
        'Failed to query conversation audit logs'
      );
      return res.status(500).json({ error: 'Failed to query audit logs' });
    }
  }

  /**
   * POST /api/audit-logs/export
   * 
   * Export audit logs as CSV or JSON
   * 
   * Request body:
   * {
   *   format: 'csv' | 'json',
   *   filters: { ...same as queryLogs... }
   * }
   * 
   * Returns: CSV or JSON file with matching audit logs
   * RBAC: admin+ only
   */
  @Post('/export')
  @Authorized(['admin', 'super_admin'])
  async exportLogs(
    @Body() request: AuditLogExportRequest,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const result = await exportAuditLogs(request);
      
      // Set appropriate content type and headers
      const contentType = result.format === 'csv' ? 'text/csv' : 'application/json';
      const filename = `audit-logs-${new Date().toISOString()}.${result.format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      return res.status(200).send(result.data);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMsg }, 'Failed to export audit logs');
      return res.status(500).json({ error: 'Failed to export audit logs' });
    }
  }
}
