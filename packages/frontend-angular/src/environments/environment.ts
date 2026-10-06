/**
 * Development environment (default build configuration).
 *
 * Replaces the Vite build-time substitution of `VITE_API_BASE_URL` / `VITE_WS_URL`
 * (see `.docs/architecture/005-angular-target-frontend-architecture.md`).
 *
 * - `apiBaseUrl: ''` = same-origin requests (matches the React default when
 *   VITE_API_BASE_URL is unset in `packages/frontend/src/lib/apiClient.ts`).
 * - `wsUrl` matches the React default in `packages/frontend/src/lib/socket.ts`.
 *
 * Values are substituted at build time via `fileReplacements` only; there is
 * no runtime environment mechanism.
 */
export const environment = {
  apiBaseUrl: '',
  wsUrl: 'ws://localhost:3000',
} as const;
