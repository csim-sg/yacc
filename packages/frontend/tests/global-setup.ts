/**
 * PREREQ-ANG-003-S1 helper wiring (pre-registered disposition — permitted
 * test-helper adaptation): the suite no longer seeds fixtures through the
 * transitional Node backend (`npm run db:fixtures` in `packages/backend` is
 * gone). The Java backend of record (`services/backend-java`) applies the
 * suite's fixture world itself when booted with the explicit non-production
 * `e2e` profile, the opt-in property `yacc.e2e.seed-enabled=true`, and a
 * loopback (non-production) datasource — see the gated
 * `com.yacc.common.seed.E2EFixtureSeed` entrypoint. This setup therefore
 * only verifies that the Java service is reachable before the suite starts.
 *
 * Harness/config ownership: the Playwright config remains
 * `packages/frontend/playwright.config.ts`; ANG-003 (#373) owns future
 * harness baseline changes (stop E2 — no second config).
 */
export default async function globalSetup() {
  const apiBase = process.env.API_URL || 'http://localhost:8080/api';
  const healthUrl = `${apiBase.replace(/\/api\/?$/, '')}/health/live`;

  let ok = false;
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(10_000) });
    ok = response.ok;
  } catch {
    ok = false;
  }

  if (!ok) {
    throw new Error(
      'Java backend not reachable at ' +
        healthUrl +
        '. Boot it with the E2E fixture posture before running the suite: e2e profile + ' +
        'yacc.e2e.seed-enabled=true + loopback DATABASE_URL (e.g. ' +
        'SPRING_PROFILES_ACTIVE=e2e yacc.e2e.seed-enabled=true DATABASE_URL=jdbc:postgresql://localhost:5432/yacc_e2e ' +
        '— the com.yacc.common.seed.E2EFixtureSeed entrypoint seeds the fixture world at startup).'
    );
  }
}
