import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authHeaderInterceptor } from './interceptors/auth-header.interceptor';
import { authRefreshInterceptor } from './interceptors/auth-refresh.interceptor';
import { correlationInterceptor } from './interceptors/correlation.interceptor';
import { errorMappingInterceptor } from './interceptors/error-mapping.interceptor';
import { retryInterceptor } from './interceptors/retry.interceptor';
import { timeoutInterceptor } from './interceptors/timeout.interceptor';

/**
 * The single HttpClient provisioning seam (ARCH-005 boundary 1; SPEC-003
 * FR-02). Every HTTP call in the Angular app goes through this one
 * `provideHttpClient()` wiring — the contract-backed family services are
 * built on it, and the interceptor chain registered here is the only
 * cross-cutting HTTP layer (ANG-005): auth-header/correlation,
 * 401-refresh (single-flight → replay once → clear + `/login`), retry
 * (3×/1×, 5xx/timeout only, offline-aware), per-attempt 30s timeout, and
 * typed `ApiError` mapping. No bare-fetch call exists in this package.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        // Outermost: maps every transport failure onto the typed ApiError.
        errorMappingInterceptor,
        correlationInterceptor,
        authHeaderInterceptor,
        authRefreshInterceptor,
        // Innermost pair: retry re-executes the request, so the per-
        // attempt timeout re-arms on every retry attempt.
        retryInterceptor,
        timeoutInterceptor,
      ]),
    )
  ]
};
