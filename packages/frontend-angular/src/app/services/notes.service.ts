import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  CreateNoteRequest,
  CreateNoteResponse,
  ListNotesParams,
  ListNotesResponse,
} from '../contracts/http/notes.schema';
import { toHttpParams } from '../lib/http-params';
import { mutationContext } from '../interceptors/http-context';

/**
 * Notes HTTP service (T2 §3.5 — mirrors the React `notes.service.ts`;
 * `pageSize` request params are the verified wire drift row). Owns IO
 * only; state lives in `NotesStore`.
 */
@Injectable({ providedIn: 'root' })
export class NotesService {
  private readonly http = inject(HttpClient);

  /** GET /api/conversations/:conversationId/notes. */
  list(
    conversationId: string,
    params: ListNotesParams = {},
  ): Promise<ListNotesResponse> {
    return firstValueFrom(
      this.http.get<ListNotesResponse>(
        `/api/conversations/${conversationId}/notes`,
        { params: toHttpParams(params) },
      ),
    );
  }

  /** POST /api/conversations/:conversationId/notes — `{ data: note }`. */
  create(conversationId: string, body: CreateNoteRequest): Promise<CreateNoteResponse> {
    return firstValueFrom(
      this.http.post<CreateNoteResponse>(
        `/api/conversations/${conversationId}/notes`,
        body,
        { context: mutationContext() },
      ),
    );
  }
}
