# PostgreSQL Backup & Restore — `backup-restore.md`

**Status**: Documented procedure (MIG-070b #447). **Not evidence of execution.**
**Audience**: Operations/SRE, the named cutover/reset owner
**Source issue**: https://github.com/csim-sg/yacc/issues/447
**Related**: [cutover-rehearsal.md](cutover-rehearsal.md) · [helm-rollback.md](helm-rollback.md) · ADR-027 (Flyway + JPA; forward-only schema) · ADR-028 (Quartz + DB DLQ; Redis dropped)

> **Scope**: PostgreSQL logical backup and restore for the Java backend's single datastore. ADR-028 removed Redis entirely (Quartz is DB-backed, DLQ is a DB table), so **PostgreSQL is the only stateful component to back up**.
>
> **This is disaster recovery, not rollback.** The Flyway schema is forward-only (ADR-027); a restore recovers a prior consistent data state, and the service then migrates forward again on boot. A restore is **never** the response to a bad release — that is roll-forward, per [helm-rollback.md](helm-rollback.md).

---

## 1. References used (names only — no values)

- **App DB connection**: Secret `yacc-backend-secrets`, key `DATABASE_URL` (the deployment contract wired by `deploy/helm/yacc-backend`).
- **Database credential**: Secret `postgresql-credentials` (`existingSecret` in the chart values).
- **PostgreSQL service name**: `postgresql` (the chart's documented `postgresql.host` value) in `<environment>`.
- **Schema state**: `flyway_schema_history` (Flyway-managed; ADR-027).
- **Storage location / retention**: `<environment>`-owned — `<founder to name>` decides location and retention period; recorded on #361, not in this document.

**Never** print, log, or copy credential values into evidence artifacts. Reference secret names/keys only.

---

## 2. Expected downtime

- **Rehearsal / planned restore**: restores target a **candidate database**, so the running deployment has **no downtime**.
- **In-place disaster restore**: the acceptance posture is a **single replica** (ADR-029) — during an in-place restore the backend is fully unavailable for the restore duration. Measure and record actual duration in the evidence template; there is no second instance to fail over to.

---

## 3. Backup procedure

### 3.1 Pre-backup checks

- [ ] `/health/live` and `/health/ready` return 200 (see [cutover-rehearsal.md](cutover-rehearsal.md) Step 2) — back up a healthy service.
- [ ] PostgreSQL client tools ≥ 12 (`psql`/`pg_dump --version`) — `pg_export_snapshot()` and `pg_dump --snapshot` require them (the service runs on PostgreSQL 15).
- [ ] Target database is the intended one (check the current `DATABASE_URL` **host/database portion only**, without printing credentials).
- [ ] Storage location for `<artifact link>` is reachable and has space.
- [ ] Actor and UTC timestamp noted for the evidence record.

### 3.2 Capture a consistent source baseline (one snapshot for counts and dump)

`pg_dump` always reads through a single MVCC snapshot, so a dump is internally consistent by construction. The **comparison baseline must come from that same snapshot** — counts collected in separate live queries before or after the dump are not comparable: a write landing between capture and dump makes a correct backup look corrupt (or hides real corruption). This procedure therefore exports **one** snapshot, captures the counts through it, and dumps through the same snapshot.

**Expected write posture**: writes on the source may continue throughout — consistency comes from MVCC, not from quiescing the service. No maintenance window or downtime is required. (If snapshot export is unavailable in the target environment, an approved maintenance/read-only window with explicit stop authority is the alternative — counts must then be captured inside the window, before the dump.)

**Prerequisites**: two connections to the **same** source database, authenticated as the **same database role** (same `DATABASE_URL` — PostgreSQL only allows a snapshot to be reused by the exporting role); the exporting session stays open until the dump finishes.

Resolve the source connection first:

```bash
export YACC_DB_URL="$(kubectl get secret yacc-backend-secrets -n <environment> \
  -o jsonpath='{.data.DATABASE_URL}' | base64 -d)"
# libpq tools take a postgresql:// URL; strip the jdbc: prefix if present
case "$YACC_DB_URL" in
  jdbc:*) export PGURL="postgresql://${YACC_DB_URL#jdbc:postgresql://}" ;;
  *)      export PGURL="$YACC_DB_URL" ;;
esac
```

**Terminal 1 — open the snapshot session; keep it open until §3.3 finishes:**

```
psql "$PGURL"
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT pg_export_snapshot();   -- record the returned id in <artifact-link>/source-snapshot-id.txt
-- leave this session OPEN — do NOT exit — until the §3.3 dump has completed
```

**Terminal 2 — run the §3.3 dump through that snapshot id.**

**Terminal 1 — after the dump completes, capture the baseline from the same snapshot, then close the session:**

```
-- Schema state (versions + success flags)
\o <artifact-link>/source-flyway-history.txt
SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank;
\o
-- Row-count baseline: exact counts of the key tables, from the same snapshot as the dump
\o <artifact-link>/source-exact-counts.txt
SELECT 'users', count(*) FROM users UNION ALL SELECT 'conversations', count(*) FROM conversations UNION ALL SELECT 'messages', count(*) FROM messages;
\o
COMMIT;
\q
```

Capture order matters: `pg_export_snapshot()` first (it fixes the transaction snapshot), the dump while the session is still open, the counts last — all three then observe the identical data state. Approximate planner statistics (`pg_stat_user_tables`) are **not** captured and are **not** a verification gate (§5); only exact counts are.

### 3.3 Backup (custom format, through the §3.2 snapshot)

```bash
pg_dump --format=custom --no-owner --no-privileges \
  --snapshot="$(cat <artifact-link>/source-snapshot-id.txt)" \
  --file=<artifact-link>/yacc-db-$(date -u +%Y%m%dT%H%M%SZ).dump "$PGURL"
```

- Run while the Terminal-1 session from §3.2 is still open — the exported snapshot exists only until that transaction ends.
- `--snapshot` makes the dump read through the exact snapshot the §3.2 counts were taken from, so baseline and dump are provably the same data state.
- Custom format (`.dump`) supports `pg_restore` selective/parallel restore and compressed storage.
- `--no-owner --no-privileges` so the restore does not depend on matching role names.
- Record the dump file as `<artifact link>`; store it in the `<environment>` storage location with the agreed retention.

### 3.4 Backup failure handling

- `pg_dump` exits non-zero ⇒ **no backup exists**; fix the cause (connectivity, disk, permissions) and re-run. Do not mark a partial dump as a backup.
- Dump succeeded but cannot be stored/retrieved ⇒ treat as failed (a backup that cannot be restored to is not a backup).
- Abort per [cutover-rehearsal.md](cutover-rehearsal.md) §4 if the backup gate cannot be met.

---

## 4. Restore into a candidate database

**Rule**: restore into a **separate candidate database**, never into a database a running deployment is serving (single-replica posture makes in-place restore full downtime — see §2).

```bash
# 4.1 Candidate connection (admin/database-create rights in <environment>)
export CAND_URL="<postgres-admin-connection-with-candidate-database>"

# 4.2 Restore the dump into the candidate database
pg_restore --dbname="$CAND_URL" --no-owner --no-privileges --exit-on-error \
  <artifact-link>/yacc-db-<timestamp>.dump
```

- `--exit-on-error` stops on the first error so a failed restore is never mistaken for a complete one.
- If the candidate database must be recreated first: drop/recreate it via the `<environment>` admin path, then re-run `pg_restore`.
- **Failure handling**: any `pg_restore` error ⇒ drop the candidate database, fix the cause, restart from §3 (a clean re-restore from a verified dump; never patch a half-restored database by hand).

---

## 5. Post-restore verification (read-only)

Run against the **candidate** connection and compare with the §3.2 snapshot captures:

```bash
# Schema version state must match the source baseline exactly (ADR-027)
psql "$CAND_URL" -c "SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank;" \
  > <artifact-link>/restored-flyway-history.txt

# Exact counts of the key tables in the restored database
psql "$CAND_URL" -Atc "SELECT 'users', count(*) FROM users UNION ALL SELECT 'conversations', count(*) FROM conversations UNION ALL SELECT 'messages', count(*) FROM messages;" \
  > <artifact-link>/restored-exact-counts.txt

diff <artifact-link>/source-flyway-history.txt <artifact-link>/restored-flyway-history.txt
diff <artifact-link>/source-exact-counts.txt   <artifact-link>/restored-exact-counts.txt
```

Verification gate (all must hold):

- [ ] `flyway_schema_history` rows identical to `source-flyway-history.txt` (same versions, all `success`).
- [ ] Exact counts identical to `source-exact-counts.txt` — both files were captured from the same MVCC snapshot as the dump (§3.2), so an exact match proves the restore faithfully reproduced the dumped state.
- [ ] No rows were modified during verification (all queries read-only).

Writes that hit the source **after** the §3.2 snapshot are expected and are **not** a failure — the comparison validates restore fidelity against the dumped state, not live-source equality. Approximate statistics (`pg_stat_user_tables`) are not a gate and are not consulted.

Any mismatch ⇒ **fail**: do not proceed; abort per [cutover-rehearsal.md](cutover-rehearsal.md) §4 and keep the dump artifact for diagnosis.

*Optional app-level check (if wired in `<environment>`)*: point a throwaway candidate deployment at the restored database and confirm `/health/live` + `/health/ready` — this proves the restored state boots and passes Flyway's startup validation. Record as an extra evidence row; it is not a substitute for the SQL checks above.

---

## 6. Restore time objective

Record actual backup and restore durations in the evidence template each time the procedure runs. There is no committed RTO/RPO number yet; establishing one is part of **MIG-070 (#361)**'s rehearsal evidence, not something this document can assert.

---

**Last Updated**: 2026-10-21 (authored by MIG-070b #447; review rework same day — procedure only; no execution claimed)
