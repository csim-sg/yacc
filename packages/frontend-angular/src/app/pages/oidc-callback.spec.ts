import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { flushTasks } from '../../testing/flush-tasks';
import { OidcCallback } from './oidc-callback';

/**
 * OIDC callback page spec (ANG-004 — MIG-034 port). Missing-code
 * fail-closed state, forged-state rejection, and the post-completion
 * routing matrix (inbox / forced credential change / back to login).
 */
describe('OidcCallback page', () => {
  let fixture: ComponentFixture<OidcCallback>;
  let router: Router;
  let http: HttpTestingController;

  function create(query: Record<string, string>): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [OidcCallback],
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
    fixture = TestBed.createComponent(OidcCallback);
    fixture.detectChanges();
  }

  /** Wire session for the post-exchange identity resolution. */
  function wireSession(mustChangePassword: boolean): Record<string, unknown> {
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
      mustChangePassword,
    };
  }

  const TOKEN_BODY = JSON.stringify({
    access_token: 'as-access-token',
    refresh_token: 'as-refresh-token',
    token_type: 'Bearer',
    expires_in: 1800,
    scope: 'openid profile email',
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('fails closed when the code is missing', async () => {
    create({});
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      (fixture.nativeElement.querySelector('[data-testid="oidc-callback-error"]')?.textContent ?? '').trim()
    ).toContain('Missing authorization code');
    http.verify();
  });

  it('rejects a forged state and stores no session', async () => {
    create({ code: 'the-code', state: 'forged-state' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      (fixture.nativeElement.querySelector('[data-testid="oidc-callback-error"]')?.textContent ?? '').trim()
    ).toContain('Sign-in could not be completed');
    expect(localStorage.getItem('yacc_token')).toBeNull();
    http.verify();
  });

  it('completes the exchange, resolves the identity, and enters the inbox', async () => {
    sessionStorage.setItem('yacc_oidc_state', 'the-state');
    sessionStorage.setItem('yacc_oidc_verifier', 'the-verifier');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(TOKEN_BODY, { status: 200 }))
    );

    create({ code: 'the-code', state: 'the-state' });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const request = http.expectOne('/api/auth/get-session');
    expect(request.request.headers.get('Authorization')).toBe('Bearer as-access-token');
    request.flush(wireSession(false));
    await flushTasks();
    fixture.detectChanges();

    expect(localStorage.getItem('yacc_token')).toBe('as-access-token');
    expect(localStorage.getItem('yacc_token_kind')).toBe('oidc');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/inbox');
    vi.unstubAllGlobals();
  });

  it('routes a bootstrap identity to the forced credential change', async () => {
    sessionStorage.setItem('yacc_oidc_state', 'the-state');
    sessionStorage.setItem('yacc_oidc_verifier', 'the-verifier');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(TOKEN_BODY, { status: 200 }))
    );

    create({ code: 'the-code', state: 'the-state' });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    http.expectOne('/api/auth/get-session').flush(wireSession(true));
    await flushTasks();
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/change-password');
    vi.unstubAllGlobals();
  });

  it('sends an identity that cannot be resolved back to login', async () => {
    sessionStorage.setItem('yacc_oidc_state', 'the-state');
    sessionStorage.setItem('yacc_oidc_verifier', 'the-verifier');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(TOKEN_BODY, { status: 200 }))
    );

    create({ code: 'the-code', state: 'the-state' });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    http
      .expectOne('/api/auth/get-session')
      .flush({ error: 'Missing or invalid token' }, { status: 401, statusText: 'Unauthorized' });
    await flushTasks();
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    vi.unstubAllGlobals();
  });
});
