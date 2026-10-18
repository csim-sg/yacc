import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { existsSync } from 'node:fs'

/**
 * Pins the parity-run same-origin relay contract (ANG-004, issue #374 scope
 * item 2): the dev server proxies the frozen /api surface and the embedded
 * Authorization Server endpoints to the Java service, which deliberately has
 * no CORS (React anchor: packages/frontend/vite.config.ts).
 *
 * - proxy.conf.json — canonical static default, wired into the `serve`
 *   target's `proxyConfig` (angular.json).
 * - proxy.conf.js — env-overridable variant (YACC_API_PROXY_TARGET) used by
 *   the Playwright webServer command; route definitions stay single-sourced
 *   in proxy.conf.json.
 *
 * The configs live at the package root, outside the app source tree; the
 * coverage run bundles this spec to a virtual path, so the package root is
 * located by walking up from the working directory instead of import.meta.url.
 */
function findPackageRoot(): string {
  let dir = process.cwd()
  while (dir !== dirname(dir) && !existsSync(resolve(dir, 'angular.json'))) {
    dir = dirname(dir)
  }
  return dir
}

const packageRoot = findPackageRoot()
const req = createRequire(resolve(packageRoot, 'package.json'))
const jsPath = resolve(packageRoot, 'proxy.conf.js')

const DEFAULT_TARGET = 'http://localhost:8080'
const OVERRIDE_TARGET = 'http://127.0.0.1:9090'
const ENV_VAR = 'YACC_API_PROXY_TARGET'

function expectRelayRoutes(config: unknown, target: string): void {
  expect(config).toEqual({
    '/api': { target, changeOrigin: true },
    '/oauth2': { target, changeOrigin: true },
    '/.well-known': { target, changeOrigin: true },
  })
}

describe('parity relay proxy configuration', () => {
  it('proxy.conf.json exposes exactly the three relay routes to the default Java target', () => {
    const config: unknown = req(resolve(packageRoot, 'proxy.conf.json'))
    expectRelayRoutes(config, DEFAULT_TARGET)
  })

  it('proxy.conf.js matches the canonical defaults when no env target is set', () => {
    const previous = process.env[ENV_VAR]
    delete process.env[ENV_VAR]
    delete req.cache[req.resolve(jsPath)]
    try {
      const config: unknown = req(jsPath)
      expectRelayRoutes(config, DEFAULT_TARGET)
    } finally {
      if (previous !== undefined) process.env[ENV_VAR] = previous
      delete req.cache[req.resolve(jsPath)]
    }
  })

  it('proxy.conf.js retargets every relay route via YACC_API_PROXY_TARGET', () => {
    const previous = process.env[ENV_VAR]
    process.env[ENV_VAR] = OVERRIDE_TARGET
    delete req.cache[req.resolve(jsPath)]
    try {
      const config: unknown = req(jsPath)
      expectRelayRoutes(config, OVERRIDE_TARGET)
    } finally {
      if (previous === undefined) delete process.env[ENV_VAR]
      else process.env[ENV_VAR] = previous
      delete req.cache[req.resolve(jsPath)]
    }
  })
})
