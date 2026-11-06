# Severity Taxonomy (SPEC-002)

**Version**: 1.0.0 (2026-11-06) · **Issue**: csim-sg/yacc#458 (MIG-091f) · **Parent**: csim-sg/yacc#366 (AC-MIG-091-4)
**Source of record**: [`.docs/qa/defect-register.md`](defect-register.md) (see §2) · **Consumed by**: #461 (dated zero-open report), #363 (MIG-072 founder acceptance gate, AC-MIG-072-3)

---

## 1. Purpose and scope

This document defines severity levels **Sev-1..Sev-4** for defects found on any SPEC-002 surface —
authentication/identity, RBAC and status enforcement, data durability (loss/corruption), contract
conformance against the frozen `.docs/migration/**` contracts (ADR-023), security exposure, raw
WebSocket real-time delivery, and irreversible-operation safety (cutover/reset) — so that
"zero open Sev-1/2" is a decidable evaluation over evidence, not a judgement call.

Each criterion is written as a "this is Sev-N if …" test that a reviewer can apply to the recorded
evidence without debate. A defect is classified at the **strongest** level any of whose criteria it
meets (a defect meeting a Sev-1 criterion is Sev-1 even if it also matches Sev-3 wording).

Relationship to the MIG-073 threat model: `MIG-073-threat-model.md` §5 scopes severity to
threat-model findings only. This taxonomy is the phase/test-wide taxonomy those definitions
anticipated. **Compatibility rule**: every severity recorded in an existing accepted record
(including the MIG-073 findings ledger) classifies unchanged under this taxonomy; the register seed
verifies this per row. This taxonomy never retroactively reclassifies a recorded finding downward.

## 2. Source of record

**[`.docs/qa/defect-register.md`](defect-register.md) is the named source of record** for defect
severity state in SPEC-002 — the source evaluated by the AC-MIG-091-4 dated report and the
AC-03 / MIG-072 zero-open gate. GitHub issues and labels are linked context, not the source.

Detailed ledgers keep their own roles: the MIG-073 findings ledger remains the security domain's
detailed adjudication record, and the frozen `.docs/migration/ledger-mig-003-reconciled.md` remains
the binding conformance scope ceiling. Register entries sourced from those ledgers link to them as
evidence; a divergence between the register and a linked source record is itself a defect and is
triaged into the register.

## 3. Severity definitions (decidable entry criteria)

### Sev-1 — a defect is Sev-1 if any of the following holds

1. **Unauthenticated exploitation.** A remote attacker without credentials can reach a protected
   operation or platform data (authentication bypass; an endpoint or WS operation reachable
   without the authentication its frozen contract documents).
2. **Identity/token/key fabric break.** Forgery or wrongful acceptance of tokens; exposure of
   secret or private-key material (in responses, logs, error paths, or the repository); privilege
   escalation across identities (a principal exercising a role it does not hold, including
   escalation to SUPER_ADMIN).
3. **Data loss or corruption without documented recovery.** A write the service acknowledged as
   successful is not durably persisted, or persisted platform data reads back differently from the
   accepted write, and recovery is not achievable through the documented backup/restore procedure
   (`backup-restore.md`).
4. **Injection crossing a trust boundary into execution.** Attacker-controlled input changes an
   executed statement or command (SQL, command, template) or a file path actually operated on.
5. **Irreversible-operation safety failure.** A documented irreversible operation (full-reset
   cutover, destructive reset) executes without its required authorized trigger, outside its
   governed procedure, or without its documented safety interlock.
6. **Contract-drift escalation.** A verified divergence from the frozen contracts whose affected
   surface independently meets any Sev-1 test above (e.g., frozen-documented authentication absent
   in the implementation).

### Sev-2 — a defect is Sev-2 if it is not Sev-1 and any of the following holds

1. **Authorization-boundary exceed.** An authenticated principal can read or modify platform data
   beyond the accepted RBAC/status/assignment boundary — cross-role, cross-scope, or cross-boundary
   access; or a status-denied identity (`inactive`/`suspended`) successfully uses a protected
   surface; or an outbound customer-facing gateway dispatch (Telegram/IRC send) occurs outside the
   documented routing/assignment policy.
2. **Control fails its documented policy.** A security control demonstrably does not enforce the
   policy its accepted records document, where a plausible attack path exists.
3. **Contract drift (floor).** Any verified behavioral divergence from the frozen
   `.docs/migration/**` contracts (openapi/asyncapi/schemas) not meeting a Sev-1 test.
   **Contract drift is Sev-1 or Sev-2 by rule (ADR-023)** — it is never classified Sev-3/Sev-4.
4. **Real-time delivery loss.** An event whose delivery the frozen AsyncAPI requires (message
   fan-out to a joined room, delivery ack/error relays, platform-status broadcasts) is not
   delivered to an eligible connected subscriber, and no documented degradation or backpressure
   semantics cover the case. (Ephemeral typing/presence events are best-effort by their frozen
   definitions and do not qualify under this clause.)

Sev-1 and Sev-2 findings **block cutover** (SPEC AC-03; no waiver — §6).

### Sev-3 — a defect is Sev-3 if it is not Sev-1/Sev-2 and any of the following holds

1. **Restricted-precondition weakness.** Exploitation or failure requires a materially restricted
   precondition — network position, pod/cluster access, operator error — or exposes only metadata
   beyond what the deployment envelope protects.
2. **Fail-closed availability defect.** A security-, delivery-, or durability-relevant control
   fails closed through the documented deployment path (refuses to boot / cannot execute), so the
   control is unavailable without creating a direct exposure.
3. **Bounded integrity/delivery defect.** Data-integrity or real-time deviation that is detectable
   and recoverable, but only through documented manual intervention, or degradation that the
   documented best-effort/backpressure semantics do cover.

### Sev-4 — a defect is Sev-4 if it is not Sev-1/2/3 and any of the following holds

1. **Documented-by-design posture** with named compensating controls and no plausible
   confidentiality/integrity impact under the stated deployment envelope (ADR-029).
2. **Hardening opportunity** — robustness, hygiene, or best-effort weakness in a non-critical path
   (e.g., best-effort audit persistence, in-memory limiter state under the single-instance
   envelope) with no plausible platform-data impact.
3. **Cosmetic or observability noise** with no functional, data, or security effect.

Severity assignment must cite the matched criterion number and the evidence anchor (file/test/commit
or record). "Restricted precondition" (Sev-3) is decidable by the record: the entry names the
precondition class from this list; a precondition not on the list is argued in the entry, not assumed.

## 4. Entry rules (when a finding becomes a register entry)

- A finding that meets any criterion in §3 is entered in [`.docs/qa/defect-register.md`](defect-register.md)
  with: stable ID (`DEF-NNN`, **never reused**), date, severity, surface, description, evidence
  link, and status `open`.
- **Contract drift is entered by rule**: a verified frozen-contract divergence is registered at
  Sev-2 minimum (Sev-1 via criterion 1.6) without further debate; only whether it is Sev-1 or Sev-2
  is decided by the criteria.
- Sources already recorded in the repository (e.g., the MIG-073 findings ledger) are seeded into the
  register; new rows appearing in a source ledger after seeding also get register entries.
- **Status mapping for sourced rows (decidable, no self-adjudication)**: a register row sourced from
  a ledger keeps status `open` while the source record's disposition is a proposal or a candidate
  (`remediated (proposed)`, `resolved-policy (candidate)`, or any unadjudicated state). Only an
  adjudicated closure or a validated remediation in the source record permits the register status
  change (§5). This mapping is mechanical; the entry carries the source's exact status verbatim so
  nothing is hidden.

## 5. Exit rules (how a row stops being open)

- **`fixed`** requires both: (a) a linked fix (commit/PR) and (b) a linked test or contract test
  that fails without the fix and passes with it. For rows sourced from the MIG-073 ledger, the
  additional bar is that ledger's own rule: the register row flips to `fixed` only when the source
  ledger records a **validated** remediation (independent reviewer validation plus the recorded
  AC decision) — a `remediated (proposed)` proposal alone never flips the register row.
- **`closed`** requires an adjudicated disposition in the source record by its named authority
  (for security findings: independent reviewer/tech-lead adjudication; policy resolutions and any
  residual acceptance are founder-only decisions). An adjudicated `not-a-finding` is recorded
  `closed` with severity `n/a` and the adjudication link.
- **Downgrades / severity corrections** are recorded re-triage events only: named authority
  (tech-lead for SPEC-002 gate purposes; the source ledger's own authority where one exists),
  evidence cited, dated line in the register's amendment log. Severity is never changed as part of
  running a report, and never changed to pass a gate.
- Every status or severity change updates the row cell **and** appends a dated amendment-log line
  (append-and-link, no history rewrite; IDs are never reused or deleted).

## 6. No-waiver rule

> **No severity may be waived to pass a gate.** There is a hard prohibition on waivers and deferred
> acceptance: no Sev-1/Sev-2 finding may be waived, deferred, downgraded for convenience, or
> accepted as residual risk to satisfy SPEC AC-03, AC-MIG-091-4, or the MIG-072 cutover gate, and
> the register defines no waiver status. Independently of register severity, the frozen ledger's own
> closure rule applies verbatim: **a `fail` or `blocked` row in
> `.docs/migration/ledger-mig-003-reconciled.md` at MIG-072 prevents founder acceptance and
> cutover.** The only ways a register row stops being open are the exit rules in §5.

This wording is consistent with SPEC AC-03 ("zero open severity-1/2 defects (no waivers) … a hard
prohibition on waivers or deferred acceptance; a failed or blocked ledger row prevents founder
acceptance and cutover") and with the MIG-073 records ("Sev-1/Sev-2 findings block cutover
(no waiver)").

## 7. Reporting

The dated-report procedure — the pinned register query, the exact report format, and the exact
closure statement — lives in [`.docs/qa/defect-register.md`](defect-register.md), § Reporting
procedure. #461 produces the report; no report is claimed by this taxonomy.
