import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { flushTasks } from '../../testing/flush-tasks';
import { provideRouter, Router } from '@angular/router';
import { Login } from './login';

/**
 * Login page spec (ANG-004, W1). Component-level behavior; the full
 * browser flow is the Tier-0 `frontend-login.spec.ts` rows.
 */
describe('Login page', () => {
  function wireSession(overrides: { mustChangePassword?: boolean } = {}): Record<string, unknown> {
    return {
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
      mustChangePassword: overrides.mustChangePassword ?? false,
    };
  }

  let fixture: ComponentFixture<Login>;
  let router: Router;
  let http: HttpTestingController;

  function setInput(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submitForm(): void {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit')
    );
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the login form with the parity selectors', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Welcome Back');
    expect(el.querySelector('[data-testid="login-email"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="login-password"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="login-submit"]')?.textContent).toContain('Sign In');
    expect(el.textContent).toContain('Forgot Password?');
    expect(el.textContent).toContain('Create One');
  });

  it('navigates to /inbox after a successful sign-in (local grant adopted)', async () => {
    setInput('[data-testid="login-email"]', 'admin@yacc.local');
    setInput('[data-testid="login-password"]', 'admin123');
    submitForm();

    const request = http.expectOne('/api/auth/sign-in/email');
    expect(request.request.body).toEqual({ email: 'admin@yacc.local', password: 'admin123' });
    request.flush(wireSession());
    await flushTasks();
    fixture.detectChanges();

    expect(localStorage.getItem('yacc_token')).toBe('access-1');
    expect(localStorage.getItem('yacc_token_kind')).toBe('local');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/inbox');
  });

  it('routes bootstrap/recovery identities to the forced credential change', async () => {
    setInput('[data-testid="login-email"]', 'admin@yacc.local');
    setInput('[data-testid="login-password"]', 'one-time-credential');
    submitForm();

    http.expectOne('/api/auth/sign-in/email').flush(wireSession({ mustChangePassword: true }));
    await flushTasks();
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/change-password');
  });

  it('surfaces the frozen 401 error body and stays on the form', async () => {
    setInput('[data-testid="login-email"]', 'admin@yacc.local');
    setInput('[data-testid="login-password"]', 'wrong');
    submitForm();

    http
      .expectOne('/api/auth/sign-in/email')
      .flush({ error: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    await flushTasks();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.alert-error')?.textContent).toContain('Invalid credentials');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(localStorage.getItem('yacc_token')).toBeNull();
  });

  it('toggles password visibility', async () => {
    const el = fixture.nativeElement as HTMLElement;
    const password = el.querySelector('[data-testid="login-password"]') as HTMLInputElement;
    const toggle = password.parentElement?.querySelector('button') as HTMLButtonElement;
    expect(password.type).toBe('password');

    toggle.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(password.type).toBe('text');
  });
});
