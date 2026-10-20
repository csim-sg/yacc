/**
 * Env-overridable variant of proxy.conf.json for parity runs.
 *
 * The Spring service has no CORS (see packages/frontend/vite.config.ts), so
 * the browser reaches the frozen /api surface and the embedded AS endpoints
 * (/oauth2/*, /.well-known/*) through the dev-server same-origin relay.
 * proxy.conf.json is the canonical static default wired into the `serve`
 * target's `proxyConfig` (angular.json); this wrapper reuses those route
 * definitions and lets a run retarget the relay via YACC_API_PROXY_TARGET
 * without editing anything — the Angular mirror of the React anchor's
 * VITE_API_URL override. When the variable is unset it is identical to
 * proxy.conf.json. Used by the Playwright webServer command
 * (`ng serve --proxy-config proxy.conf.js`); plain `pnpm dev` keeps the
 * static default.
 */
const defaults = require('./proxy.conf.json')

const target = process.env.YACC_API_PROXY_TARGET || 'http://localhost:8080'

module.exports = Object.fromEntries(
  Object.entries(defaults).map(([route, options]) => [
    route,
    { ...options, target },
  ]),
)
