import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  ExportAuditLogsRequest,
  ListAuditLogsParams,
  ListAuditLogsResponse,
  ListConversationAuditLogsParams,
} from '../contracts/http/audit-logs.schema';
import { toHttpParams } from '../lib/http-params';

/**
 * Audit-logs HTTP service (T2 §3.5 — mirrors the React
 * `auditLogs.service.ts`, blob export included via `responseType:
 * 'blob'`). Owns IO only; state lives in `AuditLogsStore`.
 */
@Injectable({ providedIn: 'root' })
export class AuditLogsService {
  private readonly http = inject(HttpClient);

  /** GET /api/audit-logs — filtered/paginated list. */
  list(params: ListAuditLogsParams = {}): Promise<ListAuditLogsResponse> {
    return firstValueFrom(
      this.http.get<ListAuditLogsResponse>('/api/audit-logs', {
        params: toHttpParams(params),
      }),
    );
  }

  /** GET /api/conversations/:conversationId/audit-logs. */
  listForConversation(
    conversationId: string,
    params: ListConversationAuditLogsParams = {},
  ): Promise<ListAuditLogsResponse> {
    return firstValueFrom(
      this.http.get<ListAuditLogsResponse>(
        `/api/conversations/${conversationId}/audit-logs`,
        { params: toHttpParams(params) },
      ),
    );
  }

  /** POST /api/audit-logs/export — CSV/JSON blob download. */
  export(request: ExportAuditLogsRequest): Promise<Blob> {
    return firstValueFrom(
      this.http.post('/api/audit-logs/export', request, { responseType: 'blob' }),
    );
  }
}
