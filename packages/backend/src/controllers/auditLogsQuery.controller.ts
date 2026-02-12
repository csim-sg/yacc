/**
 * Audit Logs Query Controller
 * 
 * Endpoints for querying and exporting audit logs
 * RBAC: manager+ only for viewing, admin+ for export
 */

import type { Request } from 'express';
import { JsonController, Get, Post, Param, QueryParam, Req, Res, Authorized, CurrentUser, Body, BadRequestError } from 'routing-controllers';
import type { Response } from 'express';
import {
  queryAuditLogs,
  queryConversationAuditLogs,
  exportAuditLogs,
} from '../services/auditLogsQuery.service';
import type { AuditLogQueryFilters, AuditLogExportRequest } from '../types/auditLogsQuery.types';
import { logger } from '../infrastructure/logger';
import type { AuthUser } from '../types/auth.types';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
}

@JsonController('/api/audit-logs')
export class AuditLogsQueryController {
  /**
   * GET /api/audit-logs
   * 
   * Query audit logs with optional filtering and pagination
   * 
   * Query params:
   * - actorId: filter by user who performed action
   * - action: filter by action type
   * - entityType: filter by entity type
   * - entityId: filter by specific entity ID
   * - dateFrom: filter by start date (ISO string)
   * - dateTo: filter by end date (ISO string)
   * - page: pagination page (default 1)
   * - limit: results per page (default 20, max 100)
   * 
   * Returns: { items, total, page, limit, pages }
   * 
   * RBAC: manager+ only
   */
  @Get()
  @Authorized(['manager', 'admin', 'super_admin'])
  async queryLogs(
    @Req() req: AuthenticatedRequest,
    @QueryParam('actorId') actorId: string | undefined,
    @QueryParam('action') action: string | undefined,
    @QueryParam('entityType') entityType: string | undefined,
    @QueryParam('entityId') entityId: string | undefined,
    @QueryParam('dateFrom') dateFrom: string | undefined,
    @QueryParam('dateTo') dateTo: string | undefined,
    @QueryParam('page') page: string | undefined,
    @QueryParam('limit') limit: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() res: Response
  ): Promise<Response> {
    const correlationId = req.correlationId || 'unknown';

    try {
      const filters: AuditLogQueryFilters = {
        actorId,
        action,
        entityType,
        entityId,
        dateFrom,
        dateTo,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      };

      const result = await queryAuditLogs(user.id, filters, correlationId);
      return res.status(200).json(result);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Validation errors (invalid date format, dateFrom > dateTo) return 400
      if (errorMsg.includes('Invalid dateFrom') || 
          errorMsg.includes('Invalid dateTo') ||
          errorMsg.includes('dateFrom must be')) {
        logger.warn({ correlationId, error: errorMsg }, 'Invalid audit log query parameters');
        throw new BadRequestError(errorMsg);
      }
      
      logger.error({ correlationId, error: errorMsg }, 'Failed to query audit logs');
      return res.status(500).json({ error: 'Failed to query audit logs' });
    }
  }

  /**
   * GET /api/audit-logs/conversations/:conversationId
   * 
   * Query audit logs for a specific conversation
   * 
   * Returns audit entries where entityId = conversationId
   * Same pagination/filtering as main query endpoint
   * 
   * RBAC: manager+ only
   */
  @Get('/conversations/:conversationId')
  @Authorized(['manager', 'admin', 'super_admin'])
  async queryConversationLogs(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @QueryParam('action') action: string | undefined,
    @QueryParam('entityType') entityType: string | undefined,
    @QueryParam('dateFrom') dateFrom: string | undefined,
    @QueryParam('dateTo') dateTo: string | undefined,
    @QueryParam('page') page: string | undefined,
    @QueryParam('limit') limit: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() res: Response
  ): Promise<Response> {
    const correlationId = req.correlationId || 'unknown';

    try {
      const filters: Omit<AuditLogQueryFilters, 'entityId'> = {
        action,
        entityType,
        dateFrom,
        dateTo,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      };

      const result = await queryConversationAuditLogs(user.id, conversationId, filters, correlationId);
      return res.status(200).json(result);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Validation errors return 400
      if (errorMsg.includes('Invalid dateFrom') || 
          errorMsg.includes('Invalid dateTo') ||
          errorMsg.includes('dateFrom must be')) {
        logger.warn({ correlationId, conversationId, error: errorMsg }, 'Invalid audit log query parameters');
        throw new BadRequestError(errorMsg);
      }
      
      logger.error(
        { correlationId, conversationId, error: errorMsg },
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
   *   filters: { ...same as GET /api/audit-logs... }
   * }
   * 
   * Returns: CSV or JSON file with matching audit logs
   * RBAC: admin+ only
   */
  @Post('/export')
  @Authorized(['admin', 'super_admin'])
  async exportLogs(
    @Req() req: AuthenticatedRequest,
    @Body() request: AuditLogExportRequest,
    @CurrentUser() user: AuthUser,
    @Res() res: Response
  ): Promise<Response> {
    const correlationId = req.correlationId || 'unknown';

    try {
      const result = await exportAuditLogs(user.id, request, correlationId);
      
      // Set appropriate content type and headers
      const contentType = result.format === 'csv' ? 'text/csv' : 'application/json';
      const filename = `audit-logs-${new Date().toISOString()}.${result.format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      return res.status(200).send(result.data);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Validation errors return 400
      if (errorMsg.includes('Invalid dateFrom') || 
          errorMsg.includes('Invalid dateTo') ||
          errorMsg.includes('dateFrom must be')) {
        logger.warn({ correlationId, error: errorMsg }, 'Invalid audit log export parameters');
        throw new BadRequestError(errorMsg);
      }
      
      logger.error({ correlationId, error: errorMsg }, 'Failed to export audit logs');
      return res.status(500).json({ error: 'Failed to export audit logs' });
    }
  }
}
