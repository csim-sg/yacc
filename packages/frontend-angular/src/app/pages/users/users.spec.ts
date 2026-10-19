import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterOutlet, provideRouter, Router } from '@angular/router';

import { errorMappingInterceptor } from '../../interceptors/error-mapping.interceptor';
import { Users } from './users';

@Component({ selector: 'app-stub', template: '' })
class StubPage {}

@Component({
  selector: 'app-test-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class TestHost {}

/**
 * Users page spec (ANG-011 — W15 users admin CRUD + roles, React
 * `components/admin/__tests__/UsersTable.spec.tsx` port).
 *
 * Covers: table rendering with role/status badges and the Showing range,
 * the in-component SUPER_ADMIN gate (React `isSuperAdmin` parity — the
 * route-level `roleGuard('SUPER_ADMIN')` wiring is pinned in
 * `app.routes.spec.ts` and the role×requirement matrix in
 * `guards.spec.ts`), loading/error(+Retry)/empty states, client-side
 * sorting with the arrow indicator, role filter + clear-filters, the
 * 300ms debounced search with page reset, pagination + page size, and
 * the create/edit/delete modals incl. self-modification prevention.
 *
 * U4 (`GET /api/users/roles` — API-only parity): the page never calls the
 * roles endpoint; `HttpTestingController.verify()` in `afterEach` fails
 * the suite on any unexpected request, so a roles fetch could not slip
 * through, and the render test asserts none explicitly.
 */
describe('Users page', () => {
  let fixture: ComponentFixture<TestHost>;
  let router: Router;
  let http: HttpTestingController;

  /** Wire role of the signed-in session (lowercase, frozen contract). */
  const SUPER_ADMIN = {
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'super_admin',
    status: 'active',
  };
  const PLAIN_USER = {
    id: 'user-9',
    email: 'plain@example.com',
    name: 'Plain User',
    role: 'user',
    status: 'active',
  };
  const ADMIN = {
    id: 'user-8',
    email: 'admin2@example.com',
    name: 'Admin Two',
    role: 'admin',
    status: 'active',
  };

  const user = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'super_admin',
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });

  const defaultUsers = (): Record<string, unknown>[] => [
    user(),
    user({
      id: 'user-2',
      email: 'manager@example.com',
      name: 'Manager User',
      role: 'manager',
      status: 'active',
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    }),
    user({
      id: 'user-3',
      email: 'user@example.com',
      name: 'Regular User',
      role: 'user',
      status: 'inactive',
      createdAt: '2024-01-03T00:00:00.000Z',
      updatedAt: '2024-01-03T00:00:00.000Z',
    }),
  ];

  const listResponse = (
    rows: Record<string, unknown>[],
    total = rows.length,
  ): Record<string, unknown> => ({ data: rows, page: 1, limit: 20, total });

  function pageElement(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function query(testId: string): HTMLElement | null {
    return pageElement().querySelector(`[data-testid="${testId}"]`);
  }

  function button(testId: string): HTMLButtonElement {
    return query(testId) as HTMLButtonElement;
  }

  async function render(url = '/users'): Promise<void> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * Seed the token storage and render: the AuthService memoizes its
   * session restore at construction, so the token MUST exist before the
   * component instantiates — the construction-time get-session is then
   * flushed here.
   */
  async function renderSignedIn(session: Record<string, string>): Promise<void> {
    localStorage.setItem('yacc_token', 'access-1');
    localStorage.setItem('yacc_refresh_token', 'refresh-1');
    localStorage.setItem('yacc_token_kind', 'local');
    await render();
    http.expectOne('/api/auth/get-session').flush({ user: session, mustChangePassword: false });
    fixture.detectChanges();
  }

  /** Flush the users list response for the first page and let state settle. */
  async function flushUsers(
    response: Record<string, unknown> = listResponse(defaultUsers()),
    url = '/api/users?page=1&limit=20',
  ): Promise<void> {
    fixture.detectChanges();
    http.expectOne(url).flush(response);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function setInput(testId: string, value: string): void {
    const input = query(testId) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function setSelect(testId: string, value: string): void {
    const select = query(testId) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
  }

  /** Second CD pass — NgModel/bindings land after the render that created them. */
  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Find a button by its exact visible label (React parity: no testid). */
  function buttonWithLabel(label: string): HTMLButtonElement | null {
    return Array.from(pageElement().querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    ) as HTMLButtonElement | null;
  }

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TestHost, Users],
      providers: [
        provideHttpClient(withInterceptors([errorMappingInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'users', component: Users },
          { path: '', component: StubPage },
          { path: 'login', component: StubPage },
        ]),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TestHost);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    localStorage.clear();
  });

  it('renders the user rows with role/status badges, created dates and the Showing range', async () => {
    await renderSignedIn(SUPER_ADMIN);
    await flushUsers();

    expect(query('users-table')).toBeDefined();
    expect(query('create-user-btn')).toBeDefined();
    expect(query('search-input')).toBeDefined();
    expect(query('role-filter')).toBeDefined();
    expect(query('status-filter')).toBeDefined();
    expect(query('page-size-select')).toBeDefined();
    expect(pageElement().textContent).toContain('Showing 1-3 of 3 users');

    // Default sort createdAt desc → the newest user first (React parity).
    const rows = pageElement().querySelectorAll('[data-testid^="user-row-"]');
    expect(rows).toHaveLength(3);
    const firstRow = rows[0];
    expect(firstRow.textContent).toContain('user@example.com');
    expect(firstRow.querySelector('.badge')?.textContent?.trim()).toBe('user');
    // inactive → badge-warning (React class fork parity).
    expect(firstRow.querySelector('.badge-warning')).toBeDefined();

    const superAdminRow = pageElement().querySelector('[data-testid="user-row-user-1"]');
    expect(superAdminRow?.querySelector('.badge')?.textContent?.trim()).toBe('super_admin');
    expect(superAdminRow?.querySelector('.badge-primary')).toBeDefined();

    // Self-modification prevention (React parity): the signed-in row's
    // delete button is disabled with the explanatory title.
    const selfDelete = button('delete-btn-user-1');
    expect(selfDelete.disabled).toBe(true);
    expect(selfDelete.getAttribute('title')).toBe('Cannot delete your own account');
    expect(button('delete-btn-user-2').disabled).toBe(false);

    // U4: the roles endpoint is API-only — never fetched by this page.
    expect(http.match((request) => request.url === '/api/users/roles')).toEqual([]);
  });

  it('shows the permission warning for non-SUPER_ADMIN sessions (in-component React isSuperAdmin parity)', async () => {
    await renderSignedIn(PLAIN_USER);
    await flushUsers();

    expect(pageElement().textContent).toContain('You do not have permission to manage users');
    expect(query('create-user-btn')).toBeNull();
    expect(query('users-table')).toBeNull();
  });

  it('denies ADMIN too (exact SUPER_ADMIN equality, React parity)', async () => {
    await renderSignedIn(ADMIN);
    await flushUsers();

    expect(pageElement().textContent).toContain('You do not have permission to manage users');
    expect(query('users-table')).toBeNull();
  });

  it('shows the loading state until the first list load lands', async () => {
    await renderSignedIn(SUPER_ADMIN);
    fixture.detectChanges();

    expect(query('loading-state')).toBeDefined();

    await flushUsers();
    expect(query('loading-state')).toBeNull();
    expect(query('users-table')).toBeDefined();
  });

  it('renders the error alert on a failed load and refetches on Retry', async () => {
    await renderSignedIn(SUPER_ADMIN);
    fixture.detectChanges();
    http
      .expectOne('/api/users?page=1&limit=20')
      .flush({ error: 'Users unavailable' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query('error-alert')).toBeDefined();
    expect(pageElement().textContent).toContain('Failed to load users');
    expect(query('users-table')).toBeNull();

    buttonWithLabel('Retry')?.click();
    fixture.detectChanges();
    http.expectOne('/api/users?page=1&limit=20').flush(listResponse(defaultUsers()));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query('error-alert')).toBeNull();
    expect(query('users-table')).toBeDefined();
  });

  it('renders the empty state when no users exist', async () => {
    await renderSignedIn(SUPER_ADMIN);
    await flushUsers(listResponse([], 0));

    expect(query('empty-state')).toBeDefined();
    expect(pageElement().textContent).toContain('No users found');
    expect(query('users-table')).toBeNull();
  });

  it('sorts client-side with the arrow indicator (email asc/desc toggle, then role)', async () => {
    await renderSignedIn(SUPER_ADMIN);
    await flushUsers();

    button('sort-email').click();
    fixture.detectChanges();
    expect(query('sort-email')?.textContent).toContain('↑');
    expect(
      pageElement().querySelector('[data-testid^="user-row-"]')?.textContent,
    ).toContain('admin@example.com');

    button('sort-email').click();
    fixture.detectChanges();
    expect(query('sort-email')?.textContent).toContain('↓');
    expect(
      pageElement().querySelector('[data-testid^="user-row-"]')?.textContent,
    ).toContain('user@example.com');

    button('sort-role').click();
    fixture.detectChanges();
    expect(query('sort-role')?.textContent).toContain('↑');
    // role asc: manager < super_admin < user → the manager row leads.
    expect(
      pageElement().querySelector('[data-testid^="user-row-"]')?.textContent,
    ).toContain('manager@example.com');
  });

  it('filters by role through a new list request and clears back from cache', async () => {
    await renderSignedIn(SUPER_ADMIN);
    await flushUsers();

    setSelect('role-filter', 'admin');
    fixture.detectChanges();
    http
      .expectOne('/api/users?role=admin&page=1&limit=20')
      .flush(listResponse([user({ role: 'admin', email: 'admin2@example.com' })], 1));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(pageElement().textContent).toContain('Showing 1-1 of 1 users');
    expect(query('clear-filters-btn')).toBeDefined();

    // Clear reverts to the default key — served fresh from the store cache
    // (TanStack staleTime parity), so NO second request is made.
    button('clear-filters-btn').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((query('role-filter') as HTMLSelectElement).value).toBe('');
    expect(query('clear-filters-btn')).toBeNull();
    expect(pageElement().textContent).toContain('Showing 1-3 of 3 users');
  });

  it('applies the search after the 300ms debounce and resets to the first page', async () => {
    await renderSignedIn(SUPER_ADMIN);
    // total 45 → the next-page button is enabled naturally.
    await flushUsers(listResponse(defaultUsers(), 45));

    // Move to page 2 first — the debounced search must reset the page.
    button('next-page-btn').click();
    fixture.detectChanges();
    http.expectOne('/api/users?page=2&limit=20').flush(listResponse(defaultUsers(), 45));
    await fixture.whenStable();
    fixture.detectChanges();

    setInput('search-input', 'manager');
    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();

    http.expectOne('/api/users?search=manager&page=1&limit=20').flush(
      listResponse([
        user({
          id: 'user-2',
          email: 'manager@example.com',
          name: 'Manager User',
          role: 'manager',
          status: 'active',
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        }),
      ]),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(pageElement().textContent).toContain('Showing 1-1 of 1 users');
  });

  it('canceling filters before the debounce expires drops the pending search (no stale reapply)', async () => {
    await renderSignedIn(SUPER_ADMIN);
    await flushUsers();

    // Activate a role filter so the Clear Filters button is visible, then
    // type a search WITHOUT letting the 300ms debounce fire (fake timers).
    setSelect('role-filter', 'admin');
    fixture.detectChanges();
    http
      .expectOne('/api/users?role=admin&page=1&limit=20')
      .flush(listResponse([user({ role: 'admin', email: 'admin2@example.com' })], 1));
    await fixture.whenStable();
    fixture.detectChanges();

    vi.useFakeTimers();
    // ngModel view→model is synchronous: onSearchChange runs here and
    // schedules the (fake) 300ms debounce.
    setInput('search-input', 'manager');
    // NgModel syncs the [ngModel] binding through a microtask — drain it
    // between the two user events (the real-browser zone.js ticks).
    fixture.detectChanges();
    await Promise.resolve();
    button('clear-filters-btn').click();
    fixture.detectChanges();
    await Promise.resolve();

    // The clear applies immediately: the input is blank and nothing is active.
    expect((query('search-input') as HTMLInputElement).value).toBe('');
    expect(query('clear-filters-btn')).toBeNull();

    // The canceled debounce must not fire and reapply the cleared query.
    vi.advanceTimersByTime(300);
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    vi.useRealTimers();

    http.expectNone('/api/users?search=manager&page=1&limit=20');
    // The view stays on the unfiltered default key (served from store cache).
    expect(pageElement().textContent).toContain('Showing 1-3 of 3 users');
  });

  it('paginates through the list and flips prev/next at the boundaries', async () => {
    await renderSignedIn(SUPER_ADMIN);
    await flushUsers(listResponse(defaultUsers(), 45));
    await settle();

    expect(pageElement().textContent).toContain('Showing 1-20 of 45 users');
    expect(button('prev-page-btn').disabled).toBe(true);

    button('next-page-btn').click();
    fixture.detectChanges();
    http.expectOne('/api/users?page=2&limit=20').flush(listResponse(defaultUsers(), 45));
    await fixture.whenStable();
    fixture.detectChanges();
    await settle();

    expect(pageElement().textContent).toContain('Showing 21-40 of 45 users');
    expect(button('prev-page-btn').disabled).toBe(false);
    expect(button('next-page-btn').disabled).toBe(false);

    button('next-page-btn').click();
    fixture.detectChanges();
    http.expectOne('/api/users?page=3&limit=20').flush(listResponse(defaultUsers(), 45));
    await fixture.whenStable();
    fixture.detectChanges();
    await settle();

    expect(pageElement().textContent).toContain('Showing 41-45 of 45 users');
    expect(button('next-page-btn').disabled).toBe(true);

    button('prev-page-btn').click();
    fixture.detectChanges();
    await settle();
    // Back to page 2 is served from the store cache (30s freshness —
    // TanStack staleTime parity): NO second request is made.
    expect(pageElement().textContent).toContain('Showing 21-40 of 45 users');
    expect(button('next-page-btn').disabled).toBe(false);
  });

  it('changes the page size through the select and resets to the first page', async () => {
    await renderSignedIn(SUPER_ADMIN);
    await flushUsers(listResponse(defaultUsers(), 45));

    button('next-page-btn').click();
    fixture.detectChanges();
    http.expectOne('/api/users?page=2&limit=20').flush(listResponse(defaultUsers(), 45));
    await fixture.whenStable();
    fixture.detectChanges();

    setSelect('page-size-select', '50');
    fixture.detectChanges();
    http.expectOne('/api/users?page=1&limit=50').flush(listResponse(defaultUsers(), 45));
    await fixture.whenStable();
    fixture.detectChanges();
    await settle();

    expect(pageElement().textContent).toContain('Showing 1-45 of 45 users');
  });

  it('creates a user through the create modal (POST, closes on success, error keeps it open)', async () => {
    await renderSignedIn(SUPER_ADMIN);
    await flushUsers();

    button('create-user-btn').click();
    fixture.detectChanges();
    await settle();

    expect(query('create-user-modal')).toBeDefined();
    expect(query('create-email-input')).toBeDefined();
    expect(query('create-name-input')).toBeDefined();
    expect(query('create-password-input')).toBeDefined();
    expect(query('create-role-select')).toBeDefined();
    // Empty form → submit disabled (React parity).
    expect(button('create-submit-btn').disabled).toBe(true);

    setInput('create-email-input', 'new@example.com');
    setInput('create-name-input', 'New User');
    setInput('create-password-input', 'secret12');
    setSelect('create-role-select', 'manager');
    fixture.detectChanges();
    expect(button('create-submit-btn').disabled).toBe(false);

    button('create-submit-btn').click();
    fixture.detectChanges();
    const request = http.expectOne('/api/users');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'new@example.com',
      password: 'secret12',
      name: 'New User',
      role: 'manager',
    });
    request.flush({ id: 'user-7', email: 'new@example.com', name: 'New User', role: 'manager', status: 'active', createdAt: '2026-10-19T00:00:00' });
    await fixture.whenStable();
    fixture.detectChanges();

    // Success closes the modal; the store invalidated the list.
    expect(query('create-user-modal')).toBeNull();
    http.expectOne('/api/users?page=1&limit=20').flush(
      listResponse([...defaultUsers(), user({ id: 'user-7', email: 'new@example.com' })], 4),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(pageElement().textContent).toContain('new@example.com');

    // Failure path: the modal stays open and surfaces the API error.
    button('create-user-btn').click();
    fixture.detectChanges();
    await settle();
    setInput('create-email-input', 'new@example.com');
    setInput('create-name-input', 'New User');
    setInput('create-password-input', 'secret12');
    fixture.detectChanges();
    button('create-submit-btn').click();
    fixture.detectChanges();
    http
      .expectOne('/api/users')
      .flush({ error: 'email already exists' }, { status: 422, statusText: 'Unprocessable Entity' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query('create-user-modal')).toBeDefined();
    expect(pageElement().textContent).toContain('email already exists');

    // Cancel closes without a request.
    buttonWithLabel('Cancel')?.click();
    fixture.detectChanges();
    expect(query('create-user-modal')).toBeNull();
  });

  it('edits a user through the edit modal (PUT seeded from the row, disabled until changed)', async () => {
    await renderSignedIn(SUPER_ADMIN);
    await flushUsers();

    button('edit-btn-user-2').click();
    fixture.detectChanges();
    await settle();

    expect(query('edit-user-modal')).toBeDefined();
    expect(pageElement().textContent).toContain('Edit User: manager@example.com');
    expect((query('edit-name-input') as HTMLInputElement).value).toBe('Manager User');
    expect((query('edit-role-select') as HTMLSelectElement).value).toBe('manager');
    expect((query('edit-status-select') as HTMLSelectElement).value).toBe('active');
    // Unchanged form → submit disabled (React hasChanges parity).
    expect(button('edit-submit-btn').disabled).toBe(true);

    setInput('edit-name-input', 'Renamed Manager');
    fixture.detectChanges();
    expect(button('edit-submit-btn').disabled).toBe(false);

    button('edit-submit-btn').click();
    fixture.detectChanges();
    const request = http.expectOne('/api/users/user-2');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      name: 'Renamed Manager',
      role: 'manager',
      status: 'active',
    });
    request.flush({
      id: 'user-2',
      email: 'manager@example.com',
      name: 'Renamed Manager',
      role: 'manager',
      status: 'active',
      updatedAt: '2026-10-19T00:00:00',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    await settle();

    expect(query('edit-user-modal')).toBeNull();
    http.expectOne('/api/users?page=1&limit=20').flush(
      listResponse([user({ id: 'user-2', name: 'Renamed Manager' })], 3),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    await settle();

    // Failure path: the modal stays open and surfaces the API error.
    button('edit-btn-user-2').click();
    fixture.detectChanges();
    await settle();
    setInput('edit-name-input', 'Renamed Again');
    fixture.detectChanges();
    button('edit-submit-btn').click();
    fixture.detectChanges();
    http
      .expectOne('/api/users/user-2')
      .flush({ error: 'cannot update user' }, { status: 422, statusText: 'Unprocessable Entity' });
    await fixture.whenStable();
    fixture.detectChanges();
    await settle();

    expect(query('edit-user-modal')).toBeDefined();
    expect(pageElement().textContent).toContain('cannot update user');
  });

  it('locks role/status with a warning when editing the signed-in user (self parity)', async () => {
    await renderSignedIn(SUPER_ADMIN);
    await flushUsers();

    button('edit-btn-user-1').click();
    fixture.detectChanges();
    await settle();

    expect(pageElement().textContent).toContain('You cannot modify your own role or status');
    expect((query('edit-role-select') as HTMLSelectElement).disabled).toBe(true);
    expect((query('edit-status-select') as HTMLSelectElement).disabled).toBe(true);
  });

  it('deletes a user through the confirmation modal and refetches the list', async () => {
    await renderSignedIn(SUPER_ADMIN);
    await flushUsers();

    button('delete-btn-user-2').click();
    fixture.detectChanges();
    await settle();

    expect(query('delete-user-modal')).toBeDefined();
    expect(pageElement().textContent).toContain('Are you sure you want to delete');
    expect(pageElement().textContent).toContain('manager@example.com');
    expect(query('delete-confirm-btn')).toBeDefined();

    button('delete-confirm-btn').click();
    fixture.detectChanges();
    const request = http.expectOne('/api/users/user-2');
    expect(request.request.method).toBe('DELETE');
    request.flush({ id: 'user-2', deletedAt: '2026-10-19T00:00:00' });
    await fixture.whenStable();
    fixture.detectChanges();
    await settle();

    expect(query('delete-user-modal')).toBeNull();
    // The store invalidated the users list → the background refetch.
    http.expectOne('/api/users?page=1&limit=20').flush(listResponse(defaultUsers(), 2));
    await fixture.whenStable();
    fixture.detectChanges();
    await settle();

    // Cancel path on a fresh open closes the modal without a request.
    button('delete-btn-user-3').click();
    fixture.detectChanges();
    await settle();
    expect(query('delete-user-modal')).toBeDefined();
    buttonWithLabel('Cancel')?.click();
    fixture.detectChanges();
    await settle();
    expect(query('delete-user-modal')).toBeNull();
  });
});
