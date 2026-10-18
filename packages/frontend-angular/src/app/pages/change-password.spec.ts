import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TokenStorageService } from '../services/token-storage.service';
import { ChangePassword } from './change-password';

/**
 * Change-password page spec (ANG-004 — ADR-025 forced credential change).
 * Validation, the successful replace-and-continue flow, and error
 * surfacing.
 */
describe('ChangePassword page', () => {
  let fixture: ComponentFixture<ChangePassword>;
  let router: Router;
  let http: HttpTestingController;
  let tokens: TokenStorageService;

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
      imports: [ChangePassword],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStorageService);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ChangePassword);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the forced-change banner and the three credential fields', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="forced-change-banner"]')?.textContent).toContain(
      'must replace your initial password'
    );
    expect(el.querySelector('[data-testid="change-password-current"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="change-password-new"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="change-password-confirm"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="change-password-submit"]')?.textContent).toContain(
      'Update Password'
    );
  });

  it('rejects a short replacement client-side without a wire call', async () => {
    setInput('[data-testid="change-password-current"]', 'one-time');
    setInput('[data-testid="change-password-new"]', 'short');
    setInput('[data-testid="change-password-confirm"]', 'short');
    submitForm();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert-error')?.textContent).toContain(
      'New password must be at least 8 characters long'
    );
    http.expectNone('/api/auth/change-password');
  });

  it('rejects a confirmation mismatch client-side', async () => {
    setInput('[data-testid="change-password-current"]', 'one-time');
    setInput('[data-testid="change-password-new"]', 'permanent-1');
    setInput('[data-testid="change-password-confirm"]', 'permanent-2');
    submitForm();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert-error')?.textContent).toContain(
      'Passwords do not match'
    );
    http.expectNone('/api/auth/change-password');
  });

  it('replaces the credential with the Bearer header and continues to the inbox', async () => {
    tokens.setTokens('access-1', 'refresh-1', 'local');
    setInput('[data-testid="change-password-current"]', 'one-time-credential');
    setInput('[data-testid="change-password-new"]', 'permanent-1');
    setInput('[data-testid="change-password-confirm"]', 'permanent-1');
    submitForm();

    const request = http.expectOne('/api/auth/change-password');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    expect(request.request.body).toEqual({
      currentPassword: 'one-time-credential',
      newPassword: 'permanent-1',
    });
    request.flush({ success: true });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/inbox');
  });

  it('surfaces the frozen error body when the current credential is wrong', async () => {
    tokens.setTokens('access-1', 'refresh-1', 'local');
    setInput('[data-testid="change-password-current"]', 'wrong-current');
    setInput('[data-testid="change-password-new"]', 'permanent-1');
    setInput('[data-testid="change-password-confirm"]', 'permanent-1');
    submitForm();

    http
      .expectOne('/api/auth/change-password')
      .flush(
        { error: 'Missing/invalid token or wrong current password' },
        { status: 401, statusText: 'Unauthorized' }
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert-error')?.textContent).toContain(
      'Missing/invalid token or wrong current password'
    );
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
