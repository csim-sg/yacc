/**
 * Canonical Spring auth contract types (MIG-034; SPEC-002 FR-04/AC-07).
 *
 * Resolved 1:1 from the frozen contract `.docs/migration/openapi.yaml`
 * (components `AuthSessionResponse`, `AuthSessionGetResponse`,
 * `AuthRefreshResponse`, `AuthSignOutResponse`, `UserResponse` and the
 * auth request bodies). This is the single auth type surface for the
 * frontend — no BetterAuth shapes remain (ADR-025 supersedes ADR-006).
 */

import type { UserRole, UserStatus } from './user.types';

/**
 * Canonical wire user (`UserResponse`): uuid `id`, lowercase wire
 * `role`/`status` labels. The UI-facing uppercase role normalization
 * lives only in `AuthContext` (RBAC display seam).
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/auth/sign-in/email */
export interface SignInRequest {
  email: string;
  password: string;
}

/** POST /api/auth/sign-up/email (accepts NO role — always creates `user`) */
export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
}

/** POST /api/auth/refresh-token */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** POST /api/auth/change-password */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** POST /api/auth/forgot-password */
export interface ForgotPasswordRequest {
  email: string;
}

/** POST /api/auth/reset-password */
export interface ResetPasswordRequest {
  token: string;
  password: string;
}

/** POST /api/auth/verify-email */
export interface VerifyEmailRequest {
  token: string;
}

/**
 * Sign-in / self-registration response (and the RP callback answer):
 * user object plus the stateless JWT access token and the rotating
 * refresh grant. `mustChangePassword` drives the forced credential
 * replacement for the bootstrap/recovery identity (MIG-030).
 */
export interface AuthSessionResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

/** GET /api/auth/get-session — user resolved from the Bearer access token. */
export interface AuthSessionGetResponse {
  user: AuthUser;
  mustChangePassword: boolean;
}

/** POST /api/auth/refresh-token — rotated token pair. */
export interface AuthRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/** POST /api/auth/sign-out and POST /api/auth/change-password. */
export interface AuthSignOutResponse {
  success: true;
}

/** POST /api/auth/forgot-password (constant anti-enumeration message). */
export interface MessageResponse {
  message: string;
}

/** POST /api/auth/reset-password, POST /api/auth/verify-email. */
export interface SuccessMessageResponse {
  success: boolean;
  message: string;
}

/** Frozen error shape (`ErrorResponse`): `{ error: string }`. */
export interface AuthErrorResponse {
  error: string;
}
