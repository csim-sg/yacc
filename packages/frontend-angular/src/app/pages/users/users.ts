import { Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Role, UserStatus } from '../../contracts/common/role.schema';
import type {
  ListUsersParams,
  ListUsersResponse,
  User,
} from '../../contracts/http/users.schema';
import { apiErrorMessage } from '../../lib/api-error-message';
import { AuthService } from '../../services/auth.service';
import type { ResourceSnapshot } from '../../services/resource-state';
import { UsersStore } from '../../services/users.store';

/** React `SortField`/`SortDirection` unions — client-side sort (the
 * backend does not support sort params, React comment parity). */
type SortField = 'email' | 'role' | 'status' | 'createdAt';
type SortDirection = 'asc' | 'desc';

/** React `useState<20 | 50 | 100>(20)` page-size union. */
type PageSize = 20 | 50 | 100;

/** React search debounce (`setTimeout(..., 300)` parity). */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Role-select options (wire role labels; canonical lowercase — G9).
 *
 * U4 (users `/roles` API-only parity): `GET /api/users/roles` has no live
 * FE consumer — the page must NOT call `UsersService.roles()` (contracts
 * manifest "Users | GET /api/users/roles | consumer: none | gap (G8 —
 * API-only)"; parity-of-absence). The selects carry the static labels the
 * React role-filter hardcodes (the API's canonical labels), so create/edit
 * stay usable without inventing a roles UI.
 */
const ROLE_OPTIONS: ReadonlyArray<{ id: Role; label: string }> = [
  { id: 'super_admin', label: 'Super Admin' },
  { id: 'admin', label: 'Admin' },
  { id: 'manager', label: 'Manager' },
  { id: 'user', label: 'User' },
];

/** Status-select options (wire status labels; React hardcoded both selects). */
const STATUS_OPTIONS: ReadonlyArray<{ id: UserStatus; label: string }> = [
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'suspended', label: 'Suspended' },
];

/** React `select` page-size values. */
const PAGE_SIZES: ReadonlyArray<PageSize> = [20, 50, 100];

/**
 * Users page (React `pages/UsersPage.tsx` + `components/admin/UsersTable.tsx`
 * port — W15). The React page is a 1:1 wrapper rendering the table, so one
 * component carries both (routing-rules page precedent).
 *
 * Users CRUD surface over the canonical store: the list rides
 * `UsersStore.loadUsers` keyed on filters+search+pagination (React
 * `useUsers(filters, pagination)` — per-key cache, 30s-fresh repeat visits
 * are store cache hits, TanStack staleTime parity); create/update/delete
 * ride the store mutations which invalidate the users list (React
 * `invalidateQueries(['users'] lists)` parity). Sorting is client-side
 * (React comment parity: the backend does not support sort yet); search
 * debounces 300ms and resets the page; role/status filters and page size
 * reset the page (React parity).
 *
 * RBAC: the in-component gate mirrors React `isSuperAdmin`
 * (`currentUser?.role === 'SUPER_ADMIN'` — permission alert for anyone
 * else); the route additionally carries `roleGuard('SUPER_ADMIN')` (React
 * `ProtectedRoute requiredRole="SUPER_ADMIN"` parity) — UX only, the
 * backend `@Authorized` stays the security boundary.
 *
 * One mutation runs at a time (only one modal can be open), so a single
 * pending/error pair carries the React per-mutation `isPending`/modal
 * error state (observationally identical).
 */
@Component({
  selector: 'app-users',
  imports: [FormsModule],
  templateUrl: './users.html',
})
export class Users implements OnDestroy {
  private readonly store = inject(UsersStore);
  private readonly auth = inject(AuthService);

  /** React `filters` — role/status only (search rides its own debounce). */
  protected readonly filters = signal<{ role?: Role; status?: UserStatus }>({});

  /** React `page`/`pageSize` — pagination state. */
  protected readonly page = signal(1);
  protected readonly pageSize = signal<PageSize>(20);

  /** React `sortField`/`sortDirection` — client-side sort. */
  protected readonly sortField = signal<SortField>('createdAt');
  protected readonly sortDirection = signal<SortDirection>('desc');

  /** React `showCreateModal`/`editingUser`/`deletingUser` — modal state. */
  protected readonly showCreateModal = signal(false);
  protected readonly editingUser = signal<User | null>(null);
  protected readonly deletingUser = signal<User | null>(null);

  /** React `searchInput` — the live input text (ngModel-bound). */
  protected searchInput = '';
  /** React `debouncedSearch` — applied to the list key after 300ms. */
  private readonly debouncedSearch = signal<string | undefined>(undefined);
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  /** React open mutation `isPending` — disables the open modal's buttons. */
  protected readonly isMutating = signal(false);
  /** React per-modal `error` state — one modal is open at a time. */
  protected readonly modalError = signal<string | null>(null);

  /** Create-modal form fields (React `CreateUserModal` `formData`). */
  protected createEmail = '';
  protected createName = '';
  protected createPassword = '';
  protected createRole: Role = 'user';

  /** Edit-modal form fields (React `EditUserModal` `formData`). */
  protected editName = '';
  protected editRole: Role = 'user';
  protected editStatus: UserStatus = 'active';

  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;

  /** React `useUsers({...filters, search}, {page, limit})` — one key. */
  private readonly listParams = computed<ListUsersParams>(() => ({
    ...this.filters(),
    search: this.debouncedSearch(),
    page: this.page(),
    limit: this.pageSize(),
  }));

  /** List resource snapshot (null while the key's first load is pending). */
  protected readonly listSnapshot = computed<ResourceSnapshot<ListUsersResponse> | null>(
    () => this.store.listSnapshot(this.listParams()) ?? null,
  );

  /** First load with nothing to show yet (React `isLoading` parity). */
  protected readonly isLoading = computed(() => {
    const snapshot = this.listSnapshot();
    return snapshot === null || (snapshot.loading && snapshot.data === undefined);
  });

  protected readonly hasListError = computed(() => this.listSnapshot()?.error != null);

  /** Rows after the client-side sort (React `sortedUsers` parity). */
  protected readonly sortedUsers = computed<User[]>(() => {
    const rows = [...(this.listSnapshot()?.data?.data ?? [])];
    const field = this.sortField();
    const direction = this.sortDirection();
    rows.sort((a, b) => {
      let comparison = 0;
      if (field === 'email') {
        comparison = a.email.localeCompare(b.email);
      } else if (field === 'role') {
        comparison = a.role.localeCompare(b.role);
      } else if (field === 'status') {
        comparison = a.status.localeCompare(b.status);
      } else {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return direction === 'asc' ? comparison : -comparison;
    });
    return rows;
  });

  /** React `data?.total` — the wire `BaseListResponse` total. */
  protected readonly total = computed(() => this.listSnapshot()?.data?.total ?? 0);

  protected readonly showingFrom = computed(() => (this.page() - 1) * this.pageSize() + 1);
  protected readonly showingTo = computed(() =>
    Math.min(this.page() * this.pageSize(), this.total()),
  );
  protected readonly lastPage = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );

  /** React `hasActiveFilters` — any role/status filter or a live search. */
  protected readonly hasActiveFilters = computed(
    () =>
      this.filters().role !== undefined ||
      this.filters().status !== undefined ||
      this.debouncedSearch() !== undefined,
  );

  /** React `isSuperAdmin` — exact SUPER_ADMIN equality (in-component gate). */
  protected readonly isSuperAdmin = computed(() => this.auth.user()?.role === 'SUPER_ADMIN');

  protected readonly currentUserId = computed(() => this.auth.user()?.id);

  constructor() {
    // React `useUsers` parity: one list load per
    // (filters+search+pagination) key; 30s-fresh repeat keys are store
    // cache hits (TanStack staleTime parity).
    effect(() => {
      const params = this.listParams();
      void untracked(() => {
        void this.store.loadUsers(params);
      });
    });
  }

  /** Cancel a scheduled-but-unfired search debounce timer, if any. */
  private cancelSearchDebounce(): void {
    if (this.searchTimeout !== null) {
      clearTimeout(this.searchTimeout);
    }
  }

  /** React unmount cleanup — clear the pending search debounce. */
  ngOnDestroy(): void {
    this.cancelSearchDebounce();
  }

  /**
   * React `handleSearchChange` — update the input, debounce 300ms, then
   * apply the search to the list key and reset to the first page.
   */
  protected onSearchChange(value: string): void {
    this.searchInput = value;
    this.cancelSearchDebounce();
    this.searchTimeout = setTimeout(() => {
      this.debouncedSearch.set(value || undefined);
      this.page.set(1);
    }, SEARCH_DEBOUNCE_MS);
  }

  /** React `handleSort` — new field sorts asc; same field toggles. */
  protected handleSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  /** React `handleFilterChange('role', ...)` — '' clears the filter. */
  protected onRoleFilterChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const value = event.target.value;
      const role = ROLE_OPTIONS.find((option) => option.id === value)?.id;
      this.filters.update((previous) => ({ ...previous, role }));
      this.page.set(1);
    }
  }

  /** React `handleFilterChange('status', ...)` — '' clears the filter. */
  protected onStatusFilterChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const value = event.target.value;
      const status = STATUS_OPTIONS.find((option) => option.id === value)?.id;
      this.filters.update((previous) => ({ ...previous, status }));
      this.page.set(1);
    }
  }

  /**
   * React `clearFilters` — filters, search and page reset. The pending
   * debounce is canceled first: a typed-but-not-yet-applied search must
   * not fire after the clear and reapply the query while the input is
   * blank (review loop 1 — PR #433 finding #6258676322).
   */
  protected clearFilters(): void {
    this.cancelSearchDebounce();
    this.filters.set({});
    this.searchInput = '';
    this.debouncedSearch.set(undefined);
    this.page.set(1);
  }

  /** React `setPageSize(Number(...)); setPage(1)` parity. */
  protected onPageSizeChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const value = event.target.value;
      const size = PAGE_SIZES.find((candidate) => candidate === Number(value));
      if (size !== undefined) {
        this.pageSize.set(size);
        this.page.set(1);
      }
    }
  }

  /** React `onClick={() => refetch()}` — re-run the current key's load. */
  protected retry(): void {
    void this.store.loadUsers(this.listParams());
  }

  /** React `setShowCreateModal(true)` — fresh form (useState initializer). */
  protected openCreate(): void {
    this.modalError.set(null);
    this.createEmail = '';
    this.createName = '';
    this.createPassword = '';
    this.createRole = 'user';
    this.showCreateModal.set(true);
  }

  /** React `setEditingUser(user)` — form seeded from the row. */
  protected openEdit(user: User): void {
    this.modalError.set(null);
    this.editName = user.name;
    this.editRole = user.role;
    this.editStatus = user.status;
    this.editingUser.set(user);
  }

  /** React `setDeletingUser(user)`. */
  protected openDelete(user: User): void {
    this.modalError.set(null);
    this.deletingUser.set(user);
  }

  /** React `onChange` on the create-modal role select (static U4 options). */
  protected onCreateRoleChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const value = event.target.value;
      const role = ROLE_OPTIONS.find((option) => option.id === value)?.id;
      if (role !== undefined) {
        this.createRole = role;
      }
    }
  }

  /** React `onChange` on the edit-modal role select (locked while editing self). */
  protected onEditRoleChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const value = event.target.value;
      const role = ROLE_OPTIONS.find((option) => option.id === value)?.id;
      if (role !== undefined) {
        this.editRole = role;
      }
    }
  }

  /** React `onChange` on the edit-modal status select (locked while editing self). */
  protected onEditStatusChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const value = event.target.value;
      const status = STATUS_OPTIONS.find((option) => option.id === value)?.id;
      if (status !== undefined) {
        this.editStatus = status;
      }
    }
  }

  /** React `isEditingSelf` — role/status lock for the signed-in row. */
  protected get isEditingSelf(): boolean {
    return this.editingUser()?.id === this.currentUserId();
  }

  /** React `isDeletingSelf`. */
  protected get isDeletingSelf(): boolean {
    return this.deletingUser()?.id === this.currentUserId();
  }

  /** React `isValid` — all four create fields present. */
  protected get createIsValid(): boolean {
    return Boolean(this.createEmail && this.createPassword && this.createName && this.createRole);
  }

  /** React `hasChanges` — any edit field differs from the row. */
  protected get editHasChanges(): boolean {
    const user = this.editingUser();
    if (user === null) {
      return false;
    }
    return (
      this.editName !== user.name || this.editRole !== user.role || this.editStatus !== user.status
    );
  }

  /** React `handleCreateUser` — store POST; success closes the modal. */
  protected async submitCreate(): Promise<void> {
    this.modalError.set(null);
    this.isMutating.set(true);
    try {
      await this.store.createUser({
        email: this.createEmail,
        password: this.createPassword,
        name: this.createName,
        role: this.createRole,
      });
      this.showCreateModal.set(false);
    } catch (err: unknown) {
      this.modalError.set(apiErrorMessage(err, 'Failed to create user'));
    } finally {
      this.isMutating.set(false);
    }
  }

  /** React `handleUpdateUser` — store PUT; success closes the modal. */
  protected async submitEdit(): Promise<void> {
    const user = this.editingUser();
    if (user === null) {
      return;
    }
    this.modalError.set(null);
    this.isMutating.set(true);
    try {
      await this.store.updateUser(user.id, {
        name: this.editName,
        role: this.editRole,
        status: this.editStatus,
      });
      this.editingUser.set(null);
    } catch (err: unknown) {
      this.modalError.set(apiErrorMessage(err, 'Failed to update user'));
    } finally {
      this.isMutating.set(false);
    }
  }

  /** React `handleDeleteUser` — store DELETE; success closes the modal. */
  protected async confirmDelete(): Promise<void> {
    const user = this.deletingUser();
    if (user === null) {
      return;
    }
    this.modalError.set(null);
    this.isMutating.set(true);
    try {
      await this.store.deleteUser(user.id);
      this.deletingUser.set(null);
    } catch (err: unknown) {
      this.modalError.set(apiErrorMessage(err, 'Failed to delete user'));
    } finally {
      this.isMutating.set(false);
    }
  }

  /** React `new Date(user.createdAt).toLocaleDateString()` parity. */
  protected formattedDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
}
