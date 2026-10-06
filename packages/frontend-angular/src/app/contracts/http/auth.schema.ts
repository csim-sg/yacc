import { z } from 'zod';
import { RoleSchema, UserStatusSchema } from '../common/role.schema';

/**
 * Auth contract family — the live `/api/auth/*` surface (T3 §4.2/§4.3).
 *
 * The live frontend speaks the Spring-shaped auth contract (MIG-034):
 * sign-in returns the user plus a stateless JWT access token and a rotating
 * refresh grant; the session is resolved from the Bearer token. The
 * BetterAuth-delegated routes (`/sign-up/email`, `/sign-out`,
 * `/get-session`, `/refresh-token`, `/verify-email`) answer the same
 * shapes. The drifted dead React auth paths (T3 G1) are NOT ported —
 * only these `/api/auth/*` endpoints exist.
 */

/** Wire user (`UserResponse`): lowercase `role`/`status` labels (G9). */
export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
  role: RoleSchema,
  status: UserStatusSchema,
  emailVerified: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

/** POST /api/auth/sign-in/email (rate-limited). */
export const SignInRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
});

export type SignInRequest = z.infer<typeof SignInRequestSchema>;

/** Sign-in / sign-up response: user + token pair + forced-change flag. */
export const AuthSessionResponseSchema = z.object({
  user: AuthUserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  mustChangePassword: z.boolean(),
});

export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;

/** POST /api/auth/sign-up/email (accepts no role — always creates `user`). */
export const SignUpRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
  name: z.string(),
});

export type SignUpRequest = z.infer<typeof SignUpRequestSchema>;

/** GET /api/auth/get-session — user resolved from the Bearer access token. */
export const AuthSessionGetResponseSchema = z.object({
  user: AuthUserSchema,
  mustChangePassword: z.boolean(),
});

export type AuthSessionGetResponse = z.infer<typeof AuthSessionGetResponseSchema>;

/** POST /api/auth/refresh-token — single-use rotation. */
export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});

export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export const AuthRefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseSchema>;

/** POST /api/auth/sign-out and POST /api/auth/change-password. */
export const AuthSignOutResponseSchema = z.object({
  success: z.literal(true),
});

export type AuthSignOutResponse = z.infer<typeof AuthSignOutResponseSchema>;

/** POST /api/auth/change-password (authenticated). */
export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

/** POST /api/auth/forgot-password — constant anti-enumeration message. */
export const ForgotPasswordRequestSchema = z.object({
  email: z.string(),
});

export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const MessageResponseSchema = z.object({
  message: z.string(),
});

export type MessageResponse = z.infer<typeof MessageResponseSchema>;

/** POST /api/auth/reset-password and POST /api/auth/verify-email. */
export const ResetPasswordRequestSchema = z.object({
  token: z.string(),
  password: z.string(),
});

export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const VerifyEmailRequestSchema = z.object({
  token: z.string(),
});

export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

export const SuccessMessageResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type SuccessMessageResponse = z.infer<typeof SuccessMessageResponseSchema>;
