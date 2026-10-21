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

**Never** print, log, or copy credential values into evidence artifacts. Reference secret names/keys only. Connection credentials are parsed **in-process** into a mode-`0600` temporary libpq **service file** (§3.2, §4.1) that `psql`/`pg_dump`/`pg_restore` reference by `servicefile=` + `service=` name — the credential value never appears in a shell variable, a command argument (`ps`-visible), an environment entry, or `set -x` trace output, and the file is removed by a trap on exit. Every percent-**decoded** component (database, username, password, each query value) is checked for ASCII control characters before it is written, so an encoded `%0A`/`%0D` can never create a service-file line, and query parameters are allowlisted (§3.2) so a copied URL cannot override the parsed target or credentials.

---

## 2. Expected downtime

- **Rehearsal / planned restore**: restores target a **candidate database**, so the running deployment has **no downtime**.
- **In-place disaster restore**: the acceptance posture is a **single replica** (ADR-029) — during an in-place restore the backend is fully unavailable for the restore duration. Measure and record actual duration in the evidence template; there is no second instance to fail over to.

---

## 3. Backup procedure

### 3.1 Pre-backup checks

- [ ] `/health/live` and `/health/ready` return 200 (see [cutover-rehearsal.md](cutover-rehearsal.md) Step 2) — back up a healthy service.
- [ ] PostgreSQL client tools ≥ 12 (`psql`/`pg_dump --version`) — `pg_export_snapshot()`, `pg_dump --snapshot`, and the `servicefile` connection parameter require them (the service runs on PostgreSQL 15).
- [ ] Operator shell for the §3.2/§4.1 setup blocks is **`bash`** — the fail-closed retrieval pipelines use `set -o pipefail`, which POSIX `sh`/dash rejects (same requirement as P8 in [cutover-rehearsal.md](cutover-rehearsal.md)).
- [ ] **`python3`** available (standard library only) — powers the §3.2/§4.1 in-process credential conversion (same tooling as P8 in [cutover-rehearsal.md](cutover-rehearsal.md)).
- [ ] Target database is the intended one (check the current `DATABASE_URL` **host/database portion only**, without printing credentials).
- [ ] Storage location for `<artifact link>` is reachable and has space.
- [ ] Actor and UTC timestamp noted for the evidence record.

### 3.2 Capture a consistent source baseline (one snapshot for counts and dump)

`pg_dump` always reads through a single MVCC snapshot, so a dump is internally consistent by construction. The **comparison baseline must come from that same snapshot** — counts collected in separate live queries before or after the dump are not comparable: a write landing between capture and dump makes a correct backup look corrupt (or hides real corruption). This procedure therefore exports **one** snapshot, captures the counts through it, and dumps through the same snapshot.

**Expected write posture**: writes on the source may continue throughout — consistency comes from MVCC, not from quiescing the service. No maintenance window or downtime is required. (If snapshot export is unavailable in the target environment, an approved maintenance/read-only window with explicit stop authority is the alternative — counts must then be captured inside the window, before the dump.)

**Prerequisites**: two connections to the **same** source database, authenticated as the **same database role** — `psql` (Terminal 1) and `pg_dump` (Terminal 2) both connect through the **same §3.2 service file**, so host/port/database/user are identical (PostgreSQL only allows a snapshot to be reused by the exporting role); the exporting session stays open until the dump finishes.

Run the connection-setup block below **in Terminal 1's shell** (the shell that will keep the snapshot session open). It builds the credential service file and prints its path; Terminal 2 substitutes that path for `<svc-file-path>`.

**Credential handling (read before running):**

- The connection URL exists **only** inside the pipeline and the mode-`0600` file. It is never assigned to a shell variable, never passed as a command argument, never exported into the environment, and never echoed — so nothing can leak via `ps`, child-process environments, shell history, or `set -x` trace output (the setup block performs **no credential-bearing assignment or command substitution**, so xtrace cannot expand it; `set -x` may be on and no credential byte is traced).
- `mktemp` creates the file with mode `0600`; the trap removes it on normal exit, abort, or Ctrl-C (`EXIT`/`INT`/`TERM` — an interrupt cleans up and stops the procedure with exit 130). Do not remove the trap. Never `cat`, `echo`, edit, or copy the service file (including into evidence artifacts) — reference it by path only.
- The pipeline is **fail-closed on every stage** (`set -o pipefail`): a `kubectl`/`base64` failure aborts even when python3 would succeed, and an empty value (secret present, key absent) is caught by the size check as a second layer. The converter parses in-process (strips a `jdbc:` prefix, percent-decodes, validates host/database/port), emits the stanza only to the `0600` file, prints nothing else, and exits non-zero on empty, control-character-bearing, or unparseable input. Because libpq reads the service file **line by line**, every **decoded** component — database, username, password, and each query value — is rejected when it contains an ASCII control character (NUL/TAB/LF/CR/DEL/…): percent-encoded `%0A`/`%0D` therefore cannot split a value into extra service-file lines or directives. Query parameters are **allowlisted** to `sslmode` (value-validated), `connect_timeout`, and `application_name`; any other key — `host`, `hostaddr`, `port`, `dbname`, `user`, `password`, `service`, `servicefile`, `ssl`, or anything unknown — is rejected, as are duplicate or keyless pairs, so a copied URL can never override the parsed target/credentials or inject a nested service. Abort messages never contain credential material.
- The file is read by libpq **at connect time**: an open session keeps working if the file is later removed, but new connections fail after the setup shell exits — if that happens early, re-run the setup block (it prints a fresh path).

```bash
# Connection setup — run in Terminal 1's shell. The credential exists ONLY inside a
# mode-0600 temporary file: never in a shell variable, command argument, environment
# entry, or trace output. mktemp creates the file 0600; the trap removes it on normal
# exit, abort, or Ctrl-C. Requires bash (pipefail) and python3 — see §3.1.
SVC_FILE="$(mktemp)"
trap 'rm -f -- "$SVC_FILE"' EXIT
trap 'rm -f -- "$SVC_FILE"; exit 130' INT TERM   # Ctrl-C/TERM abort: clean up, then stop

(
  set -o pipefail   # every stage must succeed — Bash-only option (§3.1). The `||` list
                    # exempts the subshell from errexit; its nonzero pipeline status
                    # reaches the handler with or without `set -e`.
  kubectl get secret yacc-backend-secrets -n <environment> \
    -o jsonpath='{.data.DATABASE_URL}' \
  | base64 -d \
  | python3 -c '
import re, sys
from urllib.parse import urlsplit, unquote

SERVICE = sys.argv[1]                     # static section name — not a credential
raw = sys.stdin.read().strip()            # credential URL — never echoed

def has_ctrl(value):                      # any ASCII control char (NUL/TAB/LF/CR/DEL/...)?
    return any(ord(c) <= 31 or ord(c) == 127 for c in value)

if not raw or not re.fullmatch(r"[A-Za-z0-9_]+", SERVICE) or has_ctrl(raw):
    sys.exit(2)                           # empty, control chars, or bad service name => fail closed
if raw.startswith("jdbc:"):               # JDBC form "jdbc:postgresql://..." accepted
    raw = raw[len("jdbc:"):]
if not raw.startswith(("postgresql://", "postgres://")):
    sys.exit(2)

# Query params are allowlisted to connection-quality options only. Every other key —
# host, hostaddr, port, dbname, user, password, service, servicefile, ssl, or an
# unknown name — is rejected, so a copied URL can never override the target host,
# port, database or credentials parsed from the authority/path, or reach a nested
# service definition. Values are re-checked after percent-decoding.
SAFE_QUERY = {"sslmode", "connect_timeout", "application_name"}
SSLMODES = ("disable", "allow", "prefer", "require", "verify-ca", "verify-full")

try:
    u = urlsplit(raw)
    host = (u.hostname or "").lower()     # hostname() unbrackets IPv6 + lowercases; "" when absent
    if not host or has_ctrl(host) or u.path.count("/") != 1:
        sys.exit(2)
    db = unquote(u.path[1:])              # database = the single path segment (percent-decoded)
    if not db or has_ctrl(db):            # a decoded %0A/%0D must never reach the service file
        sys.exit(2)
    port = u.port                         # None when absent; raises ValueError when non-numeric
    if port is not None and not (0 < port <= 65535):
        sys.exit(2)
    user = unquote(u.username) if u.username is not None else None
    password = unquote(u.password) if u.password is not None else None
    if (user is not None and has_ctrl(user)) or (password is not None and has_ctrl(password)):
        sys.exit(2)                       # decoded control char in a credential => fail closed
    params = []                           # safe, decoded, duplicate-free allowlisted params
    if u.query:
        for kv in u.query.split("&"):
            if not kv:
                sys.exit(2)
            key, sep, value = kv.partition("=")
            if not sep or key not in SAFE_QUERY or any(key == done for done, _ in params):
                sys.exit(2)               # unknown/overriding/conflicting/duplicate key => fail closed
            value = unquote(value)
            if key == "sslmode" and value not in SSLMODES:
                sys.exit(2)
            if key == "connect_timeout" and not re.fullmatch(r"[0-9]{1,5}", value):
                sys.exit(2)
            if has_ctrl(value):           # decoded %0A/%0D in a query value => fail closed
                sys.exit(2)
            params.append((key, value))
except ValueError:                        # unparseable URL or port => fail closed
    sys.exit(2)

def esc(value):                           # libpq service-file quoting: backslash + quote escaped
    bs = chr(92)                          # backslash (chr() keeps the payload quote-free)
    q = chr(39)                           # single quote
    return q + value.replace(bs, bs + bs).replace(q, bs + q) + q

lines = ["[%s]" % SERVICE, "host=%s" % esc(host)]
if port is not None:
    lines.append("port=%s" % esc(str(port)))
lines.append("dbname=%s" % esc(db))
if user is not None:
    lines.append("user=%s" % esc(user))
if password is not None:
    lines.append("password=%s" % esc(password))
for key, value in params:
    lines.append("%s=%s" % (key, esc(value)))
sys.stdout.write("\n".join(lines) + "\n")  # the stanza goes ONLY to the 0600 file
' yacc_backup_src \
  > "$SVC_FILE"
) || { echo "ABORT: connection setup failed (secret retrieval, access denial, or unparseable DATABASE_URL); the temporary credential file was removed" >&2; exit 1; }
[ -s "$SVC_FILE" ] || { echo "ABORT: retrieved DATABASE_URL was empty; the temporary credential file was removed" >&2; exit 1; }

printf 'service file: %s\n' "$SVC_FILE"   # the printed path is not credential material; the file content never is
```

**Terminal 1 — open the snapshot session; keep it open until §3.3 finishes** (`<svc-file-path>` = the path printed above):

```
psql "servicefile='<svc-file-path>' service=yacc_backup_src"
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT pg_export_snapshot();   -- record the returned id in <artifact-link>/source-snapshot-id.txt
-- leave this session OPEN — do NOT exit — until the §3.3 dump has completed
```

**Terminal 2 — run the §3.3 dump through that snapshot id** (same `<svc-file-path>` — both terminals must use the same file so both connect with identical host/port/database/user).

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
  --file=<artifact-link>/yacc-db-$(date -u +%Y%m%dT%H%M%SZ).dump \
  "servicefile='<svc-file-path>' service=yacc_backup_src"
```

- Run while the Terminal-1 session from §3.2 is still open — the exported snapshot exists only until that transaction ends.
- `--snapshot` makes the dump read through the exact snapshot the §3.2 counts were taken from, so baseline and dump are provably the same data state.
- Custom format (`.dump`) supports `pg_restore` selective/parallel restore and compressed storage.
- `--no-owner --no-privileges` so the restore does not depend on matching role names.
- Record the dump file as `<artifact link>`; store it in the `<environment>` storage location with the agreed retention.

### 3.4 Backup failure handling

- Connection-setup failure (secret retrieval, access denial, or unparseable `DATABASE_URL`) ⇒ the block aborts with a generic message and the `trap` has already removed the temporary credential file; fix the cause and re-run the setup block. No credential material is printed on any abort path.
- `pg_dump` exits non-zero ⇒ **no backup exists**; fix the cause (connectivity, disk, permissions) and re-run. Do not mark a partial dump as a backup.
- Dump succeeded but cannot be stored/retrieved ⇒ treat as failed (a backup that cannot be restored to is not a backup).
- Abort per [cutover-rehearsal.md](cutover-rehearsal.md) §4 if the backup gate cannot be met.

---

## 4. Restore into a candidate database

**Rule**: restore into a **separate candidate database**, never into a database a running deployment is serving (single-replica posture makes in-place restore full downtime — see §2).

### 4.1 Candidate connection setup

Same credential-safe mechanism as §3.2: the admin connection string exists ONLY inside mode-0600 temporary files removed by the trap (exit/abort/Ctrl-C — an interrupt cleans up and stops with exit 130). It is typed into the editor — never pasted as a shell argument, never exported, never echoed — so it cannot leak via history, argv, the environment, or `set -x`. The embedded converter is the **same program** as §3.2 (only the service name and stdin source differ): it rejects decoded control characters and applies the same query-param allowlist, so a mistyped or hostile candidate URL fails closed identically. Requires bash (pipefail), python3 (§3.1) and `$EDITOR` set.

```bash
CAND_URL_FILE="$(mktemp)"
CAND_SVC_FILE="$(mktemp)"
trap 'rm -f -- "$CAND_URL_FILE" "$CAND_SVC_FILE"' EXIT
trap 'rm -f -- "$CAND_URL_FILE" "$CAND_SVC_FILE"; exit 130' INT TERM   # Ctrl-C/TERM abort: clean up, then stop
"$EDITOR" "$CAND_URL_FILE"        # paste <postgres-admin-connection-with-candidate-database>, save, quit
chmod 600 "$CAND_URL_FILE"        # re-assert in case the editor rewrote the file

(
  set -o pipefail
  python3 -c '
import re, sys
from urllib.parse import urlsplit, unquote

SERVICE = sys.argv[1]                     # static section name — not a credential
raw = sys.stdin.read().strip()            # credential URL — never echoed

def has_ctrl(value):                      # any ASCII control char (NUL/TAB/LF/CR/DEL/...)?
    return any(ord(c) <= 31 or ord(c) == 127 for c in value)

if not raw or not re.fullmatch(r"[A-Za-z0-9_]+", SERVICE) or has_ctrl(raw):
    sys.exit(2)                           # empty, control chars, or bad service name => fail closed
if raw.startswith("jdbc:"):               # JDBC form "jdbc:postgresql://..." accepted
    raw = raw[len("jdbc:"):]
if not raw.startswith(("postgresql://", "postgres://")):
    sys.exit(2)

# Query params are allowlisted to connection-quality options only. Every other key —
# host, hostaddr, port, dbname, user, password, service, servicefile, ssl, or an
# unknown name — is rejected, so a copied URL can never override the target host,
# port, database or credentials parsed from the authority/path, or reach a nested
# service definition. Values are re-checked after percent-decoding.
SAFE_QUERY = {"sslmode", "connect_timeout", "application_name"}
SSLMODES = ("disable", "allow", "prefer", "require", "verify-ca", "verify-full")

try:
    u = urlsplit(raw)
    host = (u.hostname or "").lower()     # hostname() unbrackets IPv6 + lowercases; "" when absent
    if not host or has_ctrl(host) or u.path.count("/") != 1:
        sys.exit(2)
    db = unquote(u.path[1:])              # database = the single path segment (percent-decoded)
    if not db or has_ctrl(db):            # a decoded %0A/%0D must never reach the service file
        sys.exit(2)
    port = u.port                         # None when absent; raises ValueError when non-numeric
    if port is not None and not (0 < port <= 65535):
        sys.exit(2)
    user = unquote(u.username) if u.username is not None else None
    password = unquote(u.password) if u.password is not None else None
    if (user is not None and has_ctrl(user)) or (password is not None and has_ctrl(password)):
        sys.exit(2)                       # decoded control char in a credential => fail closed
    params = []                           # safe, decoded, duplicate-free allowlisted params
    if u.query:
        for kv in u.query.split("&"):
            if not kv:
                sys.exit(2)
            key, sep, value = kv.partition("=")
            if not sep or key not in SAFE_QUERY or any(key == done for done, _ in params):
                sys.exit(2)               # unknown/overriding/conflicting/duplicate key => fail closed
            value = unquote(value)
            if key == "sslmode" and value not in SSLMODES:
                sys.exit(2)
            if key == "connect_timeout" and not re.fullmatch(r"[0-9]{1,5}", value):
                sys.exit(2)
            if has_ctrl(value):           # decoded %0A/%0D in a query value => fail closed
                sys.exit(2)
            params.append((key, value))
except ValueError:                        # unparseable URL or port => fail closed
    sys.exit(2)

def esc(value):                           # libpq service-file quoting: backslash + quote escaped
    bs = chr(92)                          # backslash (chr() keeps the payload quote-free)
    q = chr(39)                           # single quote
    return q + value.replace(bs, bs + bs).replace(q, bs + q) + q

lines = ["[%s]" % SERVICE, "host=%s" % esc(host)]
if port is not None:
    lines.append("port=%s" % esc(str(port)))
lines.append("dbname=%s" % esc(db))
if user is not None:
    lines.append("user=%s" % esc(user))
if password is not None:
    lines.append("password=%s" % esc(password))
for key, value in params:
    lines.append("%s=%s" % (key, esc(value)))
sys.stdout.write("\n".join(lines) + "\n")  # the stanza goes ONLY to the 0600 file
' yacc_restore_cand < "$CAND_URL_FILE" > "$CAND_SVC_FILE"
) || { echo "ABORT: candidate connection string was not a usable postgresql:// (or jdbc:postgresql://) URL; temporary files removed" >&2; exit 1; }
[ -s "$CAND_SVC_FILE" ] || { echo "ABORT: candidate connection string was empty; temporary files removed" >&2; exit 1; }
```

### 4.2 Restore the dump into the candidate database

Run in the **same shell** as §4.1 — `$CAND_SVC_FILE` and its cleanup trap are live there.

```bash
pg_restore --dbname="servicefile='$CAND_SVC_FILE' service=yacc_restore_cand" \
  --no-owner --no-privileges --exit-on-error \
  <artifact-link>/yacc-db-<timestamp>.dump
```

- `--exit-on-error` stops on the first error so a failed restore is never mistaken for a complete one.
- §4.1 setup failure (empty or unparseable connection string) ⇒ abort with a generic message; the `trap` has already removed both temporary files. Fix the cause and re-run §4.1.
- If the candidate database must be recreated first: drop/recreate it via the `<environment>` admin path, then re-run `pg_restore`.
- **Failure handling**: any `pg_restore` error ⇒ drop the candidate database, fix the cause, restart from §3 (a clean re-restore from a verified dump; never patch a half-restored database by hand).
- §5 runs in the **same shell** as §4.1/§4.2 — the candidate service file and its cleanup `trap` are still live. If a fresh shell must be used, re-run §4.1 there first (it prints and cleans up its own files).

---

## 5. Post-restore verification (read-only)

Run against the **candidate** connection from §4.1 (same shell — the candidate service file from §4.1 and its cleanup `trap` are still live) and compare with the §3.2 snapshot captures:

```bash
# Schema version state must match the source baseline exactly (ADR-027)
psql "servicefile='$CAND_SVC_FILE' service=yacc_restore_cand" \
  -c "SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank;" \
  > <artifact-link>/restored-flyway-history.txt

# Exact counts of the key tables in the restored database
psql "servicefile='$CAND_SVC_FILE' service=yacc_restore_cand" \
  -Atc "SELECT 'users', count(*) FROM users UNION ALL SELECT 'conversations', count(*) FROM conversations UNION ALL SELECT 'messages', count(*) FROM messages;" \
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
