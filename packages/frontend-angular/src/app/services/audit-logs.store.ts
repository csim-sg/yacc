import { Injectable, inject } from '@angular/core';

import { cacheKeys } from '../contracts/cache-keys';
import type {
  ListAuditLogsParams,
  ListAuditLogsResponse,
  ListConversationAuditLogsParams,
} from '../contracts/http/audit-logs.schema';
import type { ExportAuditLogsRequest } from '../contracts/http/audit-logs.schema';
import { AuditLogsService } from './audit-logs.service';
import { ResourceState, type ResourceSnapshot } from './resource-state';

/**
 * Audit-logs resource store (T2 §3.1 family store): global and
 * conversation-scoped audit-log lists on `ResourceState<T>`. The blob
 * export stays on the service (a download has no cache to invalidate).
 */
@Injectable({ providedIn: 'root' })
export class AuditLogsStore {
  private readonly service = inject(AuditLogsService);
  private readonly global = new ResourceState<ListAuditLogsResponse>();
  private readonly byConversation = new ResourceState<ListAuditLogsResponse>();

  /** Reactive snapshot of one filtered audit-log list, if loaded. */
  listSnapshot(params: ListAuditLogsParams): ResourceSnapshot<ListAuditLogsResponse> | undefined {
    return this.global.snapshot(cacheKeys.auditLogs.list(params));
  }

  /** Reactive snapshot of one conversation's audit logs, if loaded. */
  conversationSnapshot(
    conversationId: string,
    params: ListConversationAuditLogsParams = {},
  ): ResourceSnapshot<ListAuditLogsResponse> | undefined {
    return this.byConversation.snapshot([
      ...cacheKeys.conversations.auditLogs(conversationId),
      params,
    ]);
  }

  /** Load (or refresh) the filtered audit-log list. */
  async loadLogs(params: ListAuditLogsParams = {}): Promise<void> {
    try {
      await this.global.load(cacheKeys.auditLogs.list(params), () => this.service.list(params));
    } catch {
      // State carries the error.
    }
  }

  /** Load (or refresh) one conversation's audit logs. */
  async loadConversationLogs(
    conversationId: string,
    params: ListConversationAuditLogsParams = {},
  ): Promise<void> {
    try {
      await this.byConversation.load(
        [...cacheKeys.conversations.auditLogs(conversationId), params],
        () => this.service.listForConversation(conversationId, params),
      );
    } catch {
      // State carries the error.
    }
  }

  /** POST /api/audit-logs/export — CSV/JSON blob (rejects on failure). */
  export(request: ExportAuditLogsRequest): Promise<Blob> {
    return this.service.export(request);
  }
}
