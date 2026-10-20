import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  AttachTagRequest,
  ConversationTagsResponse,
  CreateTagRequest,
  CreateTagResponse,
  ListTagsResponse,
} from '../contracts/http/tags.schema';
import { mutationContext } from '../interceptors/http-context';

/**
 * Tags HTTP service (T2 §3.5 — mirrors the React `tags.service.ts`).
 * Owns IO only; state lives in `TagsStore`.
 */
@Injectable({ providedIn: 'root' })
export class TagsService {
  private readonly http = inject(HttpClient);

  /** GET /api/tags — `{ data: Tag[] }`. */
  list(): Promise<ListTagsResponse> {
    return firstValueFrom(this.http.get<ListTagsResponse>('/api/tags'));
  }

  /** POST /api/tags — `{ data: Tag }`. */
  create(body: CreateTagRequest): Promise<CreateTagResponse> {
    return firstValueFrom(
      this.http.post<CreateTagResponse>('/api/tags', body, { context: mutationContext() }),
    );
  }

  /** POST /api/conversations/:conversationId/tags — attach a tag. */
  attach(
    conversationId: string,
    body: AttachTagRequest,
  ): Promise<ConversationTagsResponse> {
    return firstValueFrom(
      this.http.post<ConversationTagsResponse>(
        `/api/conversations/${conversationId}/tags`,
        body,
        { context: mutationContext() },
      ),
    );
  }

  /** DELETE /api/conversations/:conversationId/tags/:tagId — detach a tag. */
  detach(conversationId: string, tagId: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`/api/conversations/${conversationId}/tags/${tagId}`, {
        context: mutationContext(),
      }),
    );
  }
}
