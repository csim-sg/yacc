import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { TimeoutError, retry, timer } from 'rxjs';

import { HTTP_BYPASS_AUTH, HTTP_IS_MUTATION, HTTP_RETRIES, HTTP_RETRY_BACKOFF_MS, MAX_BACKOFF_MS } from './http-context';

/**
 * Retry interceptor (T2 §3.1/§3.5; ARCH-005 §3.4): retries ONLY 5xx
 * responses and per-attempt timeouts — never 4xx (401 has its own path),
 * never while the browser is offline (`networkMode: 'online'` parity).
 *
 * Budgets: queries 3×, mutations 1× (`HTTP_IS_MUTATION`), exponential
 * backoff 1s → 2s → 4s capped at 30s. Re-execution re-runs the whole
 * inner chain (fresh timeout, fresh headers) — the request is retried,
 * not the response replayed.
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(HTTP_BYPASS_AUTH)) {
    return next(req);
  }
  const budget = req.context.get(HTTP_IS_MUTATION) ? 1 : req.context.get(HTTP_RETRIES);
  const backoffBase = req.context.get(HTTP_RETRY_BACKOFF_MS);

  return next(req).pipe(
    retry({
      count: budget,
      delay: (error: unknown, retryAttempt: number) => {
        if (!isRetryableError(error) || typeof navigator === 'object' && !navigator.onLine) {
          throw error;
        }
        return timer(Math.min(backoffBase * 2 ** (retryAttempt - 1), MAX_BACKOFF_MS));
      },
    }),
  );
};

/** 5xx and timeouts are transient; everything else surfaces immediately. */
function isRetryableError(error: unknown): boolean {
  if (error instanceof TimeoutError) {
    return true;
  }
  return error instanceof HttpErrorResponse && error.status >= 500;
}
