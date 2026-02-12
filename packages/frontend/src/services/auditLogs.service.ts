/**
 * Audit Logs Service
 * Handles audit log queries and exports
 */

import { api } from '../lib/apiClient';

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogsListResponse {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
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
      ? `/api/audit-logs/conversations/${conversationId}?${queryString}`
      : `/api/audit-logs/conversations/${conversationId}`;

    return api.get<AuditLogsListResponse>(endpoint);
  },

  /**
   * Export audit logs as CSV
   */
  async export(params: AuditLogsQueryParams = {}): Promise<Blob> {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });

    const queryString = query.toString();
    const endpoint = queryString
      ? `/api/audit-logs/export?${queryString}`
      : '/api/audit-logs/export';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to export audit logs');
    }

    return response.blob();
  },
};
