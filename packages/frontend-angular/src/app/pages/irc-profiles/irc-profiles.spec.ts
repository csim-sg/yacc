import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterOutlet, provideRouter, Router } from '@angular/router';

import { errorMappingInterceptor } from '../../interceptors/error-mapping.interceptor';
import { IrcProfiles } from './irc-profiles';

@Component({ selector: 'app-stub', template: '' })
class StubPage {}

@Component({
  selector: 'app-test-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class TestHost {}

/**
 * IRC Profiles page spec (ANG-012 — W16, React `IrcProfilesPage` port).
 *
 * Covers: the in-component read gate (`canManage` — permission alert for
 * USER; the route-level `roleGuard('ADMIN')` wiring is pinned in
 * `app.routes.spec.ts` and the role×requirement matrix in
 * `guards.spec.ts`), loading/error(+Retry)/empty states, profile cards
 * with Active/Disabled badges, config details and last-tested status, the
 * read-only ADMIN surface (no create button, no action buttons), the
 * SUPER_ADMIN actions (create form incl. the channels requirement, the
 * in-form live test button, per-profile test success/failure,
 * activate/disable/delete with the confirm gate), and the store
 * invalidation refetch after each mutation.
 */
describe('IrcProfiles page', () => {
  let fixture: ComponentFixture<TestHost>;
  let router: Router;
  let http: HttpTestingController;

  const config = { server: 'irc.example.com', port: 6697, username: 'yacc', channels: ['#ops'] };

  const profile = {
    id: 7,
    name: 'ops-irc',
    isEnabled: false,
    isActive: false,
    config,
    hasPassword: false,
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  };
  const activeProfile = {
    ...profile,
    id: 8,
    name: 'live-irc',
    isEnabled: true,
    isActive: true,
    lastTestedAt: '2026-10-19T00:00:00.000Z',
    lastTestPassed: true,
  };

  function pageElement(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function query(testId: string): HTMLElement | null {
    return pageElement().querySelector(`[data-testid="${testId}"]`);
  }

  function button(testId: string): HTMLButtonElement {
    return query(testId) as HTMLButtonElement;
  }

  async function render(url = '/integrations/irc-profiles'): Promise<void> {
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

  /** Flush the raw profiles list response and let the state settle. */
  async function flushProfiles(
    rows: Record<string, unknown>[] = [profile, activeProfile],
  ): Promise<void> {
    fixture.detectChanges();
    http.expectOne('/api/integrations/irc/profiles').flush(rows);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function setInput(testId: string, value: string): void {
    const input = query(testId) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  /**
   * Second CD pass — NgModel/bindings and scheduled effects land after the
   * render that created them; extra microtask drains cover the
   * rejection-path continuations (zone tracks them one tick later).
   */
  async function settle(): Promise<void> {
    await fixture.whenStable();
    for (let i = 0; i < 4; i += 1) {
      await Promise.resolve();
    }
    fixture.detectChanges();
  }

  /**
   * Timer-safe settle for flows that end in the test button's SUCCESS
   * state: its 5s auto-dismiss timer is pending, and `whenStable` would
   * block on it (and let it reset the state under assertion).
   */
  async function settleNoTimers(): Promise<void> {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    await TestBed.configureTestingModule({
      imports: [TestHost, IrcProfiles],
      providers: [
        provideHttpClient(withInterceptors([errorMappingInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'integrations/irc-profiles', component: IrcProfiles },
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
    vi.restoreAllMocks();
  });

  it('shows the permission alert for USER without requesting the list', async () => {
    await renderSignedIn({
      id: 'user-9',
      email: 'plain@example.com',
      name: 'Plain User',
      role: 'user',
      status: 'active',
    });

    expect(query('access-denied')?.textContent).toContain(
      'You do not have access to IRC profile management',
    );
    http.expectNone('/api/integrations/irc/profiles');
  });

  it('shows the first-load spinner before the list response lands', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    // The list load is scheduled with the read-gate effect; let it fire.
    await settle();
    expect(query('loading-state')).not.toBeNull();

    await flushProfiles();
    expect(query('loading-state')).toBeNull();
  });

  it('renders profile cards with badges, config details and last-tested status', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles();

    const card = query('profile-card-7');
    expect(card?.textContent).toContain('ops-irc');
    expect(card?.textContent).toContain('irc.example.com:6697');
    expect(card?.textContent).toContain('yacc');
    expect(card?.textContent).toContain('#ops');
    // Inactive + disabled profile → the error badge only.
    expect(card?.querySelector('.badge-error')?.textContent).toBe('Disabled');
    expect(card?.querySelector('.badge-success')).toBeNull();

    const liveCard = query('profile-card-8');
    expect(liveCard?.querySelector('.badge-success')?.textContent).toBe('Active');
    expect(liveCard?.textContent).toContain('Last tested:');
    expect(liveCard?.textContent).toContain('Passed');
  });

  it('renders the empty state when no profiles exist', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles([]);

    expect(query('empty-state')?.textContent).toContain('No IRC profiles configured yet');
  });

  it('renders the load-error alert with Retry and recovers', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    fixture.detectChanges();
    http
      .expectOne('/api/integrations/irc/profiles')
      .flush({ error: 'internal_error' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query('error-alert')?.textContent).toContain('internal_error');
    expect(query('empty-state')).toBeNull();

    button('error-alert').querySelector('button')?.click();
    await settle();
    http.expectOne('/api/integrations/irc/profiles').flush([profile]);
    await settle();
    expect(query('profile-card-7')).not.toBeNull();
  });

  it('gives ADMIN read-only access: cards render, no create button, no actions', async () => {
    await renderSignedIn({
      id: 'user-8',
      email: 'admin2@example.com',
      name: 'Admin Two',
      role: 'admin',
      status: 'active',
    });
    await flushProfiles();

    expect(query('profile-card-7')).not.toBeNull();
    expect(query('create-profile-btn')).toBeNull();
    expect(query('test-btn-7')).toBeNull();
    expect(query('activate-btn-7')).toBeNull();
    expect(query('delete-btn-7')).toBeNull();
  });

  it('offers SUPER_ADMIN the activate/disable/delete actions per card state', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles();

    expect(query('create-profile-btn')).not.toBeNull();
    // Inactive profile → Activate + enabled Delete; active profile → Disable
    // + Delete disabled until disabled (React parity).
    expect(query('activate-btn-7')).not.toBeNull();
    expect(query('disable-btn-7')).toBeNull();
    expect(button('delete-btn-7').disabled).toBe(false);
    expect(query('disable-btn-8')).not.toBeNull();
    expect(query('activate-btn-8')).toBeNull();
    expect(button('delete-btn-8').disabled).toBe(true);
  });

  it('activates a profile and refetches the list', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles();

    button('activate-btn-7').click();
    await settle();
    http.expectOne('/api/integrations/irc/profiles/7/activate').flush({ ...profile, isActive: true });
    await settle();
    // Invalidation refetch (React `loadProfiles()` parity).
    http.expectOne('/api/integrations/irc/profiles').flush([{ ...profile, isActive: true }]);
    await settle();

    expect(query('disable-btn-7')).not.toBeNull();
    expect(query('activate-btn-7')).toBeNull();
  });

  it('disables a profile and refetches the list', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles();

    button('disable-btn-8').click();
    await settle();
    http.expectOne('/api/integrations/irc/profiles/8/disable').flush({ ...activeProfile, isActive: false });
    await settle();
    http.expectOne('/api/integrations/irc/profiles').flush([profile, { ...activeProfile, isActive: false }]);
    await settle();

    expect(query('activate-btn-8')).not.toBeNull();
  });

  it('deletes a profile after confirm and refetches the list', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles();

    button('delete-btn-7').click();
    expect(globalThis.confirm).toHaveBeenCalledWith('Are you sure you want to delete this profile?');
    await settle();
    http.expectOne('/api/integrations/irc/profiles/7').flush(null);
    await settle();
    http.expectOne('/api/integrations/irc/profiles').flush([activeProfile]);
    await settle();

    expect(query('profile-card-7')).toBeNull();
  });

  it('skips the delete request when confirm is declined', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles();

    vi.mocked(globalThis.confirm).mockReturnValue(false);
    button('delete-btn-7').click();
    await settle();

    expect(globalThis.confirm).toHaveBeenCalled();
    http.expectNone('/api/integrations/irc/profiles/7');
  });

  it('surfaces a failed activate as the dismissable error alert', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles();

    button('activate-btn-7').click();
    await settle();
    http
      .expectOne('/api/integrations/irc/profiles/7/activate')
      .flush({ error: 'activation conflict' }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(query('error-alert')?.textContent).toContain('activation conflict');

    // Dismiss clears the alert without a request.
    button('error-alert').querySelector('button')?.click();
    await settle();
    expect(query('error-alert')).toBeNull();
  });

  it('runs the per-profile connection test: success shows the result row', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles();

    button('test-btn-7').click();
    await settle();
    const request = http.expectOne('/api/integrations/irc/profiles/7/test');
    expect(request.request.method).toBe('POST');
    request.flush({ passed: true, duration: 120 });
    await settle();

    const result = query('test-result-7');
    expect(result?.textContent).toContain('✓ Connection Successful');
    expect(result?.textContent).toContain('Duration: 120ms');
    expect(button('test-btn-7').disabled).toBe(false);
  });

  it('runs the per-profile connection test: failure shows the failed reason', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles();

    button('test-btn-8').click();
    await settle();
    http
      .expectOne('/api/integrations/irc/profiles/8/test')
      .flush({ error: 'connection refused' }, { status: 502, statusText: 'Bad Gateway' });
    await settle();

    const result = query('test-result-8');
    expect(result?.textContent).toContain('✗ Connection Failed');
    expect(result?.textContent).toContain('connection refused');
  });

  it('creates a profile through the form and refetches the list', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles();

    button('create-profile-btn').click();
    await settle();
    expect(query('create-form')).not.toBeNull();

    setInput('profile-name-input', 'Prod IRC');
    setInput('server-input', 'irc2.example.com');
    setInput('port-input', '6667');
    setInput('username-input', 'bot_user');
    setInput('channels-input', '#general, #dev');
    await settle();

    button('submit-btn').click();
    await settle();
    const request = http.expectOne('/api/integrations/irc/profiles');
    expect(request.request.method).toBe('POST');
    // Frozen flat IrcProfileWrite (the form's username field → wire nick).
    expect(request.request.body).toEqual({
      name: 'Prod IRC',
      server: 'irc2.example.com',
      port: 6667,
      nick: 'bot_user',
      channels: ['#general', '#dev'],
    });
    request.flush({ ...profile, id: 9, name: 'Prod IRC' });
    await settle();
    http.expectOne('/api/integrations/irc/profiles').flush([profile, activeProfile]);
    await settle();

    expect(query('create-form')).toBeNull();
  });

  it('requires at least one channel before creating', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles();

    button('create-profile-btn').click();
    await settle();
    setInput('profile-name-input', 'Prod IRC');
    setInput('server-input', 'irc2.example.com');
    setInput('username-input', 'bot_user');
    await settle();

    button('submit-btn').click();
    await settle();

    expect(query('create-form')?.textContent).toContain('At least one channel is required');
    http.expectNone('/api/integrations/irc/profiles');
  });

  it('closes the create form on Cancel without a request', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles();

    button('create-profile-btn').click();
    await settle();
    button('cancel-btn').click();
    await settle();

    expect(query('create-form')).toBeNull();
    expect(query('create-profile-btn')).not.toBeNull();
    http.expectNone('/api/integrations/irc/profiles');
  });

  it('tests the in-form configuration live before saving', async () => {
    await renderSignedIn({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      status: 'active',
    });
    await flushProfiles();

    button('create-profile-btn').click();
    await settle();
    // Gate: without channels the frozen body is incomplete — disabled.
    setInput('server-input', 'irc2.example.com');
    setInput('username-input', 'bot_user');
    await settle();
    const gated = pageElement().querySelector('[data-testid="irc-test-button"]') as HTMLButtonElement;
    expect(gated.disabled).toBe(true);

    setInput('channels-input', '#general');
    await settle();
    const enabled = pageElement().querySelector('[data-testid="irc-test-button"]') as HTMLButtonElement;
    expect(enabled.disabled).toBe(false);

    enabled.click();
    // The clicked button owns a pending 10s timeout timer — whenStable
    // would block on it; settle with microtask drains instead.
    await settleNoTimers();
    const request = http.expectOne('/api/integrations/irc/test');
    expect(request.request.body).toEqual({
      server: 'irc2.example.com',
      port: 6667,
      username: 'bot_user',
      channels: ['#general'],
    });
    request.flush({ data: { success: true, message: 'ok' } });
    await settleNoTimers();
    expect(
      (pageElement().querySelector('[data-testid="irc-test-button"]') as HTMLElement).textContent,
    ).toContain('Connected to IRC server successfully');
  });
});
