import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { TokenStorageService } from '../services/token-storage.service';
import { HTTP_BYPASS_AUTH } from './http-context';

/**
 * Auth-header interceptor (T2 §3.5): attaches `Authorization: Bearer` from
 * the ANG-004 `TokenStorageService` — the single token seam — when a token
 * is stored. Requests flagged `HTTP_BYPASS_AUTH` (the refresh calls
 * themselves) pass through untouched, matching the reference client where
 * the refresh `fetch` carries no auth header.
 */
export const authHeaderInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(HTTP_BYPASS_AUTH)) {
    return next(req);
  }
  const token = inject(TokenStorageService).getAccessToken();
  if (!token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
