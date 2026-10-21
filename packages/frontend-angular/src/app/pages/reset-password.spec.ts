import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { ResetPassword } from './reset-password';

/**
 * Reset-password page spec (ANG-004, W4). Fail-closed token absence,
 * client-side validation, success redirect without auto-login, and the
 * backend error classification.
 */
describe('ResetPassword page', () => {
  let fixture: ComponentFixture<ResetPassword>;
  let router: Router;
  let http: HttpTestingController;

  function create(query: Record<string, string>): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
  }

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

  it('fails closed when the token is missing from the URL', async () => {
    create({});
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Reset link is missing or invalid. Please request a new one.');
    expect(el.textContent).toContain('Request New Reset Link');
    expect(el.querySelector('form')).toBeNull();
    http.expectNone('/api/auth/reset-password');
  });

  it('validates match and minimum length client-side without a wire call', async () => {
    create({ token: 'the-token' });
    await fixture.whenStable();
    fixture.detectChanges();

    setInput('[data-testid="reset-password-input"]', 'short');
    setInput('[data-testid="reset-password-confirm"]', 'different');
    submitForm();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert-error')?.textContent).toContain(
      'Passwords do not match'
    );

    setInput('[data-testid="reset-password-confirm"]', 'short');
    submitForm();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert-error')?.textContent).toContain(
      'Password must be at least 8 characters long'
    );
    http.expectNone('/api/auth/reset-password');
  });

  it('resets the password and redirects to login (no auto-login) after 2 seconds', async () => {
    create({ token: 'the-token' });
    await fixture.whenStable();
    fixture.detectChanges();
    // Deterministic precondition: other spec files share the worker's jsdom
    // localStorage (app-shell/header seed `yacc_token`); this assertion is
    // "the reset flow issues no session" — anchor it by starting from a clean
    // storage instead of depending on cross-file execution order.
    localStorage.removeItem('yacc_token');
    vi.useFakeTimers();

    setInput('[data-testid="reset-password-input"]', 'new-secret-1');
    setInput('[data-testid="reset-password-confirm"]', 'new-secret-1');
    submitForm();

    const request = http.expectOne('/api/auth/reset-password');
    expect(request.request.body).toEqual({ token: 'the-token', password: 'new-secret-1' });
    request.flush({ success: true, message: 'Password reset' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert-success')?.textContent).toContain(
      'Password reset successful! Redirecting to login...'
    );

    // Async advance drains the microtasks chained after the redirect timer
    // (the sync variant leaves promise continuations unrun under CI load).
    await vi.advanceTimersByTimeAsync(2000);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(localStorage.getItem('yacc_token')).toBeNull();
    vi.useRealTimers();
  });

  it('classifies an expired reset link from the frozen error body', async () => {
    create({ token: 'stale-token' });
    await fixture.whenStable();
    fixture.detectChanges();

    setInput('[data-testid="reset-password-input"]', 'new-secret-1');
    setInput('[data-testid="reset-password-confirm"]', 'new-secret-1');
    submitForm();

    http
      .expectOne('/api/auth/reset-password')
      .flush({ error: 'Invalid or expired token' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert-error')?.textContent).toContain(
      'Reset link has expired. Please request a new one.'
    );
  });
});
