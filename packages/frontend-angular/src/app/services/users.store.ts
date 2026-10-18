import { Injectable, inject } from '@angular/core';

import { cacheKeys } from '../contracts/cache-keys';
import type { ListUsersParams, ListUsersResponse } from '../contracts/http/users.schema';
import type {
  CreateUserRequest,
  CreateUserResponse,
  UpdateUserRequest,
} from '../contracts/http/users.schema';
import { ResourceState, type ResourceSnapshot } from './resource-state';
import { UsersService } from './users.service';

/**
 * Users resource store (T2 §3.1 family store): the user list on
 * `ResourceState<T>`; create/update/delete invalidate the users list
 * (React `useCreateUser`/`useUpdateUser`/`useDeleteUser` mapping). The
 * role-definitions fetch (`UsersService.roles()`) is a form-options call
 * without a canonical cache key — it stays on the service.
 */
@Injectable({ providedIn: 'root' })
export class UsersStore {
  private readonly service = inject(UsersService);
  private readonly lists = new ResourceState<ListUsersResponse>();

  /** Reactive snapshot of one filtered user list, if loaded. */
  listSnapshot(params: ListUsersParams): ResourceSnapshot<ListUsersResponse> | undefined {
    return this.lists.snapshot(cacheKeys.users.list(params));
  }

  /** Load (or refresh) a filtered user list (error lands in state). */
  async loadUsers(params: ListUsersParams = {}): Promise<void> {
    try {
      await this.lists.load(cacheKeys.users.list(params), () => this.service.list(params));
    } catch {
      // State carries the error.
    }
  }

  /** POST /api/users → invalidate the users list. */
  createUser(body: CreateUserRequest): Promise<CreateUserResponse> {
    return this.service.create(body).then((response) => {
      this.lists.invalidate(cacheKeys.users.all());
      return response;
    });
  }

  /** PUT /api/users/:id → invalidate the users list. */
  updateUser(userId: string, body: UpdateUserRequest): Promise<void> {
    return this.service.update(userId, body).then(() => {
      this.lists.invalidate(cacheKeys.users.all());
    });
  }

  /** DELETE /api/users/:id → invalidate the users list. */
  deleteUser(userId: string): Promise<void> {
    return this.service.delete(userId).then(() => {
      this.lists.invalidate(cacheKeys.users.all());
    });
  }
}
