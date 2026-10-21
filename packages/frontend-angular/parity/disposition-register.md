# Disposition Register — Angular E2E Parity (ANG-015, #385)

**Status:** Active — pre-registered **before** any Angular parity run (PB-2 discipline;
SPEC-001 T4 §5, T5 §3.4). This is the consolidated register required by SPEC-003
§Java Baseline Approval → *Gated / not covered* item 7 (G-7, discharged to this issue by
tech-lead, 19 Oct 2026, [#6259848192](https://github.com/csim-sg/yacc/issues/385#issuecomment-6259848192)).
**Authority:** SPEC-003 (FR-03/FR-05, AC-03/AC-05/AC-06, §Java Baseline Approval);
SPEC-001 T4 §5 / T5 §3.4–3.5 / T2 §9 / T3 §6; `PARITY.md` (PB-1/PB-2/PB-3).
**Companion artifacts:** `gate-scope.json` (machine-readable scope + anchor provenance),
`compare-baseline.mjs` (fail-closed comparator), `baseline/react-e2e-baseline-ae42c67-on-java/` (the anchor).

**PB-2 rule of this register:** the only permitted E2E failures are the rows pre-registered
here **before** the run that exposes them. Late registration masquerades as regression — not
permitted. Spec files are never edited/skipped/renamed/weakened to make Angular pass. An
**anchor-green** row that fails on Angular is a **real regression** routed back to the owning
port issue (#374–#383) — never a register entry. The gate must never be made green by
widening this register.

---

## 1. Baseline anchor and provenance (verified)

The anchor is the **React-on-Java** run (SPEC-003 AD-1, founder-approved 18 Oct 2026):
React app + suite + Java service all byte-identical to pinned `dev`
`ae42c674ef7a6a98ddbd9902def6fd0e48718697`, Java booted in the S1 (#423) fail-closed E2E
fixture posture, **real login** (no mocks, no JWT hand-signing, no invalid-run relabeling).
Captured 2026-10-18 by S2 (#373, PR #407, merged `1300436`); capture record:
`.docs/runbooks/react-e2e-baseline-capture.md` §7.

| Artifact (committed at `parity/baseline/react-e2e-baseline-ae42c67-on-java/`) | SHA-256 (verified by `compare-baseline.mjs check`) |
|---|---|
| `per-case-listing.tsv` (1395 rows) | `acf4a1eb56ac1f442d2d16b6da3c252ff5c16f4d2e25fcf0dc5c37d41803bc0b` |
| `baseline-report.json` (raw Playwright JSON) | `11b3d087378bae5449ccb3aafe6f3fdd6c4d43fb5f71504f52d29b9226290142` |
| `summary.txt` | `7907d88c14411b7aa6e756566887efbcafa767fb656f2b2382fa505f5fbf9390` |

| Anchor status | Count (all 3 browser projects) |
|---|---|
| passed | **503** |
| failed | **664** |
| timedOut | **174** |
| skipped (the specs' own conditional `test.skip`) | **54** |
| flaky (passed only after retry) | **0** |

- **Tier-1 real-auth + REST: 390/390 green** (`backend-auth` 108, `backend-conversations` 126,
  `backend-audit-logs` 99, `backend-regression` 57) — these test the backend, which SPEC-003
  forbids changing; they stay green **unconditionally** and the comparator fails the anchor
  itself if a future re-capture ever records a red Tier-1 row.
- Real-time rows are **NOT anchored** by this capture (React `socket.io-client` vs Java raw
  WS, ADR-026) — AD-2/R1, see §4.
- The 2026-10-08 Node-era diagnostic remains archived at
  `parity/baseline/react-e2e-baseline-230bd226-DIAGNOSTIC-INVALID/`, labeled invalid — it is
  **not** an anchor and is never referenced as one (no mock/invalid baseline accepted).

## 2. Permitted adaptation — a-1 auth-helper (recorded, never silent)

| # | Entry | Class | Status |
|---|---|---|---|
| 2.1 | **a-1 super-admin credential mapping + forced-password-change step** in `packages/frontend/tests/helpers/auth.ts` (and the `global-setup.ts` fixture-posture docblock): the suite's super-admin identity maps to the ADR-025 **bootstrap-only** Super Admin (`admin@yacc.local`; forced password change on first login) instead of a seeded `super_admin` row — which the S1 fixture **must not and does not create**. Permitted test-helper adaptation (SPEC-003 AD-5 option (a), mapping a-1), executed by S1 #423 (PR #424, merged `ae42c67`). | Permitted adaptation — **pre-registered** | Recorded; part of the anchor's environment by definition |

Zero spec files were edited by S1 (`AC-ANG-003-1` verified over
`packages/frontend/tests/**/*.spec.ts`); the helper adaptation is a **recorded** permitted
change, not a spec-file edit.

## 2b. Permitted test wiring/environment adaptations (recorded, never silent)

Registered by ANG-015 after review-loop 1 (tech-lead triage
[#6290500131](https://github.com/csim-sg/yacc/issues/385#issuecomment-6290500131), H1–H4
root-cause analysis; strategist scope co-sign on #439). Both entries are **permitted
adaptations** to test wiring/environment — explicitly **not expected-red class entries**
(classes A–E in §3 are unchanged), **not** registrations of any genuinely failing
anchor-green behavior row, and **no test file was skipped, weakened, renamed, or
assertion-reduced**. They land via separate reviewed PRs merged to `dev` (the #385
branch integrates them by merging `origin/dev` — no rebase, no force), and this §385
register records them before the corrected parity rerun. PB-2 discipline is unchanged:
an anchor-green row that still fails on Angular after these environment repairs is a
real regression routed to its owning port issue.

| # | Entry | Class | Provenance / run record |
|---|---|---|---|
| 2.2 | **#439 `PREREQ-ANG-015-W1` — p0 FE_BASE honours `BASE_URL`** (PR #440, merged `b3a71ff` 2026-10-20): one line in `packages/frontend/tests/acceptance/phase1/p0-frontend-option2.spec.ts:23` — `const FE_BASE = 'http://localhost:5173';` → `const FE_BASE = process.env.BASE_URL \|\| 'http://localhost:5173';`. Test-target wiring only (same convention as the sibling gate-scoped specs); restores **measurability** of the 18 anchor-green p0 rows under the Angular harness (`BASE_URL=:4200`) — in the React anchor the hardcoded literal was correct, and in parity run 1 the rows died on `ERR_CONNECTION_REFUSED :5173` before any DOM assertion executed (root cause H2: environment defect, not behavior evidence). The `:5173` fallback literal is **preserved** (unset-`BASE_URL` runs unchanged) and `API_BASE = 'http://localhost:3000/api'` (line 22, anchor-red class A) is **byte-identical**. | Permitted wiring adaptation — **not expected-red** | Assertion-neutral verified in PR #440: 28 `test(` / 21 `expect(` counts identical, `data-testid` md5 unchanged (`16ba24847843b68832e9ccb117fe0827`), 0 `skip/only/fixme` added, 0 title lines in the diff, 1 changed file. |
| 2.3 | **#377 R1 — browser-exact outside-click + history-unwind Tier-0 rows** (PR #441, merged `8caae49` 2026-10-20; commit `3e6433f`): additive adaptation confined to #377's own Tier-0 spec `packages/frontend/tests/inbox-shell-ang007.spec.ts` (+64/−3). (a) `ANG007-NOTIF-1`: the outside press targets the deterministic `heading "YACC Inbox"` element instead of a fixed `(640, 400)` coordinate — in the unstyled shell the press could land inside the full-width notification host (0.97 px from webkit's band boundary; CI reconnect banner shifts it), where not closing is correct React-parity behavior; mechanism reproduced 3× on chromium + webkit pre-fix. (b) `ANG007-INBOX-1`: the final Back-#2 assertion is browser-neutral with **equal regression power** — exit to `about:blank` (chromium/webkit) **or** stays on the clean `/inbox` with **unchanged `history.length` AND unchanged router `navigationId`** — because Firefox's initial `page.goto` replaces the initial `about:blank` entry (browser artifact; instrumentation refuted both hypothesized app defects: the guard bounce `replaceState`s and the component performs no post-bounce URL write). | Permitted test-environment adaptation — **not expected-red** | Commit `3e6433f`, base `f9436c6`, head `3e6433f`; run record (real app + real Java S1 service, no mocks): inbox-shell spec **12/12 expected, 0 unexpected, 0 flaky** × chromium/firefox/webkit incl. `ANG007-WS-1` re-evidenced against a valid `:4200` realtime origin; `frontend-login.spec.ts` 27/27 × 3 browsers; unit 444/444; coverage gate exit 0 (96.08/88.39/95.17/96.26); PB-1 build exit 0; artifact SHA-256: per-case JSON `579f585f…`, login per-case JSON `164fe6bd…`, HTML zip `570ed62f…`, login HTML zip `5363db45…` (local `/tmp/opencode/ang007-r1/evidence/`). App-side history contract (one Back unwinds the whole filter session; no extra pushed entry) holds on all three browsers. |

**Explicit non-entries (PB-2):** no genuine failing anchor-green row is registered by §2b.
The parity gate remains **failed** as recorded for run 1; only the corrected rerun (after
H1 `BASE_URL`, H3 WS allowed-origin, H4 Mailhog sink, plus 2.2/2.3) may change the
verdict, and any surviving anchor-green → red row stays a regression routed to
#374–#383 — including the CI-only `ANG011-CRUD-1` and `HP-AUTH-006` hypotheses, which
remain unresolved evidence, not dispositions.


## 3. Anchor-red classes A–E (expected-red rows, pre-registered)

Every anchor-red row belongs to exactly one class below (file→class mapping enforced
mechanically by `gate-scope.json` + `compare-baseline.mjs`). These rows are **expected to
stay red** in the parity run; a red row in a file without a class is a register gap and fails
the gate. A class-A–E row that **passes** on Angular is an improvement — surfaced, and the
entry is retired at the next deliberate anchor update (never silently).

| Class | Files | Cause (from the anchor README, verified against the TSV) | Disposition |
|---|---|---|---|
| **A** — residual Node-URL inline API (~505 failed + 6 timedOut) | `acceptance/phase1/{auth,inbox-list-filters,p0-frontend-option2}`, `acceptance/phase2/{assignments,audit-logs-export,bulk-actions,notes-mentions,notifications,phase2-master,routing-rules,tags}` | 11 non-Tier-1 files hardcode `http://localhost:3000/...` setup calls (no env override; S1 was forbidden to touch them) → `ECONNREFUSED` → downstream 401s | Expected-red on both sides; independent of Angular. Fixing the hardcoded URLs is a spec edit — only via a separately-authorized, pre-registered adaptation |
| **B** — non-fixture identities (99 timedOut) | `fe-003-rbac-nav.spec.ts` | signs in as identities the Java fixture world does not create → real sign-in 401 → `loginAs` timeout (3 rows pass) | Expected-red; identity mapping was authorized for the helper + Tier-1 surface only (S1) |
| **C** — Node-era contract expectations (111 failed) | `fe-004-api-integration`, `fe-004-error-scenarios`, `fe-004-cache-invalidation` | env-overridable files pointed at Java via `API_URL`, but they wait for Node-era response shapes/flows; the frozen Java contract answers differently → timeouts | Expected-red; the Angular contract target is the frozen Java surface (AD-1) — these rows are re-evaluated at/after the cutover re-anchor |
| **D** — real-time / socket.io rows (18 failed + 3 timedOut) | `e2e/tags.e2e.ts` (via the now-superseded wrapper) | browser console `ws://localhost:3000/socket.io/` refused — React speaks `socket.io-client`; Java exposes raw WS `/ws` (ADR-026) | Expected-red; real-time rows anchor on the **separate R1 evidence** (§4), never on React-on-Java |
| **E** — debug/utility + mixed-era assertions (63 timedOut + 30 failed) | `conversation-detail`, `fe-002-login-ui` (mixed mock/real UI-detail), `inbox-filters` (hardcoded `:5173`, stale waits, Node fixture absent), `INT-010-irc-profiles`, `regression-suite` (+30 in-spec skips) | utility specs and mixed-era assertions; skips are the specs' own conditional `test.skip` (pre-existing) | Expected-red; per-case detail in the anchor TSV/JSON |

(Anchor-red rows in the 9 excluded debug specs and the superseded wrapper are **out of gate
scope** after U10 — §5.)

## 4. Real-time R1 rows (AD-2 — blocking, never silently passed)

| # | Entry | Class | Status |
|---|---|---|---|
| 4.1 | **Room-scoped `message.received` / `typing.*` client receipt**: the server relay half is evidenced (Java raw-WS frames in the R1 record), but the client receipt via room subscription (`subscribe.conversation`) is **not yet E2E-evidenced** on the Angular UI. | R1 (AD-2) | **Blocking** on separate R1 evidence; routed to ANG-007 (#377) / ANG-008 (#378). Never marked passed on React-on-Java evidence (Class D proves React cannot capture it) |
| 4.2 | **`tests/realtime-rawws-r1.spec.ts`** (ANG-006 #376, PR #428 merged `2e7b22a`): the Angular-native raw-WS evidence ladder — real UI sign-in, real `WebSocket` to `/ws?token=…`, real server frames, real RBAC (403/201), real service SIGTERM/restart (W19). Its own capture: **11 expected / 0 unexpected / 0 skipped / 0 flaky**. | R1 (AD-2) evidence | Runs **inside** the parity gate as an unanchored-but-known file (`gate-scope.json → angular-native-tier0`); expected **green** — a red row is a live Angular regression and **gates** |
| 4.3 | **CP-3/PB-2 remain blocking** on the complete R1 real-time evidence class; no parity/cutover claim may cite the React-on-Java anchor for real-time rows. | Gate | Unchanged |

## 5. U10 — gate-scope decision (resolved here, applied)

| Decision | Content |
|---|---|
| **Promote the excluded `e2e/` set** — **APPLIED** | 6 files / 107 cases (`FE-008-009-010-api-integration` 36, `QA-002-inbox-workflows` 16, `admin/users-table` 24, `admin/irc-test-button` 9, `FE-013-014-015-websocket-listeners` 15, `tags.e2e` 7) run in the parity gate via `testMatch` (`e2e/**/*.spec.ts`, `e2e/**/*.e2e.ts`). Required for T4 rows 7/8/13/17/18 (real-time listeners, unread badges, users admin, status/priority, IRC button) to be gate-visible |
| **Exclude the 9 debug specs** — **APPLIED** | `inbox-{console,content,debug,network,screenshot}`, `inspect-inbox`, `simple-sidebar-test`, `test-navbar`, `test-responsive-sidebar` (T4 §2: 1 assertion-free case each; Tier-2 noise) excluded via `testIgnore` |
| **Wrapper superseded** | `tests/tags.e2e.spec.ts` (2-line re-import of `e2e/tags.e2e.ts`) is excluded — direct `e2e/` discovery replaces it and avoids a double-run; its anchor rows map to `e2e/tags.e2e.ts` (comparator normalizes the paths) |
| **Conservative floor kept** | The pre-U10 default run (35 files / ~450 cases) remains the floor; U10's promotion is the recorded, deliberate expansion — never a silent one |
| **Canonical scope** | `gate-scope.json` (this config + the CI comparator both read it); the discovered scope at registration time is **38 files / 1767 cases × 3 browsers** (verified `playwright test --list`) |
| **Unanchored consequence** | The 5 promoted e2e files have **no anchor rows** (the anchor ran only `tags.e2e` via the wrapper): their outcomes are fully surfaced per run and are **non-gating until a baseline capture anchors them** — a red row there is a register/anchor event (§7), never a silent pass and never widened into expected-red without evidence |

U10 is **resolved and recorded here** per its owner route (T5 §8: tech-lead at gate wiring =
ANG-015); the founder decisions U1–U4/U12 remain untouched.

## 6. Consolidated U5–U9 dispositions (owned by ANG-004..006; not re-decided here)

| ID | Surfaced difference | Disposition (delivered) | Owning issue |
|---|---|---|---|
| **U5** | Optimistic-send activation vs live server-confirmed append | **U5 inactive**: messages append on server confirmation (React parity); retry is exactly-once per message; `canReplyAndRetry` RBAC gate preserved | ANG-008 (#378) |
| **U6** | Token-capture semantics (`set-auth-token` header + localStorage + handshake token) | **Bearer + rotating refresh pair**, kind `local\|oidc`, React-on-Java keys `yacc_token` / `yacc_refresh_token` / `yacc_token_kind`, legacy-key clear; ANG-005/006 consume the seam | ANG-004 (#374) |
| **U7** | `WebSocketStateService` persistence drop (typing/presence/event-ids/connection state lose localStorage) | **In-memory event stores** — nothing user-visible reads the dropped persistence after reload (parity of absence, verified via W19 rows) | ANG-006 (#376) |
| **U8** | Offline-queue UI scope (mechanism ported, no `OfflineIndicator` UI) | **Mechanism ported, no UI built** — FIFO queue drains only after confirmed delivery; failures persist with per-row errors + `syncError`; live parity is absence | ANG-005 (#375) |
| **U9** | SLO porting (SLOMonitor unwired today; porting = new wiring scope) | **Parity of absence** — SLO sinks not ported; `lib/logger` + `X-Request-ID` preserved; porting remains post-gate scope | ANG-006 (#376) |

### 6b. U1–U4 = T3 G2/G3/G5/G8 parity-of-absence rows (recorded; founder decisions untouched)

| T3 gap | Surfaced difference | Parity disposition |
|---|---|---|
| **G2** (=U1) | `notification.received` has **no backend emitter** (+ React broken link B6) | Parity = **same absence**: the notification panel is REST-fed (W17), no WS push claimed or counted as covered; emitter work is a post-gate backend product decision (founder, U1) |
| **G3** (=U2) | `conversation.reopened` has **no backend emitter** | Parity = **same absence**; the dead listener is not ported |
| **G5** (=U3) | `message.sent`/`message.failed` envelope mismatch (live Node) | Status UI rides the **HTTP append path** exactly as today (no frontend "fix" into a behavior change); the frozen-contract envelope wire truth is encoded (ANG-008 corrected the local send-response claim to the frozen `{data: Message}` operation, ADR-023); WS-driven status patches are **not** claimed as covered |
| **G8** (=U4) | API-only surfaces (W11 status, W12 priority, W13 bulk, W17 notifications REST, audit export, message status, users/roles, queue/DLQ, health) | Parity = **same absence of UI** — the gate does not require, and cutover must not silently add, UI for these (founder decision U4 pending for post-gate scope) |

## 6c. F4/F5 drift corrections (not reproduced in Angular)

| Entry | Disposition |
|---|---|
| **F4 — auth contract drift** (`/simple-auth/*` routes that exist nowhere; header-less `/auth/*` paths) | **Not reproduced.** Angular wires only live endpoints (T3 G1 design rule): the Spring/OIDC auth surface (ADR-025) per §Auth Target Correction. CI grep gates assert 0 `/simple-auth` references and no header-less `/auth/*` API paths (ANG-004 verification, kept in the register as a standing rule) |
| **F5 — drift blast radius** (`registerPage` registration + store-based logout hitting dead endpoints) | Register/recovery/logout are **wired to live endpoints**; the drifted paths' absence is parity-of-absence. Mixed mock/real assertions about the drifted UI (`fe-002-login-ui` subset) are Class E expected-red rows (§3) |

## 7. Unanchored known files (gate-scope `unanchoredKnownFiles`)

| Group | Files | Expected | If red |
|---|---|---|---|
| U10 promotion (no anchor rows) | `e2e/FE-008-009-010-api-integration`, `e2e/FE-013-014-015-websocket-listeners`, `e2e/QA-002-inbox-workflows`, `e2e/admin/irc-test-button`, `e2e/admin/users-table` | Unknown (Node-era contracts; likely red on both apps) | Surfaced per run, **non-gating**; red rows are a register/anchor event — disposition them with evidence or anchor them via a React-on-Java capture before they can gate |
| Angular-native Tier-0 evidence | `tests/realtime-rawws-r1` (§4.2), `tests/inbox-shell-ang007`, `tests/conversation-detail-ang008`, `tests/routing-rules-ang010`, `tests/users-admin-ang011`, `tests/irc-profiles-ang012`, `tests/audit-logs-ang013` | **Green** (they are the port issues' own merged evidence) | **Gates** — a red row is a live Angular regression routed to the owning issue |

Any **other** file appearing in a parity run is a gate-blocking violation (no silent gate
expansion); registering it here + in `gate-scope.json` is a deliberate, review-visible act.

## 8. CI test ownership (CP-4 wiring)

| Gate | CI job (`.github/workflows/frontend-angular-parity.yml`) | Enforcement |
|---|---|---|
| **PB-1** build | `build-angular` in `frontend-deploy.yml` (pre-existing, unchanged) | `ng build` green |
| **PB-2** E2E parity | `parity` matrix jobs (chromium/firefox/webkit — one FULL U10-suite run per browser, evidence only) + `parity-compare` gate job | Spec-edit integrity gate (no modified/renamed/deleted suite files per PR — in every browser job); anchor pre-flight (`compare-baseline.mjs check` — fail-closed on missing/bad/mismatched baseline incl. SHA-256 — in every browser job and again in `parity-compare`); Java service in the S1 e2e posture per browser job; full U10-scope Playwright run ×3 browsers (one browser per job — a leg that cannot finish never produces a verdict); `parity-compare` downloads all three raw JSON reports and fails closed if any browser job/report is absent, empty, hash-mismatched, mis-scoped (foreign project) or covers a different case set, merges them into the complete 3-browser report (`parity/merge-browser-reports.mjs`), then `compare-baseline.mjs compare` — fails on regressions, weakenings, scope leaks, register gaps, missing results; summary surfaces every bucket (expected red, unanchored red/green, improvements, flaky) |
| **PB-3** unit + coverage | `unit-coverage` job | `test:unit:coverage` with thresholds **≥85 lines / ≥85 statements / ≥85 functions / ≥80 branches** (angular.json; exit non-zero below target; never lowered) |
| **CP-3** baseline capture | `react-baseline-capture` job (`workflow_dispatch` only) | Boots the same Java posture, runs the **React** harness at the current SHA, derives the per-case TSV + env versions + JSON + HTML report, uploads them as workflow artifacts (full provenance: `github.sha`, tool versions). Archiving a new anchor into the repo is a separate deliberate act (register + `gate-scope.json` update) |
| Tier-1 backend | `backend-java-ci.yml` (pre-existing, unchanged) | JUnit + Testcontainers + JaCoCo ≥85% + contract tests |

**Environment honesty (corrections recorded per the tech-lead reconciliation):**

- **Postgres only — no Redis.** The Java service of record does not use Redis (ADR-028:
  Quartz + PostgreSQL DB DLQ; no Redis client exists in `services/backend-java`). The stale
  "postgres+redis services" wording in the issue body/AC-ANG-015-1 is **superseded** by the
  tech-lead's reconciliation comment (#6259848192 §4); both CI jobs provision **PostgreSQL 15
  only**. (The Redis mention in T5 §3.4 and the Node-era runbook §2 describes the retired Node
  topology, not this gate.)
- **Not a production surface.** The parity/capture jobs boot a throwaway Java service against
  an ephemeral loopback PostgreSQL on the CI runner — no AWS/deploy credentials, no
  `environment:`, no access to any deployed system; the S1 seed posture itself is fail-closed
  (explicit `e2e` profile + opt-in property + loopback datasource guard, zero partial seed,
  no `super_admin` fixture row).
- **Angular e2e posture / allowed origins:** the browser reaches the Java service only through
  the dev-server **same-origin relay** (`proxy.conf.json` routes `/api`, `/oauth2`,
  `/.well-known` → `:8080`; `proxy.conf.js` re-points them via `YACC_API_PROXY_TARGET`) — the
  Spring service has no CORS and none is added. The `globalSetup` health check fails the run
  if the Java service is not up (fail-closed).
- **Failure surfacing:** `parity-compare` writes `comparison-report.json` + a markdown
  summary to `$GITHUB_STEP_SUMMARY`; every browser job uploads its raw machine-readable
  JSON report + SHA-256 sidecar + run log + Java log as `parity-json-<browser>`, and its
  HTML report as `parity-html-<browser>`, always (`if: always()`); `parity-compare`
  uploads the merged 3-browser report (with a per-source provenance block), the merge
  summary and the comparison artifacts as `parity-evidence`. Expected red is **surfaced,
  never hidden**: the summary lists every bucket with counts and row detail.

**Execution-topology record (21 Oct 2026):** parity run 39440888894 was cancelled at the
single-job 350-minute cap without a verdict (1767 cases × 3 browsers no longer fit one
GitHub-hosted job). The gate was re-plumbed into per-browser matrix legs + a fail-closed
`parity-compare` decision job (240 min/browser — same cases, browsers, assertions,
posture, comparator, anchor; nothing dropped or weakened; a missing/short browser run
fails the aggregation instead of hiding it). Recorded here as gate WIRING, not a
disposition: no expected-red class touched, no register entry, no gate semantics changed;
the merge is validated by `parity/validate-merge-browser-reports.mjs` (incl. a
round-trip + comparator-verdict-identity check against a real 3-browser report).

## 9. Registration discipline

1. New expected difference discovered **before** a run → add the register row + `gate-scope.json`
   entry in a reviewed PR, **then** run.
2. Difference discovered **by** a run → it is a regression/gap: route to the owning issue; do
   not edit specs; do not add a late register entry to turn it green.
3. Anchor replacement (new capture) → new baseline directory + `gate-scope.json` anchor block
   (SHAs, hashes, counts) + register §1 update, reviewed; the comparator fails against any
   undocumented drift (SHA-256 mismatch, row-count change, class map drift).
4. This register never waives CP-3/PB-2/Tier-1/R1/cutover gates and never asserts a cutover
   claim; waivers are tech-lead-recorded decisions in the issue, never a silent green build
   (T3 §3 failure policy).
