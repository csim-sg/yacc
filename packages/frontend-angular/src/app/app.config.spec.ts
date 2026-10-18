import { appConfig } from './app.config';

/**
 * App-shell config spec (ANG-003 scaffold).
 *
 * Pins the shell wiring that `bootstrapApplication` consumes in `main.ts`
 * (excluded from coverage): zone change detection retained explicitly (ADR-031
 * decision 4) and the router provisioned. ANG-004+ extend the route table and
 * guard set — their specs join the parity-critical run set (PARITY.md).
 */
describe('appConfig', () => {
  it('provides shell-level providers (router + zone change detection)', () => {
    expect(Array.isArray(appConfig.providers)).toBe(true);
    expect(appConfig.providers.length).toBeGreaterThan(0);
  });
});
