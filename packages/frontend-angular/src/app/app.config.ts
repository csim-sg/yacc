import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

/**
 * The single HttpClient provisioning seam (ARCH-005 boundary 1; SPEC-003
 * FR-02). Every HTTP call in the Angular app goes through this one
 * `provideHttpClient()` wiring — contract-backed family services are built
 * on it (ANG-005 adds the interceptor chain: auth/correlation,
 * 401-refresh, retry). No bare-fetch call exists in this package.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient()
  ]
};
