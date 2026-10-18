import { routes } from './app.routes';

/**
 * App-shell route-table spec (ANG-003 scaffold).
 *
 * The scaffold ships an empty route table (no feature pages yet — feature
 * ports start at ANG-004). This spec pins that baseline so the table cannot
 * change silently; ANG-004 (auth + RBAC) replaces it with the real route/guard
 * matrix per PARITY.md.
 */
describe('routes', () => {
  it('is an empty route table in the scaffold state', () => {
    expect(routes).toEqual([]);
  });
});
