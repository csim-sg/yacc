# React-on-Java E2E Baseline — `ae42c67` (S2, ANG-003 #373, captured 2026-10-18)

**What this is:** the completed, full-suite React-on-Java baseline capture authorized by the
founder-approved Java Baseline Plan (AD-1; SPEC-003 §Java Baseline Approval) and recorded as
issue #373's S2 outcome (tech-lead reconcile #6249591432). The React frontend and the Playwright
suite at pinned `dev` SHA `ae42c67` ran against the **live Java backend of record** (`services/backend-java`
at the same pinned SHA) booted with the **S1 (#423) E2E fixture posture**, with **real login** —
no mocks for the Tier-1 auth/REST surface, no JWT hand-signing, no invalid-run relabeling.

**What this is NOT:** an all-green run, a Java production-readiness claim, a cutover claim, and
**not** the R1 real-time baseline (AD-2 — real-time rows are anchored separately on
`asyncapi.yaml` + Java server evidence + the Angular raw-WS client; React `socket.io-client`
cannot anchor them). Whether this capture satisfies CP-3/PB-2 anchoring is the reviewer/tech-lead
acceptance decision; nothing here waives any gate.

## 1. Results (complete run — preserved honestly)

**Total 1395 cases (35 files × 3 browser projects) in 2 h 15 m 59 s:**

| Status | Count |
|---|---|
| passed | **503** |
| failed | **664** |
| timedOut | **174** |
| skipped | **54** |
| flaky (passed only after retry) | **0** |

Per browser: chromium 168 pass / 221 fail / 58 timeout / 18 skip · firefox 167 / 222 / 58 / 18 ·
webkit 168 / 221 / 58 / 18. Full per-case record: `per-case-listing.tsv` (1395 rows, last-attempt
status + retries + duration) and `baseline-report.json` (raw Playwright JSON, every attempt +
error messages). `summary.txt` is the derived aggregate.

### Tier-1 real-auth + non-auth REST evidence (the AD-1 anchor rows) — 390/390 GREEN

| Tier-1 spec | Cases | Result |
|---|---|---|
| `backend-auth.spec.ts` | 108 | ✅ all pass |
| `backend-conversations.spec.ts` | 126 | ✅ all pass |
| `backend-audit-logs.spec.ts` | 99 | ✅ all pass |
| `backend-regression.spec.ts` | 57 | ✅ all pass |

These are **real** end-to-end evidence against the live Java service: real sign-up (`POST
/api/auth/sign-up/email` → 201), real sign-in (200 + `{user, accessToken, refreshToken,
mustChangePassword}`), `get-session`, `sign-out`, `refresh-token` rotation, `change-password`,
forgot/reset-password (constant anti-enumeration answer; frozen 200/400/429 set), RBAC gates per
the frozen contract, `BaseListResponse` envelopes, UUID path ids, audit export RBAC tiering — the
S1 re-pointed surface, executed green in a full-suite context (matches S1's own 390/390 live
verification). The sign-ups are visible in the capture database after the run (`users=106`, up
from the 4 fixture/bootstrap rows — the `qa-user-*` accounts created by the real sign-up tests).

Also fully green: `frontend-login.spec.ts` 27/27 (MIG-034 Spring-contract login flows, route-mocked
by design) and the real-login acceptance canary **HP-AUTH-001 "User can login with valid
credentials" passed in all 3 browsers** (UI login page → Vite same-origin proxy → Java sign-in →
inbox).

### Failure classes (all pre-registered/documented; none discovered-and-hidden)

| Class | Files / cases (approx.) | Cause | Pre-registration |
|---|---|---|---|
| A — residual Node-URL inline API | `acceptance/phase1/*`, `acceptance/phase2/*`, `phase2-master` (~430 cases): `ECONNREFUSED` on inline `http://localhost:3000/...` setup calls → downstream 401s | 17 non-Tier-1 files hardcode the Node base URL with no env override (S1 was forbidden to touch them) | S1 PR #424 known-risk #3; routed to the ANG-015 (#385) disposition register |
| B — non-fixture identities | `fe-003-rbac-nav.spec.ts` 99 timeouts (3 pass) | spec signs in as `admin@example.com` / `manager@example.com` / etc. — identities the Java fixture world does not create → real sign-in 401 → `loginAs` 30 s timeout | Same class as the S1 fixture-set reconciliation (identity mapping was authorized for the helper + Tier-1 surface only) |
| C — Node-era contract expectations | `fe-004-api-integration` 48, `fe-004-error-scenarios` 45, `fe-004-cache-invalidation` 18 (all env-overridable files, pointed at Java via `API_URL`) | specs wait for Node-era response shapes/flows; the frozen Java contract answers differently → `Timeout 10000ms` | AD-1 sub (re-point boundary covered Tier-1 + `helpers/api.ts` only); ANG-015 register |
| D — real-time / socket.io rows | `../e2e/tags.e2e.ts` 18 (incl. the real-time case); browser console: `ws://localhost:3000/socket.io/` connection refused throughout | React speaks `socket.io-client`; Java exposes raw WebSocket `/ws` (ADR-026) — transport-incompatible by design until MIG-052/Angular raw-WS | AD-2/R1 — real-time rows are **not** capturable on React-on-Java and are **not claimed** by this capture |
| E — debug/utility + mixed | `inbox-*.spec.ts` debug/inspection specs (21 timeouts), `INT-010` 15 timeouts, `conversation-detail` 12, `regression-suite` 6 timeouts + 30 in-spec skips, `fe-002-login-ui` 30 fails (mixed mock/real UI-detail assertions), `acceptance/phase1/auth` 28 fails (same Class A/B causes) | utility specs and mixed-era assertions; skips are the specs' own `test.skip` conditions (pre-existing) | recorded as-is; per-case detail in the TSV/JSON |

## 2. Pinned SHAs (G-1)

| Component | SHA | Verification |
|---|---|---|
| React app + Playwright suite (`packages/frontend`) | **dev `ae42c674ef7a6a98ddbd9902def6fd0e48718697`** | `git diff --stat ae42c67 HEAD -- packages/frontend` → **empty** (byte-identical) |
| Java backend of record (`services/backend-java`) | **dev `ae42c67`** (same monorepo commit) | `git diff --stat ae42c67 HEAD -- services/backend-java` → **empty** (byte-identical) |
| Worktree / branch HEAD at capture | `56e036d06c75a1de20b605b54f22b38bb4908629` = merge of `origin/dev` (`ae42c67`, S1 #423) into `task/ANG-003` (parent `7ae5d9f`) | merge only — no rebase, no force-push, no worktree reset; `packages/frontend` + `services/backend-java` byte-identical to `ae42c67` as verified above |
| Spec-file edits introduced by this capture | **0** | `git diff --name-only origin/dev HEAD -- 'packages/frontend/tests/**/*.spec.ts' packages/frontend/e2e` → empty (the Tier-1 re-point is dev's S1 content, not a #373 edit) |

## 3. Environment (G-1) — exact versions

Recorded verbatim in `env-versions.txt`. Summary:

| Component | Version |
|---|---|
| Node (runner, Vite, Playwright) | v24.12.0 ⚠️ CI pins Node 20 — deviation recorded, capture is local by definition |
| pnpm | 9.0.0 |
| Java (service runtime) | **Temurin 21.0.12.1** via the Gradle toolchain (`~/.gradle/jdks/eclipse_adoptium-21`) — matches the CI pin; `java` on PATH is 24.0.2 (not used by the service) |
| Gradle | 8.14.3 (wrapper) |
| Spring Boot | 3.5.16 (boot log banner) |
| PostgreSQL | 15.15 (docker `postgres:15-alpine`, the worktree compose instance `issue-373-postgres-1`, port 5432) |
| Playwright | 1.58.1 (`@playwright/test` + `playwright-core`, pnpm-resolved) |
| Vite | 5.4.21 (`packages/frontend`, pnpm-resolved) |
| OS | Linux 6.x host (uname in `env-versions.txt`) |

### Java E2E boot posture (S1 #423 — exactly the S1-verified invocation)

```
SPRING_PROFILES_ACTIVE=e2e
SPRING_APPLICATION_JSON={"yacc":{"e2e":{"seed-enabled":true}}}
DATABASE_URL=jdbc:postgresql://localhost:5432/yacc_e2e      # fresh scratch DB, loopback
POSTGRES_USER=yacc_user / POSTGRES_PASSWORD=yacc_password
YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL=admin@yacc.local
YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL=admin123
YACC_AUTH_TOKEN_SIGNING_KEY=<base64 PKCS#8 RSA-2048, generated for this run>
YACC_INTEGRATION_ENCRYPTION_MASTER_KEY=<base64 32-byte, generated for this run>
# driver note: org.postgresql:postgresql is testRuntimeOnly in the merged build; booted
# exactly as S1's PR #424 recorded — bootJar + cached driver jar on -Dloader.path
# (PropertiesLauncher). No build-file change; Dockerfile/deploy posture untouched.
```

Boot log evidence (verbatim lines from the capture run):

```
SuperAdminBootstrap  : First-run Super Admin bootstrap created identity 132c452e-f77d-3ea1-b676-85de40450770; forced password change on first login
E2EFixtureSeed       : E2E fixture seed applied (profile=e2e, opt-in property set, effective datasource URL is loopback)
```

`GET /health/live` → 200 before and after the run.

### Frontend/capture env (recorded exactly; no spec file was edited)

```
VITE_API_BASE_URL=                                # empty → same-origin (overrides the stale local .env)
VITE_API_URL=http://localhost:8080                # Vite dev proxy target (frozen /api, /oauth2, /.well-known)
API_URL=http://localhost:8080/api                 # helpers/api.ts + env-overridable files (fe-004-*)
PLAYWRIGHT_TEST_API_BASE_URL=http://localhost:8080# INT-010 env-overridable base
```

## 4. Pre-capture verification battery (curl, real service — recorded output shapes)

1. **Fixture admin real sign-in** — `POST /api/auth/sign-in/email` `{admin2@yacc.local, admin123}`
   → **200** `{user{role: admin}, accessToken, refreshToken, mustChangePassword: false}`.
2. **a-1 super-admin flow (bootstrap identity)** — first sign-in → **200 `mustChangePassword:
   true`** → `POST /api/auth/change-password` (Bearer) → **200** → re-sign-in → **200
   `mustChangePassword: false`, role `super_admin`** (same-value rotation, exactly what the
   suite's `ensureSuperAdminCredential()` performs).
3. **RBAC tiering on `GET /api/users`** — `user@yacc.local` → **403**; `admin2@yacc.local`
   (admin) → **403** (admin not authorized — ADR-025 super-admin-gated user administration);
   bootstrap super admin → **200** (4 users).
4. **Fixture world** — `GET /api/conversations` → 200 `total: 107` (telegram + irc + 105 bulk);
   DB: 4 users (one per role), 3 routing rules, 3 tags, 3 notifications.
5. **UI real-login probe** (scratch script `ui-real-login-probe-result.json`, not part of the
   suite): chromium → `http://localhost:5173/login` → fill `admin2@yacc.local/admin123` →
   submit → **redirected to `/inbox`, `yacc_token` + `yacc_refresh_token` stored, header
   visible** — the full browser→Vite-proxy→Java chain with real credentials.
6. **Canary** (runbook §3): `tests/backend-auth.spec.ts` × chromium → **36/36 green** before the
   full run was launched.

## 5. Capture command (exact)

```
cd packages/frontend
VITE_API_BASE_URL= VITE_API_URL=http://localhost:8080 API_URL=http://localhost:8080/api \
PLAYWRIGHT_TEST_API_BASE_URL=http://localhost:8080 \
PLAYWRIGHT_JSON_OUTPUT_DIR=<capture-dir> PLAYWRIGHT_JSON_OUTPUT_NAME=baseline-report.json \
pnpm exec playwright test --retries=2 --reporter=html,json
```

Suite scope = the default run at the pinned SHA: 35 files / 1395 cases × {chromium, firefox,
webkit}; `tests/e2e/` remains outside the default run per T4 G1 (promotion is the ANG-015 U10
decision). `--retries=2` local semantics per the runbook (CI-matching retry tolerance).

## 6. Artifact inventory

| Artifact | Where | Note |
|---|---|---|
| Per-case listing (1395 rows) | `per-case-listing.tsv` (committed) | project, file, status, retries, duration, title, suite path |
| Raw Playwright JSON report | `baseline-report.json` (committed, 10.8 MB) | every case, every attempt, error messages — the durable machine-readable record |
| Aggregate | `summary.txt` (committed) | per-project × status + totals |
| **Full HTML report** | **too large for git (382 MB incl. per-case traces; `playwright-report/` is gitignored)** | zipped on the capture host: `/tmp/opencode/ang003-s2/react-e2e-html-report-ae42c67-full.tar.gz` (211 MB, SHA256 `6f0b05cb530e2fb681b5188fa08d6625f8db53c8dc8387d7caf9092b23ee76c6`); report `index.html` SHA256 `2e26666f1126b2bf8244d135f17bcaa81077fc046595bee96dc64c9b1b953f33`; regenerated per-case data fully covered by the committed JSON |
| Java boot log (capture run) | capture host `/tmp/opencode/ang003-s2/java-e2e.log` | seed/bootstrap lines quoted above |
| Env versions | `env-versions.txt` (committed) | verbatim tool output |
| UI real-login probe result | `ui-real-login-probe-result.json` (committed) | scratch evidence script output |

Database state after the run (capture DB `yacc_e2e`): users=106 (4 fixture/bootstrap + real
sign-up test accounts), conversations=107, audit_logs=8231 (real audit writes from the run).
Scratch DB only; dropped with the compose volume lifecycle — no production surface touched.

## 7. Disposition register (pre-registered entries applying to this capture)

Carried verbatim from the founder-approved plan / S1 PR #424 (pre-registration of record):

> **(i) a-1 super-admin mapping + forced-password-change (`helpers/auth.ts`):** The suite's
> super-admin identity (`admin@yacc.local` / `admin123`, `TEST_USERS.superAdmin`) is served by the
> ADR-025 first-run bootstrap Super Admin created only by `SuperAdminBootstrap` at Java-service
> startup (`YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL` + `YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL`;
> E2E boot configures exactly these suite credentials). The fixture seed creates no `super_admin`
> row. The bootstrap identity carries the forced-password-change flag; the permitted test-helper
> adaptation adds `ensureSuperAdminCredential()` to `helpers/auth.ts`, which signs in, and when
> `mustChangePassword: true` performs the credential replacement through the frozen
> `POST /api/auth/change-password` contract (same-value rotation admin123 → admin123) and
> re-signs in. … Test-helper adaptation only — no `*.spec.ts` edit and no production auth
> behaviour change. It is a permitted adaptation, **not a suite weakening**.

> **(ii) Tier-1 contract re-point (4 `backend-*` specs + `helpers/api.ts`):** re-pointed from the
> Node-era surface to the frozen canonical contract `.docs/migration/openapi.yaml` as implemented
> by the Java backend of record (`http://localhost:8080/api`; `sign-up/email`, `sign-in/email`,
> `get-session`, `sign-out`, `refresh-token`, `change-password`, BaseListResponse envelopes, UUID
> path ids, seeded fixture identities). Founder-authorized **permitted adaptation, not a suite
> weakening** … no test is deleted, skipped, marked `fixme`, or weakened.

Capture-time registrations (made before this run, now evidenced by it):

> **(iii) Residual Node-URL hardcodes (17 non-Tier-1 files)** — their inline
> `http://localhost:3000` API calls fail by design against the Java-only topology
> (Class A above). Not silently fixed (would be unauthorized spec edits); owned by the ANG-015
> (#385) disposition register.
>
> **(iv) Real-time rows are out of scope for this capture (AD-2/R1)** — React
> `socket.io-client` cannot anchor real-time rows against the Java raw-WS server; Class D
> failures are recorded, not dispositioned away. R1 evidence is separate and remains **blocking**
> until the Angular raw-WebSocket evidence exists.
>
> **(v) Password-reset limiter window (3 req/h/IP, in-memory)** — auth-spec reset cases accept
> the frozen documented 200/400/429 set (S1 disposition (ii)); re-runs within the window stay
> green by assertion contract.

## 8. Honest-state statement

- This is a **completed, environment-healthy, real-login capture** — the first valid React-on-Java
  baseline run (the only earlier archive, `react-e2e-baseline-230bd226-DIAGNOSTIC-INVALID/`,
  remains labeled-invalid and is superseded as a capture attempt record but **not** rewritten).
- It is **not an all-green run**: 503/1395 passed, with the failure classes above fully
  itemized. No test was edited, skipped, or weakened for this capture; `--retries=2` matches CI
  tolerance; flaky count is 0.
- **AC-ANG-003-5 / CP-3 / PB-2:** this archive supplies the AD-1 anchor evidence (real-auth +
  non-auth REST rows). Whether it satisfies CP-3's acceptance is the reviewer/tech-lead decision;
  CP-3/PB-2 remain **blocking** per the approved plan until explicitly accepted, and the R1
  real-time evidence remains **separate and outstanding**.
