# 005 — Angular Target Frontend Architecture (SPEC-003)

**Status:** Accepted
**Date:** 2026-10-06 (authored in ANG-001, #371)
**Owner:** Tech-lead
**Author:** Builder (ANG-001), tech-lead-guarded
**Type:** Architecture (frontend placement + guardrails)
**Companion ADR:** ADR-031 (Angular target architecture — decision record)
**Related:** SPEC-003 (implementation spec, milestone #4), SPEC-001 T2 §1–§7 (canonical planning mapping), ADR-005 (flat structure / config-vs-infrastructure), ADR-006 (auth client), ADR-011 (naming), ADR-019 (S3+CloudFront frontend exclusion), ADR-020 (Zod source of truth), ARCH-001/002 (current React-stack docs — frontend sections superseded by this doc for the Angular target), ARCH-004 (Java backend guardrails — parallel stream), GOV-034, GOV-038

---

## Purpose

This document is the **placement and guardrail reference for every SPEC-003 implementation issue (ANG-002..ANG-017)**. It encodes the SPEC-001 T2 §1–§7 Angular-native mapping as canonical (planning basis, unchanged in substance) and records the implementation-time pins decided in ANG-001. Reviewers gate ANG-002..ANG-017 PRs against this document instead of re-deriving placement per issue.

The React package (`packages/frontend`) remains the **production frontend** until the approved cutover (ANG-016). Nothing in the Angular package may import from it, and no React file may be edited or deleted before ANG-016 sign-off.

## Stack (pinned in ANG-001)

| Concern | Angular target | Notes |
|---|---|---|
| Framework | **Angular 21.2.x** (`^21.2.25` floor) | Newest LTS line at implementation kickoff (2026-10); satisfies the SPEC v18+ API floor (T2 §1.1). T2 §11.4 required re-verifying the matrix at kickoff: Angular 21.2.25 peers are TypeScript `>=5.9 <6.0`, Node `^20.19.0 \|\| ^22.12.0 \|\| >=24` — matches the repo Node 20.x CI matrix. Major upgrades need an ADR-level finding |
| Components | **Standalone components** (Angular 19+ default), **no NgModules** | v21 scaffolds omit the `standalone: true` flag because standalone is the default; the guardrail is "no NgModules, standalone only" |
| Component-local state | **Signals** (`signal`/`computed`/`effect`) | T2 §1 |
| Shared state | Injectable signal-store services (`providedIn: 'root'`) | T2 §3.2; one per former Zustand store boundary |
| Server-state | Resource signal stores on one internal typed helper (`ResourceState<T>`) | T2 §3.1; no state library (NgRx rejected, T2 §8.1) |
| Routing | Angular Router + **functional guards** (`authGuard`, `publicGuard`, `roleGuard`) | T2 §3.3; route table mirrors `App.tsx` |
| HTTP | HttpClient + **functional interceptors** (auth-header/correlation, 401-refresh, retry) | T2 §3.4 |
| Real-time | **RxJS Subjects/Observables over retained `socket.io-client`**, one `WebSocketClientService` | T2 §3.5; inbound-only (B14) |
| Styling | **Tailwind v4 + daisyUI 5**, `@tailwindcss/postcss` (auto-applied by the `@angular/build` application builder when the package is installed) | T2 §4.1; identical class names/themes as React → E2E selectors unaffected. Note: the v17+ application builder has no `postcssConfiguration` option (that belonged to the retired webpack builder) — Tailwind v4 wiring is package-detection based |
| Forms | Template-driven (ngModel) for simple forms; reactive only where validation warrants | T2 §1.1 (applies from ANG-004+) |
| Change detection | **zone.js (retained explicitly)** | T2 §1.1: "zoneless is an optimization with no current need; default = max compatibility with socket callbacks". Angular 21 scaffolds default to zoneless — `provideZoneChangeDetection` + `zone.js` polyfill are deliberately kept |
| Build | **Angular CLI (`ng build`)** — AOT + budgets + strict template type-check | Vite is not present in this package; no parallel Vite config (TR-02) |

## Placement (flat `src/` folders — ADR-005 analog, enforced)

```
packages/frontend-angular/
  src/
    main.ts                  # bootstrap only
    styles.css               # Tailwind v4 + daisyUI entry
    index.html               # SPA entry (no-cache at the CDN layer)
    environments/
      environment.ts         # dev defaults (build-time substitution input)
      environment.prod.ts    # production values (fileReplacements)
    app/
      app.ts / app.html / app.css / app.config.ts / app.routes.ts
      pages/                 # routed page components (presentation)
      components/            # shared presentational components
      services/              # state + data + IO (injectable): stores, HTTP services, WebSocketClientService, event handlers, AuthService
      guards/                # functional route guards
      interceptors/          # functional HTTP interceptors
      contracts/             # typed local contracts (Zod) — frontend source of truth
      types/                 # app-internal view types (role unions, view models)
      lib/                   # pure utilities (logger, tempId, navigation config)
```

- **Flat folders only** — no nested `api/`/`domain` layering (ADR-005 addendum-1 pattern applied to the frontend).
- **One definition per file**; single responsibility.
- **No `any`**, no type casts, never (TR-06). `strictTemplates` is on; keep it.
- **Index files export consts only** (no re-export barrels) — same rule as the backend.
- **Naming:** ADR-011 (camelCase and kebabCase both allowed; Angular idiomatic file names accepted).
- Components/pages never call HttpClient or the socket directly; they consume services/stores. Services own all IO. Interceptors are the only cross-cutting HTTP layer.

## Boundaries (binding)

1. **Single HTTP entry** — all HTTP goes through the contract-backed API services behind one HttpClient provisioning seam (ANG-002). No fetch calls, no ad-hoc base URLs.
2. **Single socket entry** — one injectable `WebSocketClientService` wraps `socket.io-client`. **Inbound-only**: the client emits nothing over the socket (verified current behavior, T2 B14); no `eventId` dependency.
3. **No `@yacc/common`** — local Angular contracts (Zod `z.infer`) in `contracts/` are the frontend source of truth (SPEC binding decision; ADR-020 governs the backend, not this package).
4. **No cross-import from `packages/frontend`** — zero shared code with React; the React package is untouched until ANG-016.
5. **No TanStack** (Query/Router), **no NgRx/NgModules**, no state library (SPEC binding decisions; T2 §8).
6. **Environment substitution is build-time file replacement only** (`environment.prod.ts`); no runtime environment mechanism is invented. Fields carry the `VITE_API_BASE_URL` / `VITE_WS_URL` equivalents (`apiBaseUrl`, `wsUrl`). No `import.meta.env` anywhere in this package.

## Behavior mapping (canonical — SPEC-001 T2 §3/§5/§6/§7)

The T2 mapping is canonical for implementation; summary of what each later issue ports:

- **§3.1 TanStack Query → resource signal stores**: per-family stores on one `ResourceState<T>` helper (30s freshness, 5m lazy eviction, per-key in-flight dedup, `invalidate()`/`update()`, stale-while-revalidate + keep-previous). Canonical cache registry keys defined once in `contracts/` (ends the live three-spelling key drift, B2).
- **§3.2 Zustand → signal-store services**: same store boundaries as today; dead stores (offline-queue/presence/selection, B12) are deletion candidates, not migration cargo — their port is a surfaced decision, not a default.
- **§3.3 Routing → guards**: `ProtectedRoute`/`PublicRoute` → `authGuard`/`publicGuard`; role hierarchy USER 1 < MANAGER 2 < ADMIN 3 < SUPER_ADMIN 4 in `roleGuard` + navigation config.
- **§3.4 HTTP → interceptors**: Bearer/correlation, 401 single-flight refresh (`POST /api/auth/refresh-token`) → replay once → clear + `/login`; retry 3× queries / 1× mutations on 5xx/timeouts only.
- **§3.5 Real-time → RxJS over socket.io-client**: native reconnection (1s→30s, 10 attempts), auth token in handshake, reconnect → cache invalidation + `ReconnectingIndicator` state.
- **§5 Auth/RBAC**: `AuthService` signals (get-session at init, sign-in, sign-out), lowercase→uppercase role normalization ported verbatim; token capture via `set-auth-token` closes the empty-handshake-token gap; **register/recovery/logout wire to T3-validated live endpoints only — the `/simple-auth/*` drift is not reproduced**.
- **§6 Observability**: `lib/logger` + `X-Request-ID` correlation ported; `SLOMonitor`/`MetricsSink`/`WebSocketLogger` are **not ported** (parity-of-absence — the surface is unwired today, T1 F6); wiring them later is a U9-gated decision, not silent scope.
- **§7 Error handling**: typed `ApiError` in `contracts/`; per-component loading/error/empty states (no global error boundary); `message.failed` → status patch + retry affordance; notification pipeline feeds one canonical store (fixes frontend B6; missing backend emitter F7 remains a recorded contract gap, not a frontend invention).

## Build & deploy (TR-02)

| Aspect | Value |
|---|---|
| Build | `pnpm --filter @yacc/frontend-angular build` → `ng build` (AOT, budgets, strict type-check) |
| Output | `packages/frontend-angular/dist/frontend-angular/browser/` |
| Production config | `fileReplacements` (`environment.ts` → `environment.prod.ts`), `outputHashing: all` (immutable hashed assets), budgets: initial 500kB warning / 1MB error; anyComponentStyle 4kB / 8kB |
| Dev server | `pnpm --filter @yacc/frontend-angular dev` → `ng serve` (port 4200). Playwright `webServer` re-point is ANG-003 scope |
| Deploy | Production (`main`) continues to deploy the **React SPA** (`packages/frontend/dist` → S3 + CloudFront; ADR-019 frontend exclusion — **no Helm/K8s for the frontend**). The Angular output (`dist/frontend-angular/browser/`) is **build-validated only** by this workflow — the validation job holds no AWS credentials and has no deploy steps. Re-pointing the production sync to the Angular output is ANG-014 (retention/enablement) + ANG-016 (cutover gate) work, done under review. Workflow: `.github/workflows/frontend-deploy.yml` (Node **20.x** matrices; `deploy` job = React production, push-to-`main` only; `build-angular` job = Angular build-only validation, also on PRs touching the Angular package) |
| Rollback | Retained-asset re-point (CP-2 retention mechanism is ANG-014 scope — today's `--delete` sync cannot roll back) |

**Deploy-safety note (fail-closed):** `.github/workflows/frontend-deploy.yml` production deploys on `main` pushes remain on the **React SPA**; the `deploy` job is gated to push events only. The Angular shell is validated build-only (no AWS credentials, no S3 sync in that job), so no `dev`→`main` release can ship the shell before the approved cutover. Production cutover happens exclusively via ANG-014 (deploy enablement) + ANG-016 (cutover gate), which must re-point the `deploy` job's build/sync target in a reviewed change — a workflow comment alone is not an execution gate.

## Stale-doc note

`.docs/architecture/001` line 14 and `002` line 13 still say "TanStack Start" — stale, corrections are ANG-017 scope (tracked in the issue Durable Context). For the Angular target, this document supersedes the frontend sections of ARCH-001/002.

## Reproducible checks (ANG-001 acceptance)

```bash
pnpm --filter @yacc/frontend-angular build          # green (AOT + budgets + type-check)
ls packages/frontend-angular/dist/*/browser/        # output path
rg -n "import.meta.env|@yacc/common|@tanstack|zustand|react" packages/frontend-angular --glob '!**/node_modules/**'   # expect 0
rg -n "node-version|frontend-angular build|build-angular" .github/workflows/frontend-deploy.yml              # Angular build-only validation (Node 20.x)
rg -n "packages/frontend/dist" .github/workflows/frontend-deploy.yml                                         # production deploy stays on React until ANG-016
```
