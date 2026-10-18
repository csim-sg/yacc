# YACC — Agent Context

**YACC (Yet Another Chat Client)**: single-tenant, multi-channel social inbox (Telegram, IRC) with role-based access (Super Admin / Admin / Manager / User), real-time updates, routing rules, notifications, search, and audit logging. Detailed scope and acceptance criteria live in `.docs/01-product-specification.md`; do not duplicate them here.

**Status** (authoritative: `.docs/plans/00-INDEX.md`): Phase 1 + Phase 2 complete; SPEC-002 (Java/Spring backend migration) **Phases 0–6 merged** — the Java service is the current backend (auth/identity, REST, raw WebSocket, Telegram + IRC connectors, Quartz + DB DLQ); Phase 7–8 (cutover MIG-070..072, decommission MIG-080) plus MIG-090/091 pending; Gateway Plugin Architecture GPA-003..006 merged, GPA-007 frozen under GOV-038.

## Repository & Project Board

- **Repo**: `csim-sg/yacc` (git remote: `git@github.com:csim-sg/yacc.git`). PRs target `dev`.
- **Board**: GitHub Project #1, ID `PVT_kwHOAB4wV84BNGcw` (https://github.com/users/csim-sg/projects/1/views/1).
- Runtime field IDs, board state option IDs, worktree root, and central docs vault paths are exported from `.github-project.env` (`ANT_TEAM_*`) — the sole project config source. Source it instead of hardcoding IDs from older docs.

## Monorepo & Tooling (Node workspaces — transitional until MIG-080)

- pnpm 9 + Turborepo; workspace globs `packages/*` (`pnpm-workspace.yaml`); root scripts call `turbo run` (`turbo.json`). The Node toolchain still builds the frontend and the transitional Node packages; the backend of record is `services/backend-java` (Gradle/JVM).
- Packages:
  - `packages/common` (`@yacc/common`) — **transitional (MIG-080 pending)**: shared types, Zod schemas, constants, requests/responses, websocket contracts for the Node-era packages. Not the contract source of truth — the frozen `.docs/migration/{openapi.yaml,asyncapi.yaml,schemas/*}` is (ADR-023). Consumed as TypeScript source via subpath `exports` (`@yacc/common/schemas`, `/types/entities`, `/constants`, ...): every `exports` subpath resolves to `src/*.ts`; `build` runs `tsc` and emits a generated `dist/` for verification only — no export or consumer references it.
  - `packages/backend` (`@yacc/backend`) — **transitional Node POC (decommission: MIG-080, #364; not the backend of record)**: Express + routing-controllers API, Socket.io gateway, Drizzle + PostgreSQL, Redis/BullMQ, Telegram + IRC connectors, Vitest.
  - `packages/frontend` (`@yacc/frontend`) — React 18 SPA built with Vite; TanStack Query + Zustand, socket.io-client, Tailwind v4 + daisyUI; Vitest unit + Playwright E2E. Production frontend until the SPEC-003 Angular cutover (ANG-016).
  - `services/backend-java` — **the backend of record** (SPEC-002): Java 21 + Spring Boot, Flyway + JPA on PostgreSQL, raw Spring WebSocket, Quartz + DB DLQ, Telegram + IRC connectors; tests JUnit 5 + Testcontainers.
- Runtime: Node 20 pinned in the `backend-ci`, `lint`, and `tests` workflows; `frontend-deploy.yml` still uses Node 18. pnpm 9. Java 21 (Temurin) pinned in `backend-java-ci.yml`. ADR-018 (Bun runtime migration) is **Proposed only** — tooling remains Node + pnpm until accepted.
- Local services: `docker-compose up -d` → PostgreSQL 15 (`yacc_user`/`yacc_password`/`yacc_inbox`, :5432), Redis 7 (:6379 — **transitional, Node-POC-only**; the Java service does not use Redis), Mailhog (:8025).
- Env setup: copy `.env.example` in repo root, `packages/backend/`, and `packages/frontend/` to `.env` in the same location.

## Verified Commands

From package manifests and CI (`.github/workflows/`):

```bash
pnpm dev / build / test / lint / type-check        # root, via turbo (Node workspaces)
pnpm --filter @yacc/backend dev                    # tsx watch (port 3000) — transitional Node POC
pnpm --filter @yacc/backend build                  # clean -> tsc -> esbuild bundle
pnpm --filter @yacc/backend test                   # vitest
pnpm --filter @yacc/backend lint                   # eslint src
pnpm --filter @yacc/backend type-check             # tsc --noEmit
pnpm --filter @yacc/backend db:seed               # scripts/seed-admin.ts
pnpm --filter @yacc/backend db:fixtures           # scripts/seed-test-fixtures.ts
pnpm --filter @yacc/frontend dev                   # vite (port 5173)
pnpm --filter @yacc/frontend test                  # Playwright E2E
pnpm --filter @yacc/frontend test:unit             # vitest run
pnpm --filter @yacc/frontend lint | type-check
pnpm --filter @yacc/common build | type-check | test

# Java backend (backend of record — see services/backend-java/):
cd services/backend-java
./gradlew --no-daemon bootRun                      # dev run (port 8080)
./gradlew --no-daemon build                        # build + tests + JaCoCo gate
./gradlew --no-daemon test                         # unit + integration (Testcontainers)
./gradlew --no-daemon contractTest                 # frozen OpenAPI/AsyncAPI conformance
./gradlew --no-daemon check                        # full gate incl. JaCoCo ≥85%
```

Known failures / caveats (CI-verified):

- **Full backend vitest suite may fail on the dev baseline.** CI runs it as informational-only (`continue-on-error`); required gates are the curated unit subset (`pnpm --filter @yacc/backend test src/services/__tests__/irc-ingestion.service.test.ts`), the smoke integration test (`tests/QA-001-integration.spec.ts`), and changed-file ESLint with `--max-warnings 0`. Exit criteria to make the full suite required: GOV-029.
- `@yacc/common` has no `lint` script; `turbo run lint` simply skips it.
- No root or backend `db:migrate`/`db:studio` scripts exist, despite claims in `README.md` and package-level AGENTS files — trust `package.json` manifests.

## Backend Entrypoints & Architecture Guardrails

**Node POC (transitional until MIG-080 — the backend of record is `services/backend-java`, see the Java section below).**

Entrypoints (verified):

- `packages/backend/index.ts` — dev/prod bootstrap: imports `reflect-metadata`, calls `start()` from `./src/index`; skipped when `NODE_ENV=test`. Tests import app/server wiring from `./src/index` directly.
- `packages/backend/src/index.ts` — wiring only: `useExpressServer(app, { controllers, middlewares })` and `new SocketControllers({ io, controllers: socketControllers })`; starts HTTP + Socket.io + workers.
- Build output: `dist/index.js` (esbuild bundle), run via `pnpm --filter @yacc/backend start`.

Guardrails (strict, non-negotiable):

1. **Flat `src/` folders** — `controllers/`, `socket-controllers/`, `services/`, `middleware/`, `config/`, `infrastructure/`, `connectors/`, `websockets/`, `workers/`, `schemas/`, `types/`, `utilities/`, `decorators/`, `enums/`. No nested `api/`, `domain/` layering.
2. **No `any`** — proper interfaces extending `Request` etc.; never cast.
3. **One definition per file** (class/interface/service), single responsibility.
4. **Index files export consts only** — `export const controllers = [...]`, `export const socketControllers = [...]`, `export const schemas = {...}`; no re-export barrels, no inline arrays in `src/index.ts`.
5. **Config vs Infrastructure** (ADR-005) — `config/` holds plain data objects reading env vars (no classes, no init); `infrastructure/` holds singleton clients (DB, Redis, S3, logger).
6. **Middleware via routing-controllers config** — the `middlewares` option in `useExpressServer()`, never `app.use()` (documented exception: ADR-014).
7. **No global route prefix** — no `routePrefix: '/api'`; add `/api` at controller level where needed (see GH-206 analysis in `.docs/`).
8. **Database** — Drizzle query builder only, no raw SQL; schema source in `packages/common` (Zod schemas are the validation source of truth, ADR-020).
9. **Validation** — Zod schemas for all request payloads (SH-004 conventions in `@yacc/common/schemas`).
10. **Tests** — Vitest; ≥85% coverage for new code (infrastructure/config may be lower); co-locate or use `__tests__/`; mock Telegram/IRC in tests.

## Central Documentation Paths

- `.docs/01-product-specification.md` — scope, user stories, ACs
- `.docs/02-api-and-data-model.md` — endpoints, schema, WebSocket events
- `.docs/03-implementation-guide.md` — architecture, tech decisions
- `.docs/04-qa-and-testing.md` — test strategy, regression suite
- `.docs/05-quick-reference.md` — one-page cheat sheet
- `.docs/06-tasks.md` — task ID ↔ GitHub issue map
- `.docs/plans/00-INDEX.md` — the single always-current status page (historical plans removed per ADR-015; recover via git history)
- `.docs/adr/` — ADR-001…ADR-031 (numbering is not a queue; check `__README.md`; ADR-023..030 = the accepted + implemented Java migration decisions)
- `.docs/architecture/004-java-backend-guardrails.md` — Java backend guardrails (the Java authority alongside ADRs)
- `.docs/migration/` — frozen OpenAPI/AsyncAPI/schemas + inventory ledger (contract source of truth, ADR-023; GOV-038 — never edit)
- `.docs/governance/` — GOV-xxx execution/review records
- `.docs/runbooks/`, `.docs/security/`, `.docs/qa/`, `.docs/architecture/`, `.docs/infrastructure/`
- Central durable docs vault (Obsidian): curated knowledge base for specs, architecture, ADRs, governance, runbooks, and reusable lessons — not task mirrors or communication transcripts; local path via `ANT_TEAM_DOCS_*` in `.github-project.env`

Keep `00-INDEX.md`, relevant ADRs, and governance records in sync in the same PR as code changes. Where this file, `README.md`, or package-level AGENTS files disagree with manifests/workflows, the manifests/workflows win.

## GitHub Delivery Workflow

- Milestones = specs; Issues = execution tasks; Project #1 = the workflow board (states: Open, Backlog, Need attentions, Ready, In progress, In review, Ready to merge, Blocked, Done).
- Tech-lead solely owns milestones and task issues. Roles: strategist (shaping), tech-lead (interpretation, task creation), builder (implementation), reviewer (review gate).
- Loop: branch from `dev` in a dedicated issue worktree → implement with tests → update docs → PR to `dev` → reviewer loop (fix in the same worktree/branch; escalate after 8 loops) → merge only after explicit approval → tech-lead cleans up worktree/branch.
- No force pushes; no direct commits to `dev`/`main`; commit prefixes: `feat(scope):`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Communication is GitHub-first (GOV-001, STD-001, ARCH-001): issue comments for task-local handoffs, blockers, decisions, and status; PR descriptions for implementation handoff and verification evidence; PR review threads/comments for code review findings, responses, and approval; Project state for workflow state. The central docs vault (Obsidian) is only for durable knowledge documents when warranted — never task mirrors or communication transcripts.
- Deployment: Java backend Docker image (`services/backend-java/Dockerfile`); K3s + Helm CI/CD is the accepted target (ADR-019, amended pod envelope ADR-029; `deploy/helm`); workflows in `.github/workflows/` (`backend-java-ci.yml`, `lint.yml`, `tests.yml`, `deploy-staging.yaml`, `frontend-deploy.yml`, plus transitional Node-era `backend-ci.yml`/`backend-deploy.yml` until MIG-080).

## Java Spring Backend Migration — IMPLEMENTED (SPEC-002, Phases 0–6 merged)

The Java/Spring backend is the **backend of record**: ADRs `ADR-023`..`ADR-030` are Accepted **and implemented** (see `.docs/adr/`; SPEC-002 in the central vault). SPEC-002 Phases 0–6 are merged to `dev`; Phase 7–8 (cutover MIG-070..072) and decommission (MIG-080) remain.

- `services/backend-java` — Java 21 + Spring Boot service: Flyway + JPA on PostgreSQL 15 (ADR-027), Spring Security auth with dual-role OIDC + bootstrap/recovery (ADR-025), raw Spring WebSocket at `/ws` with the `{event,data,timestamp}` envelope (ADR-026, no Socket.io/STOMP/SockJS), Quartz + PostgreSQL DB DLQ (ADR-028 — no Redis), frozen OpenAPI/AsyncAPI contract source (ADR-023), SLF4J/logback JSON + Micrometer observability (ADR-029).
- Package layout (amended by MIG-100 #410, code reconciled by MIG-101 #411): `com.yacc.api.<feature>` standalone modules (controller + wire DTOs; mapper/service only when warranted) + shared `entity`/`repository`/`service` planes + `config`/`common`; `com.yacc.YaccApplication` at root.
- Guardrails: `.docs/architecture/004-java-backend-guardrails.md` (§1 founder-fixed decisions; ARCH-004 is the Java authority).
- CI: `backend-java-ci.yml` (build + tests + JaCoCo ≥85% + contract tests + package); deployment via `deploy/helm/yacc-backend` (ADR-029 envelope).
- The Node POC (`packages/backend`), `@yacc/common` Zod layer, and Node-era CI stay in the repo **transitionally until MIG-080 (#364)** — do not treat them as the current backend, and do not delete them ahead of that issue.
- ADR-018 (Bun runtime migration) remains **Proposed only**.

---

**Last Updated**: 2026-10-18 · SPEC-002 Phases 0–6 merged (Java service is the backend of record; Node packages transitional until MIG-080) · Communication model aligned to GOV-001/STD-001/ARCH-001 (GitHub-first) · Reconciled against git remote, package manifests, `turbo.json`, `docker-compose.yml`, `.github/workflows/`, `services/backend-java`, and `.docs/plans/00-INDEX.md`
