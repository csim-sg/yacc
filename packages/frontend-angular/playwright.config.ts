import { defineConfig, devices } from '@playwright/test'

/**
 * Angular parity harness (ANG-003 — SPEC-003 FR-03, AC-03).
 *
 * Runs the EXISTING React-suite Playwright specs from `packages/frontend/tests`
 * UNCHANGED against the Angular app (guardrail: a spec edit to make Angular
 * pass is a disposition-register entry, never a silent edit — SPEC-001 T4 §5
 * rule 4; see PARITY.md). The suite was verified mechanically
 * framework-agnostic (zero react/@testing-library/src imports).
 *
 * Only configuration is re-pointed: baseURL/webServer move from the React
 * Vite dev server (:5173) to the Angular dev server (:4200). Browser projects
 * (chromium/firefox/webkit), parallelism, retries, and the backend
 * `db:fixtures` global setup are carried over from the React config
 * (packages/frontend/playwright.config.ts) verbatim.
 *
 * Parity bar: PB-1 (build green) / PB-2 (Tier-0 E2E zero-regression vs the
 * archived React baseline) / PB-3 (unit + coverage thresholds) — defined in
 * PARITY.md. CI enforcement of these gates is ANG-015 scope.
 */
export default defineConfig({
  // The existing 41-file suite, reused unchanged (35 files / ~450 cases in the
  // default run; `e2e/` promotion + debug-spec exclusion are ANG-015 decisions).
  testDir: '../frontend/tests',
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
    command: 'pnpm dev',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    // `ng serve` (AOT dev build) needs longer than the default 60s to become
    // responsive on a cold start.
    timeout: 180_000,
  },
  globalSetup: '../frontend/tests/global-setup.ts',
})
