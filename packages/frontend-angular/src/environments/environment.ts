/**
 * Development environment (default build configuration).
 *
 * Replaces the Vite build-time substitution of `VITE_API_BASE_URL` / `VITE_WS_URL`
 * (see `.docs/architecture/005-angular-target-frontend-architecture.md`).
 *
 * - `apiBaseUrl: ''` = same-origin requests (matches the React default when
 *   VITE_API_BASE_URL is unset in `packages/frontend/src/lib/apiClient.ts`).
 * - `wsUrl` is the raw-WebSocket upgrade URL (R1 target): the Java service's
 *   `/ws` endpoint (ADR-026) — the superseded Node Socket.io URL
 *   (`ws://localhost:3000`) is not a target (SPEC-003 §Java Baseline
 *   Approval AD-2). The handshake auth token rides the upgrade's `token`
 *   query parameter (browser WS cannot set headers).
 *
 * Values are substituted at build time via `fileReplacements` only; there is
 * no runtime environment mechanism.
 */
export const environment = {
  apiBaseUrl: '',
  wsUrl: 'ws://localhost:8080/ws',
  /** AS issuer base URL; empty = same origin (React `VITE_OIDC_ISSUER` default). */
  oidcIssuer: '',
  /** Registered public SPA client id (React `VITE_OIDC_CLIENT_ID` default). */
  oidcClientId: 'yacc-frontend',
} as const;
