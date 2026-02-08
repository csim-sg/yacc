**Status:** Accepted  
**Date:** 2026-02-07  
**Deciders:** Architecture Team  
**Technical Story:** PR-227 build/runtime stabilization

---

# Architecture Decision Record

## Context / Problem Statement
The backend package (`@yacc/backend`) is an ESM Node.js application and is started via `node dist/index.js`. Node ESM module resolution can be sensitive to import specifiers in emitted output, and some dependencies (e.g. Better Auth packages) are ESM-only.

We also want:
1. A single backend entry artifact for deployment (`dist/index.js`).
2. Source maps for debugging.
3. To keep runtime dependencies in `node_modules` (no full dependency inlining).

## Drivers & Constraints
- Keep runtime as Node.js 18+ (no Bun runtime change).
- Preserve decorator metadata required by `routing-controllers` / `class-validator` / `reflect-metadata`.
- Avoid forcing `.js` specifiers in TypeScript source imports.
- Deployment remains: `dist/` + `node_modules/`.

## Options Considered
1. Keep `tsc` output and run `node dist/index.js` with manual import specifier fixes.
2. Switch backend to CommonJS.
3. Introduce a bundler for the backend build (esbuild), producing a single `dist/index.js` with sourcemap while keeping `node_modules` at runtime. ✅
4. Switch runtime to Bun.

## Decision
Adopt a two-step backend build:
1. Compile TypeScript with `tsc` into `dist-tmp/` to preserve decorator metadata.
2. Bundle a single runtime entry using `esbuild` into `dist/index.js` with sourcemap enabled.

Runtime dependencies remain external and are shipped in `node_modules/`.

## Implications & Consequences
- Backend `build` script changes to run `tsc` + esbuild bundling.
- `start` enables source maps (`node --enable-source-maps dist/index.js`).
- CI/CD should deploy `packages/backend/dist/` and `packages/backend/node_modules/` (prod-only) together.
- This introduces a new build-time dependency (`esbuild`).

## Architecture Principle Alignment
- **Operational Excellence:** single entry artifact + sourcemaps improves observability and debugging.
- **Reliability:** keeps Node runtime stable; avoids runtime import resolution drift.
- **Governance:** build/runtime change is documented and auditable.
