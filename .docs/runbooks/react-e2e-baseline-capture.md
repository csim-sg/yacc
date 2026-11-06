# Runbook — React E2E Baseline Capture (SPEC-003 CP-3 / PB-2 anchor)

**Purpose:** capture and archive the React frontend's Playwright E2E green-state at the
pinned pre-implementation commit, so the Angular parity gate (PB-2, "zero regression",
SPEC-003 AC-03) anchors to a **recorded** state instead of an assumed-green suite.
Blocking precondition for the parity gate (SPEC-001 T4 §5, T5 CP-3).

**Baseline status (ANG-003 S2, 2026-10-18):** **CAPTURED — React-on-Java baseline at pinned
`dev` `ae42c67`** (Java E2E fixture posture per S1 #423; real login; 503 pass / 664 fail /
174 timeout / 54 skip / 0 flaky over 1395 cases; Tier-1 real-auth + REST **390/390 green**).
Archive:
`packages/frontend-angular/parity/baseline/react-e2e-baseline-ae42c67-on-java/` (README with
pinned SHAs, env versions, failure classes, dispositions; per-case TSV; raw JSON). This is the
AD-1 anchor for auth + non-auth REST rows; real-time rows stay on the separate R1 evidence track
(AD-2) and CP-3/PB-2 remain **blocking** until reviewer/tech-lead accept the evidence. The
2026-10-06→10-10 attempts against the Node backend (`230bd226`) are historical; their
labeled-invalid diagnostic stays at
`packages/frontend-angular/parity/baseline/react-e2e-baseline-230bd226-DIAGNOSTIC-INVALID/`.
See §6 (history) and §7 (S2 capture record).

---

## 1. Pin the commit

Capture BEFORE any frontend change. `packages/frontend` (React app + suite) must be
byte-identical to the pinned commit:

```bash
git rev-parse HEAD                      # record as the baseline SHA
git diff --stat <sha> -- packages/frontend   # must be empty
```

## 2. Environment prerequisites (verified 2026-10-06)

| Requirement | Notes / gotchas |
|---|---|
| **Node 20.x** | Repo CI pin. Local defaults may be newer; verify `node --version`. |
| **PostgreSQL 15** | `docker compose up -d postgres` (compose service; port 5432). A fresh volume needs migrations (see 2.1). |
| **Redis 7 on :6379** | **Not in docker-compose since ADR-028**, but the E2E environment contract (SPEC-001 T4 §1.2) includes it — the backend's queue/DLQ layer connects at boot. Run standalone: `docker run -d --name yacc-e2e-redis -p 6379:6379 redis:7-alpine`. |
| **Backend on :3000** | `pnpm --filter @yacc/backend dev` (tsx). Note (2026-10-06): `pnpm --filter @yacc/backend build` fails at `build:tsc` with **pre-existing type errors on the dev baseline** (12+ errors, controllers/gateway-exchange) — unrelated to frontend work; the dev server path is unaffected. |
| **Test fixtures** | The Playwright `globalSetup` runs `db:fixtures` itself; a manual first run validates the pipeline. |

### 2.1 Fresh database volume

There is no `db:migrate` script (verified against package manifests). Apply the committed
Drizzle migrations manually, then seed:

```bash
pnpm --filter @yacc/backend exec drizzle-kit migrate
pnpm --filter @yacc/backend run db:fixtures
```

### 2.2 jsonwebtoken 9.0.3 ESM blocker (recurring until upstream-pinned)

`jsonwebtoken@9.0.3` (published 2025-12-04) is **not ESM named-import detectable**: Node
(tried 24.12.0 and 20.20.2) fails `import { sign } from 'jsonwebtoken'` with
`SyntaxError: The requested module 'jsonwebtoken' does not provide an export named 'sign'`,
which crashes `tsx`-run backend entrypoints (dev server, seed scripts if they import it).

Machine-local workaround used for the 2026-10-06 capture (gitignored store file — never
commit it; a lockfile pin/override is a backend change and out of frontend-migration
scope):

```bash
python3 - <<'EOF'
import re
p = 'node_modules/.pnpm/jsonwebtoken@9.0.3/node_modules/jsonwebtoken/index.js'
src = open(p).read()
names = re.findall(r"(\w+):\s*require\('\./([^']+)'\)", src)
lines = "\n".join([f"const {n} = require('./{r}');" for n, r in names])
keys = ",\n".join([f"  {n}" for n, _ in names])
open(p, 'w').write(lines + "\n\nmodule.exports = {\n" + keys + "\n};\n")
print('patched:', [n for n, _ in names])
EOF
# verify: named exports now resolvable
node -e "import('jsonwebtoken').then(m => console.log(Object.keys(m)))"  # from packages/backend
```

Behavior is unchanged for `require()` consumers; only ESM named-export metadata is
restored. Do not fabricate a baseline on an environment where this is unresolved.

### 2.3 Playwright browsers

`pnpm --filter @yacc/frontend exec playwright install chromium firefox webkit` if
`~/.cache/ms-playwright` lacks the build matching the resolved `@playwright/test`.

## 3. Canary first

One small browser spec proves the whole chain (backend reachable, fixtures seeded, Vite
`webServer` autostart on :5173) before committing to the long run:

```bash
cd packages/frontend
pnpm exec playwright test --project=chromium frontend-login.spec.ts   # expect green
```

## 4. Full capture

Local semantics with CI-matching retry tolerance (`--retries=2`; local default is 0,
which records ordinary flake as baseline red):

```bash
mkdir -p /tmp/opencode/ang003-baseline
cd packages/frontend
PLAYWRIGHT_JSON_OUTPUT_DIR=/tmp/opencode/ang003-baseline \
PLAYWRIGHT_JSON_OUTPUT_NAME=baseline-report.json \
pnpm exec playwright test --retries=2 --reporter=html,json 2>&1 | tee /tmp/opencode/ang003-baseline/run-output.log
```

Scope (default run at the pinned commit): 35 spec files / ~450 cases × 3 browser projects
(chromium, firefox, webkit); `e2e/` (6 files / 107 cases) stays outside the default run
per T4 G1 — promotion is the ANG-015 U10 decision. Expect 20–60 minutes.

**Red-at-baseline:** if any case fails, record it — the archive captures the state as-is;
PB-2 anchors to it. Do not re-run until green and do not weaken specs.

## 5. Archive

```bash
DEST=packages/frontend-angular/parity/baseline/react-e2e-baseline-<sha>
mkdir -p "$DEST"
cp -r packages/frontend/playwright-report/* "$DEST/playwright-report/"
cp /tmp/opencode/ang003-baseline/baseline-report.json "$DEST/"
# per-case listing + README.md metadata (commit SHA, versions, results summary) — see existing archive for format
```

Commit the archive with the harness so the parity bar is self-contained. Env versions to
record: `node --version`, `pnpm --version`,
`pnpm --filter @yacc/frontend exec playwright --version`, browser builds from the report,
backend commit + `db:fixtures` result.

## 6. Capture record

### 2026-10-06 → 2026-10-08 attempts — INVALID (environment-red), no baseline captured

Three attempts at the pinned commit `230bd226` (from the `task/ANG-003` worktree):

| Run | Outcome | Cause |
|---|---|---|
| 2 | invalid — 1084 fail / 44 pass / 225 did-not-run | broken Firefox/WebKit browser cache |
| 3 | invalid — died silently mid-run | process loss |
| 4 | completed RED — 1371 cases: 107 pass / 817 fail / 168 timeout / 279 skip, 0 flaky, ~3.0 h | **RC-1 + RC-2 below** |

**RC-1 — backend login broken on `dev`** (`0ba6edb`/#267 moved `bodyParserMiddleware`
into the routing-controllers `middlewares` option; plain functions are silently dropped
by the framework's decorator-metadata filtering, so `req.body` is `undefined` for the
BetterAuth delegation path): every real login → `400 VALIDATION_ERROR`. Reproduced by
raw `curl`; `0ba6edb` is an ancestor of the pin and `packages/backend` is byte-identical
to `230bd226`. Not React behavior — route-mocked `frontend-login.spec.ts` is 9/9 green.

**RC-2 — in-memory login rate limiter (5 / 15 min / IP)**: all Playwright workers share
`127.0.0.1`, so any full-suite run exceeds 5 logins per window → `429` for everything
after. 2290 of 2514 error snapshots in run 4 showed the 429 banner.

Environment repair validated before declaring invalidity (2026-10-08): jsonwebtoken ESM
patch verified, migrations applied, fixtures seeded, backend healthy on :3000, React
canary 9/9 green, real-backend canary red with HTTP 400 (RC-1 confirmed with fresh
limiter state). Full evidence:
`packages/frontend-angular/parity/baseline/react-e2e-baseline-230bd226-DIAGNOSTIC-INVALID/README.md`.

**A valid green-state capture requires a tech-lead decision first** (backend repair or
CP-3 re-scope) — both are outside frontend-migration scope. Do not re-run the multi-hour
suite until that decision is recorded.

### 2026-10-10 re-verification after prerequisite #409 (`2a7e7e2`) — RC-3 blocks capture

Founder decision A authorized a bounded backend prerequisite (#408, merged via PR #409 at
`2a7e7e2`); `task/ANG-003` merged `origin/dev` at `371c247` (no rebase/force). Boot:
`APP_ENV=test pnpm --filter @yacc/backend dev` (⚠️ never `NODE_ENV=test` —
`packages/backend/index.ts` skips `start()` under it).

- **RC-1 fixed:** login body now parsed (`400 VALIDATION_ERROR` → `401
  INVALID_EMAIL_OR_PASSWORD`; UI error "HTTP 400" → "HTTP 401").
- **RC-2 verified deterministic:** `APP_ENV=test` → 8/8 logins, zero 429;
  `APP_ENV=development` (production values) → 401×5 then 429 from the 6th —
  contractual `max: 5` reasserted; posture is E2E-run configuration only
  (`rateLimit.config.ts`, safety tests merged in #409).
- **RC-3 (new blocker, pre-existing on pin, outside #408 scope):** BetterAuth
  email/password cannot work against the current schema — `users.password_hash` /
  `role` / `status` are `NOT NULL` (BetterAuth's default user insert omits them →
  sign-up `422 FAILED_TO_CREATE_USER`), and the `account` table has **no `password`
  column** (credential verify has no stored hash → every sign-in `401`). The backend's
  own `tests/test-helpers.ts` bypasses BetterAuth signup/ login entirely (direct DB
  inserts + hand-signed JWTs), and BE-003 auth specs are fully mocked — real
  email/password login has never worked end-to-end on this codebase.
- **Capture posture:** canary/env deterministically unhealthy → full run **not**
  attempted (would only reproduce ~900 downstream 401/timeOut failures);
  `react-e2e-baseline-230bd226-DIAGNOSTIC-INVALID/` §6 holds the full record. CP-3
  stays open pending a further separately-authorized backend prerequisite
  (schema/auth alignment for BetterAuth email/password, or an equivalent deterministic
  credential seed path).

## 7. S2 capture record — React-on-Java baseline CAPTURED (2026-10-18)

Founder-approved Java Baseline Plan executed through S1 (#423, merged `ae42c67`) → S2 (this
record). The Node-backend capture route (§2–§5's `:3000`/`db:fixtures` environment) is
**superseded for future re-captures** by the Java posture below; §2–§5 remain as the historical
Node-era procedure.

**Pins:** React app + suite + Java service byte-identical to `dev` `ae42c674` (S1 merge);
worktree HEAD at capture `56e036d` (merge of `origin/dev` into `task/ANG-003` — merge only, no
rebase/force). **0 spec-file edits vs `dev`** by this capture.

**Procedure (Java posture — replaces §2/§3 environment for re-captures):**

1. Scratch loopback DB (e.g. `yacc_e2e` in the local compose PostgreSQL — Flyway builds the
   schema at boot; no manual migration step, no Redis, no Node backend).
2. Boot the service with the S1 E2E posture (all gates explicit, fail-closed):
   `SPRING_PROFILES_ACTIVE=e2e SPRING_APPLICATION_JSON='{"yacc":{"e2e":{"seed-enabled":true}}}'
   DATABASE_URL=jdbc:postgresql://localhost:5432/yacc_e2e YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL=admin@yacc.local
   YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL=admin123 YACC_AUTH_TOKEN_SIGNING_KEY=<b64 RSA-2048>
   YACC_INTEGRATION_ENCRYPTION_MASTER_KEY=<b64 32B>` — booted via bootJar +
   `-Dloader.path=<cached postgresql driver>` (PropertiesLauncher; `postgresql` is
   `testRuntimeOnly` — S1 PR #424's recorded local-boot method; no build-file change). Wait for
   `E2E fixture seed applied` + `First-run Super Admin bootstrap` log lines and `GET /health/live`
   → 200.
3. Pre-capture battery: curl real sign-in (`admin2@yacc.local`/`admin123`), a-1 super-admin flow
   (`mustChangePassword` true → change-password → re-sign-in false), RBAC tiering on
   `GET /api/users` (user 403 / admin 403 / super_admin 200), fixture world (`total: 107`
   conversations), UI real-login probe through Vite (:5173 same-origin proxy → :8080), then the
   Tier-1 canary `tests/backend-auth.spec.ts` × chromium (36/36 expected).
4. Frontend + service env for the run (corrected 2026-10-20 — parity H1–H4 wiring, tech-lead
   triage [#6290500131](https://github.com/csim-sg/yacc/issues/385#issuecomment-6290500131)):
   `BASE_URL=http://localhost:5173` (explicit React-origin pin — the gate-scoped specs resolve
   `process.env.BASE_URL \|\| 'http://localhost:5173'`; only the **Angular** parity job overrides
   it, to `http://localhost:4200`), `VITE_API_BASE_URL=` (empty → same-origin),
   `VITE_API_URL=http://localhost:8080`, `API_URL=http://localhost:8080/api`,
   `PLAYWRIGHT_TEST_API_BASE_URL=http://localhost:8080`, plus the environment the synchronous
   sign-up email path and the raw-WS rows depend on:
   - **Mailhog SMTP sink on `127.0.0.1:1025`** (`YACC_SMTP_HOST=127.0.0.1 YACC_SMTP_PORT=1025`;
     docker-compose `mailhog` service): auth-email delivery is **synchronous inside the sign-up
     request** (retry/backoff up to 2 × 500 ms), so the Tier-1 `sign-up endpoint should respond
     within 500ms` rows cannot meet their budget without a listener (parity root cause H4).
   - **`YACC_REALTIME_WS_ALLOWED_ORIGINS=http://localhost:5173`** for the capture's raw-WS rows
     (this is the Java default; the Angular parity job instead allows `http://localhost:4200`,
     its own harness origin — explicit localhost allowlist values only, never a wildcard, never
     a production-config change; parity root cause H3).
   - **No Redis anywhere in the capture posture** (ADR-028): PostgreSQL only — the S1 seed's
     loopback datasource guard is satisfied by `localhost:5432` as in step 1.
5. Full capture: same command shape as §4 (HTML+JSON reporters, `--retries=2`).

**Outcome (2026-10-18):** 1395 cases / 35 files × 3 browsers in 2 h 16 m — **503 passed / 664
failed / 174 timedOut / 54 skipped / 0 flaky**. Tier-1 real-auth + REST **390/390 green**
(backend-auth 108, backend-conversations 126, backend-audit-logs 99, backend-regression 57);
acceptance UI real-login canary HP-AUTH-001 green ×3; `frontend-login.spec.ts` 27/27. Failures
are fully classified in the archive README (residual `:3000` inline-API files, non-fixture
identities, Node-era contract expectations, socket.io-vs-raw-WS real-time rows, debug/utility
specs) — each class pre-registered; no test edited/skipped/weakened for the capture.

**Archive:** `packages/frontend-angular/parity/baseline/react-e2e-baseline-ae42c67-on-java/`
(README.md with pins/env/evidence/dispositions · per-case-listing.tsv · summary.txt ·
env-versions.txt · baseline-report.json · ui-real-login-probe-result.json). The full HTML report
(382 MB incl. traces) exceeds git-committable size — zipped on the capture host with SHA256
recorded in the archive README; the committed JSON is the complete durable per-case record.

**Gates unchanged:** CP-3/PB-2 remain **blocking** pending reviewer/tech-lead acceptance of this
evidence; real-time rows remain on the separate R1 track (AD-2) and are **not** satisfied by this
capture.

## 8. Automated CI capture (ANG-015, 2026-10-19)

§7's procedure is now automated as the `react-baseline-capture` job in
`.github/workflows/frontend-angular-parity.yml` (CP-3, AC-ANG-015-3): `workflow_dispatch`
only; boots the Java backend of record in the same S1 E2E fixture posture (PostgreSQL
service container — no Redis, ADR-028), runs the React harness (HTML+JSON reporters,
CI retries) at the checked-out SHA, derives the per-case TSV with
`packages/frontend-angular/parity/compare-baseline.mjs tsv`, records environment
versions, and uploads everything as workflow artifacts (JSON + TSV + env + run log +
HTML report). Non-gating evidence: archiving a new anchor into the repo remains a
deliberate act — a reviewed register (§1) + `parity/gate-scope.json` anchor-block update
(SHA-256s, declared counts). The same workflow's `parity` job enforces PB-2 against the
committed anchor (fail-closed comparator); §2–§5 above remain the historical Node-era
procedure.

**Status 2026-10-20 (H1–H4 wiring):** the CI capture job now carries the same corrected
environment as §7.4 — `BASE_URL=http://localhost:5173` pinned explicitly, the Mailhog
SMTP sink (`mailhog/mailhog:v1.0.1`, port 1025) with a fail-closed readiness gate, and
the SMTP env for the synchronous sign-up path (realtime allowed-origin left at the Java
default `:5173`, which matches this harness). The first `workflow_dispatch` CP-3 run is
**deliberately pending** until the `parity` job has validated the H1–H4 environment
repairs (ANG-015 review loop 2) — dispatch it only after that, and archive the artifacts
with the exact SHA. The dispatch is evidence for AC-ANG-015-3 only: **no new anchor
substitution** — `ae42c67-on-java` stays the comparison anchor and no
`gate-scope.json` anchor hash is refreshed from the capture (a new anchor would be a
separate, deliberate register/gate-scope decision).
