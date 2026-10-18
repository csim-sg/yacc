import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, concatMap, from, throwError } from 'rxjs';

import { apiErrorFromHttpError } from '../lib/api-error-from-http';
import { AuthRefreshService } from '../services/auth-refresh.service';
import { TokenStorageService } from '../services/token-storage.service';
import { HTTP_AUTH_REPLAYED, HTTP_BYPASS_AUTH, HTTP_RETRIES } from './http-context';

/**
 * Whether the request URL sits on the public auth surface
 * (`/api/auth/*`): a 401 there is a semantic error to surface (invalid
 * credentials, unknown reset token) — never a session loss and never a
 * refresh trigger (React `isPublicAuthEndpoint` parity).
 */
function isPublicAuthPath(url: string): boolean {
  return new URL(url, window.location.origin).pathname.startsWith('/api/auth/');
}

/**
 * 401-refresh interceptor (T2 §3.1/§3.5; ARCH-005 §3.4): on a 401 from a
 * protected endpoint, run the single-flight refresh, then replay the
 * original request EXACTLY ONCE with the rotated bearer. On refresh
 * failure (or a second 401 on the replay) clear the token pair and
 * navigate to `/login` in-SPA. 401s from the public auth surface and from
 * the bare refresh calls themselves surface as typed errors untouched.
 */
export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const refreshService = inject(AuthRefreshService);
  const tokens = inject(TokenStorageService);
  const bypass = req.context.get(HTTP_BYPASS_AUTH);
  const publicAuth = isPublicAuthPath(req.url);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        bypass ||
        publicAuth
      ) {
        return throwError(() => error);
      }
      return from(refreshService.refresh()).pipe(
        concatMap((refreshed) => {
          if (!refreshed) {
            refreshService.forceReLogin();
            return throwError(() => apiErrorFromHttpError(error));
          }
          const accessToken = tokens.getAccessToken();
          const headers = accessToken
            ? req.headers.set('Authorization', `Bearer ${accessToken}`)
            : req.headers;
          const replay = req.clone({
            headers,
            // Retries are not re-armed for the single replay (React
            // `retries: 0` parity); the flag marks it as the one replay.
            context: req.context.set(HTTP_AUTH_REPLAYED, true).set(HTTP_RETRIES, 0),
          });
          // A 401 on the one replay means the fresh token was rejected —
          // no second refresh: clear and force re-login.
          return next(replay).pipe(
            catchError((replayError: unknown) => {
              if (replayError instanceof HttpErrorResponse && replayError.status === 401) {
                refreshService.forceReLogin();
              }
              return throwError(() => replayError);
            }),
          );
        }),
      );
    }),
  );
};
