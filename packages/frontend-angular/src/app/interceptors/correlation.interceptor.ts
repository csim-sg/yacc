import { HttpInterceptorFn } from '@angular/common/http';

import { HTTP_BYPASS_AUTH } from './http-context';

/**
 * Correlation interceptor (T2 §6): attaches one `X-Request-ID` (UUIDv4)
 * per request — the same correlation header the socket handshake uses
 * (`contracts/ws/connection.ts`). Refresh calls flagged
 * `HTTP_BYPASS_AUTH` stay bare, matching the reference client.
 */
export const correlationInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(HTTP_BYPASS_AUTH)) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-Request-ID': crypto.randomUUID() } }));
};
