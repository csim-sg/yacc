import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { OidcService } from '../../services/oidc.service';
import { Header } from './header';

/**
 * Header spec (W2/W17): brand + mobile toggle, the NotificationCenter
 * mount, session user info (name/role/avatar), the OIDC session button
 * wired to the delivered `OidcService`, and the logout confirmation modal
 * wired to the delivered `AuthService`.
 */
describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let router: Router;
  let http: HttpTestingController;
  let oidc: OidcService;

  const session = {
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

  async function establishSession(): Promise<void> {
    localStorage.setItem('yacc_token', 'access-1');
    localStorage.setItem('yacc_refresh_token', 'refresh-1');
    TestBed.inject(AuthService);
    fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
    http.expectOne('/api/auth/get-session').flush(session);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideHttpClient(withInterceptors([])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    oidc = TestBed.inject(OidcService);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    localStorage.clear();
  });

  it('renders the brand, the NotificationCenter mount, and the session user info', async () => {
    await establishSession();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('header')).toBeTruthy();
    expect(el.textContent).toContain('YACC');
    expect(el.querySelector('app-notification-center')).toBeTruthy();
    expect(el.textContent).toContain('System Administrator');
    // SUPER_ADMIN → underscores replaced with spaces.
    expect(el.textContent).toContain('SUPER ADMIN');
    const avatar = el.querySelector('.rounded-full.w-8');
    expect(avatar?.textContent?.trim()).toBe('S');
  });

  it('emits menuClick from the mobile toggle', async () => {
    await establishSession();
    let clicked = false;
    fixture.componentRef.instance.menuClick.subscribe(() => {
      clicked = true;
    });

    (fixture.nativeElement as HTMLElement)
      .querySelector('button[aria-label="Toggle menu"]')!
      .dispatchEvent(new MouseEvent('click'));
    expect(clicked).toBe(true);
  });

  it('starts the OIDC session with the stored access token', async () => {
    await establishSession();
    const beginLogin = vi.spyOn(oidc, 'beginLogin').mockResolvedValue(undefined);

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button[data-testid="oidc-login-button"]',
    ) as HTMLButtonElement;
    button.click();
    await fixture.whenStable();

    expect(beginLogin).toHaveBeenCalledWith('access-1');
  });

  it('does not start the OIDC session without a stored token', async () => {
    TestBed.inject(AuthService);
    fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
    const beginLogin = vi.spyOn(oidc, 'beginLogin').mockResolvedValue(undefined);

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button[data-testid="oidc-login-button"]',
    ) as HTMLButtonElement;
    button.click();
    await fixture.whenStable();

    expect(beginLogin).not.toHaveBeenCalled();
  });

  it('resets the OIDC pending state when the flow fails', async () => {
    await establishSession();
    vi.spyOn(oidc, 'beginLogin').mockRejectedValue(new Error('as down'));

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button[data-testid="oidc-login-button"]',
    ) as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(button.disabled).toBe(false);
  });

  it('opens the logout confirmation modal and cancels it', async () => {
    await establishSession();

    (fixture.nativeElement as HTMLElement).querySelector('button[aria-label="Logout"]')!.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.modal')).toBeTruthy();

    const cancel = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.modal button'),
    ).find((candidate) => candidate.textContent?.trim() === 'Cancel') as HTMLButtonElement;
    cancel.click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.modal')).toBeNull();
  });

  it('confirms logout: signs out via AuthService, clears state, navigates to /login', async () => {
    await establishSession();

    (fixture.nativeElement as HTMLElement).querySelector('button[aria-label="Logout"]')!.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    const confirm = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.modal button'),
    ).find((candidate) => candidate.textContent?.includes('Sign Out')) as HTMLButtonElement;
    confirm.click();

    const signOut = http.expectOne('/api/auth/sign-out');
    expect(signOut.request.method).toBe('POST');
    signOut.flush({ success: true });
    await fixture.whenStable();

    expect(localStorage.getItem('yacc_token')).toBeNull();
    expect(localStorage.getItem('yacc_refresh_token')).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('stays on the modal when the sign-out call fails', async () => {
    await establishSession();

    (fixture.nativeElement as HTMLElement).querySelector('button[aria-label="Logout"]')!.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    const confirm = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.modal button'),
    ).find((candidate) => candidate.textContent?.includes('Sign Out')) as HTMLButtonElement;
    confirm.click();
    http.expectOne('/api/auth/sign-out').flush({ error: 'boom' }, { status: 500, statusText: 'err' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/login');
    expect((fixture.nativeElement as HTMLElement).querySelector('.modal')).toBeTruthy();
  });
});
