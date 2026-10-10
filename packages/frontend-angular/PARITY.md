# PARITY — Angular parity bar, harness, and unit-test foundation (ANG-003)

**Status:** Active — defines the parity bar for every SPEC-003 feature port (ANG-004+) and cutover (ANG-016).
**Authority:** SPEC-003 (FR-03, AC-03); SPEC-001 T4 §4–§5 (planning basis, unchanged in substance); tech-lead guardrails on issue #373.
**Companion docs:** ARCH-005 / ADR-031 (placement + guardrails); `.docs/runbooks/react-e2e-baseline-capture.md` (baseline capture + evidence).

---

## 1. Parity bar

The Angular build replaces React as the app under test; the existing framework-agnostic
Playwright suite runs **unchanged**. The gate is the conjunction of:

| Bar | Definition | Command | Enforced |
|---|---|---|---|
| **PB-1 — Build gate** | `ng build` green (AOT + budgets + strict template type-check) | `pnpm --filter @yacc/frontend-angular build` | from ANG-001; CI build-only validation job |
| **PB-2 — E2E parity gate** | Tier-0 Playwright set passes **100% against the Angular build** with **zero regression vs the archived React baseline**: no test green on React that fails on Angular; no test skipped/removed/weakened/made conditional without a pre-registered disposition | `pnpm --filter @yacc/frontend-angular test:e2e` | pre-cutover (ANG-016); CI wiring is ANG-015 |
| **PB-3 — Unit gate** | Angular unit suite green **and** coverage thresholds met as a merge gate: ≥85% lines / statements / functions, ≥80% branches on new Angular code | `pnpm --filter @yacc/frontend-angular test:unit:coverage` | from ANG-003 (thresholds fail the run below target); CI wiring is ANG-015 |

**Baseline precondition (blocking for PB-2, CP-3):** the React-baseline E2E green-state is
to be archived at `parity/baseline/react-e2e-baseline-230bd226/` (full HTML report + per-case
listing + commit SHA + environment versions; capture procedure in the runbook). PB-2's
"zero regression" anchors to that **recorded** state — red-at-baseline is recorded, never
assumed green.
**Current status (2026-10-10): NOT captured.** Prerequisite #408/#409 (`2a7e7e2`) fixed
the backend body-parser regression (RC-1) and added a deterministic non-production
limiter posture (RC-2, `APP_ENV=test` only; production values unchanged and
test-asserted). A third pre-existing blocker remains: BetterAuth email/password is
structurally non-functional against the current DB schema (`users.password_hash`/`role`/
`status` NOT NULL break sign-up with `422`; `account` has no `password` column so every
sign-in `401`s) — see the diagnostic README §6 and runbook §6 (RC-3). Capture attempts
stay environment-red; a labeled-invalid diagnostic lives at
`parity/baseline/react-e2e-baseline-230bd226-DIAGNOSTIC-INVALID/` — it is **not** a PB-2
anchor. CP-3 is open pending a further separately-authorized backend prerequisite.

## 2. Disposition-register discipline

- **Pre-registration before the parity run:** every expected observable-behavior deviation
  must be on the register **before** the run that exposes it — never explained after.
  Candidates already surfaced by the planning basis (T4 §5 PB-2): optimistic-send
  activation, token-capture semantics, websocket-store persistence drop, offline-queue UI
  scope, SLO porting, the F7/B6 notification contract gap, and the F4/F5 drift corrections
  (register/recovery/logout wired to live endpoints; the `/simple-auth/*` drift is not
  reproduced).
- **Spec files are never edited to make Angular pass.** A spec change required by wiring
  (none anticipated — `baseURL` is config, not spec) is itself a disposition-register
  entry. Zero spec edits is the ANG-003 acceptance state and is verified by
  `git diff --stat dev -- packages/frontend/tests packages/frontend/e2e` (empty).
- **Ownership:** the register **content** (entries + CI enforcement of the gate scope,
  `e2e/` promotion, debug-spec exclusion) is authored in **ANG-015** (U10). This issue
  delivers the discipline + the harness; Tier-0/Tier-1/Tier-2 classification per T4 §2.
- **Tier-1 API specs stay green unconditionally** — they test the backend, which SPEC-003
  forbids changing; a Tier-1 failure indicates environment, not migration.

## 3. Parity harness

`playwright.config.ts` in this package runs the existing suite from
`../frontend/tests` **unchanged** against the Angular dev server:

- Only configuration moved: `baseURL` `:5173 → :4200`; `webServer` Vite → `ng serve`
  (180s cold-start timeout); everything else (3 browser projects, `fullyParallel`,
  CI retries/workers, `trace: 'on-first-retry'`, backend `db:fixtures` global setup) is
  carried over from `packages/frontend/playwright.config.ts` verbatim.
- Requires the E2E environment (runbook §Prerequisites): PostgreSQL + Redis + backend
  `:3000` + fixtures. The suite seeds fixtures itself via `globalSetup`.

```bash
pnpm --filter @yacc/frontend-angular test:e2e                      # full suite × 3 browsers
pnpm --filter @yacc/frontend-angular test:e2e -- --project=chromium <spec>   # targeted
```

## 4. Unit runner decision (T4 §4.2 pre-registered switch — TRIGGERED)

T4 §4.2 selected **Jest via `jest-preset-angular`** with a pre-registered switch
condition: *if the Angular line pinned at implementation kickoff ships first-party Vitest
support as the CLI default, select Vitest instead (consolidating on the ADR-007
precedent)*.

**Condition verified true at ANG-003 kickoff (2026-10-06):** the pinned line
**Angular 21.2.x** (`@angular/build` 21.2.25) ships **Vitest as the first-party CLI
default** (`@angular/build:unit-test` builder, `runner: "vitest"` default; Angular 21 made
Vitest the default `ng test` runner and deprecated/removed Karma from new projects).
Jest + `jest-preset-angular` is therefore **not** used; the switch is documented here per
the tech-lead guardrail ("mechanical … and documented if triggered").

- **One runner per package; no dual-run:** Vitest 4 via the `unit-test` builder, jsdom
  environment, TestBed, zone.js retained (ADR-031 decision 4) — consolidating the
  monorepo on the ADR-007 Vitest precedent (backend + this package).
- **Mechanical-switch consequence:** specs are runner-agnostic TestBed specs; only mock
  globals differ (`vi.fn`/`vi.spyOn` instead of `jest.*`). No Jest dependency is added.
- Config lives in `angular.json` (`test` target): `setupFiles` (browser-API mocks ported
  per T4 §4.3; the Vite `import.meta.env` mock is NOT ported — environment files replace
  it), `coverageThresholds`, `coverageInclude/Exclude`, `coverageReporters`.

```bash
pnpm --filter @yacc/frontend-angular test:unit            # unit suite (fast)
pnpm --filter @yacc/frontend-angular test:unit:coverage   # PB-3 gate run (thresholds enforced)
```

## 5. Parity-critical unit run set (replaces the React package's dead-weight run set)

Single convention: `*.spec.ts` **co-located** with sources (no `__tests__/` mirrors, no
`.test.` files). Priority order (T4 §4.3); feature ports add their specs as they land:

| Target (T2 mechanism) | Unit scope | Tooling |
|---|---|---|
| Resource stores `ResourceState<T>` + 8 families | 30s freshness, 5m eviction, per-key dedup, invalidate/update, stale-while-revalidate | `HttpTestingController` |
| HTTP interceptors | retry 3×/1× on 5xx/timeout only; 401 single-flight refresh + replay + redirect; auth-header + `X-Request-ID` | `HttpTestingController` |
| Guards + route table | role × route matrix, public redirect, catch-all | TestBed stubs |
| `AuthService` | session load / sign-in / sign-out, role-case normalization | `HttpTestingController` |
| `WebSocketClientService` + event-handler services | connection-state signal; event → store wirings; dedup; typing auto-clear | fake socket.io client stub |
| Signal-store services (8 boundaries) | ported store semantics (notifications cap-100, offline FIFO) | plain TestBed |
| Contracts (Zod) | request/response + WS envelope validation | plain |
| Components (interactive logic only) | `Navigation` role filter, `NotificationCenter`, `ReplyComposer` RBAC gate | TestBed fixtures — **no @testing-library/angular**; full behavior stays E2E's job |
| `lib/` utilities | logger, tempId, nav config | plain |

Current scaffold state (ANG-003): shell smoke specs (`app.spec.ts`,
`app.config.spec.ts`, `app.routes.spec.ts`) proving the pipeline; feature issues replace
dead-weight coverage with the run set above as code lands.

## 6. Coverage thresholds (PB-3)

- **≥85% lines / ≥85% statements / ≥85% functions / ≥80% branches** — the ADR-007
  backend precedent and GOV-029 ≥85%-new-code convention. **No lowering** below the
  precedent (tech-lead guardrail).
- Enforced by `coverageThresholds` in `angular.json` — the coverage run **exits
  non-zero** when any threshold is missed (verified in ANG-003).
- Exclusions: `src/main.ts` (bootstrap), `src/environments/**` (build-time
  substitution), `src/test/**` (setup) — mirroring the backend pattern per T4 §4.4.
- Baseline honesty: the React package's frontend coverage was never measured (T4 G4);
  the Angular target **introduces** measurement and does not inherit a number.
- CI enforcement of PB-3 (required check) is **ANG-015** scope.

## 7. ANG-003 verification evidence

```bash
# suite is framework-agnostic (guardrail, T4 §1.2):
rg -l "from '(react|@testing-library|.*src/)" packages/frontend/tests packages/frontend/e2e | wc -l   # → 0
# zero spec-file edits in this issue:
git diff --stat dev -- packages/frontend/tests packages/frontend/e2e                                  # → empty
# PB-1 build green:
pnpm --filter @yacc/frontend-angular build
# PB-3 unit + thresholds green:
pnpm --filter @yacc/frontend-angular test:unit:coverage
```
