import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  AuthSessionGetResponse,
  AuthSessionResponse,
  AuthSignOutResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  MessageResponse,
  ResetPasswordRequest,
  SignInRequest,
  SignUpRequest,
  SuccessMessageResponse,
} from '../contracts/http/auth.schema';
import { apiErrorMessage } from '../lib/api-error-message';
import { toUiUser } from '../lib/map-auth-user';
import type { UiUser } from '../types/user';
import { OidcService } from './oidc.service';
import { TokenStorageService } from './token-storage.service';

/**
 * Authentication Service (ANG-004; React `AuthContext` + MIG-034
 * `auth.service.ts` port; ADR-025).
 *
 * The single auth state system of the application: session restore,
 * login/logout/registration, password recovery, the ADR-025
 * forced-password-change state, and OIDC callback completion support.
 *
 * All endpoint calls ride the frozen Spring auth surface (frozen
 * `.docs/migration/openapi.yaml` §auth, read-only per ADR-023/GOV-038);
 * tokens are persisted ONLY via `TokenStorageService` (U6 resolution:
 * bearer access + rotating refresh pair, grant kind `local` | `oidc` —
 * no `set-auth-token` capture, no cookie session). A failed session
 * restore clears local auth state; refresh failure forces re-login
 * (no POC identity continuity).
 *
 * Role normalization seam: the wire contract is lowercase
 * (`super_admin|admin|manager|user`); the UI keeps uppercase — every RBAC
 * read consumes the normalized value mapped once in `lib/map-auth-user.ts`.
 *
 * Security note: the Spring Security backend remains the security
 * boundary; these signals/guards are UX only.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStorageService);
  private readonly oidc = inject(OidcService);

  private readonly userSignal = signal<UiUser | null>(null);
  /** The signed-in user (normalized uppercase role), or null. */
  readonly user = this.userSignal.asReadonly();

  /** True while a session-bearing identity is present. */
  readonly isAuthenticated = computed(() => this.userSignal() !== null);

  private readonly isLoadingSignal = signal(true);
  /** Global auth-operation pending state (React `isLoading` parity). */
  readonly isLoading = this.isLoadingSignal.asReadonly();

  private readonly errorSignal = signal<string | null>(null);
  /** Last auth error message surfaced to the auth pages. */
  readonly error = this.errorSignal.asReadonly();

  private readonly mustChangePasswordSignal = signal(false);
  /**
   * ADR-025 forced-password-change state of the bootstrap/recovery
   * identity: an authenticated identity with this flag is held on
   * `/change-password` until the credential is replaced.
   */
  readonly mustChangePassword = this.mustChangePasswordSignal.asReadonly();

  /** Memoized app-init session restore (guards await this exactly once). */
  private sessionLoad: Promise<void> | null = null;

  constructor() {
    // Restore the session on construction (React `AuthProvider` mount
    // `loadUser` parity): the app-init lookup runs exactly once, and
    // guards await the same memoized promise before redirect decisions.
    void this.ensureSessionLoaded();
  }

  /**
   * Restore the session exactly once per app lifetime (React's mount-time
   * `loadUser` parity): GET /api/auth/get-session with the stored Bearer
   * token. Guards call this before any redirect decision so the first
   * navigation observes the settled session state.
   */
  ensureSessionLoaded(): Promise<void> {
    if (!this.sessionLoad) {
      this.sessionLoad = this.loadSession().catch(() => undefined);
    }
    return this.sessionLoad;
  }

  /**
   * Load the session user. A missing/invalid/unusable token clears local
   * auth state (forced re-login is inherent — no identity continuity).
   */
  async loadSession(): Promise<void> {
    const accessToken = this.tokens.getAccessToken();
    if (!accessToken) {
      this.resetState();
      this.isLoadingSignal.set(false);
      return;
    }
    this.isLoadingSignal.set(true);
    try {
      const session = await firstValueFrom(
        this.http.get<AuthSessionGetResponse>(this.url('/api/auth/get-session'), {
          headers: this.bearerHeaders(),
        })
      );
      this.userSignal.set(toUiUser(session.user));
      this.mustChangePasswordSignal.set(session.mustChangePassword);
    } catch {
      this.tokens.clear();
      this.resetState();
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Email/password sign-in (local grant). Stores the returned token pair
   * and the forced-password-change state; resolves to that state so the
   * caller can route bootstrap/recovery identities to `/change-password`.
   */
  async signIn(credentials: SignInRequest): Promise<boolean> {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const session = await firstValueFrom(
        this.http.post<AuthSessionResponse>(this.url('/api/auth/sign-in/email'), credentials)
      );
      this.tokens.setTokens(session.accessToken, session.refreshToken, 'local');
      this.userSignal.set(toUiUser(session.user));
      this.mustChangePasswordSignal.set(session.mustChangePassword);
      return session.mustChangePassword;
    } catch (err: unknown) {
      this.errorSignal.set(this.toErrorMessage(err, 'Login failed'));
      throw err;
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Sign out: revokes the server-side grant (POST /api/auth/sign-out),
   * plus the AS grant at `/oauth2/revoke` for `oidc` sessions (local
   * cleanup alone is not sufficient there), then clears ALL local auth
   * state — always, even on API failure.
   */
  async signOut(): Promise<AuthSignOutResponse | null> {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);
    // Captured before any cleanup: revocation needs the stored refresh
    // token, and the local state clear below must stay unconditional.
    const refreshToken = this.tokens.getRefreshToken();
    const tokenKind = this.tokens.getTokenKind();
    let response: AuthSignOutResponse | null = null;
    try {
      response = await firstValueFrom(
        this.http.post<AuthSignOutResponse>(this.url('/api/auth/sign-out'), {}, {
          headers: this.bearerHeaders(),
        })
      );
      return response;
    } catch (err: unknown) {
      this.errorSignal.set(this.toErrorMessage(err, 'Logout failed'));
      throw err;
    } finally {
      if (tokenKind === 'oidc' && refreshToken) {
        await this.oidc.revokeGrant(refreshToken);
      }
      this.tokens.clear();
      this.resetState();
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Self-registration (always creates `role: user` — no role is accepted
   * on the wire). The returned session is deliberately not stored — the
   * flow hands the user to the login page (no auto-login, POC parity).
   */
  async register(request: SignUpRequest): Promise<void> {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      await firstValueFrom(
        this.http.post<AuthSessionResponse>(this.url('/api/auth/sign-up/email'), request)
      );
    } catch (err: unknown) {
      this.errorSignal.set(this.toErrorMessage(err, 'Registration failed'));
      throw err;
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /** Forgot password — constant anti-enumeration answer (always 200). */
  forgotPassword(request: ForgotPasswordRequest): Promise<MessageResponse> {
    return firstValueFrom(
      this.http.post<MessageResponse>(this.url('/api/auth/forgot-password'), request)
    );
  }

  /** Reset password with the emailed token (public). */
  resetPassword(request: ResetPasswordRequest): Promise<SuccessMessageResponse> {
    return firstValueFrom(
      this.http.post<SuccessMessageResponse>(this.url('/api/auth/reset-password'), request)
    );
  }

  /**
   * Replace the credential (authenticated). Clears the ADR-025
   * forced-password-change state of the bootstrap/recovery identity and
   * revokes every refresh grant of the identity on success.
   */
  changePassword(request: ChangePasswordRequest): Promise<AuthSignOutResponse> {
    return firstValueFrom(
      this.http.post<AuthSignOutResponse>(this.url('/api/auth/change-password'), request, {
        headers: this.bearerHeaders(),
      })
    );
  }

  /** Clear the forced-password-change state after a successful change. */
  markPasswordChanged(): void {
    this.mustChangePasswordSignal.set(false);
  }

  /** Clear the surfaced auth error (React `clearError` parity). */
  clearError(): void {
    this.errorSignal.set(null);
  }

  /** Same-origin API base (build-time environment; ARCH-005 boundary 6). */
  private url(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }

  /** `Authorization: Bearer` header set (empty when no token is stored). */
  private bearerHeaders(): Record<string, string> {
    const accessToken = this.tokens.getAccessToken();
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  }

  /** Reset identity state (user + forced-change flag), keep error surface. */
  private resetState(): void {
    this.userSignal.set(null);
    this.mustChangePasswordSignal.set(false);
  }

  /**
   * Map a failed request onto its surfaced message (frozen `ErrorResponse`
   * body's `error` field, else generic — React `ApiError` parity).
   */
  private toErrorMessage(err: unknown, fallback: string): string {
    return apiErrorMessage(err, fallback);
  }
}
