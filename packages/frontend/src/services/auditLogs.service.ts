/**
 * Audit Logs Service
 * Handles audit log queries and exports
 */

import { api } from '../lib/apiClient';

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogsListResponse {
  success: boolean;
  data: AuditLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface AuditLogsQueryParams {
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface ConversationAuditLogsQueryParams {
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogsExportRequest {
  format?: 'csv' | 'json';
  filters?: Record<string, unknown>;
}

export const auditLogsService = {
  /**
   * Query audit logs with filters
   */
  async query(params: AuditLogsQueryParams = {}): Promise<AuditLogsListResponse> {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });

    const queryString = query.toString();
    const endpoint = queryString
      ? `/api/audit-logs?${queryString}`
      : '/api/audit-logs';

    return api.get<AuditLogsListResponse>(endpoint);
  },

  /**
   * Get audit logs for a specific conversation
   * GET /api/conversations/:conversationId/audit-logs?page=1&limit=50
   * Response: { success, data, pagination: { total, page, limit, pages } }
   */
  async queryByConversation(
    conversationId: string,
    params: ConversationAuditLogsQueryParams = {}
  ): Promise<AuditLogsListResponse> {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });

    const queryString = query.toString();
    const endpoint = queryString
      ? `/api/conversations/${conversationId}/audit-logs?${queryString}`
      : `/api/conversations/${conversationId}/audit-logs`;

    return api.get<AuditLogsListResponse>(endpoint);
  },

  /**
   * Export audit logs as CSV or JSON
   * POST /api/audit-logs/export
   * Body: { format?: 'csv'|'json', filters?: {...} }
   * Response: Blob (CSV/JSON content directly)
   */
  async export(format: 'csv' | 'json' = 'csv', filters?: Record<string, unknown>): Promise<Blob> {
    const payload: AuditLogsExportRequest = {
      format,
      filters,
    };

    const response = await fetch('/api/audit-logs/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to export audit logs: ${response.statusText}`);
    }

    return response.blob();
  },
};
