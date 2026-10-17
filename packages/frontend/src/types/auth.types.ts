/**
 * Canonical Spring auth contract types (MIG-041; SPEC-002 AC-07; ADR-023).
 *
 * GENERATED-contract-derived: every type here is an alias of the frozen
 * contract types in `../api/contract/rest-api.gen.ts` (generated from
 * `.docs/migration/openapi.yaml`). This module only pins the frontend-facing
 * names — the shapes are the contract's, not re-declared by hand.
 * (MIG-034 established this surface; MIG-041 single-sources it.)
 *
 * No BetterAuth shapes remain (ADR-025 supersedes ADR-006). Wire
 * `role`/`status` are lowercase; the UI-facing uppercase role normalization
 * lives only in `AuthContext` (RBAC display seam).
 */

import type { components, operations } from '../api/contract/rest-api.gen';

type Schemas = components['schemas'];
type Operations = operations;

/** Extract an inline `application/json` request body from a generated operation. */
type JsonBody<Op> = Op extends {
  requestBody?: { content: { 'application/json': infer Body } };
}
  ? Body
  : never;

/** Wire canonical user (`UserResponse`): uuid `id`, lowercase wire `role`/`status`. */
export type AuthUser = Schemas['UserResponse'];

/** POST /api/auth/sign-in/email */
export type SignInRequest = JsonBody<Operations['authSignInEmail']>;

/** POST /api/auth/sign-up/email (accepts NO role — always creates `user`) */
export type SignUpRequest = JsonBody<Operations['authSignUpEmail']>;

/** POST /api/auth/refresh-token */
export type RefreshTokenRequest = JsonBody<Operations['authRefreshToken']>;

/** POST /api/auth/change-password */
export type ChangePasswordRequest = JsonBody<Operations['authChangePassword']>;

/** POST /api/auth/forgot-password */
export type ForgotPasswordRequest = Schemas['ForgotPasswordBody'];

/** POST /api/auth/reset-password */
export type ResetPasswordRequest = Schemas['ResetPasswordBody'] & {
  // Frozen contract quirk: `ResetPasswordBody` lists `password` in
  // `required` but omits it from `properties`; keep it typed without
  // touching the frozen file.
  password: string;
};

/** POST /api/auth/verify-email */
export type VerifyEmailRequest = Schemas['VerifyEmailBody'];

/**
 * Sign-in / self-registration response (and the RP callback answer):
 * user object plus the stateless JWT access token and the rotating
 * refresh grant. `mustChangePassword` drives the forced credential
 * replacement for the bootstrap/recovery identity (MIG-030).
 */
export type AuthSessionResponse = Schemas['AuthSessionResponse'];

/** GET /api/auth/get-session — user resolved from the Bearer access token. */
export type AuthSessionGetResponse = Schemas['AuthSessionGetResponse'];

/** POST /api/auth/refresh-token — rotated token pair. */
export type AuthRefreshResponse = Schemas['AuthRefreshResponse'];

/** POST /api/auth/sign-out and POST /api/auth/change-password. */
export type AuthSignOutResponse = Schemas['AuthSignOutResponse'];

/** POST /api/auth/forgot-password (constant anti-enumeration message). */
export type MessageResponse = Schemas['MessageResponse'];

/** POST /api/auth/reset-password, POST /api/auth/verify-email. */
export type SuccessMessageResponse = Schemas['SuccessMessageResponse'];

/** Frozen error shape (`ErrorResponse`): `{ error: string }`. */
export type AuthErrorResponse = Schemas['ErrorResponse'];
