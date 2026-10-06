/**
 * Production environment (substituted for `environment.ts` by the
 * `production` build configuration's `fileReplacements`).
 *
 * Same-origin defaults, identical to the React build's effective fallbacks
 * when `VITE_API_BASE_URL` / `VITE_WS_URL` are unset. Explicit production
 * endpoints, if ever required, are set here at build time — the deploy
 * enablement/cutover issues (ANG-014/ANG-016) own that decision.
 */
export const environment = {
  apiBaseUrl: '',
  wsUrl: 'ws://localhost:3000',
} as const;
