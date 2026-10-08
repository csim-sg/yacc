# React E2E baseline — DIAGNOSTIC ONLY — **NOT A VALID BASELINE**

**Status:** `INVALID — environment-determined red`. This directory is **not** the CP-3
baseline anchor and must not be used for PB-2 "zero regression" comparisons. A valid
green-state capture is currently **impossible against the pinned baseline commit**
(root causes below; both are backend-side and SPEC-003 freezes the backend).

- Attempted capture of: `dev` @ `230bd226` (pinned pre-implementation commit;
  `packages/frontend` verified byte-identical to the pin at capture time).
- Run: 2026-10-07 23:13 → 2026-10-08 02:11 (+08), ~3.0 h, default scope
  (35 spec files, 3 browser projects, `--retries=2`).
- Result: **1371 cases — 107 passed / 817 failed / 168 timed out / 279 skipped,
  0 flaky** (see `summary.txt`, `per-case-listing.tsv`).

---

## 1. Root causes (both reproduced on 2026-10-08, both pre-existing on `dev`)

### RC-1 — Backend login endpoint broken on `dev` (HTTP 400 on every real login)

`POST /api/auth/sign-in/email` returns
`400 {"code":"VALIDATION_ERROR","message":"[body] Invalid input: expected object, received undefined"}`
for any correctly-formed JSON body — including a plain `curl` with
`{"email":"manager@yacc.local","password":"admin123"}`.

- **Mechanism:** commit `0ba6edb` (#267, INT-011-014) moved `bodyParserMiddleware`
  (`express.json()`) from `app.use()` (ADR-014) into the routing-controllers
  `useExpressServer({ middlewares: [...] })` option. routing-controllers only registers
  middlewares from that array that have `@Middleware` decorator metadata
  (`MetadataArgsStorage.filterMiddlewareMetadatasForClasses` matches by `target === cls`
  against the decorator storage); a bare `express.json()` function is silently dropped.
  `req.body` is therefore `undefined` for every request, and the BetterAuth delegation
  path (`auth.controller.ts` `delegateToAuth`) forwards no body.
  `@Body()`-decorated routes still parse (routing-controllers attaches a per-action body
  parser), which is why non-auth endpoints behave and the defect stayed unnoticed.
- **Affects the pinned baseline:** `0ba6edb` is an ancestor of `230bd226`, and
  `git diff --stat 230bd226 <head> -- packages/backend` is empty — the backend is
  byte-identical to the pin.
- **Not React behavior:** the React login form sends correct JSON (the same payload
  authenticates fine against the mocked contract; `frontend-login.spec.ts` is 9/9 green
  with route mocks), and a raw `curl` with a correct body reproduces the 400. The defect
  is server-side.

### RC-2 — In-memory login rate limiter makes a full-suite run structurally impossible

`loginRateLimiter` (backend `rateLimit.middleware.ts`) is `express-rate-limit` with an
**in-memory store, 5 requests / 15 min / IP**. All Playwright workers share `127.0.0.1`,
and the suite performs real UI logins across 3 parallel browser projects. Any full run
exceeds 5 login requests per window, after which every further login gets `429`
("Too many login attempts. Please try again in 15 minutes.") — independent of
environment health. In this run, 2290 of 2514 captured `error-context.md` page snapshots
showed the 429 banner (survey taken 2026-10-08 ~22:15, before the run-4 scratch
artifacts were recycled); the remainder are downstream `waitForURL('/inbox')` timeouts
and assertion failures caused by RC-1/RC-2 logins never succeeding.

### Failure taxonomy (run 4, per JSON report)

| Bucket | Cases | Dominant cause |
|---|---|---|
| `unexpected` total | 985 | RC-1 400s (first ≤5 logins per window) + RC-2 429s (all subsequent) |
| — timeouts (`waitForURL`/locator) | ~832 | login never succeeds → never navigates to `/inbox` |
| — assertion errors | ~153 | login-required state never reached |
| passed | 107 | route-mocked specs (`frontend-login.spec.ts` etc.) + no-login-needed specs |
| skipped | 279 | `test.skip` by design |
| flaky (passed-after-retry) | 0 | — |

Top failing files: `acceptance/phase2/phase2-master.spec.ts` (111),
`fe-003-rbac-nav.spec.ts` (99), `backend-auth.spec.ts` (63),
`acceptance/phase1/inbox-list-filters.spec.ts` (54) — all login-gated.

## 2. Environment repair performed before declaring invalidity (2026-10-08, this branch)

Per `.docs/runbooks/react-e2e-baseline-capture.md` §2:

1. jsonwebtoken 9.0.3 ESM patch verified applied and effective
   (`import('jsonwebtoken').sign` resolvable from `packages/backend`; `db:fixtures`
   seeds successfully).
2. `drizzle-kit migrate` — all migrations applied.
3. `db:fixtures` — 4 fixture users + phase-1/phase-2 data seeded successfully.
4. Backend booted on :3000 (`/health` → 200; BullMQ retry-worker startup error is
   non-blocking and pre-existing).
5. **React canary (runbook §3):** `frontend-login.spec.ts` × chromium → **9/9 green**
   (6.2 s) — browser, Vite `webServer`, and fixtures chain healthy.
6. **Real-backend canary:** `acceptance/phase1/auth.spec.ts` HP-AUTH-001 × chromium →
   **red with HTTP 400 on the login form**, reproduced by direct `curl` — RC-1 confirmed
   with a fresh rate-limiter state.

The environment is healthy; the red is **deterministically produced by the pinned
backend itself**.

## 3. Why this run is not a valid baseline and what a valid one requires

Run 4's red set is a function of backend defects and limiter timing, not of React
behavior. Archiving it as the baseline would anchor PB-2 to backend timing artifacts.
`frontend-login.spec.ts` (route-mocked, 9/9 green) demonstrates the React app itself is
not the cause.

A valid CP-3 capture requires **either**:

1. Backend repair of RC-1 (restore body parsing for the BetterAuth delegation path) and
   a documented decision on RC-2 (e.g. env-gated limiter relaxation for E2E, or an
   accepted red-at-baseline convention that tolerates limiter-timing nondeterminism) —
   both are backend changes, **out of SPEC-003/ANG-003 scope** (SPEC-003 freezes the
   backend; Tier-1 failures indicate environment, not migration), requiring tech-lead
   decision; **or**
2. Tech-lead re-scoping of CP-3 (e.g. accept a documented red-at-baseline anchor with
   the deterministic subset defined).

## 4. Artifacts kept here / evidence custody

- `summary.txt`, `per-case-listing.tsv` — generated from the run-4 Playwright JSON
  report (all 1371 cases; generator: `gen_listing.py` methodology, stdlib-only).
- The full JSON report (13 MB) and run log were kept out of git deliberately (size);
  they were last at `/tmp/opencode/ang003-baseline/baseline-report.json` and
  `run4.log` (session scratch). The diagnosis itself is reproducible in seconds via the
  RC-1 `curl` above — no multi-hour rerun is needed to re-evidence it.
- The run-4 HTML report / `test-results/` under `packages/frontend/` were recycled by
  later canary runs (Playwright cleans both per invocation); the JSON-derived listing
  above is the surviving per-case record.

## 5. Source commits for this analysis

- Analysis performed on branch `task/ANG-003` (worktree `issue-373`), backend verified
  identical to pin `230bd226`; regression introduced by `0ba6edb` (#267).
- Live evidence commands (backend on :3000):
  `curl -s -X POST http://localhost:3000/api/auth/sign-in/email -H 'Content-Type: application/json' -d '{"email":"manager@yacc.local","password":"admin123"}'`
  → HTTP 400 VALIDATION_ERROR (RC-1); any 6th login within 15 min → HTTP 429 (RC-2).
