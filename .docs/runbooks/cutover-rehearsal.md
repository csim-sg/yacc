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
| P3 | Candidate environment | A **dedicated candidate namespace** `<candidate-namespace>` on kube context `<candidate-context>`, reserved for rehearsal use — **never** a namespace that hosts a live `yacc-backend` release, not production, no shared production credentials. The Step-1 guards fail closed unless the resolved context/namespace/release state is clean. | Ops |
| P4 | Secret material present | Secret *objects* exist in `<candidate-namespace>` (names only; values are never copied into runbooks or evidence): `yacc-backend-secrets` (`DATABASE_URL`), `yacc-auth-secrets` (bootstrap/recovery keys), `yacc-email-secrets`, `yacc-integration-secrets`, `postgresql-credentials` (database credential). | Founder/Ops |
| P5 | Chart + images pinned | Chart at a pinned commit (`<artifact link>`); candidate image tag pinned (`<image-tag>`, never `latest`) **and a distinct forward-fix image** (`<forward-fix-image-tag>` — an immutable tag or digest, **different from `<image-tag>`**, provenance recorded as `<artifact link>`). Step 7 fails closed if the two are not distinct. | Ops |
| P6 | Candidate database | A reachable PostgreSQL instance with the schema migrated, plus a **separate candidate database** `<candidate-database>` (host `<candidate-db-host>`) for the restore test (see [backup-restore.md](backup-restore.md)). The candidate release's `DATABASE_URL` must reference **only** the candidate database — verified by name (never the value) in the Step-1 guards. | Ops |
| P7 | Rehearsal window + stop authority | Window agreed; stop-authority contact named — `<founder to name>` — and reachable for the drill. (Backup/restore consistency does **not** depend on this window — see [backup-restore.md](backup-restore.md) §3.2.) | Founder |

**Stop** if any row is unmet. Record the abort per §4 and in the §3 evidence template, and halt.

---

## 2. Rehearsal sequence (overview)

```
candidate deploy → health gates → backup → restore into candidate DB
  → post-restore integrity checks → stop-authority drill → roll-forward path check
```

Every step records one row in the §3 evidence template.

### Step 1 — Candidate deploy (provably isolated)

The rehearsal installs **its own uniquely named release in a dedicated candidate namespace** (P3). It never upgrades an existing release: `helm install` (not `upgrade --install`) is used deliberately — Helm refuses to create a release whose name is already in use, so this step **cannot modify an active deployment**. All release-scoped resources are named after `<candidate-release>` by the chart (`fullname` template), e.g. `deployment/<candidate-release>`, `svc/<candidate-release>` — nothing collides with the live `yacc-backend` release.

Run every guard first. **Any guard failure aborts the rehearsal (§4)** — never "work around" a guard by picking a different context/namespace/release:

```bash
# G1 — expected cluster context (fail closed)
test "$(kubectl config current-context)" = "<candidate-context>" \
  || { echo "ABORT: wrong cluster context — refusing to deploy"; exit 1; }

# G2 — no live release/deployment in the candidate namespace (fail closed)
helm status yacc-backend -n <candidate-namespace> >/dev/null 2>&1 \
  && { echo "ABORT: live release 'yacc-backend' present in <candidate-namespace>"; exit 1; }
kubectl get deployment yacc-backend -n <candidate-namespace> >/dev/null 2>&1 \
  && { echo "ABORT: live deployment 'yacc-backend' present in <candidate-namespace>"; exit 1; }

# G3 — candidate release name is unique and is not the live release name (fail closed)
test "<candidate-release>" != "yacc-backend" \
  || { echo "ABORT: candidate release name must differ from the live release"; exit 1; }
helm status <candidate-release> -n <candidate-namespace> >/dev/null 2>&1 \
  && { echo "ABORT: candidate release name already in use"; exit 1; }

# G4 — candidate release points at the candidate database (names only; the value is never printed or recorded)
CAND_DB_URL="$(kubectl get secret yacc-backend-secrets -n <candidate-namespace> \
  -o jsonpath='{.data.DATABASE_URL}' | base64 -d)"
printf '%s' "$CAND_DB_URL" | grep -Eq '^(jdbc:)?postgresql://<candidate-db-host>(:[0-9]+)?/<candidate-database>' \
  || { echo "ABORT: candidate DATABASE_URL must target the candidate database <candidate-database>"; exit 1; }
unset CAND_DB_URL
```

Only when **all four guards pass**:

```bash
helm install <candidate-release> ./deploy/helm/yacc-backend \
  -n <candidate-namespace> \
  -f deploy/helm/yacc-backend/values-staging.yaml \
  --set image.tag=<image-tag>
kubectl rollout status deployment/<candidate-release> -n <candidate-namespace> --timeout=2m
```

(Using `-f deploy/helm/yacc-backend/values-staging.yaml` follows the documented staging values convention — see `.docs/DEPLOYMENT-GUIDE-MVP.md`; candidate-specific overrides are set explicitly, e.g. the candidate image pin above.)

### Step 2 — Health gates

The frozen actuator wire paths are `/health/live` and `/health/ready` (ADR-029):

```bash
kubectl port-forward -n <candidate-namespace> svc/<candidate-release> 8080:8080 &
sleep 2
curl -i http://localhost:8080/health/live   # expect 200
curl -i http://localhost:8080/health/ready  # expect 200
kill %1
```

**Gate**: both 200 before proceeding. Red gate ⇒ abort per §4.

### Step 3 — Backup

Execute the backup per [backup-restore.md](backup-restore.md) §3 (snapshot-consistent baseline capture + `pg_dump` custom format). Record the dump artifact as `<artifact link>`.

**Gate**: backup completes and its artifact is storable/retrievable in the `<environment>` storage location.

### Step 4 — Restore into a candidate database

Execute the restore per [backup-restore.md](backup-restore.md) §4–5 into the **candidate database** (P6) — never into the database the candidate deployment is serving. Single-replica posture (ADR-029): an in-place restore is full backend downtime; the rehearsal avoids it by design.

### Step 5 — Post-restore integrity checks

Run the verification queries from [backup-restore.md](backup-restore.md) §5 against the candidate database and compare against the source captures from [backup-restore.md](backup-restore.md) §3.2 (taken from the same MVCC snapshot as the dump):

- `flyway_schema_history` versions/success flags match the source snapshot baseline (ADR-027 schema state).
- Exact row counts of the key tables match the same-snapshot baseline (see [backup-restore.md](backup-restore.md) §3.2 for why separate live queries are never used).
- No step modifies the restored data — checks are read-only.

**Gate**: all checks match. Mismatch ⇒ abort per §4; do not proceed with a partial match.

### Step 6 — Stop-authority drill

The drill exercises the **decision and call sequence**, using the escalation matrix documented in [helm-rollback.md](helm-rollback.md#stop-authority--escalation) (Level 1 on-call → Level 2 DevOps lead → Level 3 founder):

1. Presenter states a rehearsed stop condition (e.g. "suspected data loss during rehearsal step N").
2. Level-1 actor classifies it against the trigger list and escalates (record: who, when, why).
3. Level-3 stop authority — `<founder to name>` — issues an **explicit, recorded stop** ("halt deploys/traffic").
4. The halt is confirmed (no new deploys; traffic decision recorded) and the drill ends with an explicit resume decision, recorded the same way.

Stop authority is exercised by the named human. It is never simulated, pre-filled, or attributed to an agent. The drill passes only if the decision, call, and halt are all evidenced in §3 rows.

### Step 7 — Roll-forward path check

Validate the documented incident path end-to-end (forward fix, **not** `helm rollback`). A forward fix means deploying a **new image** — re-applying the candidate `<image-tag>` would only re-install the same release and prove nothing about the roll-forward path, so this step uses the **distinct forward-fix image pinned in P5** and fails closed if it is not distinct:

```bash
# Fail closed: the forward-fix image must be distinct from the candidate image (P5)
test "<forward-fix-image-tag>" != "<image-tag>" \
  || { echo "ABORT: forward-fix image must differ from the candidate image"; exit 1; }

helm history <candidate-release> -n <candidate-namespace>      # audit trail present
helm upgrade <candidate-release> ./deploy/helm/yacc-backend \
  -n <candidate-namespace> \
  -f deploy/helm/yacc-backend/values-staging.yaml \
  --set image.tag=<forward-fix-image-tag>                      # forward fix = new image, rehearsal-owned release only
kubectl rollout status deployment/<candidate-release> -n <candidate-namespace> --timeout=2m
```

`helm upgrade` here targets **only the rehearsal's own candidate release** (created in Step 1 under the G1–G4 guards) — it can never touch a live release, which does not exist in `<candidate-namespace>` by construction.

Re-run the §Step-2 health gates. **Gate**: both 200; `helm history` shows a **new revision whose recorded image is `<forward-fix-image-tag>`** — the check passes only if a distinct image was rolled forward and is healthy.

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
- Any Step-1 guard fails: wrong cluster context, a live `yacc-backend` release/deployment present in the target namespace, a release-name collision, or the candidate `DATABASE_URL` not targeting `<candidate-database>`.
- §Step-2 health gates are red after the candidate deploy or the roll-forward check.
- The backup fails, or cannot be stored/retrieved in the `<environment>` storage location.
- Any §Step-5 integrity check does not match the same-snapshot source capture.
- The roll-forward check cannot use a forward-fix image distinct from `<image-tag>`.
- Any operation would touch resources outside the rehearsal's candidate scope (wrong namespace, wrong database, production-carrying cluster credentials).
- A destructive step (reset, recovery drill, cutover) is proposed — those belong to MIG-071 (#362) / MIG-072 (#363), not here.

On abort: do not attempt in-place repairs beyond restoring the candidate environment to its pre-rehearsal state; report to the named owner (`<founder to name>`); no partial pass may be claimed.

---

## 5. What not to do

- **No `helm rollback` after a forward migration.** The schema is forward-only (ADR-027); a rolled-back image against a forward-migrated database is undefined. Recovery is roll-forward only — see [helm-rollback.md](helm-rollback.md).
- **No targeting of a live release or namespace.** The rehearsal uses only its own `<candidate-release>` in `<candidate-namespace>` (Step-1 guards). Never run `helm upgrade --install` against the `yacc-backend` release name or any pre-existing release, never point the candidate release at a live/shared database, and never reuse the live release's namespace as `<candidate-namespace>`.
- **No reset, recovery drill, or key rotation here** — that is MIG-071 (#362).
- **No production cutover step here** — that is MIG-072 (#363), founder-governed.
- **No HA assumptions.** The acceptance posture is a single replica/instance (ADR-029); no second instance exists for failover.
- **No secret values in evidence.** Reference secret names/keys only.
- **No attribution shortcuts.** Every record names the human who executed it; CI green is not substitute evidence for #361's attributable records.

---

## 6. After the rehearsal

1. Complete every §3 row; attach artifact links.
2. Link the completed evidence from **MIG-070 (#361)** — the rehearsal passes there, not here.
3. Record deviations as follow-ups on #361 (or bounded issues, tech-lead's call); this document is updated by PR when the procedure itself needs correction.

---

**Last Updated**: 2026-10-21 (authored by MIG-070b #447; review rework same day — procedure only; no execution claimed)
