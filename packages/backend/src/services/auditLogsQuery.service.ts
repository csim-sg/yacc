/**
 * Audit Logs Query Service
 * 
 * Provides methods for querying, filtering, and exporting audit logs
 * Handles pagination and date range filtering
 */

import { and, desc, gte, lte, eq, count } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { auditLogs } from '../schemas/auditLog.schema';
import type {
  AuditLogQueryFilters,
  AuditLogQueryResponse,
  AuditLogExportRequest,
  AuditLogExportResponse,
  AuditLogEntry,
} from '../types/auditLogsQuery.types';
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
  userId: string,
  filters: AuditLogQueryFilters,
  correlationId: string = 'unknown'
): Promise<AuditLogQueryResponse> {
  const page = Math.max(1, filters.page || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  try {
    // Validate date range
    let dateFromVal: Date | undefined;
    let dateToVal: Date | undefined;

    if (filters.dateFrom) {
      dateFromVal = new Date(filters.dateFrom);
      if (Number.isNaN(dateFromVal.getTime())) {
        throw new Error('Invalid dateFrom format');
      }
    }

    if (filters.dateTo) {
      dateToVal = new Date(filters.dateTo);
      if (Number.isNaN(dateToVal.getTime())) {
        throw new Error('Invalid dateTo format');
      }
      // Set time to end of day
      dateToVal.setHours(23, 59, 59, 999);
    }

    if (dateFromVal && dateToVal && dateFromVal > dateToVal) {
      throw new Error('dateFrom must be before or equal to dateTo');
    }

    // Build WHERE conditions
    const conditions: ReturnType<typeof eq>[] = [];

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

    if (dateFromVal) {
      conditions.push(gte(auditLogs.createdAt, dateFromVal));
    }

    if (dateToVal) {
      conditions.push(lte(auditLogs.createdAt, dateToVal));
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Execute count query with proper COUNT(*)
    let countQuery = dbClient
      .select({ count: count() })
      .from(auditLogs) as any;

    if (whereClause) {
      countQuery = countQuery.where(whereClause);
    }

    const countResult = await countQuery;
    const total = countResult[0]?.count || 0;

    // Execute data query
    let dataQuery = dbClient
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
      .offset(offset) as any;

    if (whereClause) {
      dataQuery = dataQuery.where(whereClause);
    }

    const items = (await dataQuery) as AuditLogEntry[];

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
  userId: string,
  conversationId: string,
  filters?: Omit<AuditLogQueryFilters, 'entityId'>,
  correlationId: string = 'unknown'
): Promise<AuditLogQueryResponse> {
  return queryAuditLogs(
    userId,
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
  userId: string,
  request: AuditLogExportRequest,
  correlationId: string = 'unknown'
): Promise<AuditLogExportResponse> {
  const format = request.format || 'csv';

  try {
    // Query all matching logs with pagination
    const filters = request.filters || {};
    const queryResponse = await queryAuditLogs(userId, filters, correlationId);

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
 * Convert audit log entries to CSV format with injection protection
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

  /**
   * Escape CSV values and prevent Excel formula injection
   * Values starting with =, +, -, or @ are prefixed with single quote
   */
  const escapeCsvValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }

    const str = String(value);
    
    // Check for Excel formula injection
    if (/^[=+\-@]/.test(str)) {
      // Prefix with single quote to prevent formula injection
      return `"'${str}"`;
    }
    
    // Standard CSV escaping for commas, quotes, newlines
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
