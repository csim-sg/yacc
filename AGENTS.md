# YACC — Agent Context

**YACC (Yet Another Chat Client)**: single-tenant, multi-channel social inbox (Telegram, IRC) with role-based access (Super Admin / Admin / Manager / User), real-time updates, routing rules, notifications, search, and audit logging. Detailed scope and acceptance criteria live in `.docs/01-product-specification.md`; do not duplicate them here.

**Status** (authoritative: `.docs/plans/00-INDEX.md`): Phase 1 complete; Phase 2 (collaboration + rules) EA-approved; Gateway Plugin Architecture GPA-003..006 merged, GPA-007 next (see GOV-038).

## Repository & Project Board

- **Repo**: `csim-sg/yacc` (git remote: `git@github.com:csim-sg/yacc.git`). PRs target `dev`.
- **Board**: GitHub Project #1, ID `PVT_kwHOAB4wV84BNGcw` (https://github.com/users/csim-sg/projects/1/views/1).
- Runtime field IDs, board state option IDs, worktree root, and central docs vault paths are exported from `.github-project.env` (`ANT_TEAM_*`) — the sole project config source. Source it instead of hardcoding IDs from older docs.

## Monorepo & Tooling

- pnpm 9 + Turborepo; workspace globs `packages/*` (`pnpm-workspace.yaml`); root scripts call `turbo run` (`turbo.json`).
- Packages:
  - `packages/common` (`@yacc/common`) — shared types, Zod schemas, constants, requests/responses, websocket contracts. Consumed as TypeScript source via subpath `exports` (`@yacc/common/schemas`, `/types/entities`, `/constants`, ...): every `exports` subpath resolves to `src/*.ts`; `build` runs `tsc` and emits a generated `dist/` for verification only — no export or consumer references it.
  - `packages/backend` (`@yacc/backend`) — Express + routing-controllers API, Socket.io gateway, Drizzle + PostgreSQL, Redis/BullMQ, Telegram + IRC connectors, Vitest.
  - `packages/frontend` (`@yacc/frontend`) — React 18 SPA built with Vite; TanStack Query + Zustand, socket.io-client, Tailwind v4 + daisyUI; Vitest unit + Playwright E2E.
- Runtime: Node 20 pinned in the `backend-ci`, `lint`, and `tests` workflows; `frontend-deploy.yml` still uses Node 18. pnpm 9. ADR-018 (Bun runtime migration) is **Proposed only** — tooling remains Node + pnpm until accepted.
- Local services: `docker-compose up -d` → PostgreSQL 15 (`yacc_user`/`yacc_password`/`yacc_inbox`, :5432), Redis 7 (:6379), Mailhog (:8025).
- Env setup: copy `.env.example` in repo root, `packages/backend/`, and `packages/frontend/` to `.env` in the same location.

## Verified Commands

From package manifests and CI (`.github/workflows/`):

```bash
pnpm dev / build / test / lint / type-check        # root, via turbo
pnpm --filter @yacc/backend dev                    # tsx watch (port 3000)
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
```

Known failures / caveats (CI-verified):

- **Full backend vitest suite may fail on the dev baseline.** CI runs it as informational-only (`continue-on-error`); required gates are the curated unit subset (`pnpm --filter @yacc/backend test src/services/__tests__/irc-ingestion.service.test.ts`), the smoke integration test (`tests/QA-001-integration.spec.ts`), and changed-file ESLint with `--max-warnings 0`. Exit criteria to make the full suite required: GOV-029.
- `@yacc/common` has no `lint` script; `turbo run lint` simply skips it.
- No root or backend `db:migrate`/`db:studio` scripts exist, despite claims in `README.md` and package-level AGENTS files — trust `package.json` manifests.

## Backend Entrypoints & Architecture Guardrails

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
- `.docs/adr/` — ADR-001…ADR-022 (numbering is not a queue; check `__README.md`)
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
- Deployment: backend Docker image (`packages/backend/Dockerfile`); K3s + Helm CI/CD is the accepted target (ADR-019, `deploy/helm`); workflows in `.github/workflows/` (`backend-ci.yml`, `lint.yml`, `tests.yml`, `backend-deploy.yml`, `frontend-deploy.yml`, `deploy-staging.yaml`).

## Java Spring Backend Migration — ADRs ACCEPTED, NOT YET IMPLEMENTED

A backend migration to Java Spring is approved as planning: ADRs `ADR-023`..`ADR-029` are **Accepted** (see `.docs/adr/`; SPEC-002 in the central vault). No Spring code, dependencies, CI, or infrastructure exists in this repo yet.

- `ADR-023`..`ADR-029` define the contract source, architecture, auth, WebSocket transport, data access, async processing, and JVM deployment envelope for the Java service.
- No Spring code, dependencies, CI, or infrastructure may be introduced until the SPEC-002 milestone issues pass the normal builder→reviewer→merge loop.
- ADR-018 (Bun runtime migration) remains **Proposed only**.

---

**Last Updated**: 2026-09-24 · Communication model aligned to GOV-001/STD-001/ARCH-001 (GitHub-first) · Reconciled against git remote, package manifests, `turbo.json`, `docker-compose.yml`, `.github/workflows/`, and `.docs/plans/00-INDEX.md`
