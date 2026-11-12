# Full Reset, Bootstrap, Recovery Drill & Key Rotation (Compose) — `compose-reset-recovery-rotation.md`

**Status**: Documented procedure (MIG-070e #488). **Not evidence of execution.**
**Audience**: the founder/sole operator (OPC) executing the MIG-071 (#362) drills
**Source issue**: https://github.com/csim-sg/yacc/issues/488
**Consumers**: MIG-071 (**#362**, AC-MIG-071-1..3 — this document defines how they are performed and recorded; the runs and records belong to #362)
**Related**: [compose-staging.md](compose-staging.md) (staging target, §3 decrypt flow, §5 evidence steps + §6 template) · [compose-backup-restore.md](compose-backup-restore.md) (mandatory pre-reset backup; §3) · [compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md) · ADR-025 (deterministic bootstrap; founder-controlled recovery; no surviving POC identities) · ADR-027 (Flyway forward-only; integration-credential encryption) · ADR-032 (Compose target; SOPS secret medium) · ADR-028 (Quartz + DB DLQ — queue tables are schema objects and reset with the schema)

> **This is a destructive, founder-gated procedure.** The founder holds stop authority at every pre-irreversible gate; each gate records an explicit go/no-go before it is crossed. Nothing here authorizes a production cutover (MIG-072, #363).
>
> **Shared-server blast radius — binding.** The target database is exactly **`yacc_client`** on the shared server container **`antpolis-database-postgres-1`** (network `antpolis-database_database`). That server hosts **other workloads' databases too**. Every destructive step: (a) runs only after the §3 fail-closed target pin, (b) is **schema-scoped inside `yacc_client`** — it never issues `DROP DATABASE`, never creates/drops/alters any database, role, or server setting, and never touches another workload's data — and (c) **aborts on any ambiguity** (wrong server, wrong database, unexpected schemas, failed verification). A reset or restore must never be able to reach another workload's database.

---

## 1. What this procedure touches (and nothing else)

| Piece | Definition | Boundary |
|---|---|---|
| `yacc_client` database | schema objects only (public schema: Flyway tables, app tables, Quartz/DLQ tables) on `antpolis-database-postgres-1` | the **only** datastore this procedure may destroy/reset |
| `yacc-app` staging backend | the Compose project of [compose-staging.md](compose-staging.md) | stopped before the reset, restarted for bootstrap/recovery/rotation gates — stop/start recorded as environment mutations |
| operator's decrypted env | `deploy/compose/secrets/staging.env` (mode 0600, git-ignored; from §3 of [compose-staging.md](compose-staging.md)) | edited with a no-swap/no-history editor only; never `source`d or `eval`ed — data only |
| committed SOPS artifact | `deploy/compose/secrets/staging.sops.env` | re-encrypted only via the §7.7 fail-closed flow (both committed age recipients, `.sops.yaml` rules) |

Everything else — the shared Traefik gateway, DNS/Cloudflare, other databases and roles on the shared server, the local (`compose-local.md`) target, `services/**` code — is outside this procedure's blast radius.

**Secrets discipline (non-negotiable):** no secret value in argv (`ps`-visible), shell history, logs, terminal scrollback shared with others, or evidence records. Values travel via mode-`0600` files and in-process readers that print pass/fail only. The private age identity stays operator-held.

---

## 2. Prerequisites (all must hold before starting — stop otherwise)

| # | Item | Requirement | Owner |
|---|------|-------------|-------|
| P1 | Authorization + record home | The run is founder-authorized and will be recorded on **#362** (AC-MIG-071-1..3): one attributable record per workflow — operator / UTC timestamp / commit SHA / environment / result. | Founder |
| P2 | Stop authority | The founder/sole operator (OPC) is present and decides every pre-irreversible gate in person; an unattended run does not start. | Founder |
| P3 | **Pre-reset backup** | A §3 backup of `yacc_client` ([compose-backup-restore.md](compose-backup-restore.md)) was just completed and its dump is storable/retrievable — **a reset without a fresh backup immediately before it is not authorized**. | Operator |
| P4 | Decrypted env present | `deploy/compose/secrets/staging.env` exists (mode 0600, verified `stat -c '%a'` = 600), produced by [compose-staging.md](compose-staging.md) §3.1; the operator holds the private age identity for re-encryption (§7.7). | Operator |
| P5 | Pinned image available | The exact `sha-<commit>` backend image pinned in `backend.staging.env` exists in the registry (restarts must not pull surprises). | Operator |
| P6 | Tooling | Docker + compose plugin; `bash` (the guard blocks use `set -o pipefail`); `python3` (stdlib only); `openssl` and `sha256sum` (recovery-pair generation, §6.1); `sops` with age (§7.7); the `postgres:15` image present or pullable (§3 client). | Operator |
| P7 | Shared-server facts | §3's pin succeeds (container, network, pinned-host/pinned-port converter checks, connected-server identity + listener-port binding, database name, major). If any pin fails or anything is ambiguous: **stop and record** — this is a founder-resolved fact, never a workaround. | Operator |

**Stop** if any row is unmet. Record the abort per §9 and halt.

---

## 3. Target pin (fail-closed, before every destructive step)

Run this block at the start of the session **and re-run before the §5 reset block**. Only an explicit success continues; every other outcome — including a *successful command with an unexpected result* — aborts:

```bash
# (1) Container + network exist; the server is on the expected network (names only).
docker inspect antpolis-database-postgres-1 >/dev/null \
  || { echo "ABORT: shared PostgreSQL container 'antpolis-database-postgres-1' not found — refusing to continue"; exit 1; }
docker network inspect antpolis-database_database >/dev/null \
  || { echo "ABORT: shared database network 'antpolis-database_database' not found — refusing to continue"; exit 1; }
docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' antpolis-database-postgres-1 \
  | grep -qw antpolis-database_database \
  || { echo "ABORT: shared server is not attached to network 'antpolis-database_database'"; exit 1; }

# (2) Credential service file — same discipline as compose-backup-restore.md §3.2:
# the admin connection string <shared-admin-connection> (<founder to name>: a role
# with ownership/CREATE rights on the yacc_client schema — a shared-server fact this
# repository cannot verify) is typed into a 0600 temp file and converted in-process.
# The converter also refuses any URL whose host is not EXPECTED_HOST below (the
# pinned container name) and any explicit URL port other than the pinned 5432: a
# wrong-host or wrong-port URL never becomes a credential file.
# Client tools reference the file through PGSERVICEFILE=/run/yacc-svc (the file's
# path — not credential material) + the service= keyword: modern libpq client
# tools reject an inline servicefile= connection keyword, so this procedure
# never uses one (verified against the pinned postgres:15 image).
# Requires bash + python3 (P6) and a no-swap/no-history EDITOR (see backup doc §3.2).
SVC_FILE="$(mktemp)"
URL_FILE="$(mktemp)"
trap 'rm -f -- "$SVC_FILE" "$URL_FILE"' EXIT
trap 'rm -f -- "$SVC_FILE" "$URL_FILE"; exit 130' INT TERM
$EDITOR "$URL_FILE"                # paste <shared-admin-connection>, save, quit
chmod 600 "$URL_FILE"
EXPECTED_HOST='antpolis-database-postgres-1'   # pinned shared server (§1)
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
' yacc_reset_admin "$EXPECTED_HOST" < "$URL_FILE" > "$SVC_FILE"
) || { echo "ABORT: connection setup failed (unusable connection string, or host is not the pinned antpolis-database-postgres-1); temporary credential files removed" >&2; exit 1; }
[ -s "$SVC_FILE" ] || { echo "ABORT: connection string was empty; temporary credential files removed" >&2; exit 1; }
printf 'service file: %s\n' "$SVC_FILE"

# (3) In-session mechanical gate — abort unless the CONNECTED server is the pinned
# container serving yacc_client on major 15 at the pinned listener port 5432.
# Identity layers: the converter (2) already refused any URL host other than
# 'antpolis-database-postgres-1' and any explicit URL port other than 5432; this
# gate binds the established connection to that container and port —
# host(inet_server_addr()) is the server-side address of the connection that just
# ran (netmask suffix removed) and must match an address Docker DNS resolves the
# pinned container name to on this network, and inet_server_port() must be exactly
# 5432. A reachable different server carrying a same-named yacc_client database on
# major 15 — or a second listener on the same container address at a non-default
# port — therefore aborts HERE, before any destructive step: database name, major,
# address or port alone cannot pass it. Database name and major are non-secret;
# nothing else is printed.
docker run --rm -i --network antpolis-database_database \
  -e PGSERVICEFILE=/run/yacc-svc \
  --mount type=bind,src="$SVC_FILE",dst=/run/yacc-svc,readonly \
  postgres:15 bash -c '
    db="$(psql "service=yacc_reset_admin" -Atc "SELECT current_database();")" || exit 1
    ver="$(psql "service=yacc_reset_admin" -Atc "SHOW server_version;")" || exit 1
    srv="$(psql "service=yacc_reset_admin" -Atc "SELECT host(inet_server_addr());")" || exit 1
    prt="$(psql "service=yacc_reset_admin" -Atc "SELECT inet_server_port();")" || exit 1
    case "$db $ver" in
      "yacc_client "15.*) ;;
      *) echo "ABORT: connected target is not yacc_client on PostgreSQL major 15 (got db=$db server=$ver)"; exit 1 ;;
    esac
    [ -n "$srv" ] || { echo "ABORT: connected server reported no network address"; exit 1; }
    [ "$prt" = "5432" ] || { echo "ABORT: connected listener port is not the pinned 5432 (got: $prt) — wrong-instance target refused"; exit 1; }
    EXP="$( { getent ahostsv4 antpolis-database-postgres-1 | awk "{print \$1}"; getent ahostsv6 antpolis-database-postgres-1 | awk "{print \$1}"; } | sort -u )"
    [ -n "$EXP" ] || { echo "ABORT: pinned container did not resolve on this network"; exit 1; }
    printf "%s\n" "$EXP" | grep -Fxq "$srv" \
      || { echo "ABORT: connected server address is not antpolis-database-postgres-1 on this network — wrong-server target refused"; exit 1; }
    echo "target pin OK: yacc_client on PostgreSQL $ver served by antpolis-database-postgres-1 on port 5432"
' || { echo "ABORT: target pin failed — refusing every destructive step"; exit 1; }

# (4) Schema inventory — abort on ANY ambiguity. The reset in §5 is valid ONLY for the
# single recorded application schema 'public'. Anything else (extra user schemas) is an
# ambiguity this procedure does not resolve.
SCHEMAS="$(docker run --rm -i --network antpolis-database_database \
  -e PGSERVICEFILE=/run/yacc-svc \
  --mount type=bind,src="$SVC_FILE",dst=/run/yacc-svc,readonly \
  postgres:15 \
  psql "service=yacc_reset_admin" -Atc \
  "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema') AND schema_name NOT LIKE 'pg_%' ORDER BY schema_name;")" \
  || { echo "ABORT: schema inventory query failed"; exit 1; }
[ "$SCHEMAS" = "public" ] \
  || { echo "ABORT: unexpected schema inventory — refusing to reset (got: $SCHEMAS; expected exactly: public)"; exit 1; }
echo "schema inventory OK: public only"
```

`<shared-admin-connection>` placeholder: the admin/owner role for the `yacc_client` schema on the shared server (`<founder to name>` — the shared server's ownership model is a host-internal fact). If that role cannot be supplied, the procedure stops here; nothing destructive runs.

### 3.1 Negative control — a wrong server and a same-IP/different-port listener abort (throwaway resources only)

This control proves the §3 gate refuses a wrong server **and** a wrong-port listener on the pinned server's own address **before** the §4 reset. It runs **only** on throwaway resources the operator creates for the control and removes afterwards — never the shared server, never a real database, never a real credential. Record the outcome as the §8 control row when the drill is executed.

Setup — two throwaway PostgreSQL 15 servers on a throwaway network, each with a database named `yacc_client` and operator-chosen **throwaway** credentials (same database name and major as the real target — that coincidence is the point of the control), **plus** a second throwaway PG15 listener inside `<nc-container-a>` on a different port (5433) — same container IP as the §3 gate's pinned name, same database name: that coincidence is the point of NC-1P/NC-2P. The second cluster is throwaway data the container's writable layer holds; it dies with `<nc-container-a>` at teardown (NC-4). No ports are published to the host:

```bash
docker network create <nc-network>
docker run -d --name <nc-container-a> --network <nc-network> \
  -e POSTGRES_USER=<nc-user> -e POSTGRES_PASSWORD=<nc-password> -e POSTGRES_DB=yacc_client postgres:15
docker run -d --name <nc-container-b> --network <nc-network> \
  -e POSTGRES_USER=<nc-user> -e POSTGRES_PASSWORD=<nc-password> -e POSTGRES_DB=yacc_client postgres:15
for c in <nc-container-a> <nc-container-b>; do                      # bounded readiness wait
  ok=""
  for i in $(seq 1 30); do
    docker exec "$c" pg_isready -U <nc-user> -d yacc_client >/dev/null 2>&1 && { ok=1; break; }
    sleep 2
  done
  [ -n "$ok" ] || { echo "ABORT (control): $c never became ready"; exit 1; }
done
# Second throwaway PG15 listener INSIDE <nc-container-a> — SAME container IP as the
# name the §3 gate pins, DIFFERENT port (5433), own throwaway cluster/data dir, same
# database name. Runs as the image postgres user (initdb/pg_ctl refuse root); must
# listen on the container network address and accept the gate client container, so
# listen_addresses and pg_hba.conf are widened exactly as the image entrypoint does.
docker exec -u postgres <nc-container-a> initdb -U <nc-user> -D /tmp/nc-pg5433 --auth=trust >/dev/null
docker exec -u postgres <nc-container-a> bash -c "printf \"listen_addresses = '*'\\n\" >> /tmp/nc-pg5433/postgresql.conf"
docker exec -u postgres <nc-container-a> bash -c "printf \"host all all all trust\\n\" >> /tmp/nc-pg5433/pg_hba.conf"
docker exec -u postgres <nc-container-a> pg_ctl -D /tmp/nc-pg5433 -o '-p 5433' -l /tmp/nc-pg5433.log -w start
docker exec -u postgres <nc-container-a> psql -h 127.0.0.1 -p 5433 -U <nc-user> -d postgres -c 'CREATE DATABASE yacc_client;'
```

| # | Action (against the throwaway pair only) | Required outcome |
|---|---|---|
| NC-1 | Run the §3 (2) conversion with a URL whose host is `<nc-container-b>` while `EXPECTED_HOST` is `<nc-container-a>` | converter exits non-zero and **no service file is written** — a wrong-host URL is refused before any credential file exists |
| NC-1P | Run the §3 (2) conversion with a URL for the pinned host `<nc-container-a>` at a non-5432 port (`postgresql://<nc-user>:<nc-password>@<nc-container-a>:5433/yacc_client`) | converter exits non-zero and **no service file is written** — a non-5432 port is refused before any credential file exists |
| NC-2 | Control-only bypass of (2): write a throwaway 0600 libpq stanza **by hand** whose `host=` is `<nc-container-b>` (throwaway credentials, never the real URL), then run the §3 (3) gate block with the pinned container name replaced by `<nc-container-a>` on `<nc-network>` | gate **aborts** at the server-identity comparison (container B's address ≠ container A's resolved address) even though db name and major alone would pass — the §4 `DROP SCHEMA` step never runs, because §3 must pass first |
| NC-2P | Control-only bypass of (2): write a throwaway 0600 libpq stanza **by hand** with `host=` `<nc-container-a>` and `port=` `5433` (the second listener above; user `<nc-user>`, throwaway password — never the real URL), then run the §3 (3) gate block with the pinned container name `<nc-container-a>` on `<nc-network>` | gate **aborts** at the `inet_server_port()` check (connected port 5433 ≠ pinned 5432) even though server address, database name and major all match — the §4 `DROP SCHEMA` step never runs, because §3 must pass first |
| NC-3 | Same control stanza as NC-2P with `port=` `5432` (or no `port=` line — libpq default) | gate passes ("target pin OK: … served by `<nc-container-a>` on port 5432") — the positive path still works |
| NC-4 | Tear the control down | `docker rm -f <nc-container-a> <nc-container-b> && docker network rm <nc-network>` (the second listener is a process inside `<nc-container-a>` and dies with it) |

Hand-writing a libpq stanza is allowed **only** inside this control — throwaway values, throwaway network, never the shared server, never the real connection string. The same gate shape guards [compose-backup-restore.md](compose-backup-restore.md) §3.1a (shared source) and §4.2 (restore target), where a wrong host or a non-5432 listener port aborts before `pg_dump`/`pg_restore`.

---

## 4. Full reset (schema-scoped — AC-MIG-071-1, part 1)

**Founder gate 1 (record before crossing):** confirm the §2 P3 backup is complete and retrievable, the §3 pin just passed, and the target is exactly `yacc_client`. Explicit recorded go/no-go.

**Stop the backend first** (a reset with the app running would race its connections and re-create state mid-reset). This is an environment mutation — record it:

```bash
cd <repo-root>
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env stop backend
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env ps   # backend must show exited/stopped
```

Then the reset. It drops and recreates **only the `public` schema of `yacc_client`** — all application tables, Flyway history, Quartz/DLQ tables, sessions, tokens, credentials, and audit rows are schema objects and reset with it. It never issues `DROP DATABASE` and never addresses any other database:

```bash
# Requires $SVC_FILE + trap from §3 (same shell). Re-run §3 first if the shell changed.
docker run --rm -i --network antpolis-database_database \
  -e PGSERVICEFILE=/run/yacc-svc \
  --mount type=bind,src="$SVC_FILE",dst=/run/yacc-svc,readonly \
  postgres:15 bash -c '
    db="$(psql "service=yacc_reset_admin" -Atc "SELECT current_database();")" || exit 1
    [ "$db" = "yacc_client" ] || { echo "ABORT: pre-reset re-check failed (db=$db)"; exit 1; }
    # Server-identity re-assert at the moment of destruction: the address the server
    # accepted this connection on must still belong to the pinned container, and the
    # connected listener port must still be the pinned 5432 — a second listener on
    # the same address at a non-default port refuses here.
    prt="$(psql "service=yacc_reset_admin" -Atc "SELECT inet_server_port();")" || exit 1
    [ "$prt" = "5432" ] || { echo "ABORT: pre-reset re-check failed (connected listener port is $prt, not the pinned 5432)"; exit 1; }
    srv="$(psql "service=yacc_reset_admin" -Atc "SELECT host(inet_server_addr());")" || exit 1
    EXP="$( { getent ahostsv4 antpolis-database-postgres-1 | awk "{print \$1}"; getent ahostsv6 antpolis-database-postgres-1 | awk "{print \$1}"; } | sort -u )"
    [ -n "$EXP" ] || { echo "ABORT: pinned container did not resolve on this network"; exit 1; }
    printf "%s\n" "$EXP" | grep -Fxq "$srv" \
      || { echo "ABORT: connected server is not antpolis-database-postgres-1 — refusing the reset"; exit 1; }
    psql "service=yacc_reset_admin" -v ON_ERROR_STOP=1 \
      -c "DROP SCHEMA public CASCADE;" \
      -c "CREATE SCHEMA public;" || exit 1
    echo "reset done: schema public of yacc_client dropped and recreated"
' || { echo "ABORT: reset did not complete cleanly — see §9; do NOT restart the backend"; exit 1; }
```

**Forbidden everywhere in this procedure** (each is an abort + incident record, not an option): `DROP DATABASE` / `CREATE DATABASE` on the shared server; `DROP ROLE` / `ALTER ROLE` / `ALTER SYSTEM`; any statement addressing a database other than `yacc_client`; `TRUNCATE`/`DROP` of any schema other than `public` of `yacc_client`; destructive statements through any connection path other than the §3-verified service file.

**Post-reset ownership note (honest gap, not an invented fact):** `CREATE SCHEMA public` assigns ownership per the shared server's own defaults; if the §3 admin role is not the application role, the app's Flyway boot may lack `CREATE`/`USAGE` on the fresh schema. The required re-grant is a shared-server convention this repository cannot verify — `<founder to name>` supplies it through the same §3 connection if boot fails on privilege errors (record the grant as an environment mutation). Never "fix" it by granting superuser or touching other databases.

**Founder gate 2 (record):** reset observed complete (schema empty) before any restart.

---

## 5. Deterministic first-run bootstrap verification (AC-MIG-071-1, part 2)

Restart the backend on the empty schema. Bootstrap (ADR-025) is deterministic: when no `SUPER_ADMIN` exists at startup, exactly one is created from the configured `YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL` + one-time initial credential, marked forced-password-change, audit-logged; **missing configuration on an admin-less database fails startup** (fail-closed).

```bash
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env up -d
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env ps      # wait for healthy (start_period 90s)
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env logs --tail 80 backend | \
  grep -iE 'Flyway|Started YaccApplication|bootstrap|recovery' > <artifact-link>/boot1.log
```

**Gate (bootstrap-from-empty):** Flyway migrates the full schema from zero, `Started YaccApplication`, and the bootstrap audit shows exactly **one** Super Admin created from the configured email with forced credential change. Red ⇒ abort per §9.

**Idempotency check (determinism evidence):** restart once more and confirm **no second** Super Admin is created (the log shows no new bootstrap creation — the existing identity is kept):

```bash
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env restart backend
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env logs --tail 80 backend | \
  grep -iE 'bootstrap|Started YaccApplication' > <artifact-link>/boot2.log
```

**Gate (idempotency):** `boot2.log` shows `Started YaccApplication` and **no** new bootstrap creation row — the existing Super Admin is kept, none is created. A second creation is a product finding (record, abort per §9 — never normalize).

**Forced credential change (ADR-025):** the bootstrap identity carries `mustChangePassword=true`; every path outside `/api/auth/`, `/health`, `/actuator` returns 403 until the credential is replaced. Complete the change through [compose-staging.md](compose-staging.md) §5 Step 3/3b (Path A dedicated identity preferred; Path B replaces the bootstrap credential and is recorded as the environment mutation it is). Record the outcome in the §8 evidence rows.

---

## 6. Founder-controlled recovery drill (AC-MIG-071-2)

**Recovery medium (pinned, ADR-025 + #362 guardrail F4):** the env-gated restart flag — `RECOVERY_MODE=once` + founder-held `RECOVERY_KEY`, delivered **out-of-band through the operator-held, SOPS-derived env file** (`deploy/compose/secrets/staging.env`, mode 0600) — never a public endpoint, never a repo artifact, never a command argument. The durable verification material is `YACC_RECOVERY_KEY_HASH` (SHA-256 of the key); only the founder holds the preimage. Recovery forces a **fresh** credential (never restores an old one) and is audit-logged on every use. `RECOVERY_MODE` must be returned to **empty** afterwards (§6.4).

### 6.1 Generate the recovery pair (founder-held preimage + pinned hash)

```bash
# Preimage and digest are generated into 0600 files; neither value is echoed, passed
# as an argument, or left in history. The digest is of the EXACT key string (no
# trailing newline). Requires bash, openssl, sha256sum, mktemp (P6).
umask 077
KEY_FILE="$(mktemp)"; HASH_FILE="$(mktemp)"
trap 'rm -f -- "$KEY_FILE" "$HASH_FILE"' EXIT
trap 'rm -f -- "$KEY_FILE" "$HASH_FILE"; exit 130' INT TERM
openssl rand -base64 48 > "$KEY_FILE"                                  # founder-held preimage
printf '%s' "$(cat "$KEY_FILE")" | sha256sum | awk '{print $1}' > "$HASH_FILE"
echo "pair generated; preimage at $KEY_FILE (0600), digest at $HASH_FILE (0600)"
```

Edit the **decrypted** `staging.env` (mode 0600, no-swap/no-history editor, values never in argv/history): set `RECOVERY_KEY` to the preimage from `$KEY_FILE` and `YACC_RECOVERY_KEY_HASH` to the digest from `$HASH_FILE`. Then verify the pair **in-process** — the file is read as data and only the verdict prints:

```bash
# Mechanical pair check — reads the decrypted env as DATA (never sourced/eval'd),
# recomputes SHA-256(RECOVERY_KEY) and compares it to YACC_RECOVERY_KEY_HASH.
# Prints MATCH or ABORT — never a value.
python3 - deploy/compose/secrets/staging.env <<'PY'
import hashlib, sys
values = {}
for line in open(sys.argv[1]):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    values[k] = v
key = values.get("RECOVERY_KEY", "")
digest = values.get("YACC_RECOVERY_KEY_HASH", "")
if not key or not digest:
    print("ABORT: RECOVERY_KEY or YACC_RECOVERY_KEY_HASH missing/empty")
    sys.exit(1)
if hashlib.sha256(key.encode()).hexdigest() == digest:
    print("MATCH: YACC_RECOVERY_KEY_HASH equals SHA-256(RECOVERY_KEY)")
else:
    print("ABORT: recovery pair does not match")
    sys.exit(1)
PY
```

**Gate**: `MATCH` or abort — a drill with a mismatched pair proves nothing and must not run.

### 6.2 Enable recovery mode and restart (environment mutation — record)

Edit `staging.env` again: set `RECOVERY_MODE=once`. Then recreate so the container picks up the env-file change:

```bash
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env up -d    # recreate: env_file content changed
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env ps       # wait for healthy
```

On boot with `RECOVERY_MODE=once` + a matching key, ADR-025 recovery **re-provisions the bootstrap Super Admin** (fresh credential, forced password change, ACTIVE status) and audit-logs the use. Observe and record — do not invent log text; grep and archive what the service actually emits:

```bash
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env logs --tail 120 backend | \
  grep -iE 'recovery|bootstrap|Started YaccApplication' > <artifact-link>/recovery.log
```

**Gate (recovery exercised):** the log shows the recovery/bootstrap re-provision audit for the configured bootstrap email, and `Started YaccApplication`. If the log shows recovery did **not** trigger, stop and record (§9) — never retry with varied keys.

### 6.3 Prove the fresh-credential property

The previous bootstrap credential must **no longer authenticate**, and the fresh credential must carry `mustChangePassword=true`. Run the sign-in flow of [compose-staging.md](compose-staging.md) §5 Step 3 **twice**: once with the pre-drill credential (expect failure — record the status), once with the fresh recovery-issued credential (expect success + `mustChangePassword=true`), then resolve the forced change via Step 3b and confirm `GET /api/conversations` returns 200. Record all outcomes.

### 6.4 Unset recovery mode immediately (environment mutation — record)

`RECOVERY_MODE=once` is single-use by contract; leaving it set is a standing hazard. Edit `staging.env`: return `RECOVERY_MODE` to **empty** (keep the rotated `RECOVERY_KEY`/hash pair — it is the new pin), recreate, and confirm health:

```bash
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env up -d
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env ps
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env logs --tail 40 backend | \
  grep -icE 'recovery' || true   # expected: no new recovery activity
```

**Gate**: backend healthy; no recovery activity in the fresh log slice; `RECOVERY_MODE` empty in `staging.env`. The §7.7 re-encryption carries the new pair into the committed artifact.

---

## 7. Secret/key rotation (AC-MIG-071-3)

**Standing rules (each rotation follows all of them):**

- Every value is generated by the operator into mode-`0600` files (§6.1 pattern) and enters `staging.env` only through the no-swap/no-history editor — never argv, history, or logs.
- **Rotation order is pinned** below. Do not reorder: the order keeps every restart verifiable and lands the recovery-pair drill on the final pair.
- **Restart ordering:** after each rotation batch, `docker compose … up -d` (recreate), wait `healthy`, and gate on the boot log (`Flyway` + `Started YaccApplication`) **before** the next batch. One batch per restart — a failed gate must identify its batch.
- **Never leave a placeholder or drill value past the drill.** The post-drill env is the operated env; §7.7 re-encrypts it into the committed artifact.
- **No rollback.** If a rotation leaves the stack unhealthy, fix forward (regenerate the value, recreate) — reverting to a previous value after the store has booted with the new one is the undefined-state path ([compose-roll-forward.md](compose-roll-forward.md)).

| # | Rotate | How | Why this order |
|---|--------|-----|----------------|
| 7.1 | `YACC_AUTH_TOKEN_SIGNING_KEY` | operator-generated RSA-2048 key, base64 PKCS#8 DER (shape per [compose-staging.md](compose-staging.md) §3.2) | first: it is not data-coupled; JWTs minted before the drill are disposable on a post-reset stack |
| 7.2 | `YACC_INTEGRATION_ENCRYPTION_MASTER_KEY` | operator-generated 32-byte base64 key | second, **on the post-reset empty datastore**: stored integration credentials are encrypted under the old key (ADR-027 fail-closed) — on an empty schema there is nothing to carry over. A later rotation on a **populated** environment must first resolve the stored-credential re-encryption path as a separate founder-owned decision; this document does not claim one exists |
| 7.3 | `YACC_AUTH_EMAIL_SENDGRID_API_KEY` | stays empty while `YACC_AUTH_EMAIL_PROVIDER=smtp` (record the deliberate emptiness); rotate only if SendGrid is adopted | provider-scoped, not data-coupled |
| 7.4 | `POSTGRES_USER` / `POSTGRES_PASSWORD` | **shared-server-owned**: the role credential is changed by the shared server's owner flow (`<founder to name>`), then `staging.env` is updated to match and the batch is restarted + health-gated. If the founder declines this rotation, record the deliberate skip — never half-rotate (env changed, server not) | the app's database credential must match the server; the server side is founder-owned |
| 7.5 | Bootstrap identity | replaced by the completed forced change (§5, Step 3b Path B) or by re-bootstrap on the empty schema — record which path | the credential is proven replaced, not assumed |
| 7.6 | `RECOVERY_KEY` + `YACC_RECOVERY_KEY_HASH` | rotate **as a matching pair** (never one without the other) using §6.1; re-run the §6.1 pair check (`MATCH`) | last so the §6 drill exercised the final pair; the pair check makes the pin mechanical |
| 7.7 | SOPS re-encryption | §7.7 below — after the final batch is healthy | the committed artifact must equal the operated env |

### 7.7 SOPS re-encryption (fail-closed)

After the final rotation batch is healthy, re-encrypt the operated env into the committed artifact — same recipients (`.sops.yaml` rules; both committed age recipients), atomic replace, no partial output:

```bash
cd <repo-root>
umask 077
# NEVER redirect straight onto the committed artifact; encrypt into a fresh 0600
# temp file, verify it is really encrypted, then atomically rename into place.
TMPSOPS="$(mktemp deploy/compose/secrets/.staging.sops.env.XXXXXX)"
chmod 600 "$TMPSOPS"
if ! sops -e deploy/compose/secrets/staging.env > "$TMPSOPS"; then
  rm -f "$TMPSOPS"
  echo "ABORT: sops encryption failed — the committed artifact was NOT modified" >&2
  exit 1
fi
sops filestatus "$TMPSOPS" | grep -q '"encrypted":true' \
  || { rm -f "$TMPSOPS"; echo "ABORT: re-encrypted file is not marked encrypted" >&2; exit 1; }
mv -fT "$TMPSOPS" deploy/compose/secrets/staging.sops.env
sops filestatus deploy/compose/secrets/staging.sops.env | grep -q '"encrypted":true' \
  || { echo "ABORT: committed artifact failed the post-move encryption check" >&2; exit 1; }
git diff --stat -- deploy/compose/secrets/staging.sops.env   # changed ciphertext only; review before commit
```

The decrypted `staging.env` stays operator-held (git-ignored, mode 0600). Never commit, log, or paste it. Re-encryption changes only ciphertext — verify with `git diff` that no plaintext ever reached the working tree (it cannot: `secrets/*.env` is git-ignored; the scan is belt-and-braces).

---

## 8. Evidence-record template (AC-MIG-071-1..3 record shapes)

One row per workflow, filled at execution time by the operator. **All fields start empty — this template is unusable as "proof" until a human fills it.** Same shape as [compose-staging.md](compose-staging.md) §6; completed records live on **#362**.

| # | Workflow | Operator | Timestamp (UTC) | Commit SHA | Environment | Result | Evidence link |
|---|----------|----------|-----------------|------------|-------------|--------|---------------|
| 1 | Pre-reset backup ([compose-backup-restore.md](compose-backup-restore.md) §3) | | | | `staging` | | `<artifact-link>` |
| 2 | Target pin + schema inventory (§3) | | | | `staging` | | `<artifact-link>` |
| 3 | Full reset (§4) + founder gates 1–2 | | | | `staging` | | `<artifact-link>` |
| 4 | Bootstrap-from-empty + idempotency (§5) | | | | `staging` | | `<artifact-link>` |
| 5 | Forced credential change (§5) | | | | `staging` | | `<artifact-link>` |
| 6 | Recovery pair + pair check (§6.1) | | | | `staging` | | `<artifact-link>` |
| 7 | Recovery drill + fresh-credential proof (§6.2–6.3) | | | | `staging` | | `<artifact-link>` |
| 8 | Recovery mode unset (§6.4) | | | | `staging` | | `<artifact-link>` |
| 9 | Rotation batches 7.1–7.6 (one row per batch) | | | | `staging` | | `<artifact-link>` |
| 10 | SOPS re-encryption (§7.7) | | | | `staging` | | `<artifact-link>` |
| 11 | Negative controls — wrong host + same-IP/different-port (§3.1 — throwaway resources only) | | | | `throwaway control` | | `<artifact-link>` |

Rules: timestamps UTC; every environment mutation (backend stop/start, credential replacement, env edits, re-grant) is recorded in the row of the workflow that caused it — never silently normalized; **empty rows mean the workflow did not happen**; no POC identity survives (recovery never resurrects one — ADR-025); secret values never appear in artifacts. **This procedure is not evidence.**

---

## 9. Abort criteria

Abort immediately, record the rows filled so far, and halt if any of these occurs:

- Any §2 prerequisite is unmet or lapses mid-run (especially: the founder is no longer present at a gate, or the P3 backup cannot be retrieved).
- Any §3 pin fails or anything is **ambiguous** (container/network mismatch, connected server not bound to the pinned container by the §3 gate, connected listener port not the pinned 5432, database/major mismatch, unexpected schema inventory, failed verification query). Ambiguity is an abort, never a judgment call.
- The reset block exits non-zero, or its post-conditions cannot be verified.
- Bootstrap does not produce exactly one forced-change Super Admin, boot fails, or a restart creates a second Super Admin (that is a product finding, recorded — not normalized).
- The recovery pair check does not print `MATCH`; recovery does not trigger; the pre-drill credential still authenticates after recovery.
- `RECOVERY_MODE` cannot be returned to empty and confirmed off.
- Any rotation batch fails its restart/health gate, or a re-grant on the shared server cannot be supplied by `<founder to name>`.
- The §7.7 re-encryption fails its encryption checks.
- Any command would touch another database, a role, server configuration, the shared gateway, DNS, or anything outside §1's table.

On abort: **do not restart the backend into a half-reset state**; recover only by founder decision — the P3 backup restored per [compose-backup-restore.md](compose-backup-restore.md) (disaster-restore posture, §2 there), or a clean re-run from §3. Report on **#362**; no partial pass may be claimed.

---

## 10. What not to do

- **No shared-server expansion.** Never `DROP DATABASE`, never create/drop databases, roles, or server settings on `antpolis-database-postgres-1`; never touch another workload's schema. The reset is schema-scoped inside `yacc_client` or it does not happen.
- **No recovery mode left on.** `RECOVERY_MODE` returns to empty in the same session (§6.4) and the new pair lands in the re-encrypted artifact (§7.7).
- **No secret values anywhere** — argv, history, logs, evidence, or the repo. The decrypted env file is data only: never `source`/`eval`.
- **No rollback after forward state exists.** A botched rotation is fixed forward (regenerate + recreate); reverting values after the store booted with new ones is the undefined path.
- **No placeholder values past the drill** — the post-drill env is the operated env.
- **No claims from this document.** Completed §8 rows attached to #362 are the evidence; editing this file never creates one.

---

**Last Updated**: 2026-11-13 (authored by MIG-070e #488; feeds MIG-071 #362 AC-MIG-071-1..3; pins the recovery medium (env-gated `RECOVERY_MODE=once` + founder-held `RECOVERY_KEY` via the operator-held SOPS-derived env file) and the rotation order; review pass 1 (PR #492): server-identity binding added — converter rejects any URL host other than the pinned `antpolis-database-postgres-1`, §3/§4 gate and reset block bind the connected server to the pinned container via `inet_server_addr()` ↔ container address, §3.1 wrong-host negative control added; review pass 2 (PR #492): port identity added — converter rejects any explicit URL port other than the pinned 5432, §3 gate and §4 pre-DROP re-assert additionally require the connected listener to report `inet_server_port()` = 5432, §3.1 same-IP/different-port negative controls (NC-1P/NC-2P) added; procedure only — no execution claimed)
