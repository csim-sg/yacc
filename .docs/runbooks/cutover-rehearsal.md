# Cutover Rehearsal Procedure — `cutover-rehearsal.md`

**Status**: Documented procedure (MIG-070b #447). **Not evidence of execution.**
**Audience**: Operations/SRE, the named cutover/reset owner, the three named developers
**Source issue**: https://github.com/csim-sg/yacc/issues/447
**Related**: [backup-restore.md](backup-restore.md) · [helm-rollback.md](helm-rollback.md) · ADR-029 (deployment envelope) · ADR-027 (Flyway, forward-only) · ADR-028 (Quartz + DB DLQ; no Redis)

> **This is a procedure, not evidence.** Nothing in this document asserts that a rehearsal, deploy, backup, restore, or drill has happened. The rehearsal execution, the attributable developer records (AC-MIG-070-3/4), and the stop-authority exercise are owned by **MIG-070 (#361)** — this document only defines how they are performed and recorded.
>
> **Rehearsal ≠ production cutover.** The rehearsal runs in a candidate environment against candidate resources. The production cutover is **MIG-072 (#363)** and is founder-governed; no step here authorizes or performs it.

---

## 1. Preconditions (all must hold before starting)

| # | Item | Requirement | Owner |
| - | ---- | ----------- | ----- |
| P1 | Cutover/reset owner | **Named** — `<founder to name>`. The rehearsal does not start without a name recorded on #361 (forward-risk guardrail). | Founder |
| P2 | Three named developers | For AC-MIG-070-3/4 attributable records — `<founder to name>` ×3, with repo + `<environment>` access. | Founder |
| P3 | Candidate environment | Namespace/environment `<environment>` exists and is authorized for rehearsal use (not production, not shared production credentials). | Ops |
| P4 | Secret material present | Secret *objects* exist in `<environment>` (names only; values are never copied into runbooks or evidence): `yacc-backend-secrets` (`DATABASE_URL`), `yacc-auth-secrets` (bootstrap/recovery keys), `yacc-email-secrets`, `yacc-integration-secrets`, `postgresql-credentials` (database credential). | Founder/Ops |
| P5 | Chart + image pinned | Chart at a pinned commit (`<artifact link>`); image tag pinned (`<image-tag>`, never `latest`). | Ops |
| P6 | Candidate database | A reachable PostgreSQL instance in `<environment>` with the schema migrated, plus a **separate candidate database** for the restore test (see [backup-restore.md](backup-restore.md)). | Ops |
| P7 | Maintenance window + stop authority | Window agreed; stop-authority contact named — `<founder to name>` — and reachable for the drill. | Founder |

**Stop** if any row is unmet. Record the abort in §7 and halt.

---

## 2. Rehearsal sequence (overview)

```
candidate deploy → health gates → backup → restore into candidate DB
  → post-restore integrity checks → stop-authority drill → roll-forward path check
```

Every step records one row in the §7 evidence template.

### Step 1 — Candidate deploy

```bash
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n <environment> \
  -f deploy/helm/yacc-backend/values-staging.yaml \
  --set image.tag=<image-tag>
kubectl rollout status deployment/yacc-backend -n <environment> --timeout=2m
```

### Step 2 — Health gates

The frozen actuator wire paths are `/health/live` and `/health/ready` (ADR-029):

```bash
kubectl port-forward -n <environment> svc/yacc-backend 8080:8080 &
sleep 2
curl -i http://localhost:8080/health/live   # expect 200
curl -i http://localhost:8080/health/ready  # expect 200
kill %1
```

**Gate**: both 200 before proceeding. Red gate ⇒ abort per §6.

### Step 3 — Backup

Execute the backup per [backup-restore.md](backup-restore.md) §3 (pre-backup checks + `pg_dump` custom format). Record the dump artifact as `<artifact link>`.

**Gate**: backup completes and its artifact is storable/retrievable in the `<environment>` storage location.

### Step 4 — Restore into a candidate database

Execute the restore per [backup-restore.md](backup-restore.md) §4–5 into the **candidate database** (P6) — never into the database the candidate deployment is serving. Single-replica posture (ADR-029): an in-place restore is full backend downtime; the rehearsal avoids it by design.

### Step 5 — Post-restore integrity checks

Run the verification queries from [backup-restore.md](backup-restore.md) §5 against the candidate database and compare against the source captures:

- `flyway_schema_history` versions/success flags match the source database (ADR-027 schema state).
- Row-count comparison matches the pre-backup capture (estimates + targeted exact counts).
- No step modifies the restored data — checks are read-only.

**Gate**: all checks match. Mismatch ⇒ abort per §6; do not proceed with a partial match.

### Step 6 — Stop-authority drill

The drill exercises the **decision and call sequence**, using the escalation matrix documented in [helm-rollback.md](helm-rollback.md#stop-authority--escalation) (Level 1 on-call → Level 2 DevOps lead → Level 3 founder):

1. Presenter states a rehearsed stop condition (e.g. "suspected data loss during rehearsal step N").
2. Level-1 actor classifies it against the trigger list and escalates (record: who, when, why).
3. Level-3 stop authority — `<founder to name>` — issues an **explicit, recorded stop** ("halt deploys/traffic").
4. The halt is confirmed (no new deploys; traffic decision recorded) and the drill ends with an explicit resume decision, recorded the same way.

Stop authority is exercised by the named human. It is never simulated, pre-filled, or attributed to an agent. The drill passes only if the decision, call, and halt are all evidenced in §7 rows.

### Step 7 — Roll-forward path check

Validate the documented incident path end-to-end (forward fix, **not** `helm rollback`):

```bash
helm history yacc-backend -n <environment>                      # audit trail present
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n <environment> \
  -f deploy/helm/yacc-backend/values-staging.yaml \
  --set image.tag=<image-tag>                                   # forward fix shape
kubectl rollout status deployment/yacc-backend -n <environment> --timeout=2m
```

Re-run the §Step-2 health gates. **Gate**: both 200; `helm history` shows the new revision with actor/tag recorded.

---

## 3. Evidence-record template

One row per step, filled at execution time by the actor. **All fields start empty** — this template is unusable as "proof" until a human fills it. The same template records the three attributable build/test records and three attributable deploy-or-operate records defined by #361 (AC-MIG-070-3/4).

| # | Step | Actor (role) | Actor (name) | Timestamp (UTC) | Command / procedure | Artifact link | Pass/Fail | Deviations |
| - | ---- | ------------ | ------------ | --------------- | ------------------- | ------------- | --------- | ---------- |
| 1 | Candidate deploy | `<role>` | `<name>` | | | | | |
| 2 | Health gates | `<role>` | `<name>` | | | | | |
| 3 | Backup | `<role>` | `<name>` | | | | | |
| 4 | Restore to candidate DB | `<role>` | `<name>` | | | | | |
| 5 | Integrity checks | `<role>` | `<name>` | | | | | |
| 6 | Stop-authority drill | `<role>` | `<name>` | | | | | |
| 7 | Roll-forward path check | `<role>` | `<name>` | | | | | |

Rules: timestamps in UTC; deviations recorded, never silently normalized; secret values never appear in artifacts; empty rows mean the step did not happen.

---

## 4. Abort criteria

Abort the rehearsal immediately if any of these occurs, record the rows filled so far, and halt:

- Any §1 precondition is unmet or lapses mid-rehearsal (especially: stop-authority contact unreachable).
- §Step-2 health gates are red after the candidate deploy or the roll-forward check.
- The backup fails, or cannot be stored/retrieved in the `<environment>` storage location.
- Any §Step-5 integrity check does not match the source capture.
- Any operation would touch resources outside the rehearsal's candidate scope (wrong namespace, wrong database, production-carrying cluster credentials).
- A destructive step (reset, recovery drill, cutover) is proposed — those belong to MIG-071 (#362) / MIG-072 (#363), not here.

On abort: do not attempt in-place repairs beyond restoring the candidate environment to its pre-rehearsal state; report to the named owner (`<founder to name>`); no partial pass may be claimed.

---

## 5. What not to do

- **No `helm rollback` after a forward migration.** The schema is forward-only (ADR-027); a rolled-back image against a forward-migrated database is undefined. Recovery is roll-forward only — see [helm-rollback.md](helm-rollback.md).
- **No reset, recovery drill, or key rotation here** — that is MIG-071 (#362).
- **No production cutover step here** — that is MIG-072 (#363), founder-governed.
- **No HA assumptions.** The acceptance posture is a single replica/instance (ADR-029); no second instance exists for failover.
- **No secret values in evidence.** Reference secret names/keys only.
- **No attribution shortcuts.** Every record names the human who executed it; CI green is not substitute evidence for #361's attributable records.

---

## 6. After the rehearsal

1. Complete every §7 row; attach artifact links.
2. Link the completed evidence from **MIG-070 (#361)** — the rehearsal passes there, not here.
3. Record deviations as follow-ups on #361 (or bounded issues, tech-lead's call); this document is updated by PR when the procedure itself needs correction.

---

**Last Updated**: 2026-10-21 (authored by MIG-070b #447 — procedure only; no execution claimed)
