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

---

## 6. 2026-10-10 re-verification after prerequisite #409 (`2a7e7e2`) — RC-1 FIXED, RC-2 VERIFIED, NEW RC-3 BLOCKS CAPTURE

Prerequisite **#408 / PR #409** (merged to `dev` at `2a7e7e2`, merged into
`task/ANG-003` at `371c247`) restored the ADR-014 `app.use(bodyParserMiddleware)`
ordering and added the deterministic non-production limiter posture
(`packages/backend/src/config/rateLimit.config.ts`). Re-verification on 2026-10-10,
backend booted per tech-lead directive `APP_ENV=test pnpm --filter @yacc/backend dev`:

**RC-1 — FIXED.** `POST /api/auth/sign-in/email` with a valid JSON body now reaches
BetterAuth's credential logic: the response changed from
`400 VALIDATION_ERROR: expected object, received undefined` to
`401 INVALID_EMAIL_OR_PASSWORD`. The React login form error correspondingly changed
from "HTTP 400" to "HTTP 401" (canary `HP-AUTH-001` × chromium, 2026-10-10).

**RC-2 — VERIFIED DETERMINISTIC, both directions (curl probes, 2026-10-10):**

| Backend boot | Login attempts | Result |
|---|---|---|
| `APP_ENV=test` (test posture) | 8 sequential | **8×401, zero 429** — ceilings lifted |
| `APP_ENV=development` (production values) | 7 sequential | **5×401 then 2×429** — contractual `max: 5` reasserted from the 6th request |

The posture is exactly E2E-run configuration: production limiter values are unchanged
and re-asserted by `packages/backend/tests/unit/middleware/rate-limit-posture.test.ts`
(merged in #409).

**RC-3 (NEW) — BetterAuth email/password is structurally non-functional against the
app's DB schema; every real login 401s and sign-up 422s.** Pre-existing on the pinned
commit (schema unchanged by #409), **outside #408's bounded scope**, not fixable within
ANG-003:

- `users.password_hash`, `users.role`, `users.status` are `NOT NULL`
  (`packages/backend/src/schemas/user.schema.ts`), but BetterAuth's default user
  creation inserts only its own fields → sign-up fails with
  `422 {"code":"FAILED_TO_CREATE_USER"}` (empirically reproduced 2026-10-10;
  BetterAuth log: `User not found` on the subsequent sign-in).
- The `account` table/schema has **no `password` column**
  (`packages/backend/src/schemas/account.schema.ts`), so BetterAuth's default
  credential verification has no stored hash to compare → sign-in returns
  `401 INVALID_EMAIL_OR_PASSWORD` even for correctly seeded fixture users
  (`manager@yacc.local` / `admin123`, re-seeded via `db:fixtures` immediately before
  the probe).
- The codebase's own test infrastructure corroborates this:
  `packages/backend/tests/test-helpers.ts` `createTestUser()` creates users **directly
  in the DB, "bypasses BetterAuth signup issues"**, and hand-signs JWTs "since
  BetterAuth handler … may not work properly in test environment"; the BE-003 auth
  specs are fully mocked. Real email/password login through the BetterAuth HTTP
  endpoints has never worked end-to-end against this schema — which is why the E2E
  suite pivoted to route mocks (MIG-034) and why run 4's only passes were
  mocked/no-login specs.

**Consequence:** with RC-1 and RC-2 resolved, the real-login E2E subset now fails
deterministically with **401** at the credential layer. A green-state React baseline
therefore still cannot be captured on the current backend without a further,
separately-authorized backend prerequisite (schema/auth alignment for BetterAuth
email/password, or an equivalent deterministic credential seed path). Per the
tech-lead directive (2026-10-10: "Run full baseline only when canary/env is healthy;
if blockers persist, stop safely and record exact reason"), the multi-hour full-suite
run was **not** attempted: the canary/env is deterministically unhealthy and a rerun
would only reproduce ~900 downstream 401/timeOut failures. This archive therefore
**remains `DIAGNOSTIC-INVALID`** and CP-3 stays open.
