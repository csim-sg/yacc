import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Request-context vocabulary for the interceptor chain (ANG-005). The ONE
 * place per-request behavior flags are defined — services set them, the
 * interceptors in `interceptors/` consume them.
 */

/** Default per-request timeout (React apiClient `timeout: 30000`). */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Hard cap of the exponential retry backoff (1s → 2s → 4s → cap 30s). */
export const MAX_BACKOFF_MS = 30_000;

/** Retry budget for one logical request (queries: 3). */
export const HTTP_RETRIES = new HttpContextToken<number>(() => 3);

/** Per-attempt timeout in ms (React apiClient 30s). */
export const HTTP_TIMEOUT_MS = new HttpContextToken<number>(() => REQUEST_TIMEOUT_MS);

/**
 * Mutations opt down to a single retry (T2 §3.5; never 4xx, never
 * offline). Read by the retry interceptor.
 */
export const HTTP_IS_MUTATION = new HttpContextToken<boolean>(() => false);

/** Base of the exponential retry backoff (`base * 2 ** attempt`). */
export const HTTP_RETRY_BACKOFF_MS = new HttpContextToken<number>(() => 1000);

/**
 * Skip the auth/correlation cross-cutting layer (and its retry/timeout
 * wrapping): used by the refresh calls themselves, which are bare in the
 * reference client (React refresh `fetch` had no auth header, no
 * correlation id, no timeout/retry).
 */
export const HTTP_BYPASS_AUTH = new HttpContextToken<boolean>(() => false);

/**
 * Marks the one replayed request after a successful 401 refresh — a
 * replayed request must never trigger a second refresh (replay once).
 */
export const HTTP_AUTH_REPLAYED = new HttpContextToken<boolean>(() => false);

/**
 * Context for mutation calls: one retry instead of the query budget of 3
 * (T2 §3.5 — mutations opt down).
 */
export function mutationContext(): HttpContext {
  return new HttpContext().set(HTTP_IS_MUTATION, true);
}
