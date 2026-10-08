# Runbook — React E2E Baseline Capture (SPEC-003 CP-3 / PB-2 anchor)

**Purpose:** capture and archive the React frontend's Playwright E2E green-state at the
pinned pre-implementation commit, so the Angular parity gate (PB-2, "zero regression",
SPEC-003 AC-03) anchors to a **recorded** state instead of an assumed-green suite.
Blocking precondition for the parity gate (SPEC-001 T4 §5, T5 CP-3).

**Baseline status (ANG-003, 2026-10-08):** NOT captured — capture attempts against the
pinned commit `230bd226` are **environment-red** (backend login endpoint broken on `dev`
since `0ba6edb`/#267; in-memory login rate limiter makes full-suite runs structurally
red). A labeled-invalid diagnostic archive (not a baseline) is kept at
`packages/frontend-angular/parity/baseline/react-e2e-baseline-230bd226-DIAGNOSTIC-INVALID/`.
CP-3 remains open pending a tech-lead decision (backend repair is out of SPEC-003 scope).
See §6 for the full record.

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
