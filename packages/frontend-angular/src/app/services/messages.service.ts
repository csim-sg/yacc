import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  ListMessagesResponse,
  RetryMessageResponse,
  SendMessageRequest,
  SendMessageResponse,
} from '../contracts/http/messages.schema';
import { mutationContext } from '../interceptors/http-context';

/**
 * Messages HTTP service (T2 §3.5 — one service per backend family; the
 * live `GET/POST /api/conversations/:id/messages` surface, frozen
 * contract). Owns IO only; state lives in `MessagesStore`.
 */
@Injectable({ providedIn: 'root' })
export class MessagesService {
  private readonly http = inject(HttpClient);

  /**
   * GET /api/conversations/:conversationId/messages?page&limit — verified
   * wire shape `{ messages, total, page, limit }`.
   */
  list(
    conversationId: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<ListMessagesResponse> {
    const query = new URLSearchParams();
    if (params.page !== undefined) {
      query.set('page', String(params.page));
    }
    if (params.limit !== undefined) {
      query.set('limit', String(params.limit));
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return firstValueFrom(
      this.http.get<ListMessagesResponse>(
        `/api/conversations/${conversationId}/messages${suffix}`,
      ),
    );
  }

  /** POST /api/conversations/:conversationId/messages — raw message (201). */
  send(conversationId: string, body: SendMessageRequest): Promise<SendMessageResponse> {
    return firstValueFrom(
      this.http.post<SendMessageResponse>(
        `/api/conversations/${conversationId}/messages`,
        body,
        { context: mutationContext() },
      ),
    );
  }

  /** POST .../messages/:messageId/retry — `{ data: message }` (exactly-once click tracking preserved by the caller). */
  retry(conversationId: string, messageId: string): Promise<RetryMessageResponse> {
    return firstValueFrom(
      this.http.post<RetryMessageResponse>(
        `/api/conversations/${conversationId}/messages/${messageId}/retry`,
        undefined,
        { context: mutationContext() },
      ),
    );
  }
}
