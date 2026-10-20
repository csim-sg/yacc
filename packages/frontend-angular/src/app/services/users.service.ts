import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  CreateUserRequest,
  CreateUserResponse,
  DeleteUserResponse,
  ListRolesResponse,
  ListUsersParams,
  ListUsersResponse,
  UpdateUserRequest,
  UpdateUserResponse,
} from '../contracts/http/users.schema';
import { toHttpParams } from '../lib/http-params';
import { mutationContext } from '../interceptors/http-context';

/**
 * Users HTTP service (T2 §3.5 — mirrors the React `users.service.ts`).
 * Owns IO only; state lives in `UsersStore`.
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly baseUrl = '/api/users';
  private readonly http = inject(HttpClient);

  /** GET /api/users — filtered/paginated list. */
  list(params: ListUsersParams = {}): Promise<ListUsersResponse> {
    return firstValueFrom(
      this.http.get<ListUsersResponse>(this.baseUrl, { params: toHttpParams(params) }),
    );
  }

  /** POST /api/users. */
  create(body: CreateUserRequest): Promise<CreateUserResponse> {
    return firstValueFrom(
      this.http.post<CreateUserResponse>(this.baseUrl, body, { context: mutationContext() }),
    );
  }

  /** PUT /api/users/:id. */
  update(userId: string, body: UpdateUserRequest): Promise<UpdateUserResponse> {
    return firstValueFrom(
      this.http.put<UpdateUserResponse>(`${this.baseUrl}/${userId}`, body, {
        context: mutationContext(),
      }),
    );
  }

  /** DELETE /api/users/:id. */
  delete(userId: string): Promise<DeleteUserResponse> {
    return firstValueFrom(
      this.http.delete<DeleteUserResponse>(`${this.baseUrl}/${userId}`, {
        context: mutationContext(),
      }),
    );
  }

  /** GET /api/users/roles — role definitions for the management forms. */
  roles(): Promise<ListRolesResponse> {
    return firstValueFrom(this.http.get<ListRolesResponse>(`${this.baseUrl}/roles`));
  }
}
