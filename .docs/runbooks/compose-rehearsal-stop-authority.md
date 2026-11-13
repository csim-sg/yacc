# Cutover Rehearsal & Stop-Authority Drill (Compose) — `compose-rehearsal-stop-authority.md`

**Status**: Documented procedure (MIG-070e #488). **Not evidence of execution.**
**Audience**: the founder/sole operator (OPC)
**Source issue**: https://github.com/csim-sg/yacc/issues/488
**Related**: [compose-staging.md](compose-staging.md) (staging target; its §6 evidence template is the record shape) · [compose-backup-restore.md](compose-backup-restore.md) (executed at Steps 3–5) · [compose-roll-forward.md](compose-roll-forward.md) (incident path exercised at Step 7) · [compose-reset-recovery-rotation.md](compose-reset-recovery-rotation.md) (reset/recovery/rotation live there — never here) · ADR-032 (Compose target) · ADR-029 (runtime envelope) · ADR-027 (Flyway, forward-only) · ADR-025 (bootstrap behaviour on an empty candidate DB)

> **This is a procedure, not evidence.** Nothing in this document asserts that a rehearsal, deploy, backup, restore, or drill has happened. The rehearsal execution, the attributable operator record (AC-10 as amended, `17ea19d6`), and the stop-authority exercise are owned by **MIG-070 (#361)** — this document only defines how they are performed and recorded.
>
> **Amended 2026-11-13 — optional procedure:** the mandatory DR-rehearsal requirement this procedure served was retired by the founder scope decision of 2026-11-13 (“no need for such DR processes” — SPEC-002 “Scope amendment — 2026-11-13”, Antpolis/documentation PR #24, merge `e4c0ead`). **AC-MIG-070-1** now requires the staging health gates (`/health/live` + `/health/ready` through the deployed host) plus one authenticated read (`GET /api/conversations` 200) — not this rehearsal. Running and recording this procedure on #361 remains permitted and voluntary; nothing here is a gate.
>
> **Rehearsal ≠ production cutover.** The rehearsal runs on **candidate resources only** — its own Compose project, its own network, its own candidate database container — never the live staging project (`yacc-app`), never the shared networks (`treafik-proxy`, `antpolis-database_database`), never the shared PostgreSQL server `antpolis-database-postgres-1`, never production. The production cutover is **MIG-072 (#363)** and is founder-governed; no step here authorizes or performs it.

---

## 1. Preconditions (all must hold before starting)

| # | Item | Requirement | Owner |
| - | ---- | ----------- | ----- |
| P1 | Authorization + operator | The run is founder-authorized and will be recorded on **#361** (AC-MIG-070-1): one attributable record per workflow — operator / UTC timestamp / commit SHA / environment / result. The operator is the founder/sole operator (OPC). **Amended 2026-11-13:** this rehearsal is an optional procedure — AC-MIG-070-1 now requires the staging health gates plus one authenticated read, not a rehearsal record (founder decision “no need for such DR processes”; SPEC-002 “Scope amendment — 2026-11-13”, Antpolis/documentation PR #24, merge `e4c0ead`); a voluntary run may still be recorded on #361. | Founder |
| P2 | Stop authority | The founder is personally present and reachable for the drill; an unattended rehearsal does not start. | Founder |
| P3 | Candidate isolation | A **dedicated candidate Compose project** `<candidate-project>` with its own network and its own candidate database container (§2.1) — **never** the live `yacc-app` project, never a project that joins `treafik-proxy` or `antpolis-database_database`, no shared production credentials. The Step-1 guards fail closed unless the resolved Docker state is clean. | Operator |
| P4 | Secret material present | The operator's decrypted `deploy/compose/secrets/staging.env` exists (mode 0600; [compose-staging.md](compose-staging.md) §3.1) — the candidate reuses it as **data** (`env_file`), never `source`d. Its values are operator-held; nothing is copied into runbooks or evidence. | Operator |
| P5 | Images pinned | Candidate image pinned by an **immutable tag** (`<image-tag>` — an immutable `sha-<commit>` OCI tag from the CI registry; **never `latest`** or another mutable tag) **and a distinct forward-fix image tag** (`<forward-fix-image-tag>` — likewise an immutable `sha-<commit>` tag, **different from `<image-tag>`**, provenance recorded as `<artifact link>`). Step 7 fails closed if the two tags are not distinct. | Operator |
| P6 | Candidate database | The candidate project defines its own PostgreSQL **15** server container (`db`) with a disposable data directory and database `<candidate-database>` (§2.1). The candidate backend's `DATABASE_URL` must reference **only** the candidate database — verified by name (never the value) in guard G4. | Operator |
| P7 | Rehearsal window + stop authority | Window agreed; stop authority = the founder, reachable for the drill. (Backup/restore consistency does **not** depend on this window — see [compose-backup-restore.md](compose-backup-restore.md) §3.2.) | Founder |
| P8 | Operator tooling | **`bash`** — the Step-1 guard block uses Bash-only features (`set -o pipefail`): run it under `bash`, not POSIX `sh`/dash. Plus docker + compose plugin, **`python3` (standard library only)**, `curl`, and the `postgres:15` image present or pullable (candidate server + backup/restore client). | Operator |

**Stop** if any row is unmet. Record the abort per §4 and in the §3 evidence template, and halt.

---

## 2. Rehearsal sequence (overview)

```
candidate deploy → health gates → backup → restore into candidate DB
  → post-restore integrity checks → stop-authority drill → roll-forward path check
```

Every step records one row in the §3 evidence template.

### 2.1 The candidate stack (separate project, network, database)

The operator creates the candidate compose file **on the staging host, by hand, before the rehearsal** — it is rehearsal-owned and **never committed to the repository** (suggested location `deploy/compose/compose.candidate.yml` so the `env_file` relative paths resolve alongside the committed staging files; delete it when the rehearsal is over). Replace every `<placeholder>` before use — same discipline as [compose-staging.md](compose-staging.md) §3.2 (`<candidate-db-user>` / `<candidate-db-password>` are operator-chosen **throwaway** values for a disposable database; never reuse a real secret; never commit them):

```yaml
# ============================================================================
# Rehearsal candidate stack — operator-created on the staging host, NEVER
# committed to the repository. Separate project + network + database; joins NO
# external network (no shared gateway, no shared PostgreSQL server), publishes
# no ports, defines no Traefik labels. The candidate DB data dir is disposable
# (tmpfs): nothing persists beyond the run.
# ============================================================================
name: <candidate-project>

services:
  db:
    image: postgres:15                       # candidate server major 15 — the same-major rule
    restart: "no"                            # rehearsal-managed; no auto-restart loops
    environment:
      POSTGRES_USER: <candidate-db-user>           # operator-chosen throwaway values,
      POSTGRES_PASSWORD: <candidate-db-password>   # replaced before use; never committed
      POSTGRES_DB: <candidate-database>
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U <candidate-db-user> -d <candidate-database>"]
      interval: 5s
      timeout: 3s
      retries: 30
    tmpfs:
      - /var/lib/postgresql/data            # disposable in-memory data dir (default tmpfs
                                            # size is host-dependent — rehearsal data only)
    networks:
      - cand

  backend:
    image: ${YACC_BACKEND_IMAGE:?YACC_BACKEND_IMAGE required — pinned sha-<commit> tag, never latest}
    restart: "no"
    depends_on:
      db:
        condition: service_healthy
    user: "1000:1000"
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:uid=1000,gid=1000
      - /app/heap-dumps:uid=1000,gid=1000,mode=700
      - /app/logs:uid=1000,gid=1000,mode=700
    env_file:
      - ./backend.staging.env               # non-secret staging values (relative to this file)
      - path: ./secrets/staging.env         # operator-decrypted SOPS artifact (0600), as data
        required: true
    environment:
      # Candidate pin: this backend serves ONLY the candidate database.
      # environment: wins over both env_file values (compose precedence).
      DATABASE_URL: jdbc:postgresql://db:5432/<candidate-database>
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:8080/health/ready"]
      interval: 15s
      timeout: 5s
      retries: 12
      start_period: 90s
    networks:
      - cand

networks:
  cand:
    internal: true    # no external reachability: the candidate cannot touch the
                      # shared server, the shared gateway, or the internet
```

### Step 1 — Candidate deploy (provably isolated)

Run every guard first. **Any guard failure aborts the rehearsal (§4)** — never "work around" a guard by picking a different project, network, or database. Absence checks are fail closed: a resource counts as absent **only** on the tool's explicit empty/not-found response; every other failure — daemon unreachable, permission denied, timeout — aborts the rehearsal, because an unverifiable Docker state is never treated as a free one:

```bash
# Fail-closed absence helper — empty output proves absence; every non-zero exit aborts.
require_absent_docker() {  # <list-command...> <label>
  local label="$1"; shift
  local out rc=0
  out="$("$@" 2>&1)" || rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "ABORT: $label — docker query failed (exit $rc); an unverifiable Docker state is never treated as free" >&2
    printf '%s\n' "$out" >&2
    exit 1
  fi
  [ -z "$out" ] || { echo "ABORT: $label — resources already exist:"; printf '%s\n' "$out" >&2; exit 1; }
}

# G1 — expected Docker context (fail closed)
test "$(docker context show)" = "<candidate-docker-context>" \
  || { echo "ABORT: wrong Docker context — refusing to deploy (got $(docker context show))"; exit 1; }

# G2 — the candidate project's scope is clean: no containers, networks, or volumes
# carry its project label (fail closed: empty result proves absence)
require_absent_docker "candidate containers" \
  docker ps -a --filter "label=com.docker.compose.project=<candidate-project>" --format '{{.Names}}'
require_absent_docker "candidate networks" \
  docker network ls --filter "label=com.docker.compose.project=<candidate-project>" --format '{{.Name}}'
require_absent_docker "candidate volumes" \
  docker volume ls --filter "label=com.docker.compose.project=<candidate-project>" --format '{{.Name}}'

# G3 — candidate project name is unique and is not the live staging project (fail closed)
test "<candidate-project>" != "yacc-app" \
  || { echo "ABORT: candidate project name must differ from the live staging project yacc-app"; exit 1; }
PROJECTS="$(docker compose ls --format json)" \
  || { echo "ABORT: docker compose ls failed"; exit 1; }
printf '%s' "$PROJECTS" | EXPECTED='<candidate-project>' python3 -c '
import json, os, sys
try:
    entries = json.load(sys.stdin)
except ValueError:
    sys.exit(1)                      # unparseable listing => fail closed
names = [e.get("Name") for e in entries if isinstance(e, dict)]
sys.exit(0 if os.environ["EXPECTED"] not in names else 1)
' || { echo "ABORT: candidate project name '<candidate-project>' is already in use"; exit 1; }

# G4 — the rendered candidate config pins the candidate database and touches no
# shared surface (fail closed; names only). The render contains decrypted values
# (env_file is inlined): private 0600 temp, greps compare NAMES only, removed after.
umask 077
RENDER="$(mktemp)"
docker compose -f deploy/compose/compose.candidate.yml \
  --env-file deploy/compose/backend.staging.env config > "$RENDER" \
  || { echo "ABORT: candidate render failed"; rm -f "$RENDER"; exit 1; }
grep -q "DATABASE_URL: jdbc:postgresql://db:5432/<candidate-database>" "$RENDER" \
  || { echo "ABORT: candidate DATABASE_URL does not pin db:5432/<candidate-database>"; rm -f "$RENDER"; exit 1; }
grep -Eq "treafik-proxy|antpolis-database_database" "$RENDER" \
  && { echo "ABORT: candidate config references a shared network"; rm -f "$RENDER"; exit 1; }
grep -q "traefik.enable" "$RENDER" \
  && { echo "ABORT: candidate config must define no routing labels"; rm -f "$RENDER"; exit 1; }
rm -f "$RENDER"   # contained decrypted values — always removed
echo "G4 OK: candidate pins db:5432/<candidate-database>; no shared network; no routing labels"

# G5 — derived resource names are free (fail closed; compose names containers
# '<project>-<service>-<index>' and the declared network '<project>_<name>')
NAMES="$(docker ps -a --format '{{.Names}}')" \
  || { echo "ABORT: docker ps failed"; exit 1; }
for n in <candidate-project>-backend-1 <candidate-project>-db-1; do
  printf '%s\n' "$NAMES" | grep -qx "$n" \
    && { echo "ABORT: container name '$n' already exists"; exit 1; }
done
NETS="$(docker network ls --format '{{.Name}}')" \
  || { echo "ABORT: docker network ls failed"; exit 1; }
printf '%s\n' "$NETS" | grep -qx "<candidate-project>_cand" \
  && { echo "ABORT: network name '<candidate-project>_cand' already exists"; exit 1; }
echo "G1–G5 passed"
```

Only when **all five guards pass**:

```bash
docker compose -f deploy/compose/compose.candidate.yml \
  --env-file deploy/compose/backend.staging.env up -d
docker compose -f deploy/compose/compose.candidate.yml \
  --env-file deploy/compose/backend.staging.env ps      # wait: db + backend healthy
docker compose -f deploy/compose/compose.candidate.yml \
  --env-file deploy/compose/backend.staging.env logs --tail 60 backend | \
  grep -E 'Flyway|Started YaccApplication' || { echo "ABORT: candidate boot evidence missing"; exit 1; }
```

On the empty candidate database the backend migrates the full schema and bootstraps exactly one Super Admin (ADR-025) — expected first-boot behaviour; record it, it is not a defect.

### Step 2 — Health gates (candidate loopback)

The frozen actuator wire paths are `/health/live` and `/health/ready` (ADR-029). The candidate publishes **no ports and has no routing** (P3) — health is read on the container's own loopback:

```bash
docker exec <candidate-project>-backend-1 \
  curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/health/live   # expect 200
docker exec <candidate-project>-backend-1 \
  curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/health/ready  # expect 200
```

**Gate**: both print 200 (and exit 0) before proceeding. Red gate ⇒ abort per §4. **Interpretation guard:** this is loopback-in-container evidence only — it is **not** an ingress/gateway proof, and the candidate must never be attached to a shared network to "make it one". Publicly-routed health evidence belongs to [compose-staging.md](compose-staging.md) §5 on the real target.

### Step 3 — Backup (candidate source)

Execute the backup per [compose-backup-restore.md](compose-backup-restore.md) §3 with the **candidate database as the source**: in §3.2 the connection string is `postgresql://<candidate-db-user>:<candidate-db-password>@db:5432/<candidate-database>` (host `db` — the candidate `db` service name resolves on the candidate network), the client containers join the candidate network `<candidate-project>_cand` instead of the shared one, and §3.1a (shared-server pin) does **not** apply — a rehearsal backup reads only candidate resources. §3.2's converter host pin follows the source: set `EXPECTED_HOST=db` for the rehearsal source (`antpolis-database-postgres-1` remains the pin for the shared staging source). Record the dump artifact as `<artifact link>`.

**Gate**: backup completes and its artifact is storable/retrievable in the operator's storage location (`<artifact-link>`).

### Step 4 — Restore into a candidate database

Execute the restore per [compose-backup-restore.md](compose-backup-restore.md) §4–5 into a **second, fresh candidate database** on the same candidate server (§4.1 rehearsal shape: `docker exec <candidate-project>-db-1 createdb -U <candidate-db-user> <candidate-restored-database>`, then declare `CAND_EXPECTED_HOST=db`, `CAND_CONTAINER=<candidate-project>-db-1`, `CAND_DB=<candidate-restored-database>` so the §4.2 identity gate binds the restore to this container and database) — never into `<candidate-database>`, which the candidate backend is serving.

### Step 5 — Post-restore integrity checks

Run the verification queries from [compose-backup-restore.md](compose-backup-restore.md) §5 against the restored candidate database and compare against the source captures from its §3.2 (taken from the same MVCC snapshot as the dump):

- `flyway_schema_history` versions/success flags match the source snapshot baseline (ADR-027 schema state).
- Exact row counts of the key tables match the same-snapshot baseline (the counted-diff gate — see the linked procedure for why separate live queries are never used).
- No step modifies the restored data — checks are read-only.

**Gate**: all checks match. Mismatch ⇒ abort per §4; do not proceed with a partial match.

### Step 6 — Stop-authority drill

The drill exercises the **decision and recording discipline**. Under the OPC operating model there is no escalation ladder: the founder/sole operator holds stop authority directly (SPEC-002 AC-10 as amended, `17ea19d6`); the trigger vocabulary comes from [compose-roll-forward.md](compose-roll-forward.md):

1. State a rehearsed stop condition (e.g. "suspected data loss during rehearsal step N") and classify it against the roll-forward trigger list (record: what, when, why).
2. The founder issues an **explicit, recorded stop** ("halt all deploys and changes").
3. The halt is confirmed — no further deploys, resets, or configuration changes; the candidate stack is frozen as-is — and the drill ends with an explicit **resume** decision, recorded the same way.

Stop authority is exercised by the founder in person. It is never simulated, pre-filled, or attributed to an agent. The drill passes only if the condition, stop, halt-confirmation, and resume are all evidenced in §3 rows.

### Step 7 — Roll-forward path check

Validate the documented incident path end-to-end (forward fix, **never** an image reversion). A forward fix means deploying a **new image** — re-applying the candidate `<image-tag>` would only recreate the same release and prove nothing, so this step uses the **distinct forward-fix image tag pinned in P5** and fails closed if it is not distinct:

```bash
# Fail closed: the forward-fix image must be distinct from the candidate image (P5)
test "<forward-fix-image-tag>" != "<image-tag>" \
  || { echo "ABORT: forward-fix image must differ from the candidate image"; exit 1; }

# Forward fix = recreate the candidate backend with the new pinned image. The shell
# prefix overrides the --env-file interpolation value (compose precedence); the tag
# is non-secret, so its visibility in `docker ps` is acceptable.
YACC_BACKEND_IMAGE=<forward-fix-image-tag> \
  docker compose -f deploy/compose/compose.candidate.yml \
    --env-file deploy/compose/backend.staging.env up -d
docker compose -f deploy/compose/compose.candidate.yml \
  --env-file deploy/compose/backend.staging.env ps      # wait for healthy

# Evidence the rolled-forward image from the DEPLOYED container, not from intent.
ROLLED_IMAGE="$(docker inspect --format '{{.Config.Image}}' <candidate-project>-backend-1)" \
  || { echo "ABORT: could not read the candidate container image"; exit 1; }
case "$ROLLED_IMAGE" in
  *:"<forward-fix-image-tag>") ;;   # the distinct forward-fix image is what is deployed
  *) echo "ABORT: candidate container is not running <forward-fix-image-tag> (roll-forward not evidenced)"; exit 1 ;;
esac
```

Re-run the §Step-2 health gates. **Gate**: both 200 **and** the image check passes — the candidate container must be running **exactly the distinct `<forward-fix-image-tag>`**. The check passes only if a distinct image was rolled forward, is provably the image deployed, and is healthy.

---

## 3. Evidence-record template

One row per step, filled at execution time by the operator. **All fields start empty** — this template is unusable as "proof" until a human fills it. Same record shape as [compose-staging.md](compose-staging.md) §6; the completed rehearsal feeds the **AC-MIG-070-1** record on **#361** (one attributable record per workflow — operator / UTC timestamp / commit / environment / result). **Amended 2026-11-13:** a completed rehearsal no longer feeds AC-MIG-070-1 — that criterion requires the staging health gates plus one authenticated read; this template is used only for a voluntary run (founder decision “no need for such DR processes”; SPEC-002 “Scope amendment — 2026-11-13”, Antpolis/documentation PR #24, merge `e4c0ead`).

| # | Step | Operator | Timestamp (UTC) | Commit SHA | Image tag | Environment | Command (shape) | Result | Evidence link |
|---|------|----------|-----------------|------------|-----------|-------------|-----------------|--------|---------------|
| 1 | Candidate deploy (G1–G5 + `up -d`) | | | | `<image-tag>` | `<candidate-project>` (rehearsal) | | | `<artifact-link>` |
| 2 | Health gates (loopback) | | | | | `<candidate-project>` (rehearsal) | | | `<artifact-link>` |
| 3 | Backup (candidate source) | | | | | `<candidate-project>` (rehearsal) | | | `<artifact-link>` |
| 4 | Restore to candidate DB | | | | | `<candidate-project>` (rehearsal) | | | `<artifact-link>` |
| 5 | Integrity checks (counted diff) | | | | | `<candidate-project>` (rehearsal) | | | `<artifact-link>` |
| 6 | Stop-authority drill | | | | | `<candidate-project>` (rehearsal) | | | `<artifact-link>` |
| 7 | Roll-forward path check | | | | `<forward-fix-image-tag>` | `<candidate-project>` (rehearsal) | | | `<artifact-link>` |

Rules: timestamps in UTC; deviations recorded, never silently normalized; secret values never appear in artifacts; empty rows mean the step did not happen; the Environment column names the rehearsal project — it is **not** the `staging` record of [compose-staging.md](compose-staging.md) §6 and must not be presented as one.

---

## 4. Abort criteria

Abort the rehearsal immediately if any of these occurs, record the rows filled so far, and halt:

- Any §1 precondition is unmet or lapses mid-rehearsal (especially: the founder unreachable for the drill).
- Any Step-1 guard fails: wrong Docker context, existing candidate-project resources, a candidate project name already in use, the rendered `DATABASE_URL` not pinning `db:5432/<candidate-database>`, a shared network or routing label in the render (G4), or a derived resource name already existing (G5).
- Any guard check that cannot verify Docker state aborts — a docker failure other than an explicit empty/not-found result (daemon down, permission denied, timeout) is treated as a failure, never as absence.
- §Step-2 health gates are red after the candidate deploy or the roll-forward check.
- The backup fails, or cannot be stored/retrieved in the operator's storage location.
- Any §Step-5 integrity check does not match the same-snapshot source capture.
- The roll-forward check cannot use a forward-fix image distinct from `<image-tag>`.
- Any operation would touch resources outside the candidate project's scope (the live `yacc-app` project, the shared networks `treafik-proxy`/`antpolis-database_database`, the shared server `antpolis-database-postgres-1`, the shared gateway, DNS).
- A destructive step against real state (reset, recovery drill, key rotation, cutover) is proposed — those belong to MIG-071 (#362) / MIG-072 (#363), not here.

On abort: tear the candidate stack down (`docker compose -f deploy/compose/compose.candidate.yml --env-file deploy/compose/backend.staging.env down`; it owns no volume — the disposable `tmpfs` data dies with the containers), remove the candidate compose file, report to the founder; no partial pass may be claimed.

---

## 5. What not to do

- **No `helm rollback` after a forward migration — and no image reversion.** The schema is forward-only (ADR-027); a rolled-back image against a forward-migrated database is undefined, and the Helm-era rollback path is retired (ADR-032). Recovery is roll-forward only — see [compose-roll-forward.md](compose-roll-forward.md).
- **No targeting of the live project or shared infrastructure.** The rehearsal uses only its own `<candidate-project>` (Step-1 guards). Never attach the candidate to `treafik-proxy` or `antpolis-database_database`, never point it at `yacc_client` on the shared server, never reuse the live project's name or files as the candidate definition.
- **No reset, recovery drill, or key rotation here** — that is MIG-071 (#362) via [compose-reset-recovery-rotation.md](compose-reset-recovery-rotation.md).
- **No production cutover step here** — that is MIG-072 (#363), founder-governed.
- **No HA assumptions.** The posture is a single instance (ADR-029/ADR-032); there is no second instance to fail over to, and the candidate's disposable `tmpfs` database exists only for the run.
- **No secret values in evidence.** Reference names/keys only; candidate DB credentials are throwaways and are still never committed or logged.
- **No attribution shortcuts.** Every record names the human who executed it — the founder/sole operator; CI green is not substitute evidence for #361's attributable records.

---

## 6. After the rehearsal

1. Complete every §3 row; attach artifact links; tear the candidate stack down and delete the candidate compose file (nothing candidate-owned persists).
2. Link the completed evidence from **MIG-070 (#361)** — the rehearsal passes there, not here.
3. Record deviations as follow-ups on #361 (or bounded issues, tech-lead's call); this document is updated by PR when the procedure itself needs correction.

---

**Last Updated**: 2026-11-13 (authored by MIG-070e #488 as the Compose successor to the K8s-shaped `cutover-rehearsal.md`; preserves the reviewed substance — fail-closed G1–G5 with explicit-absence semantics, candidate isolation, snapshot-consistent backup/restore via the linked procedure, evidence template, abort criteria, human stop authority; candidate isolation re-expressed as a separate Compose project/network/database with no shared surface; attribution is the founder/sole operator per AC-10 as amended — the superseded three-developer wording was not carried; review pass 1 (PR #492): Step 3/4 declarations aligned with the backup/restore server-identity gates (`EXPECTED_HOST`, `CAND_*`); procedure only — no execution claimed)
