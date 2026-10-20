import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';

import { AuthService } from '../../services/auth.service';
import { Navigation } from './navigation';

/** Route stub for active-highlight navigation. */
@Component({ selector: 'app-stub', template: '' })
class StubPage {}

/**
 * Navigation spec (W23): role-filtered items from the delivered
 * `getAccessibleNavItems` config, active-route highlighting, the mobile
 * drawer open/close, the loading skeleton, the unauthenticated no-render,
 * and the Sign Out control wired to the delivered `AuthService`.
 */
describe('Navigation', () => {
  let fixture: ComponentFixture<Navigation>;
  let router: Router;
  let http: HttpTestingController;

  const superAdminSession = {
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@yacc.local',
      name: 'System Administrator',
      role: 'super_admin',
      status: 'active',
      emailVerified: true,
      createdAt: '2026-09-27T08:00:00',
      updatedAt: '2026-09-27T08:00:00',
    },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    mustChangePassword: false,
  };

  function nav(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('nav[aria-label="Main navigation"]');
  }

  async function establishSession(user: Record<string, unknown> = superAdminSession.user): Promise<void> {
    localStorage.setItem('yacc_token', 'access-1');
    TestBed.inject(AuthService);
    fixture = TestBed.createComponent(Navigation);
    fixture.detectChanges();
    http.expectOne('/api/auth/get-session').flush({ ...superAdminSession, user });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Navigation, StubPage],
      providers: [
        provideHttpClient(withInterceptors([])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'inbox', component: StubPage }]),
      ],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('renders the loading skeleton while the session restore is pending', () => {
    localStorage.setItem('yacc_token', 'access-1');
    TestBed.inject(AuthService);
    fixture = TestBed.createComponent(Navigation);
    fixture.detectChanges();

    const skeleton = (fixture.nativeElement as HTMLElement).querySelector('nav[aria-busy="true"]');
    expect(skeleton).toBeTruthy();
    expect(skeleton?.getAttribute('aria-label')).toBe('Navigation');

    http.expectOne('/api/auth/get-session').flush(superAdminSession);
    fixture.detectChanges();
  });

  it('renders nothing while unauthenticated', () => {
    TestBed.inject(AuthService);
    fixture = TestBed.createComponent(Navigation);
    fixture.detectChanges();
    http.expectNone('/api/auth/get-session');

    expect(nav()).toBeNull();
  });

  it('lists every configured item for SUPER_ADMIN', async () => {
    await establishSession();

    const labels = Array.from(nav()!.querySelectorAll('a')).map((anchor) => anchor.textContent?.trim());
    expect(labels).toEqual([
      '📋Inbox',
      '📊Audit Logs',
      '👥Users',
      '🔌Integrations',
      '💬IRC Profiles',
      '⚙️Routing Rules',
      '⚙️Settings',
    ]);
  });

  it('filters items to the USER role (inbox only)', async () => {
    await establishSession({
      ...superAdminSession.user,
      id: '00000000-0000-0000-0000-000000000004',
      email: 'user@yacc.local',
      name: 'Support User',
      role: 'user',
    });

    const links = Array.from(nav()!.querySelectorAll('a'));
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toContain('Inbox');
    expect(nav()?.textContent).toContain('Role: USER');
  });

  it('highlights the active route with aria-current', async () => {
    await establishSession();

    await router.navigateByUrl('/inbox');
    fixture.detectChanges();

    const active = nav()!.querySelector('a[aria-current="page"]')!;
    expect(active.textContent).toContain('Inbox');
    expect(active.getAttribute('class')).toContain('bg-primary');
    const inactive = Array.from(nav()!.querySelectorAll('a')).find((anchor) => anchor !== active)!;
    expect(inactive.getAttribute('class')).not.toContain('bg-primary');
  });

  it('reflects the mobile drawer state in the transform class', async () => {
    await establishSession();
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();

    expect(nav()?.getAttribute('class')).toContain('-translate-x-full');

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    expect(nav()?.getAttribute('class')).toContain('translate-x-0');
  });

  it('emits the close request from the mobile close button', async () => {
    await establishSession();

    let closed = false;
    fixture.componentRef.instance.closed.subscribe(() => {
      closed = true;
    });
    (fixture.nativeElement as HTMLElement)
      .querySelector('button[aria-label="Close navigation"]')!
      .dispatchEvent(new MouseEvent('click'));

    expect(closed).toBe(true);
  });

  it('signs out through AuthService and navigates to /login', async () => {
    await establishSession();
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    (fixture.nativeElement as HTMLElement)
      .querySelector('button[aria-label="Sign out from application"]')!
      .dispatchEvent(new MouseEvent('click'));
    const signOutRequest = http.expectOne('/api/auth/sign-out');
    expect(signOutRequest.request.method).toBe('POST');
    signOutRequest.flush({ success: true });
    await fixture.whenStable();

    expect(localStorage.getItem('yacc_token')).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('navigates to /login even when the sign-out call fails (state is cleared)', async () => {
    await establishSession();
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    (fixture.nativeElement as HTMLElement)
      .querySelector('button[aria-label="Sign out from application"]')!
      .dispatchEvent(new MouseEvent('click'));
    http.expectOne('/api/auth/sign-out').flush({ error: 'boom' }, { status: 500, statusText: 'err' });
    await fixture.whenStable();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
