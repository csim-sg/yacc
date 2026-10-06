# ADR-031: Angular Target Frontend Architecture

**Status:** Accepted
**Date:** 2026-10-06
**Owner:** Tech-lead (decision gate); builder-authored in ANG-001 (#371)
**Type:** Architecture
**Acceptance:** SPEC-001 §Architecture Notes gated this ADR on implementation authorization; the founder granted it on 2026-09-26 (SPEC-003 §Founder Override Record). Effective with ANG-001.
**Related:** ADR-005 (flat structure), ADR-006 (auth client), ADR-011 (naming), ADR-018 (Bun — Proposed only, unaffected), ADR-019 (K3s/Helm; frontend excluded), ADR-020 (Zod source of truth — backend), ADR-030 (Java package layout — parallel stream), companion ARCH: `.docs/architecture/005-angular-target-frontend-architecture.md`

## Context

YACC's production frontend is React 18 (Vite 5, TanStack Query v5, Zustand 5, react-router-dom v7, socket.io-client). SPEC-001 (closed) produced a decision-ready Angular migration plan; its T2 ("Angular-Native / No-TanStack Architecture Plan", vault commit `5be7908`) is the verified, canonical mapping. SPEC-001 deliberately withheld implementation and the dedicated architecture ADR behind an Approval Gate. On 2026-09-26 the founder authorized implementation (SPEC-003, milestone #4, 17 issues ANG-001..017) with two binding overrides: (1) the Angular and Java (SPEC-002) migrations proceed **in parallel**; (2) Angular follows the **existing React frontend's calls/DTOs/behavior 1:1** against the current Node backend and does not re-baseline to Java contracts.

ANG-001 requires, before any feature work: a buildable Angular app shell in `packages/frontend-angular` and a committed Angular-target ARCH + ADR as the placement/guardrail reference for ANG-002..ANG-017.

## Decision

1. **Full React→Angular replacement** built in `packages/frontend-angular` over the SPEC-003 issue sequence. Single production frontend throughout: production remains the React SPA until the ANG-016 cutover gate (parity sign-off PB-1/2/3 + founder stop authority). No comparison environment.
2. **Framework pin: Angular 21.2.x** (`^21.2.25` floor). Newest **LTS** line at implementation kickoff (2026-10), satisfying the SPEC/T2 "v18+ LTS track" floor (T2 §11.4 required re-verifying the matrix at kickoff; Angular 21.2.25 peers: TypeScript `>=5.9 <6.0`, Node `^20.19.0` — compatible with the repo's Node 20.x CI matrix). Major upgrades require an ADR-level finding.
3. **Angular-native stack, no framework additions** (T2 §1 as canonical): standalone components (no NgModules), Signals for component-local and shared state (injectable signal-store services), Angular Router + functional guards, HttpClient + functional interceptors, RxJS over retained `socket.io-client`, Tailwind v4 + daisyUI 5 via `@tailwindcss/postcss`. No TanStack, no NgRx, no other state library.
4. **zone.js change detection retained explicitly.** Angular 21 scaffolds default to zoneless; ANG-001 overrides to `provideZoneChangeDetection` + the `zone.js` polyfill per T2 §1.1 ("zoneless is an optimization with no current need; default = max compatibility with socket callbacks"). Zoneless remains a future optimization, not migration scope.
5. **Placement and guardrails per companion ARCH-005**: flat `src/app/{pages,components,services,guards,interceptors,contracts,types,lib}` + `src/environments/`; one definition per file; index files export consts only; **no `any`**/casts; **no cross-import from `packages/frontend`**; local Zod contracts in `contracts/` are the frontend source of truth (**`@yacc/common` is not adopted**); single HTTP entry; single socket entry, inbound-only.
6. **Build/deploy re-spec**: `ng build` (AOT + budgets + strict template type-check) replaces Vite entirely in this package; output `dist/frontend-angular/browser/`; deploy target stays **S3 + CloudFront** (ADR-019 frontend exclusion preserved — no Helm/K8s for the frontend); `.github/workflows/frontend-deploy.yml` re-specced to Node **20.x** matrix + `pnpm --filter @yacc/frontend-angular build` + the new output path (releasing `main` against the shell before ANG-014/ANG-016 is gated by the workflow header note and tech-lead sequencing).
7. **Environment substitution is build-time file replacement only** (`environment.ts` → `environment.prod.ts` carrying the `VITE_API_BASE_URL`/`VITE_WS_URL` equivalents); no runtime environment mechanism is invented.

## Alternatives Considered

- **Zoneless change detection now (Angular 21 default):** rejected — T2 §1.1 explicitly defers it as an optimization; socket-callback compatibility and review stability favor the documented default. Revisit only with a measured finding.
- **Angular 22 (current `latest`, not LTS-tagged):** rejected — SPEC/T2 mandate the LTS track; v22 adoption can be a later ADR-gated upgrade.
- **Keep Vite as bundler for the Angular package:** rejected — two build systems violate KISS/TR-02; `ng build` owns compile/bundle/dev-server (AOT + budgets replace the manual `tsc` gate).
- **NgRx / state library:** rejected — T2 §8.1: the state surface is small and bounded; Signals + services cover it with zero new concepts.
- **TanStack (Angular ports of Query/Router):** rejected — SPEC binding decision "no TanStack"; every Query/Zustand responsibility has a concrete Angular-native replacement (T2 §3).
- **Adopt `@yacc/common` for frontend contracts:** rejected — binding decision; local Angular contracts are the source of truth.
- **Move frontend into Helm/K8s deploy:** rejected — ADR-019 keeps the frontend on S3 + CloudFront, outside Helm scope.

## Consequences

- **Stability:** production keeps serving React until ANG-016; the Angular package is additive and parallel-safe with the Java stream (zero backend/common changes in SPEC-003). Known risk: the re-specced deploy workflow fires on `main`, so `dev`→`main` releases are gated on ANG-014 (deploy enablement) and ANG-016 (cutover) sequencing.
- **Cost:** one new dependency tree in the workspace lockfile (Angular 21 + Tailwind/daisyUI already present in the workspace); no new infrastructure.
- **Security:** no new secrets; environment values are build-time only; client-side token handling stays in the same sensitivity class as today (T2 §5); login/recovery/RBAC flows are covered by the Playwright parity gate before cutover; frontend guards remain UX, not a security boundary (enforcement stays server-side).
- **Operability:** rollback remains retained-asset re-point (retention mechanism is ANG-014 scope — the current `--delete` sync cannot roll back); Node 20.x aligns all CI matrices; stale "TanStack Start" references in ARCH-001/002 remain until ANG-017.

## Standards Alignment

- **TOGAF:** Application Architecture (frontend target state); Technology Architecture (build/deploy tooling).
- **AWS Well-Architected:** Operational Excellence (single CLI pipeline, gated cutover), Reliability (retained-asset rollback), Cost Optimization (no new infrastructure), Security (unchanged auth model, parity-gated flows).
- **ISO controls:** no impact — no new secrets, data flows, or network exposure beyond the existing S3/CloudFront static hosting.
