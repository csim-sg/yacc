import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  AssignConversationRequest,
  AssignConversationResponse,
} from '../contracts/http/assignments.schema';
import type {
  AssignConversationByIdRequest,
  GetConversationResponse,
  ListConversationsParams,
  ListConversationsResponse,
  UpdateConversationPriorityRequest,
  UpdateConversationResponse,
  UpdateConversationStatusRequest,
} from '../contracts/http/conversations.schema';
import { toHttpParams } from '../lib/http-params';
import { mutationContext } from '../interceptors/http-context';

/**
 * Conversations HTTP service (T2 §3.5 — one service per backend family,
 * mirroring the React `conversations.service.ts`; frozen OpenAPI surface,
 * ADR-023/GOV-038). Owns IO only; state lives in `ConversationsStore`.
 */
@Injectable({ providedIn: 'root' })
export class ConversationsService {
  private readonly http = inject(HttpClient);

  /** GET /api/conversations — filtered/paginated list. */
  list(params: ListConversationsParams = {}): Promise<ListConversationsResponse> {
    return firstValueFrom(
      this.http.get<ListConversationsResponse>('/api/conversations', {
        params: toHttpParams(params),
      }),
    );
  }

  /** GET /api/conversations/:id — `{ data: conversation }`. */
  getById(conversationId: string): Promise<GetConversationResponse> {
    return firstValueFrom(
      this.http.get<GetConversationResponse>(`/api/conversations/${conversationId}`),
    );
  }

  /** PATCH /api/conversations/:id/status (admin/manager/super_admin). */
  updateStatus(
    conversationId: string,
    body: UpdateConversationStatusRequest,
  ): Promise<UpdateConversationResponse> {
    return firstValueFrom(
      this.http.patch<UpdateConversationResponse>(
        `/api/conversations/${conversationId}/status`,
        body,
        { context: mutationContext() },
      ),
    );
  }

  /** PATCH /api/conversations/:id/priority (manager+). */
  updatePriority(
    conversationId: string,
    body: UpdateConversationPriorityRequest,
  ): Promise<UpdateConversationResponse> {
    return firstValueFrom(
      this.http.patch<UpdateConversationResponse>(
        `/api/conversations/${conversationId}/priority`,
        body,
        { context: mutationContext() },
      ),
    );
  }

  /** PATCH /api/conversations/:id/assign (admin+). */
  assignById(
    conversationId: string,
    body: AssignConversationByIdRequest,
  ): Promise<UpdateConversationResponse> {
    return firstValueFrom(
      this.http.patch<UpdateConversationResponse>(
        `/api/conversations/${conversationId}/assign`,
        body,
        { context: mutationContext() },
      ),
    );
  }

  /**
   * POST /api/conversations/:conversationId/assign (manager+) — the live
   * assignment endpoint (assignments family; no unassign exists, W10).
   */
  assign(
    conversationId: string,
    body: AssignConversationRequest,
  ): Promise<AssignConversationResponse> {
    return firstValueFrom(
      this.http.post<AssignConversationResponse>(
        `/api/conversations/${conversationId}/assign`,
        body,
        { context: mutationContext() },
      ),
    );
  }
}
