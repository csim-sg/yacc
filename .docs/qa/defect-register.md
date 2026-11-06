# Defect Register (SPEC-002 — source of record)

**Version**: 1.0.0 (seeded 2026-11-06) · **Issue**: csim-sg/yacc#458 (MIG-091f) · **Parent**: csim-sg/yacc#366 (AC-MIG-091-4)
**Severity definitions**: [`.docs/qa/severity-taxonomy.md`](severity-taxonomy.md) (§2 names this register the source of record) · **Consumed by**: #461 (dated report), #363 (MIG-072 gate)

> **An empty register means "no registered defects" — it does NOT mean "no defects".**
> The register records what is triaged into it; absence of a row is absence of a registered
> entry, not proof of a clean surface. Nothing in this file claims a dated report, a passing
> gate, or defect closure — the dated zero-open report is produced at closure (#461).

## 1. Columns and statuses (pinned — do not change the column set)

`ID | Date | Sev | Surface | Description | Evidence | Status (open/fixed/closed) | Resolution link`

- **ID** — `DEF-NNN`, stable, **never reused or deleted**; the register is append-and-link.
- **Date** — date of the source record the row seeds from (seeded rows) or the entry date (new rows).
- **Sev** — `Sev-1`..`Sev-4` per the taxonomy; `TBD` = severity undetermined pending triage
  (used only for unassessed clusters, never for an assessed finding); `n/a` = adjudicated
  not-a-finding (closed, excluded from defect totals).
- **Description / Evidence** — one-line summary + link to the evidence of record. **Cells must not
  contain a literal `|` character** (keeps the pinned queries deterministic).
- **Status (open/fixed/closed)** — `open`, `fixed`, or `closed` only. Status mapping rule for rows
  sourced from another ledger (taxonomy §4): a proposal or candidate disposition
  (`remediated (proposed)`, `resolved-policy (candidate)`, or any unadjudicated state) is recorded
  **`open`**, with the source's exact status carried verbatim in the Description. Only an adjudicated
  closure or a validated remediation in the source record permits `closed`/`fixed` (taxonomy §5).
- Every status/severity change after seeding appends a dated line to §5 (Amendment log).
- There is **no waiver status**, and none may be added (taxonomy §6).

## 2. Register

| ID | Date | Sev | Surface | Description | Evidence | Status (open/fixed/closed) | Resolution link |
|---|---|---|---|---|---|---|---|
| DEF-001 | 2026-10-20 | Sev-2 | WS room join | Conversation-room join has no resource-level authorization (receive path: message bodies, delivery status, id discovery). Source status verbatim: resolved-policy (candidate) — unadjudicated, so open here. | [ledger §2 TM-001](../security/MIG-073-findings-ledger.md) at rev f83863f | open | Reviewer/tech-lead adjudication of the AC-2 effect, reserved (ledger §2 TM-001) |
| DEF-002 | 2026-10-20 | Sev-2 | REST conversation reads | REST conversation-content read paths lack resource-level authorization. Source status verbatim: resolved-policy (candidate) — unadjudicated, so open here. | [ledger §2 TM-002](../security/MIG-073-findings-ledger.md) at rev f83863f | open | Reviewer/tech-lead adjudication of the AC-2 effect, reserved (ledger §2 TM-002) |
| DEF-003 | 2026-10-20 | Sev-3 | Helm env injection | Chart env injection does not match the Spring env contract (fail-closed bootstrap/signing/recovery/encryption/email binding). Post-ledger chart env alignment merged in #446 (2026-11-06); ledger row not re-assessed, so open here — not marked fixed. | [ledger §2 TM-003](../security/MIG-073-findings-ledger.md) at rev f83863f | open | tech-lead: bounded chart-fix issue or #361 MIG-070 rehearsal (ledger §1 routing) |
| DEF-004 | 2026-10-20 | Sev-3 | Pod env secret material | Unconsumed secret material (CLOUDFLARE_R2_*, TELEGRAM_BOT_TOKEN, IRC_PASSWORD) mounted into pod env with no Java consumer. | [ledger §2 TM-004](../security/MIG-073-findings-ledger.md) at rev f83863f | open | tech-lead: chart cleanup decision incl. R2 disposition (ledger §1 routing) |
| DEF-005 | 2026-10-20 | Sev-3 | WS token transport | WS access token travels in the upgrade query parameter; log-capture half unverified without the live environment. | [ledger §2 TM-005](../security/MIG-073-findings-ledger.md) at rev f83863f | open | tech-lead: ingress log-redaction / short-lived-token decision in MIG-070 envelope |
| DEF-006 | 2026-10-20 | Sev-3 | IRC transport | IRC connector has no TLS support; plaintext transport between pod and endpoint. | [ledger §2 TM-006](../security/MIG-073-findings-ledger.md) at rev f83863f | open | tech-lead/ops: TLS-terminating endpoint or founder acceptance (E4) |
| DEF-007 | 2026-10-20 | Sev-4 | Prometheus endpoint | Unauthenticated Prometheus scrape surface (metadata-class disclosure; path frozen by ADR-029). | [ledger §2 TM-007](../security/MIG-073-findings-ledger.md) at rev f83863f | open | tech-lead: network protection decision at MIG-070 |
| DEF-008 | 2026-10-20 | Sev-4 | AS public-client refresh | Public-client refresh/revoke authenticates by client id only; documented design posture with named compensating controls. | [ledger §2 TM-008](../security/MIG-073-findings-ledger.md) at rev f83863f | open | Founder visibility only if residual risk is to be accepted (E4) |
| DEF-009 | 2026-10-20 | Sev-4 | Audit persistence | Audit persistence is best-effort (swallowed failures, non-UUID drop); baseline parity. | [ledger §2 TM-009](../security/MIG-073-findings-ledger.md) at rev f83863f | open | Routing note to #366 MIG-091 (E7); kept in ledger |
| DEF-010 | 2026-10-20 | Sev-4 | Reset rate limiter | Password-reset rate limiter keyed on RemoteAddr with in-memory per-instance state. | [ledger §2 TM-010](../security/MIG-073-findings-ledger.md) at rev f83863f | open | Note for MIG-070 ingress topology decision (ADR-029 envelope) |
| DEF-011 | 2026-10-20 | Sev-2 | REST message send | USER reply assignment-bound policy not enforced on POST messages. Remediation merged (PR #443 at f83863f: controller guard + integration test + authorized frozen reconciliation) but source status verbatim: remediated (proposed) — pending the fresh independent reviewer validation, so open here and NOT counted as fixed. | [ledger §2 TM-011](../security/MIG-073-findings-ledger.md) at rev f83863f | open | Fresh independent reviewer assessment + tech-lead AC-MIG-073-2 decision (ledger §3); at the last independently validated revision (4) this was an open Sev-2 |
| DEF-012 | 2026-10-20 | n/a | REST notes create | Adjudicated not-a-finding (tech-lead, 2026-10-20): notes-create matches every accepted record; excluded from finding counts, retained for ID stability. | [ledger §2 TM-012](../security/MIG-073-findings-ledger.md) at rev f83863f | closed | Adjudication: [csim-sg/yacc#367 comment 6291002089](https://github.com/csim-sg/yacc/issues/367#issuecomment-6291002089) |
| DEF-013 | 2026-10-20 | Sev-3 | WS connector relay ops | Connector relay/subscribe ops accept any authenticated session; client-supplied payloads published into conversation rooms (transient, non-persisted; no first-party client emits the ops). | [ledger §2 TM-013](../security/MIG-073-findings-ledger.md) at rev f83863f | open | tech-lead: caller-role gating decision (frozen rows cite-only) |
| DEF-014 | 2026-10-20 | Sev-4 | WS typing/presence identity | Ephemeral typing/presence fan-out trusts client-declared identity (spoofing scope only; documented wire posture). | [ledger §2 TM-014](../security/MIG-073-findings-ledger.md) at rev f83863f | open | tech-lead: hardening backlog (server-side identity binding) |
| DEF-015 | 2026-10-20 | n/a | WS typing receipt | Adjudicated not-a-finding (tech-lead, 2026-10-20): conversation-scoped typing receipt matches the accepted records; excluded from finding counts, retained for ID stability. | [ledger §2 TM-015](../security/MIG-073-findings-ledger.md) at rev f83863f | closed | Adjudication: [csim-sg/yacc#367 comment 6291375868](https://github.com/csim-sg/yacc/issues/367#issuecomment-6291375868) |
| DEF-016 | 2026-10-21 | TBD | Frozen ledger WS cluster | 15 frozen-ledger rows named in the #366 adjudication (WS-OP-CONV-003, WS-OP-MSG-001..004, WS-OP-REACT-001..004, WS-RAW-004/005/014/015/016) carry evidence attributions to tests that never covered them; implementation landed via #444 (merged fd9429d) and the reaction.count capture was corrected via #452, but row-level evidence attribution has not happened. Unassessed cluster, so Sev TBD — each resulting finding is classified by the taxonomy when attributed. All 15 rows are Result: blocked and block cutover by frozen row semantics regardless of severity. | [#366 adjudication 2026-10-21](https://github.com/csim-sg/yacc/issues/366); [frozen ledger](../migration/ledger-mig-003-reconciled.md) (read-only) | open | Attribution: #459 (REST slice) / #460 (WS slice); closure via #461 |
| DEF-017 | 2026-10-21 | TBD | Frozen ledger tail | Remaining 141 of 156 frozen-ledger rows at Result: blocked (pending implementation/attribution evidence per frozen row semantics). Unassessed cluster, so Sev TBD; every blocked row blocks cutover by frozen row semantics regardless of severity. | [frozen ledger row semantics](../migration/ledger-mig-003-reconciled.md) (read-only) | open | Attribution: #459 / #460; closure via #461 |

## 3. Reporting procedure

The dated zero-open report (#461, AC-MIG-091-4) is produced by running the pinned queries below
**verbatim** against the register and pasting their output **unmodified**. The procedure only reads;
it never mutates the register, never adjudicates severity or status, and never waives anything
(taxonomy §6). A report is valid only for the revision it pins.

### 3.1 Pinned register queries

Counts by severity and status:

```bash
awk -F'|' '
  /^\| DEF-/ {
    sev = $4; sub(/^ +/, "", sev); sub(/ +$/, "", sev)
    st  = $8; sub(/^ +/, "", st);  sub(/ +$/, "", st)
    total[sev]++
    if (st == "open")   open[sev]++
    if (st == "fixed")  fixed[sev]++
    if (st == "closed") closed[sev]++
  }
  END {
    n = split("Sev-1 Sev-2 Sev-3 Sev-4 TBD n/a", keys, " ")
    printf "%-8s %6s %6s %6s %6s\n", "severity", "open", "fixed", "closed", "total"
    for (i = 1; i <= n; i++) {
      k = keys[i]
      o = (k in open)   ? open[k]   : 0
      f = (k in fixed)  ? fixed[k]  : 0
      c = (k in closed) ? closed[k] : 0
      t = (k in total)  ? total[k]  : 0
      printf "%-8s %6d %6d %6d %6d\n", k, o, f, c, t
      O += o; F += f; C += c; T += t
    }
    printf "%-8s %6d %6d %6d %6d\n", "TOTAL", O, F, C, T
  }' .docs/qa/defect-register.md
```

List of open Sev-1/Sev-2 rows (empty output means none):

```bash
awk -F'|' '
  /^\| DEF-/ {
    sev = $4; sub(/^ +/, "", sev); sub(/ +$/, "", sev)
    st  = $8; sub(/^ +/, "", st);  sub(/ +$/, "", st)
    id  = $2; sub(/^ +/, "", id);  sub(/ +$/, "", id)
    sf  = $5; sub(/^ +/, "", sf);  sub(/ +$/, "", sf)
    rl  = $9; sub(/^ +/, "", rl);  sub(/ +$/, "", rl)
    if (st == "open" && (sev == "Sev-1" || sev == "Sev-2"))
      printf "%s | %s | %s | %s\n", id, sev, sf, rl
  }' .docs/qa/defect-register.md
```

Frozen-ledger state check (read-only; `grep -c` prints `0` with exit status 1 when the count is
zero — record the printed counts):

```bash
grep -c "| blocked |" .docs/migration/ledger-mig-003-reconciled.md
grep -c "| pass |" .docs/migration/ledger-mig-003-reconciled.md
grep -c "| fail |" .docs/migration/ledger-mig-003-reconciled.md
```

### 3.2 Dated-report format (exact)

```text
## Dated severity report — <YYYY-MM-DD (UTC)>

- Revision of record: <git sha> (git rev-parse HEAD of the evaluated tree)
- Register query output (pinned, run verbatim, unmodified):
  <counts table from §3.1 query 1>
- Open Sev-1/Sev-2 rows (query output; "(none)" if empty):
  <list from §3.1 query 2>
- Frozen-ledger state: blocked=<n> pass=<n> fail=<n> of row_count=156
- Closure statement: <the §3.3 statement, placeholders filled>
```

### 3.3 Closure statement (exact wording — fill only the placeholders)

> Dated closure statement — `<YYYY-MM-DD (UTC)>` @ `<git sha>`: the pinned query over the source of
> record (`.docs/qa/defect-register.md`) returns **0 open Sev-1 and 0 open Sev-2** rows and **0 open
> rows of undetermined (TBD) severity**; by severity: Sev-1 open=0, Sev-2 open=0, Sev-3 open=`<n>`,
> Sev-4 open=`<n>`; fixed=`<n>` and closed=`<n>`, each via the taxonomy's exit rules with linked
> evidence. The frozen ledger (`.docs/migration/ledger-mig-003-reconciled.md` @ `<git sha>`,
> row_count=156) records **0 `fail` and 0 `blocked` rows**. **No waiver was granted or used; no
> severity was reclassified to pass the gate; no deferred acceptance was applied.** Queries were run
> verbatim as pinned; outputs are attached unmodified. This statement is valid only for the pinned
> revision.

## 4. Amendment log (append-only)

- 2026-11-06 — **seed**: register created and seeded (#458) from
  `.docs/security/MIG-073-findings-ledger.md` (revision 5 @ `f83863f`: DEF-001..DEF-015) and the
  frozen-ledger clusters named in the #366 adjudication (DEF-016, DEF-017). Source statuses carried
  verbatim; nothing marked fixed; severities unchanged from the source records (taxonomy §1
  compatibility verified per row). Register state at seed: 15 open, 0 fixed, 2 closed, 17 total;
  open by severity: Sev-2 × 3 (DEF-001, DEF-002, DEF-011), Sev-3 × 5 (DEF-003..DEF-006, DEF-013),
  Sev-4 × 5 (DEF-007..DEF-010, DEF-014), TBD × 2 (DEF-016, DEF-017).

## 5. Seeding provenance (triage of 2026-11-06)

Sources read and how each was triaged (revision of record: `dev` @ `fd9429d`):

- `.docs/security/MIG-073-findings-ledger.md` (revision 5, 2026-10-20, anchored `f83863f`): all
  **15 ledger rows** seeded — 13 findings as DEF-001..DEF-011 and DEF-013/DEF-014, and the 2
  adjudicated not-a-findings (TM-012, TM-015) as closed rows DEF-012/DEF-015 so the register is a
  complete mirror. Statuses and severities are carried verbatim; proposal/candidate dispositions map
  to `open` by the taxonomy §4 rule (DEF-001, DEF-002, DEF-011).
- `.docs/security/MIG-073-threat-model.md` (§5/§6): the severity definitions and outcome record of
  the same review — no additional findings beyond the ledger; its §5 definitions classify unchanged
  under the new taxonomy.
- `.docs/security/BE-003-SECURITY-REVIEW.md`: Node-era (BetterAuth) checklist review of the
  transitional Node POC (dated 2026-02-06, document status "IN PROGRESS"). It contains **no tracked
  open findings** (checklist results and recommendations only), and the Java backend of record was
  separately threat-modeled in MIG-073; the Node POC retires at MIG-080 (#364). Recorded here as a
  triage note — not a register row — with reason: no defect entries to triage.
- `.docs/migration/ledger-mig-003-reconciled.md` (read-only, never edited): 156/156 rows
  `Result: blocked`; the clusters named in the #366 adjudication are DEF-016 (15 rows), the
  remainder DEF-017 (141 rows). Severity `TBD` because the rows are unproven conformance, not
  assessed defects; the frozen row semantics keep every blocked row cutover-blocking regardless of
  register severity.

**Honesty statement**: nothing is marked fixed in this seed; no genuine Sev-1/2 is diluted; no
dated report is claimed and no closure is asserted — the report is #461's deliverable. The register
state above is the conservative reading of the source records as of 2026-11-06.
