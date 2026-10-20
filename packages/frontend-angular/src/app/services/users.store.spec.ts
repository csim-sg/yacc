import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { UsersStore } from './users.store';

/**
 * UsersStore spec (AC-ANG-005-2; T2 §3.1 family store): filtered list on
 * the canonical registry key; create/update/delete invalidate the users
 * list (React mutation mapping).
 */
describe('UsersStore', () => {
  let store: UsersStore;
  let http: HttpTestingController;

  const user = {
    id: 'u1',
    email: 'user@yacc.local',
    name: 'User One',
    role: 'user',
    status: 'active',
    emailVerified: true,
    createdAt: '2026-10-18T00:00:00',
    updatedAt: '2026-10-18T00:00:00',
  };
  const listResponse = { data: [user], page: 1, limit: 20, total: 1 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([])), provideHttpClientTesting()],
    });
    store = TestBed.inject(UsersStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function loadList(): Promise<void> {
    const pending = store.loadUsers({});
    http.expectOne('/api/users').flush(listResponse);
    return pending;
  }

  it('loads the filtered user list onto the canonical key', async () => {
    const pending = store.loadUsers({ role: 'user', page: 2 });
    http.expectOne('/api/users?role=user&page=2').flush(listResponse);
    await pending;

    expect(store.listSnapshot({ role: 'user', page: 2 })?.data).toEqual(listResponse);
  });

  it('create/update/delete invalidate the users list', async () => {
    await loadList();

    const created = store.createUser({ email: 'x@y.local', name: 'X', password: 'secret', role: 'user' });
    http.expectOne('/api/users').flush({ user });
    await created;
    await loadList(); // invalidated → refetch

    const updated = store.updateUser('u1', { name: 'Renamed' });
    http.expectOne('/api/users/u1').flush({ user: { ...user, name: 'Renamed' } });
    await updated;
    await loadList();

    const deleted = store.deleteUser('u1');
    http.expectOne('/api/users/u1').flush({ success: true });
    await deleted;
    await loadList();
  });

  it('mutation failures reject to the caller', async () => {
    const pending = store.createUser({ email: 'x@y.local', name: 'X', password: 'secret', role: 'user' });
    http.expectOne('/api/users').flush({ error: 'email exists' }, { status: 422, statusText: 'err' });

    await expect(pending).rejects.toBeDefined();
  });
});
