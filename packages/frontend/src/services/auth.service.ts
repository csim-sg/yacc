/**
 * Authentication Service (MIG-034; ADR-025)
 *
 * All auth endpoint calls against the Spring auth contract (frozen
 * `.docs/migration/openapi.yaml` §auth). Transport, token persistence and
 * refresh live in the single API client (`lib/apiClient`); this service is
 * the endpoint map only.
 */

import { api, clearTokens, getRefreshToken, getTokenKind, setTokens } from '../lib/apiClient';
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
  VerifyEmailRequest,
} from '../types/auth.types';
import { revokeOidcGrant } from './oidc.service';

/** `User` re-exported under its canonical contract name. */
export type User = AuthSessionGetResponse['user'];

export const authService = {
  /**
   * Email/password sign-in. Stores the returned token pair (local grant).
   * The `mustChangePassword` flag drives the forced credential change.
   */
  async signIn(credentials: SignInRequest): Promise<AuthSessionResponse> {
    const session = await api.post<AuthSessionResponse>('/api/auth/sign-in/email', credentials);
    setTokens(session.accessToken, session.refreshToken, 'local');
    return session;
  },

  /**
   * Self-registration (always creates `role: user`). The returned session
   * is deliberately not stored — the register flow hands the user to the
   * login page (no auto-login, POC parity).
   */
  async signUp(request: SignUpRequest): Promise<AuthSessionResponse> {
    return api.post<AuthSessionResponse>('/api/auth/sign-up/email', request);
  },

  /** Current session user from the Bearer access token. */
  async getSession(): Promise<AuthSessionGetResponse | null> {
    try {
      return await api.get<AuthSessionGetResponse>('/api/auth/get-session');
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error && error.statusCode === 401) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Sign out: revokes the refresh grant named by the access token's
   * `sid` claim, revokes the AS grant at `/oauth2/revoke` for `oidc`
   * sessions (guardrail: local cleanup alone is not sufficient there),
   * then clears all local auth state (always, even on API failure).
   */
  async signOut(): Promise<AuthSignOutResponse | null> {
    // Captured before any cleanup: revocation needs the stored refresh
    // token, and the local state clear below must stay unconditional.
    const refreshToken = getRefreshToken();
    const tokenKind = getTokenKind();
    try {
      return await api.post<AuthSignOutResponse>('/api/auth/sign-out');
    } finally {
      if (tokenKind === 'oidc' && refreshToken) {
        await revokeOidcGrant(refreshToken);
      }
      clearTokens();
    }
  },

  /**
   * Replace the credential (authenticated). Clears the ADR-025
   * forced-password-change state of the bootstrap/recovery identity and
   * revokes every refresh grant of the identity on success.
   */
  async changePassword(request: ChangePasswordRequest): Promise<AuthSignOutResponse> {
    return api.post<AuthSignOutResponse>('/api/auth/change-password', request);
  },

  /** Forgot password — constant anti-enumeration answer. */
  async forgotPassword(request: ForgotPasswordRequest): Promise<MessageResponse> {
    return api.post<MessageResponse>('/api/auth/forgot-password', request);
  },

  /** Reset password with the emailed token. */
  async resetPassword(request: ResetPasswordRequest): Promise<SuccessMessageResponse> {
    return api.post<SuccessMessageResponse>('/api/auth/reset-password', request);
  },

  /** Confirm the email address with the emailed token. */
  async verifyEmail(request: VerifyEmailRequest): Promise<SuccessMessageResponse> {
    return api.post<SuccessMessageResponse>('/api/auth/verify-email', request);
  },
};
