import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ForgotPassword } from './forgot-password';

/**
 * Forgot-password page spec (ANG-004, W4). Anti-enumeration posture:
 * failures show the same generic message as success; success redirects
 * to login after 3 seconds.
 */
describe('ForgotPassword page', () => {
  let fixture: ComponentFixture<ForgotPassword>;
  let router: Router;
  let http: HttpTestingController;

  function setInput(value: string): void {
    const input = fixture.nativeElement.querySelector(
      '[data-testid="forgot-password-email"]'
    ) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submitForm(): void {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit')
    );
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects an invalid email client-side without a wire call', async () => {
    setInput('not-an-email');
    submitForm();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Please enter a valid email address');
    http.expectNone('/api/auth/forgot-password');
  });

  it('shows the success state and redirects to login after 3 seconds', async () => {
    vi.useFakeTimers();
    setInput('user@yacc.local');
    submitForm();

    const request = http.expectOne('/api/auth/forgot-password');
    expect(request.request.body).toEqual({ email: 'user@yacc.local' });
    request.flush({ message: 'If an account exists, a reset link was sent' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert-success')?.textContent).toContain(
      'Check your email for the reset link. Redirecting to login...'
    );

    vi.advanceTimersByTime(3000);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('shows the generic anti-enumeration message on failure (never a missing-account hint)', async () => {
    setInput('user@yacc.local');
    submitForm();

    http
      .expectOne('/api/auth/forgot-password')
      .flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert-info')?.textContent).toContain(
      'If an account with this email exists, you will receive a password reset link'
    );
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
