import { readFileSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/**
 * Angular parity harness (ANG-003 — SPEC-003 FR-03, AC-03; gate scope per
 * ANG-015 U10).
 *
 * Runs the EXISTING React-suite Playwright specs from `packages/frontend`
 * UNCHANGED against the Angular app (guardrail: a spec edit to make Angular
 * pass is a disposition-register entry, never a silent edit — SPEC-001 T4 §5
 * rule 4; see PARITY.md). The suite was verified mechanically
 * framework-agnostic (zero react/@testing-library/src imports).
 *
 * Configuration moved from the React harness: baseURL/webServer are re-pointed
 * from the Vite dev server (:5173) to the Angular dev server (:4200). Browser
 * projects (chromium/firefox/webkit), parallelism, retries, and the Java
 * backend health-check global setup are carried over verbatim.
 *
 * U10 gate scope (ANG-015 #385, resolved 2026-10-19 — recorded in
 * `parity/disposition-register.md` §5): the excluded `e2e/` set is PROMOTED
 * into the parity run (6 files / 107 cases — real-time listeners, unread
 * badges, users admin, QA-002 workflows, IRC button, tags) and the 9
 * debug/inspector specs (T4 §2, assertion-free noise) are EXCLUDED. The
 * `tests/tags.e2e.spec.ts` wrapper is superseded by direct `e2e/` discovery
 * (it only re-imported the excluded file; direct discovery avoids a
 * double-run). Scope + the baseline anchor identity live in
 * `parity/gate-scope.json` — the single machine-readable source of truth this
 * config and the CI comparator (`parity/compare-baseline.mjs`) both read.
 * Editing that file is a disposition-register event, never a way to make a
 * red gate green.
 *
 * Parity bar: PB-1 (build green) / PB-2 (Tier-0 E2E zero-regression vs the
 * archived React baseline) / PB-3 (unit + coverage thresholds) — defined in
 * PARITY.md. CI enforcement of these gates is ANG-015 scope
 * (.github/workflows/frontend-angular-parity.yml).
 */
// Fail-closed: the gate scope must load — a missing/corrupt scope file must
// never silently fall back to a wider or narrower run.
// Resolved from the package dir (all repo invocations run with
// `pnpm --filter @yacc/frontend-angular …`, which sets this cwd).
const gateScope = JSON.parse(readFileSync('parity/gate-scope.json', 'utf8'))

export default defineConfig({
  testDir: '../frontend',
  testMatch: gateScope.runMatch,
  testIgnore: [...gateScope.excludedDebugSpecs, ...gateScope.supersededWrappers],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    // Same-origin relay: the Spring service has no CORS, so browser calls
    // reach the Java service through the dev-server proxy. `--proxy-config`
    // selects the env-overridable variant (YACC_API_PROXY_TARGET, default
    // http://localhost:8080); plain `pnpm dev` serves the same routes from
    // proxy.conf.json via the `serve` target's proxyConfig.
    command: 'pnpm exec ng serve --proxy-config proxy.conf.js',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    // `ng serve` (AOT dev build) needs longer than the default 60s to become
    // responsive on a cold start.
    timeout: 180_000,
  },
  globalSetup: '../frontend/tests/global-setup.ts',
})
