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
- [ ] Target database is the intended one (check the current `DATABASE_URL` **host/database portion only**, without printing credentials).
- [ ] Storage location for `<artifact link>` is reachable and has space.
- [ ] Actor and UTC timestamp noted for the evidence record.

### 3.2 Capture the source state (for later comparison)

```bash
export YACC_DB_URL="$(kubectl get secret yacc-backend-secrets -n <environment> \
  -o jsonpath='{.data.DATABASE_URL}' | base64 -d)"
# libpq tools take a postgresql:// URL; strip the jdbc: prefix if present
case "$YACC_DB_URL" in
  jdbc:*) export PGURL="postgresql://${YACC_DB_URL#jdbc:postgresql://}" ;;
  *)      export PGURL="$YACC_DB_URL" ;;
esac

# Schema state (versions + success flags)
psql "$PGURL" -c "SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank;" \
  > <artifact-link>/source-flyway-history.txt

# Row-count baseline (estimates; exact counts for key tables below)
psql "$PGURL" -c "SELECT relname AS table_name, n_live_tup FROM pg_stat_user_tables ORDER BY relname;" \
  > <artifact-link>/source-row-counts.txt
psql "$PGURL" -Atc "SELECT 'users', count(*) FROM users UNION ALL SELECT 'conversations', count(*) FROM conversations UNION ALL SELECT 'messages', count(*) FROM messages;" \
  > <artifact-link>/source-exact-counts.txt
```

### 3.3 Backup (custom format)

```bash
pg_dump --format=custom --no-owner --no-privileges \
  --file=<artifact-link>/yacc-db-$(date -u +%Y%m%dT%H%M%SZ).dump "$PGURL"
```

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

Run against the **candidate** connection and compare with the §3.2 captures:

```bash
# Schema version state must match the source exactly (ADR-027)
psql "$CAND_URL" -c "SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank;"

# Row-count comparison: estimates for shape, exact counts for key tables
psql "$CAND_URL" -c "SELECT relname AS table_name, n_live_tup FROM pg_stat_user_tables ORDER BY relname;"
psql "$CAND_URL" -Atc "SELECT 'users', count(*) FROM users UNION ALL SELECT 'conversations', count(*) FROM conversations UNION ALL SELECT 'messages', count(*) FROM messages;"
```

Verification gate (all must hold):

- [ ] `flyway_schema_history` rows identical to `source-flyway-history.txt` (same versions, all `success`).
- [ ] Exact counts match `source-exact-counts.txt`.
- [ ] `pg_stat_user_tables` shape matches `source-row-counts.txt` (estimates may differ slightly; investigate large deltas).
- [ ] No rows were modified during verification (all queries read-only).

Any mismatch ⇒ **fail**: do not proceed; abort per [cutover-rehearsal.md](cutover-rehearsal.md) §4 and keep the dump artifact for diagnosis.

*Optional app-level check (if wired in `<environment>`)*: point a throwaway candidate deployment at the restored database and confirm `/health/live` + `/health/ready` — this proves the restored state boots and passes Flyway's startup validation. Record as an extra evidence row; it is not a substitute for the SQL checks above.

---

## 6. Restore time objective

Record actual backup and restore durations in the evidence template each time the procedure runs. There is no committed RTO/RPO number yet; establishing one is part of **MIG-070 (#361)**'s rehearsal evidence, not something this document can assert.

---

**Last Updated**: 2026-10-21 (authored by MIG-070b #447 — procedure only; no execution claimed)
