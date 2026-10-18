import { HttpInterceptorFn } from '@angular/common/http';
import { timeout } from 'rxjs';

import { HTTP_BYPASS_AUTH, HTTP_TIMEOUT_MS } from './http-context';

/**
 * Timeout interceptor (T2 §3.5): fails a request that exceeds its
 * per-attempt timeout (default 30s) with a RxJS `TimeoutError` — the
 * retry interceptor (placed OUTSIDE this one) treats it as transient and
 * re-executes the request, re-arming the timeout per attempt. Refresh
 * calls flagged `HTTP_BYPASS_AUTH` stay unwrapped (reference-client
 * parity: the refresh `fetch` had no timeout).
 */
export const timeoutInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(HTTP_BYPASS_AUTH)) {
    return next(req);
  }
  return next(req).pipe(timeout(req.context.get(HTTP_TIMEOUT_MS)));
};
