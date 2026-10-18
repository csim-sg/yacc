import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { flushTasks } from '../../testing/flush-tasks';
import { provideRouter, Router } from '@angular/router';
import { Register } from './register';

/**
 * Register page spec (ANG-004, W3). Client-side validation order, the
 * no-auto-login handover to the login page, and error surfacing.
 */
describe('Register page', () => {
  let fixture: ComponentFixture<Register>;
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

  function errorText(): string {
    return (fixture.nativeElement.querySelector('.alert-error')?.textContent ?? '').trim();
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Register);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the registration form (no role field — self-registration is USER-only)', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Join YACC Today');
    expect(el.querySelector('input[name="name"]')).toBeTruthy();
    expect(el.querySelector('input[name="email"]')).toBeTruthy();
    expect(el.querySelector('input[name="password"]')).toBeTruthy();
    expect(el.querySelector('input[name="confirmPassword"]')).toBeTruthy();
  });

  it('rejects mismatched passwords client-side without a wire call', async () => {
    setInput('input[name="name"]', 'New User');
    setInput('input[name="email"]', 'new@yacc.local');
    setInput('input[name="password"]', 'secret1');
    setInput('input[name="confirmPassword"]', 'secret2');
    submitForm();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(errorText()).toContain('Passwords do not match');
    http.expectNone('/api/auth/sign-up/email');
  });

  it('rejects a short password client-side without a wire call', async () => {
    setInput('input[name="name"]', 'New User');
    setInput('input[name="email"]', 'new@yacc.local');
    setInput('input[name="password"]', 'abc');
    setInput('input[name="confirmPassword"]', 'abc');
    submitForm();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(errorText()).toContain('Password must be at least 6 characters');
    http.expectNone('/api/auth/sign-up/email');
  });

  it('registers and hands over to the login page without auto-login', async () => {
    setInput('input[name="name"]', 'New User');
    setInput('input[name="email"]', 'new@yacc.local');
    setInput('input[name="password"]', 'secret1');
    setInput('input[name="confirmPassword"]', 'secret1');
    submitForm();

    const request = http.expectOne('/api/auth/sign-up/email');
    expect(request.request.body).toEqual({
      email: 'new@yacc.local',
      password: 'secret1',
      name: 'New User',
    });
    request.flush({
      user: {
        id: '00000000-0000-0000-0000-000000000009',
        email: 'new@yacc.local',
        name: 'New User',
        role: 'user',
        status: 'active',
        emailVerified: false,
        createdAt: '2026-10-18T00:00:00',
        updatedAt: '2026-10-18T00:00:00',
      },
      accessToken: 'access-9',
      refreshToken: 'refresh-9',
      mustChangePassword: false,
    });
    await flushTasks();
    fixture.detectChanges();

    // The returned session is deliberately NOT stored (no auto-login).
    expect(localStorage.getItem('yacc_token')).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('surfaces server-side registration errors', async () => {
    setInput('input[name="name"]', 'Dup');
    setInput('input[name="email"]', 'taken@yacc.local');
    setInput('input[name="password"]', 'secret1');
    setInput('input[name="confirmPassword"]', 'secret1');
    submitForm();

    http
      .expectOne('/api/auth/sign-up/email')
      .flush({ error: 'Validation error' }, { status: 400, statusText: 'Bad Request' });
    await flushTasks();
    fixture.detectChanges();

    expect(errorText()).toContain('Validation error');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
