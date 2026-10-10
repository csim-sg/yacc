/**
 * Rate Limiter Configuration
 *
 * Plain data object (ADR-005: config holds plain data reading env vars).
 *
 * Production values are contractual and MUST stay exactly:
 * - login:           5 requests  / 15 minutes / IP
 * - password reset:  3 requests  / 1 hour     / IP
 * - API:             100 requests / 15 minutes / IP
 *
 * Deterministic non-production (test) posture (PREREQ-ANG-003 / #408): when the
 * environment is explicitly a test environment, the request ceilings are lifted
 * so a full E2E run from a single shared IP is not contaminated by 429s. The
 * posture is ACTIVE only when `APP_ENV === 'test'` or `NODE_ENV === 'test'`,
 * and is unreachable when `APP_ENV === 'production'`. Windows, response
 * payloads, and headers are unchanged in both postures.
 *
 * @see .docs/adr/ADR-005-config-vs-infrastructure.md
 * @see https://github.com/csim-sg/yacc/issues/408
 */

import { appConfig } from './appConfig';

export interface RateLimitConfig {
  login: { windowMs: number; max: number };
  passwordReset: { windowMs: number; max: number };
  api: { windowMs: number; max: number };
}

/** Production limiter values — do not change without a security review. */
const PRODUCTION_RATE_LIMITS: RateLimitConfig = {
  login: { windowMs: 15 * 60 * 1000, max: 5 },
  passwordReset: { windowMs: 60 * 60 * 1000, max: 3 },
  api: { windowMs: 15 * 60 * 1000, max: 100 },
};

/** Non-production (test) posture: same windows, effectively unlimited requests. */
const TEST_POSTURE_RATE_LIMITS: RateLimitConfig = {
  login: { windowMs: 15 * 60 * 1000, max: Number.MAX_SAFE_INTEGER },
  passwordReset: { windowMs: 60 * 60 * 1000, max: Number.MAX_SAFE_INTEGER },
  api: { windowMs: 15 * 60 * 1000, max: Number.MAX_SAFE_INTEGER },
};

/**
 * Resolves the limiter values for an environment. The test posture requires an
 * explicit test environment and is never active when APP_ENV is 'production'.
 */
export function resolveRateLimitConfig(env: { APP_ENV?: string; NODE_ENV?: string }): RateLimitConfig {
  const isTestEnvironment =
    env.APP_ENV !== 'production' && (env.APP_ENV === 'test' || env.NODE_ENV === 'test');

  return isTestEnvironment ? TEST_POSTURE_RATE_LIMITS : PRODUCTION_RATE_LIMITS;
}

export const rateLimitConfig = resolveRateLimitConfig({
  APP_ENV: appConfig.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
});
