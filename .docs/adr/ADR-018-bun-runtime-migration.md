**Status:** Proposed  
**Date:** 2026-02-20  
**Deciders:** Enterprise Architect + Product Owner  
**Related:** ADR-013 (backend build bundling esbuild), ADR-007 (vitest)

---

# Architecture Decision Record

## Title
Adopt Bun Runtime (and Bun Workspaces) for the YACC Monorepo

## Context

We want to migrate YACC to the Bun runtime while keeping the current monorepo structure:

- `packages/backend/`
- `packages/frontend/`
- `packages/common/`

Current backend assumptions include Node.js 18+ runtime and a backend build pipeline documented in ADR-013.

Key goals:

- Keep monorepo layout (no structural rewrite)
- Reduce runtime/tooling friction (faster installs and execution)
- Keep deployability to K3s (Helm-based deployments)
- Maintain compatibility with decorator-heavy backend stack (routing-controllers + reflect-metadata)
- Keep Turborepo orchestration (optional but preferred)

## Decision

### 1) Runtime

Adopt **Bun** as the primary runtime for:

- Running the backend service in dev and production
- Running backend scripts (build/test/lint) where compatible

### 2) Monorepo

Keep the existing monorepo package boundaries and adopt **Bun workspaces** for dependency installation/linking.

Turborepo remains supported; it is runtime-agnostic and can continue to orchestrate tasks.

### 3) Backend build pipeline

This ADR supersedes the "keep runtime as Node.js 18+" constraint in ADR-013.

We keep ADR-013's build approach (tsc -> esbuild) initially to minimize risk. The runtime used to execute the built artifact becomes:

- `bun dist/index.js` (or equivalent Bun start command)

Any future simplification (e.g., Bun-native TS execution in dev) is explicitly out of scope for this ADR and should be evaluated after the migration stabilizes.

### 4) Testing

Keep Vitest (ADR-007) initially.

Rationale: migration scope is already large; switching test runners to `bun test` can be evaluated later as a separate ADR/task.

## Consequences

### Pros

- Monorepo can remain unchanged; workspaces continue to link local packages
- Potential faster install and script execution
- Single runtime choice across environments (local + Docker)

### Cons / Risks

- Bun compatibility gaps may surface (ESM edge cases, Node API parity differences, tooling expectations)
- CI/CD pipeline changes (lockfile, caching strategy, install commands)
- Deployment image changes (base image, entrypoint)

### Compatibility guardrails

- Keep the backend build output as a JS artifact (`dist/index.js`) and run that in Bun
- Do not change core framework stack during migration (Express, routing-controllers, Drizzle)
- Rollback must remain possible within one PR (return to Node + pnpm)

## Migration Plan (High-Level)

1. Add Bun runtime to CI and local toolchain; validate `bun --version`
2. Add Bun workspace configuration and lockfile; update install scripts
3. Update backend start command to run with Bun (dev + prod)
4. Update Dockerfile to use Bun runtime image
5. Update GitHub Actions caching and commands
6. Run full test suite and smoke run backend

## Rollback Plan

- Revert lockfile/tooling changes (restore pnpm usage)
- Restore backend start commands to Node
- Restore CI/Docker base image to Node
