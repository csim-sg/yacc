# PostgreSQL Backup & Restore (Compose) — `compose-backup-restore.md`

**Status**: Documented procedure (MIG-070e #488). **Not evidence of execution.**
**Audience**: the founder/sole operator (OPC)
**Source issue**: https://github.com/csim-sg/yacc/issues/488
**Related**: [compose-staging.md](compose-staging.md) (staging target definition + evidence template) · [compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md) (rehearsal that exercises this procedure on candidate resources) · [compose-reset-recovery-rotation.md](compose-reset-recovery-rotation.md) (uses §3 as its mandatory pre-reset backup) · [compose-roll-forward.md](compose-roll-forward.md) · ADR-032 (Compose target) · ADR-027 (Flyway + JPA; forward-only schema) · ADR-028 (Quartz + DB DLQ; Redis dropped)

> **Scope**: PostgreSQL logical backup and restore for the Java backend's single datastore. ADR-028 removed Redis entirely (Quartz is DB-backed, DLQ is a DB table), so **PostgreSQL is the only stateful component to back up**.
>
> **This is disaster recovery, not rollback.** The Flyway schema is forward-only (ADR-027); a restore recovers a prior consistent data state, and the service then migrates forward again on boot. A restore is **never** the response to a bad release — that is roll-forward, per [compose-roll-forward.md](compose-roll-forward.md).
>
> **Shared-server blast radius.** The staging source database is `yacc_client` on the **shared** server container `antpolis-database-postgres-1`, which hosts **other workloads' databases too**. §3 reads from it (read-only) only after the §3.1 fail-closed target pin. Nothing in this procedure ever creates, drops, or writes a database on the shared server: **every restore lands in a dedicated candidate PostgreSQL 15 server/operator-started container — never over a database a deployment is serving, never as a new database on the shared server.**

---

## 1. References used (names only — no values)

- **Source coordinates (staging)**: container `antpolis-database-postgres-1`, database `yacc_client`, Docker network `antpolis-database_database` — the non-secret coordinates pinned by [compose-staging.md](compose-staging.md) §1. Rehearsal use replaces them with the candidate database of [compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md) (P3/P6): a rehearsal backup reads and writes **only candidate resources** — never the shared server, never another workload's data.
- **Source credential**: `<postgres-source-connection>` — a `postgresql://` (or `jdbc:postgresql://`) connection string for a role with `CONNECT` + read access to the source database (`<founder to name>`: the exact role is a shared-server fact this repository cannot verify; the operator's decrypted `staging.env` `POSTGRES_USER`/`POSTGRES_PASSWORD` is the expected app role). The credential is entered into a mode-`0600` temporary file and converted in-process (§3.2) — it is **never** `source`d, `eval`ed, exported, echoed, or passed as a command argument. The decrypted env file is data only: paste **from** it with the no-swap/no-history editor if useful; never source it.
- **Candidate restore target**: a dedicated PostgreSQL **15** server the operator controls — either the rehearsal candidate database container ([compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md) P6) or a throwaway §4.1 container. Coordinates: `<candidate-container>` on network `<candidate-network>`, fresh database `<candidate-database>` (created via `createdb`; empty; served by no deployment).
- **Schema state**: `flyway_schema_history` (Flyway-managed; ADR-027).
- **Storage location / retention**: `<artifact-link>` directory on the operator's side — `<founder to name>` decides location and retention period; recorded on #361, not in this document.

**Never** print, log, or copy credential values into evidence artifacts. Reference names/keys only. Connection credentials are parsed **in-process** into a mode-`0600` temporary libpq **service file** (§3.2, §4.1) that `psql`/`pg_dump`/`pg_restore` reference through the `PGSERVICEFILE` environment variable (the file's path — not credential material) + the `service=` keyword — the credential value never appears in a shell variable, a command argument (`ps`-visible), an environment entry, or `set -x` trace output, and the file is removed by a trap on exit. (An inline `servicefile=` connection keyword is rejected by modern libpq client tools — verified against the pinned `postgres:15` image — so this procedure never uses one.) The operator-typed connection string additionally requires the no-swap/no-history editor invocation specified in §3.2 — editor-internal copies (swap/viminfo/backup) sit outside every trap. Every percent-**decoded** component (database, username, password, each query value) is checked for ASCII control characters before it is written, so an encoded `%0A`/`%0D` can never create a service-file line, and query parameters are allowlisted (§3.2) so a copied URL cannot override the parsed target or credentials.

---

## 2. Expected downtime

- **Rehearsal / planned restore**: restores target a **candidate database** on a dedicated candidate server, so the running deployment has **no downtime**.
- **In-place disaster restore**: the posture is a **single backend instance** (ADR-032/ADR-029) — during an in-place restore the backend is fully unavailable for the restore duration (stop-and-replace, brief planned interruption). Measure and record actual duration in the evidence template ([compose-staging.md](compose-staging.md) §6 shape); there is no second instance to fail over to. An in-place disaster restore is founder-authorized — §4's candidate-only rule governs rehearsals and verification.

---

## 3. Backup procedure

### 3.1 Pre-backup checks

- [ ] `/health/live` and `/health/ready` return 200 — through `https://staging.riotingnerds.com` ([compose-staging.md](compose-staging.md) §5 Step 2) for the staging target, or the candidate loopback check ([compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md) Step 2) for a rehearsal candidate — back up a healthy service.
- [ ] **Client tools pinned to the source server's major version — PostgreSQL 15** for this service. The documented pinned-tools path is the `postgres:15` client container used throughout (the image tag pins the **major**; the same-major rule is a major-version rule — exactly the reviewed posture: dump output is documented to load same-or-newer major, never guaranteed older, and `pg_dump` refuses a newer source). If operator-installed host clients are used instead, preflight them identically: `pg_dump --version`, `pg_restore --version` — record both and confirm **major 15**; abort otherwise. `pg_export_snapshot()` and `pg_dump --snapshot` require these modern clients. Connections go through the `PGSERVICEFILE` environment variable (a file path — not credential material) + the `service=` keyword; an inline `servicefile=` connection keyword is rejected by modern libpq client tools (verified on the pinned `postgres:15` image), so this procedure never uses one.
- [ ] Operator shell for the setup/guard blocks is **`bash`** — the fail-closed blocks use `set -o pipefail`, which POSIX `sh`/dash rejects.
- [ ] **`python3`** available (standard library only) — powers the §3.2/§4.1 in-process credential conversion.
- [ ] Docker + compose plugin on the host; the `postgres:15` image present or pullable.
- [ ] **Shared-server target pin (fail closed) — §3.1a** — run before any connection to the shared server. A rehearsal source skips this row and uses the candidate pin instead (rehearsal doc Step 3).
- [ ] Storage location for `<artifact-link>` is reachable and has space.
- [ ] Actor and UTC timestamp noted for the evidence record.

#### 3.1a Shared-server target pin (staging source only — fail closed)

Every check must pass; **any failure or ambiguity aborts**. The connection is then provably bound to the pinned container and its 5432 listener (converter host/port pins in §3.2 + connected-server address and `inet_server_port()` bindings in the gate below), database, and major:

```bash
# Fail-closed pins for the SHARED source (staging). Run before building the service file.
# Only an explicit success continues; every other outcome aborts.
docker inspect antpolis-database-postgres-1 >/dev/null \
  || { echo "ABORT: shared PostgreSQL container 'antpolis-database-postgres-1' not found — refusing to continue"; exit 1; }
docker network inspect antpolis-database_database >/dev/null \
  || { echo "ABORT: shared database network 'antpolis-database_database' not found — refusing to continue"; exit 1; }
docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' antpolis-database-postgres-1 \
  | grep -qw antpolis-database_database \
  || { echo "ABORT: shared server is not attached to network 'antpolis-database_database'"; exit 1; }
echo "shared-server pin OK: antpolis-database-postgres-1 on antpolis-database_database"
```

After the §3.2 service file exists, the **connection gate** below mechanically verifies the connected server identity, the database name, and the server major before anything else runs (database name and major are non-secret; nothing else is printed):

```bash
# Connection gate — abort unless the CONNECTED server is the pinned container serving
# 'yacc_client' on PostgreSQL major 15 at the pinned listener port 5432. Identity
# layers: (a) the §3.2 converter already refused any URL host other than
# antpolis-database-postgres-1 and any explicit URL port other than 5432 (a
# wrong-host or wrong-port URL never became a service file); (b) host(inet_server_addr())
# — the server-side address of the connection that just ran, without the netmask
# suffix — must match an address Docker DNS resolves the pinned container name to on
# this network; (c) inet_server_port() — the port that same connection was served on
# — must be exactly 5432, so a second PostgreSQL listener on the same container
# address at a non-default port aborts HERE, before pg_dump runs.
docker run --rm -i --network antpolis-database_database \
  -e PGSERVICEFILE=/run/yacc-svc \
  --mount type=bind,src="$SVC_FILE",dst=/run/yacc-svc,readonly \
  postgres:15 bash -c '
    db="$(psql "service=yacc_backup_src" -Atc "SELECT current_database();")" || exit 1
    ver="$(psql "service=yacc_backup_src" -Atc "SHOW server_version;")" || exit 1
    srv="$(psql "service=yacc_backup_src" -Atc "SELECT host(inet_server_addr());")" || exit 1
    prt="$(psql "service=yacc_backup_src" -Atc "SELECT inet_server_port();")" || exit 1
    case "$db $ver" in
      "yacc_client "15.*) ;;
      *) echo "ABORT: connected target is not yacc_client on PostgreSQL major 15 (got db=$db server=$ver)"; exit 1 ;;
    esac
    [ -n "$srv" ] || { echo "ABORT: connected server reported no network address"; exit 1; }
    [ "$prt" = "5432" ] || { echo "ABORT: connected listener port is not the pinned 5432 (got: $prt) — refusing the shared source"; exit 1; }
    EXP="$( { getent ahostsv4 antpolis-database-postgres-1 | awk "{print \$1}"; getent ahostsv6 antpolis-database-postgres-1 | awk "{print \$1}"; } | sort -u )"
    [ -n "$EXP" ] || { echo "ABORT: pinned container did not resolve on this network"; exit 1; }
    printf "%s\n" "$EXP" | grep -Fxq "$srv" \
      || { echo "ABORT: connected server address is not antpolis-database-postgres-1 on this network — refusing the shared source"; exit 1; }
    echo "target pin OK: yacc_client on PostgreSQL $ver served by antpolis-database-postgres-1 on port 5432"
' || { echo "ABORT: shared-source connection gate failed"; exit 1; }
```

### 3.2 Capture a consistent source baseline (one snapshot for counts and dump)

`pg_dump` always reads through a single MVCC snapshot, so a dump is internally consistent by construction. The **comparison baseline must come from that same snapshot** — counts collected in separate live queries before or after the dump are not comparable: a write landing between capture and dump makes a correct backup look corrupt (or hides real corruption). This procedure therefore exports **one** snapshot, captures the counts through it, and dumps through the same snapshot.

**Expected write posture**: writes on the source may continue throughout — consistency comes from MVCC, not from quiescing the service. No maintenance window or downtime is required. (If snapshot export is unavailable in the target environment, an approved maintenance/read-only window with explicit founder stop authority is the alternative — counts must then be captured inside the window, before the dump.)

**Prerequisites**: two connections to the **same** source database, authenticated as the **same database role** — the interactive `psql` client container (Terminal 1) and the `pg_dump` client container (Terminal 2) both connect through the **same §3.2 service file**, so host/port/database/user are identical (PostgreSQL only allows a snapshot to be reused by the exporting role); the exporting session stays open until the dump finishes.

Run the connection-setup block below **in Terminal 1's shell** (the shell that will keep the snapshot session open). It builds the credential service file and prints its path; Terminal 2 substitutes that path for `<svc-file-path>`.

**Credential handling (read before running):**

- The connection string exists **only** inside the mode-`0600` editor temp file and the mode-`0600` service file. It is never assigned to a shell variable, never passed as a command argument, never exported into the environment, and never echoed — so nothing can leak via `ps`, child-process environments, shell history, or `set -x` trace output.
- `mktemp` creates both files with mode `0600`; the trap removes them on normal exit, abort, or Ctrl-C (`EXIT`/`INT`/`TERM` — an interrupt cleans up and stops the procedure with exit 130). Do not remove the trap. Never `cat`, `echo`, edit, or copy the service file (including into evidence artifacts) — reference it by path only.
- **The trap cannot reach editor-internal copies**: an editor that keeps a swap file, undo history, viminfo, or backup copies leaves credential-bearing files the trap never removes, so the only-inside-temporary-files property holds **only** under a no-swap/no-history editor invocation — e.g. `EDITOR='vim -n -i NONE'` (no swap file, no viminfo; vim keeps backups off by default — do not use an editor environment that enables swap/backup/undo persistence, or disable it for this invocation). If the editor's file behavior cannot be verified, treat the connection string as having left additional local copies on that workstation and remove them deliberately afterwards.
- The converter parses in-process (strips a `jdbc:` prefix, percent-decodes, validates host/database/port — an explicit URL port other than the pinned 5432 is rejected — and **rejects any URL whose host is not the declared expected host** — `antpolis-database-postgres-1` for the shared source, `db` for a rehearsal candidate), emits the stanza only to the `0600` file, prints nothing else, and exits non-zero on empty, control-character-bearing, wrong-host, wrong-port, or unparseable input. Because libpq reads the service file **line by line**, every **decoded** component — database, username, password, and each query value — is rejected when it contains an ASCII control character (NUL/TAB/LF/CR/DEL/…): percent-encoded `%0A`/`%0D` therefore cannot split a value into extra service-file lines or directives. Query parameters are **allowlisted** to `sslmode` (value-validated), `connect_timeout`, and `application_name`; any other key — `host`, `hostaddr`, `port`, `dbname`, `user`, `password`, `service`, `servicefile`, `ssl`, or anything unknown — is rejected, as are duplicate or keyless pairs, so a copied URL can never override the parsed target/credentials or inject a nested service. Abort messages never contain credential material.
- The service file pins the source host as **`antpolis-database-postgres-1`** and the listener port as **5432** for the staging source — enforced, not assumed: the converter refuses any URL whose host is not the pinned name or whose explicit port is not 5432, and the §3.1a connection gate binds the **connected** server to the pinned container by comparing the server-side connection address (`host(inet_server_addr())`) with the container's Docker-DNS address on the pinned network and requires the connected listener to report `inet_server_port()` = 5432 — so a reachable different server carrying a same-named `yacc_client` database on major 15, or a second listener on the same container address at a non-default port, aborts. A rehearsal candidate pins its candidate host instead (`db`).
- The file is read by libpq **at connect time**: an open session keeps working if the file is later removed, but new connections fail after the setup shell exits — if that happens early, re-run the setup block (it prints a fresh path).

```bash
# Connection setup — run in Terminal 1's shell. The credential exists ONLY inside
# mode-0600 temporary files: never in a shell variable, command argument, environment
# entry, or trace output. mktemp creates the files 0600; the trap removes them on
# normal exit, abort, or Ctrl-C. Requires bash (pipefail) and python3 — see §3.1.
# Rehearsal use: the candidate stack of compose-rehearsal-stop-authority.md —
# host = db (the candidate db service name on network <candidate-project>_cand),
# database = <candidate-database> (never the shared server; see that doc's Step 3).
# The converter's host pin follows the source: EXPECTED_HOST below is the pinned
# shared container for the staging source; a rehearsal source sets EXPECTED_HOST=db.
SVC_FILE="$(mktemp)"
URL_FILE="$(mktemp)"
trap 'rm -f -- "$SVC_FILE" "$URL_FILE"' EXIT
trap 'rm -f -- "$SVC_FILE" "$URL_FILE"; exit 130' INT TERM   # Ctrl-C/TERM abort: clean up, then stop
EXPECTED_HOST='antpolis-database-postgres-1'   # pinned source host (§3.1a) — the converter
                                               # refuses any other URL host; rehearsal source: db
# The editor invocation must leave no swap/history/backup copies — those would
# outlive the trap, e.g. EDITOR='vim -n -i NONE'. $EDITOR is deliberately UNQUOTED
# so it may carry editor flags; it holds no credential material itself.
$EDITOR "$URL_FILE"                # paste <postgres-source-connection>, save, quit
chmod 600 "$URL_FILE"              # re-assert in case the editor rewrote the file

(
  set -o pipefail   # the converter's failure must abort — Bash-only option (§3.1). The
                    # `||` list exempts the subshell from errexit; its nonzero status
                    # reaches the handler with or without `set -e`.
  python3 -c '
import re, sys
from urllib.parse import urlsplit, unquote

SERVICE = sys.argv[1]                     # static section name — not a credential
EXPECTED = sys.argv[2]                    # pinned/declared server host — any other host aborts
raw = sys.stdin.read().strip()            # credential URL — never echoed

def has_ctrl(value):                      # any ASCII control char (NUL/TAB/LF/CR/DEL/...)?
    return any(ord(c) <= 31 or ord(c) == 127 for c in value)

if (not raw or not EXPECTED or has_ctrl(EXPECTED)
        or not re.fullmatch(r"[A-Za-z0-9_]+", SERVICE) or has_ctrl(raw)):
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
    if host != EXPECTED or u.path.count("/") != 1:
        sys.exit(2)                       # any host other than the pinned one => fail closed
    db = unquote(u.path[1:])              # database = the single path segment (percent-decoded)
    if not db or has_ctrl(db):            # a decoded %0A/%0D must never reach the service file
        sys.exit(2)
    port = u.port                         # None when absent; raises ValueError when non-numeric
    if port is not None and port != 5432:
        sys.exit(2)                       # any explicit port other than the pinned 5432 => fail closed
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
' yacc_backup_src "$EXPECTED_HOST" < "$URL_FILE" > "$SVC_FILE"
) || { echo "ABORT: connection setup failed (unusable connection string, or host/port is not the pinned source host/port); the temporary credential files were removed" >&2; exit 1; }
[ -s "$SVC_FILE" ] || { echo "ABORT: connection string was empty; the temporary credential files were removed" >&2; exit 1; }

printf 'service file: %s\n' "$SVC_FILE"   # the printed path is not credential material; the file content never is
```

**Terminal 1 — open the snapshot session; keep it open until §3.3 finishes** (`<svc-file-path>` = the path printed above — an absolute `mktemp` path). The client container joins the source's network (`antpolis-database_database` for the shared staging source; the candidate network for a rehearsal candidate) so the pinned host name resolves, and mounts the artifacts directory for the §3.2 captures. **Bind-mount sources must be absolute paths** — `<svc-file-path>` is absolute by construction; use the absolute path of the `<artifact-link>` directory for `<artifact-link-dir>`:

```bash
docker run --rm -it --network antpolis-database_database \
  -e PGSERVICEFILE=/run/yacc-svc \
  --mount type=bind,src="<svc-file-path>",dst=/run/yacc-svc,readonly \
  --mount type=bind,src="<artifact-link-dir>",dst=/run/art \
  postgres:15 \
  psql "service=yacc_backup_src"
```

```
-- Rehearsal sources skip §3.1a; for the shared staging source §3.1a's connection gate
-- has already verified both lines below mechanically. Confirm again here and record:
SELECT current_database();     -- MUST print exactly: yacc_client  (staging source)
SHOW server_version;           -- MUST report major 15 (e.g. 15.x)
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT pg_export_snapshot();   -- record the returned id in <artifact-link>/source-snapshot-id.txt
-- leave this session OPEN — do NOT exit — until the §3.3 dump has completed
```

**Terminal 2 — run the §3.3 dump through that snapshot id** (same `<svc-file-path>` — both terminals must use the same file so both connect with identical host/port/database/user).

**Terminal 1 — after the dump completes, capture the baseline from the same snapshot, then close the session:**

```
-- Capture format: unaligned + tuples-only — the exact bytes `psql -Atc` writes in §5,
-- so the §5 diff compares equal representations (default aligned/table output here would
-- never byte-match §5 and would fail the diff even on identical data).
\pset format unaligned
\pset tuples_only on
-- Schema state (versions + success flags)
\o /run/art/source-flyway-history.txt
SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank;
\o
-- Row-count baseline: exact counts of the key tables, from the same snapshot as the dump
\o /run/art/source-exact-counts.txt
SELECT 'users', count(*) FROM users UNION ALL SELECT 'conversations', count(*) FROM conversations UNION ALL SELECT 'messages', count(*) FROM messages;
\o
COMMIT;
\q
```

(`\o` writes inside the client container; `/run/art` is the bind-mounted `<artifact-link>` directory, so the files land on the operator's side.)

Capture order matters: `pg_export_snapshot()` first (it fixes the transaction snapshot), the dump while the session is still open, the counts last — all three then observe the identical data state. Approximate planner statistics (`pg_stat_user_tables`) are **not** captured and are **not** a verification gate (§5); only exact counts are.

### 3.3 Backup (custom format, through the §3.2 snapshot)

```bash
# Terminal 2 — same <svc-file-path> as Terminal 1. Network = the source's network
# (antpolis-database_database for the shared staging source; the candidate network
# <candidate-project>_cand for a rehearsal source). The dump lands in the mounted
# artifacts directory (operator-side <artifact-link>); the snapshot id is read from
# the operator-side file Terminal 1 recorded.
docker run --rm -i --network antpolis-database_database \
  -e PGSERVICEFILE=/run/yacc-svc \
  --mount type=bind,src="<svc-file-path>",dst=/run/yacc-svc,readonly \
  --mount type=bind,src="<artifact-link-dir>",dst=/run/art \
  postgres:15 \
  pg_dump --format=custom --no-owner --no-privileges \
    --snapshot="$(cat <artifact-link>/source-snapshot-id.txt)" \
    --file=/run/art/yacc-db-$(date -u +%Y%m%dT%H%M%SZ).dump \
    "service=yacc_backup_src"
```

- Run while the Terminal-1 session from §3.2 is still open — the exported snapshot exists only until that transaction ends.
- `--snapshot` makes the dump read through the exact snapshot the §3.2 counts were taken from, so baseline and dump are provably the same data state.
- Custom format (`.dump`) supports `pg_restore` selective/parallel restore and compressed storage.
- `--no-owner --no-privileges` so the restore does not depend on matching role names.
- Record the dump file as `<artifact link>`; store it in the operator-chosen storage location with the agreed retention (§1).

### 3.4 Backup failure handling

- §3.2 setup failure (unusable connection string) ⇒ the block aborts with a generic message and the `trap` has already removed the temporary credential files; fix the cause and re-run the setup block. No credential material is printed on any abort path.
- §3.1a pin or connection-gate failure ⇒ **abort**; the shared server, network, connected-server identity, connected listener port, database name, or major is not what this procedure pins. Never proceed on an ambiguous target.
- `pg_dump` exits non-zero ⇒ **no backup exists**; fix the cause (connectivity, disk, permissions) and re-run. Do not mark a partial dump as a backup.
- Dump succeeded but cannot be stored/retrieved ⇒ treat as failed (a backup that cannot be restored to is not a backup).
- Abort per [compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md) §4 if the backup gate cannot be met during a rehearsal.

---

## 4. Restore into a candidate database

**Rule**: restore into a **fresh candidate database on a dedicated candidate PostgreSQL 15 server** — never into a database a running deployment is serving, and **never as a new database on the shared server** (single-instance posture makes in-place restore full downtime — see §2; in-place disaster restore is founder-authorized, out of rehearsal scope). Creating or altering databases, roles, or server configuration on `antpolis-database-postgres-1` is outside this procedure's blast radius.

### 4.1 Candidate server and connection setup

Two supported shapes; either way the candidate server runs **PostgreSQL major 15**:

- **Rehearsal candidate** (preferred): the candidate database container of [compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md) (P6) on the candidate network `<candidate-project>_cand`. Create the fresh target database inside it, then build the candidate service file against it — host `db` (the candidate `db` service name, resolvable on the candidate network), database `<candidate-restored-database>`:

  ```bash
  # Fresh empty restore target inside the candidate server (operator-chosen throwaway
  # credentials already hold: the candidate server was started from the operator's
  # own 0600 env values — see compose-rehearsal-stop-authority.md §2.1).
  docker exec <candidate-project>-db-1 createdb -U <candidate-db-user> <candidate-restored-database>
  ```

- **Standalone candidate** (non-rehearsal verification): start a throwaway server the operator owns — internal network only, no published ports:

  ```bash
  docker network create <candidate-network>
  docker run -d --name <candidate-container> --network <candidate-network> \
    -e POSTGRES_USER=<candidate-db-user> -e POSTGRES_PASSWORD=<candidate-db-password> \
    -e POSTGRES_DB=<candidate-database> postgres:15
  ```

Then build the candidate service file. Same credential-safe mechanism as §3.2, with one operator-typed difference: the admin connection string is entered **inside the editor** into a mode-`0600` temporary file (mktemp + trap on exit/abort/Ctrl-C — an interrupt cleans up and stops with exit 130) — never pasted as a shell argument, never exported, never echoed — so it cannot leak via history, argv, the environment, or `set -x`. The no-swap/no-history editor invocation requirement from §3.2 applies unchanged. The embedded converter is the **same program** as §3.2 (only the service name, expected host, and stdin source differ): it rejects decoded control characters, applies the same query-param allowlist, and **refuses any URL whose host is not the declared candidate host** (`CAND_EXPECTED_HOST` — `db` for the rehearsal shape, `<candidate-container>` for the standalone shape) **or whose explicit port is not the pinned 5432**, so a mistyped or hostile candidate URL fails closed identically. The §4.2 identity gate then binds the **connected** server to the declared candidate container (`CAND_CONTAINER`) by comparing the server-side connection address with the container's Docker-DNS address on the candidate network, requires the connected listener to report `inet_server_port()` = 5432, and pins the connected database to `CAND_DB` — so a same-named, same-major database on any other host, or on a second listener at a non-default port of the same address, aborts before `pg_restore` runs.

```bash
# Candidate identity declarations — set per shape BEFORE running (fail-closed in §4.2):
CAND_EXPECTED_HOST='db'                      # converter host pin — the candidate service name
                                             # (rehearsal shape); standalone shape: replace with
                                             # '<candidate-container>'
CAND_CONTAINER='<candidate-project>-db-1'    # the declared candidate server container (rehearsal
                                             # shape, G5 naming); standalone shape: '<candidate-container>'
CAND_DB='<candidate-restored-database>'      # the fresh restore-target database created above —
                                             # never '<candidate-database>' (the candidate backend
                                             # serves that one)
CAND_URL_FILE="$(mktemp)"
CAND_SVC_FILE="$(mktemp)"
trap 'rm -f -- "$CAND_URL_FILE" "$CAND_SVC_FILE"' EXIT
trap 'rm -f -- "$CAND_URL_FILE" "$CAND_SVC_FILE"; exit 130' INT TERM   # Ctrl-C/TERM abort: clean up, then stop
# No-swap/no-history editor invocation — see §3.2 (e.g. EDITOR='vim -n -i NONE').
$EDITOR "$CAND_URL_FILE"          # paste <candidate-connection-with-candidate-database>, save, quit
chmod 600 "$CAND_URL_FILE"        # re-assert in case the editor rewrote the file

(
  set -o pipefail
  python3 -c '
import re, sys
from urllib.parse import urlsplit, unquote

SERVICE = sys.argv[1]                     # static section name — not a credential
EXPECTED = sys.argv[2]                    # pinned/declared server host — any other host aborts
raw = sys.stdin.read().strip()            # credential URL — never echoed

def has_ctrl(value):                      # any ASCII control char (NUL/TAB/LF/CR/DEL/...)?
    return any(ord(c) <= 31 or ord(c) == 127 for c in value)

if (not raw or not EXPECTED or has_ctrl(EXPECTED)
        or not re.fullmatch(r"[A-Za-z0-9_]+", SERVICE) or has_ctrl(raw)):
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
    if host != EXPECTED or u.path.count("/") != 1:
        sys.exit(2)                       # any host other than the pinned one => fail closed
    db = unquote(u.path[1:])              # database = the single path segment (percent-decoded)
    if not db or has_ctrl(db):            # a decoded %0A/%0D must never reach the service file
        sys.exit(2)
    port = u.port                         # None when absent; raises ValueError when non-numeric
    if port is not None and port != 5432:
        sys.exit(2)                       # any explicit port other than the pinned 5432 => fail closed
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
' yacc_restore_cand "$CAND_EXPECTED_HOST" < "$CAND_URL_FILE" > "$CAND_SVC_FILE"
) || { echo "ABORT: candidate connection string was not a usable postgresql:// (or jdbc:postgresql://) URL for the declared candidate host/port; temporary files removed" >&2; exit 1; }
[ -s "$CAND_SVC_FILE" ] || { echo "ABORT: candidate connection string was empty; temporary files removed" >&2; exit 1; }
```

### 4.2 Restore the dump into the candidate database

Run in the **same shell** as §4.1 — `$CAND_SVC_FILE`, `$CAND_CONTAINER`, `$CAND_DB` and the cleanup trap are live there. The client container joins the §4.1 candidate network (`<candidate-project>_cand` for the rehearsal shape, `<candidate-network>` for the standalone candidate) so the declared candidate container address resolves:

```bash
# Restore-target identity gate — run BEFORE the restore; record the verdict with the
# evidence. Aborts unless the connected target is the declared candidate database
# (CAND_DB) on PostgreSQL major 15 at the pinned listener port 5432, served by the
# declared candidate container (CAND_CONTAINER): host(inet_server_addr()) is the
# server-side address of the connection that just ran (netmask suffix removed) and
# must match an address Docker DNS resolves CAND_CONTAINER to on the candidate
# network, and inet_server_port() must be exactly 5432. A reachable different server
# — or a second listener on the same container address at a non-default port — with
# a same-named, same-major database therefore aborts HERE, before pg_restore runs.
docker run --rm -i --network <candidate-network> \
  -e CAND_CONTAINER="$CAND_CONTAINER" -e CAND_DB="$CAND_DB" \
  -e PGSERVICEFILE=/run/yacc-svc \
  --mount type=bind,src="$CAND_SVC_FILE",dst=/run/yacc-svc,readonly \
  postgres:15 bash -c '
    db="$(psql "service=yacc_restore_cand" -Atc "SELECT current_database();")" || exit 1
    ver="$(psql "service=yacc_restore_cand" -Atc "SHOW server_version;")" || exit 1
    srv="$(psql "service=yacc_restore_cand" -Atc "SELECT host(inet_server_addr());")" || exit 1
    prt="$(psql "service=yacc_restore_cand" -Atc "SELECT inet_server_port();")" || exit 1
    case "$db $ver" in
      "$CAND_DB "15.*) ;;
      *) echo "ABORT: connected target is not $CAND_DB on PostgreSQL major 15 (got db=$db server=$ver)"; exit 1 ;;
    esac
    [ -n "$srv" ] || { echo "ABORT: connected server reported no network address"; exit 1; }
    [ "$prt" = "5432" ] || { echo "ABORT: connected listener port is not the pinned 5432 (got: $prt) — refusing the restore"; exit 1; }
    EXP="$( { getent ahostsv4 "$CAND_CONTAINER" | awk "{print \$1}"; getent ahostsv6 "$CAND_CONTAINER" | awk "{print \$1}"; } | sort -u )"
    [ -n "$EXP" ] || { echo "ABORT: candidate container did not resolve on this network"; exit 1; }
    printf "%s\n" "$EXP" | grep -Fxq "$srv" \
      || { echo "ABORT: connected server address is not $CAND_CONTAINER on this network — refusing the restore"; exit 1; }
    echo "restore-target pin OK: $CAND_DB on PostgreSQL $ver served by $CAND_CONTAINER on port 5432"
' || { echo "ABORT: restore-target identity gate failed — refusing the restore"; exit 1; }
```

```bash
docker run --rm -i --network <candidate-network> \
  -e PGSERVICEFILE=/run/yacc-svc \
  --mount type=bind,src="$CAND_SVC_FILE",dst=/run/yacc-svc,readonly \
  --mount type=bind,src="<artifact-link-dir>",dst=/run/art,readonly \
  postgres:15 \
  pg_restore --dbname="service=yacc_restore_cand" \
    --no-owner --no-privileges --exit-on-error \
    /run/art/yacc-db-<timestamp>.dump
```

- `--exit-on-error` stops on the first error so a failed restore is never mistaken for a complete one.
- **Version compatibility**: the candidate server must run PostgreSQL **major 15** — the **same major** as the source and the §3.1-pinned tools; abort the restore if the identity gate above reports anything else. PostgreSQL documents dump output as expected to load into servers of the **same or newer** major than the `pg_dump` tool and **not guaranteed** to load into an **older** major, so a newer dump tool against a PG15 target would be an unsupported pair — pinning source, tools, and target to one major (15) is the only configuration where every pairing in this procedure is documented-supported. This is a restore-fidelity rule for the documented PG15 datastore, not a database upgrade policy: a restore into any other major is not a configuration this procedure validates.
- **Identity-gate failure** ⇒ abort; the connected server is not the declared candidate container/database on major 15, or its listener port is not the pinned 5432. A same-named, same-major database on any other host — or on a second listener at a non-default port of the same address — must never receive the restore — see §4.3's negative controls.
- §4.1 setup failure (empty or unparseable connection string, or host not matching the declared candidate host) ⇒ abort with a generic message; the `trap` has already removed both temporary files. Fix the cause and re-run §4.1.
- If the candidate database must be recreated first: drop/recreate **inside the candidate server** (it is operator-owned; e.g. `dropdb` + `createdb` as in §4.1), then re-run `pg_restore`. Never drop anything on the shared server.
- **Failure handling**: any `pg_restore` error ⇒ drop/recreate the candidate database inside the candidate server, fix the cause, restart from §3 (a clean re-restore from a verified dump; never patch a half-restored database by hand).
- §5 runs in the **same shell** as §4.1/§4.2 — the candidate service file and its cleanup `trap` are still live. If a fresh shell must be used, re-run §4.1 there first (it prints and cleans up its own files).

### 4.3 Negative control — a different server with the same database name and major aborts before the restore (throwaway resources only)

This control proves the §4 gates refuse a wrong server **and** a wrong-port listener on the declared server's own address **before** `pg_restore` runs. Use the throwaway resource pair from [compose-reset-recovery-rotation.md](compose-reset-recovery-rotation.md) §3.1 (two throwaway PostgreSQL 15 containers on a throwaway network, each with a database named `yacc_client` and throwaway credentials, **plus the second throwaway 5433 listener inside `<nc-container-a>`** defined in that setup; same teardown) — never the shared server, never a real database or credential. Record the outcome as an extra evidence row when the procedure is executed.

| # | Action (against the throwaway pair only) | Required outcome |
|---|---|---|
| NC-1 | Run the §4.1 conversion with the candidate URL for `<nc-container-b>` while `CAND_EXPECTED_HOST` is `<nc-container-a>` | converter exits non-zero and **no candidate service file is written** — a wrong-host URL is refused before any credential file exists |
| NC-1P | Run the §4.1 conversion with the candidate URL for the declared host `<nc-container-a>` at a non-5432 port (`postgresql://<nc-user>:<nc-password>@<nc-container-a>:5433/yacc_client`) | converter exits non-zero and **no candidate service file is written** — a non-5432 port is refused before any credential file exists |
| NC-2 | Control-only bypass of §4.1: write a throwaway 0600 libpq stanza **by hand** whose `host=` is `<nc-container-b>` (throwaway credentials, never the real URL), then run the §4.2 identity gate with `CAND_CONTAINER=<nc-container-a>`, `CAND_DB=yacc_client` on the throwaway network | gate **aborts** at the server-identity comparison (container B's address ≠ container A's resolved address) even though database name and major alone would pass — `pg_restore` never runs |
| NC-2P | Control-only bypass of §4.1: write a throwaway 0600 libpq stanza **by hand** with `host=` `<nc-container-a>` and `port=` `5433` (the second listener above; user `<nc-user>`, throwaway password — never the real URL), then run the §4.2 identity gate with `CAND_CONTAINER=<nc-container-a>`, `CAND_DB=yacc_client` on the throwaway network | gate **aborts** at the `inet_server_port()` check (connected port 5433 ≠ pinned 5432) even though server address, database name and major all match — `pg_restore` never runs |
| NC-3 | Same control stanza as NC-2P with `port=` `5432` (or no `port=` line — libpq default) | gate passes ("restore-target pin OK: … served by `<nc-container-a>` on port 5432") — the positive path still works |

Hand-writing a libpq stanza is allowed **only** inside this control — throwaway values, throwaway network, never the shared server, never the real connection string.

---

## 5. Post-restore verification (read-only)

Run against the **candidate** connection from §4.1 (same shell — the candidate service file from §4.1 and its cleanup `trap` are still live) and compare with the §3.2 snapshot captures:

```bash
# Schema version state must match the source baseline exactly (ADR-027).
# -Atc = unaligned, tuples-only — the same deterministic format as the §3.2 captures,
# so both diffs below compare equal representations (see §3.2 capture-format note).
docker run --rm -i --network <candidate-network> \
  -e PGSERVICEFILE=/run/yacc-svc \
  --mount type=bind,src="$CAND_SVC_FILE",dst=/run/yacc-svc,readonly \
  --mount type=bind,src="<artifact-link-dir>",dst=/run/art \
  postgres:15 \
  psql "service=yacc_restore_cand" \
    -Atc "SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank;" \
    > <artifact-link>/restored-flyway-history.txt

# Exact counts of the key tables in the restored database
docker run --rm -i --network <candidate-network> \
  -e PGSERVICEFILE=/run/yacc-svc \
  --mount type=bind,src="$CAND_SVC_FILE",dst=/run/yacc-svc,readonly \
  --mount type=bind,src="<artifact-link-dir>",dst=/run/art \
  postgres:15 \
  psql "service=yacc_restore_cand" \
    -Atc "SELECT 'users', count(*) FROM users UNION ALL SELECT 'conversations', count(*) FROM conversations UNION ALL SELECT 'messages', count(*) FROM messages;" \
    > <artifact-link>/restored-exact-counts.txt

# Counted-diff gate — both pairs must be byte-identical (equal representations).
diff <artifact-link>/source-flyway-history.txt <artifact-link>/restored-flyway-history.txt
diff <artifact-link>/source-exact-counts.txt   <artifact-link>/restored-exact-counts.txt
```

Verification gate (all must hold):

- [ ] `flyway_schema_history` rows identical to `source-flyway-history.txt` (same versions, all `success`).
- [ ] Exact counts identical to `source-exact-counts.txt` — both files were captured from the same MVCC snapshot as the dump (§3.2), so an exact match proves the restore faithfully reproduced the dumped state.
- [ ] No rows were modified during verification (all queries read-only).

Writes that hit the source **after** the §3.2 snapshot are expected and are **not** a failure — the comparison validates restore fidelity against the dumped state, not live-source equality. Approximate statistics (`pg_stat_user_tables`) are not a gate and are not consulted.

Any mismatch ⇒ **fail**: do not proceed; abort per [compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md) §4 and keep the dump artifact for diagnosis.

*Optional app-level check (rehearsal shape)*: point the candidate backend of [compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md) at the restored candidate database and confirm `/health/live` + `/health/ready` via the Step-2 loopback check — this proves the restored state boots and passes Flyway's startup validation. Record as an extra evidence row; it is not a substitute for the SQL checks above.

---

## 6. Restore time objective

Record actual backup and restore durations in the evidence template each time the procedure runs. There is no committed RTO/RPO number yet; establishing one is part of **MIG-070 (#361)**'s rehearsal evidence, not something this document can assert.

**Amended 2026-11-13:** the rehearsal evidence named above was retired by the founder scope decision of 2026-11-13 (“no need for such DR processes” — SPEC-002 “Scope amendment — 2026-11-13”, Antpolis/documentation PR #24, merge `e4c0ead`) — no rehearsal evidence exists or is required for MIG-070. Durations, if recorded, are voluntary operator information; this procedure asserts no acceptance gate. §4/§5 verification gates and the shared-server blast-radius rules are unchanged.

---

**Last Updated**: 2026-11-13 (authored by MIG-070e #488 as the Compose successor to the K8s-shaped `backup-restore.md`; preserves the reviewed substance — PG15 same-major source/tools/target with version preflights, MVCC-snapshot-consistent baseline, unaligned/`-Atc` byte-comparable captures, counted-diff gate, candidate-only restore, trap-scoped 0600 credential files, in-process converter with control-char/query-allowlist hardening; adds the fail-closed shared-server target pin; review pass 1 (PR #492): server-identity binding added — converter rejects any URL host other than the pinned/declared host on source and candidate paths, §3.1a/§4.2 gates bind the connected server to the pinned container via `inet_server_addr()` ↔ container address, §4.2 pins the restore database to the declared candidate database, §4.3 wrong-host negative control; connection mechanism corrected to `PGSERVICEFILE` + `service=` after live verification showed the inline `servicefile=` keyword is rejected by the pinned `postgres:15` client tools; review pass 2 (PR #492): port identity added — converter rejects any explicit URL port other than the pinned 5432 on source and candidate paths, §3.1a/§4.2 gates additionally require the connected listener to report `inet_server_port()` = 5432, §4.3 same-IP/different-port negative controls (NC-1P/NC-2P) added; procedure only — no execution claimed)
