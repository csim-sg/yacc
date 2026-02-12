/**
 * Audit Logs Query Service
 * 
 * Provides methods for querying, filtering, and exporting audit logs
 * Handles pagination and date range filtering
 */

import { and, desc, gte, lte, eq, like, or } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { auditLogs } from '../schemas/auditLog.schema';
import type {
  AuditLogQueryFilters,
  AuditLogQueryResponse,
  AuditLogExportRequest,
  AuditLogExportResponse,
  AuditLogEntry,
} from '../types/audit-logs-query.types';
import { logger } from '../infrastructure/logger';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Query audit logs with filters and pagination
 * 
 * Returns audit log entries matching the provided filters
 * Defaults to newest first (by createdAt DESC)
 */
export async function queryAuditLogs(
  filters: AuditLogQueryFilters,
  correlationId: string = 'unknown'
): Promise<AuditLogQueryResponse> {
  const page = Math.max(1, filters.page || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  try {
    // Build WHERE conditions
    const conditions: (typeof auditLogs.id | typeof auditLogs.id)[] = [];

    if (filters.actorId) {
      conditions.push(eq(auditLogs.actorId, filters.actorId));
    }

    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }

    if (filters.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }

    if (filters.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    }

    // Date range filtering
    if (filters.dateFrom) {
      const dateFrom = new Date(filters.dateFrom);
      conditions.push(gte(auditLogs.createdAt, dateFrom));
    }

    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      // Set time to end of day
      dateTo.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogs.createdAt, dateTo));
    }

    // Execute count query
    const countResult = await dbClient
      .select({ count: auditLogs.id })
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = countResult[0]?.count || 0;

    // Execute data query
    let query = dbClient
      .select({
        id: auditLogs.id,
        actorId: auditLogs.actorId,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const items = (await query) as AuditLogEntry[];

    logger.info(
      {
        correlationId,
        filters,
        itemCount: items.length,
        total,
        page,
        limit,
      },
      'Audit logs queried'
    );

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      { correlationId, filters, error: errorMsg },
      'Failed to query audit logs'
    );
    throw new Error(`Failed to query audit logs: ${errorMsg}`);
  }
}

/**
 * Query audit logs scoped to a specific conversation
 * 
 * Returns all audit entries related to a conversation
 */
export async function queryConversationAuditLogs(
  conversationId: string,
  filters?: Omit<AuditLogQueryFilters, 'entityId'>,
  correlationId: string = 'unknown'
): Promise<AuditLogQueryResponse> {
  return queryAuditLogs(
    {
      ...filters,
      entityId: conversationId,
    },
    correlationId
  );
}

/**
 * Export audit logs as CSV or JSON
 * 
 * Supports filtering same as queryAuditLogs
 * Returns data as string (CSV or JSON format)
 */
export async function exportAuditLogs(
  request: AuditLogExportRequest,
  correlationId: string = 'unknown'
): Promise<AuditLogExportResponse> {
  const format = request.format || 'csv';

  try {
    // Query all matching logs (no pagination for export)
    const queryResponse = await queryAuditLogs(
      {
        ...(request.filters || {}),
        limit: MAX_LIMIT,
      },
      correlationId
    );

    let data: string;

    if (format === 'csv') {
      data = convertToCSV(queryResponse.items);
    } else {
      data = JSON.stringify(queryResponse.items, null, 2);
    }

    logger.info(
      {
        correlationId,
        format,
        count: queryResponse.items.length,
        filters: request.filters,
      },
      'Audit logs exported'
    );

    return {
      data,
      format,
      timestamp: new Date(),
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      { correlationId, format, error: errorMsg },
      'Failed to export audit logs'
    );
    throw new Error(`Failed to export audit logs: ${errorMsg}`);
  }
}

/**
 * Convert audit log entries to CSV format
 */
function convertToCSV(entries: AuditLogEntry[]): string {
  // CSV headers
  const headers = [
    'ID',
    'Actor ID',
    'Action',
    'Entity Type',
    'Entity ID',
    'Created At',
    'Metadata',
  ];

  // Escape CSV values
  const escapeCsvValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }

    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Convert rows
  const rows = entries.map((entry) => [
    escapeCsvValue(entry.id),
    escapeCsvValue(entry.actorId),
    escapeCsvValue(entry.action),
    escapeCsvValue(entry.entityType),
    escapeCsvValue(entry.entityId),
    escapeCsvValue(entry.createdAt.toISOString()),
    escapeCsvValue(JSON.stringify(entry.metadata)),
  ]);

  // Combine headers and rows
  const headerRow = headers.join(',');
  const dataRows = rows.map((row) => row.join(',')).join('\n');

  return `${headerRow}\n${dataRows}`;
}
