# Staging Compose Runbook — `compose-staging.md`

**Status**: Documented procedure (MIG-070d #487). **This is a procedure, not evidence** — nothing in this document asserts that a deploy, health check, sign-in, or API call has happened or will succeed. A filled §6 evidence record, attached to **#361** by the operator who ran the steps, is the only evidence this procedure can produce.
**Decision**: ADR-032 (Docker Compose target; Traefik ingress; SOPS secrets; manual deployment) · ADR-029 (runtime envelope) · ADR-025 (bootstrap/recovery, forced credential replacement) · ADR-026 (raw `/ws`) · ADR-027 (forward-only Flyway).
**Audience**: the founder/sole operator executing a staging deploy-or-operate run (the AC-MIG-070-3 record of MIG-070 #361).
**Source issue**: https://github.com/csim-sg/yacc/issues/487
**Related**: [compose-local.md](compose-local.md) (local/dev target — separate definition, untouched by staging) · successor procedures: MIG-070e (**#488**) owns the Compose backup/restore, reset/recovery/rotation, rehearsal/stop-authority and roll-forward documents (the K8s-shaped `cutover-rehearsal` / `backup-restore` / `helm-rollback` files are target-stale and own no step here).

> **Scope guard — STAGING ONLY.** This runbook deploys the backend service of the staging stack that already exists on the host. It is not the local target ([compose-local.md](compose-local.md)) and not a production/cutover procedure. It never modifies DNS, the shared gateway's configuration, the shared PostgreSQL server's data, or any secret outside the operator's own decrypted file.

---

## 1. What is deployed (the target that exists)

`deploy/compose/docker-compose.staging.yml` (project `yacc-app` — the staging project name already on the host) defines **one service**:

| Piece | Definition | Exposure |
|---|---|---|
| `backend` | pinned CI image (`ghcr.io/csim-sg/yacc/yacc-backend:sha-<commit>`), ADR-029 envelope (uid 1000, read-only root FS, `cap_drop: [ALL]`, `no-new-privileges`, tmpfs-only writes, 2 Gi cap / 1 Gi advisory reservation, 1.0 CPU quota) | **no host ports** — joined to two external networks only |
| shared Traefik gateway | **external, not defined here** | routes the public host to the backend via the labels in the compose file (Host `staging.riotingnerds.com`, `websecure`, ACME resolver `le`, `/api` `/health/*` `/oauth2` `/.well-known` `/ws`) |
| shared PostgreSQL | **external, not defined here** — container `antpolis-database-postgres-1`, database `yacc_client`, network `antpolis-database_database` | reached by the backend on the compose `database` network; this project owns **no database container and no volume** |

**Verified host facts baked into the committed definition** (2026-11-12 evidence; founder draft + live checks): public host `staging.riotingnerds.com` (`/health/ready` returned HTTP 200 — *reachability only, not evidence of anything else*); proxy network `treafik-proxy` (the name that actually exists on the host, historical "treafik" spelling kept verbatim and used consistently — draft-finding 4); shared database coordinates above.

**Explicit placeholders — not verifiable from the repository, do not invent:**

| Placeholder | Where it appears | Why it stays a placeholder |
|---|---|---|
| Shared gateway identity/definition | not referenced at all — the artifact only joins its network | whether the public gateway is the shared instance in the founder's draft (`yacc-traefik` project) is a host-internal fact |
| ACME resolver name (`le`) | router label `certresolver=le` | taken from the founder draft; must be verified against the gateway's actual resolver config (P6) before any deploy |
| SMTP relay reachability | `YACC_AUTH_EMAIL_PROVIDER=smtp` (as deployed) | not exercised by this procedure's evidence steps (P7) |

**Founder finding carried from the unreviewed staging draft (do not enshrine):** the draft's gateway definition enabled the Traefik dashboard/API (`--api.dashboard=true --api.insecure=true`) behind a socket proxy. An unauthenticated control surface is unacceptable on any listener that is not bound to loopback. This artifact defines **no gateway at all**; whether the *deployed* shared gateway exposes such a surface is a founder-owned finding recorded in the #487 PR handover — verify and remediate the gateway separately; never document an insecure control surface as intended.

**Honest semantics (ADR-032 accepted losses — read before trusting the stack):** `healthcheck` = **visibility only** (Docker does not restart a still-running unhealthy container); `restart: unless-stopped` acts on **process exit only**; the shared gateway routes **without readiness gating**; deploys are stop-and-replace with a brief planned interruption; **recovery is manual**.

---

## 2. Prerequisites (all must hold before starting — stop otherwise)

| # | Item | Requirement | Check |
|---|------|-------------|-------|
| P1 | Authorization + operator | The run is founder-authorized and will be recorded on **#361**; the operator is the founder/sole operator (OPC). | #361 record |
| P2 | Host tooling | Docker + compose plugin on the staging host; locally `curl`, `python3`, `openssl`, `sops` (with age). | `docker compose version` |
| P3 | Operator-held private age identity | The private age identity for the committed SOPS artifact is held by the operator — never in the repo, a PR, a log, or a handover. | custody, by construction |
| P4 | External networks exist | `docker network inspect treafik-proxy` and `docker network inspect antpolis-database_database` both succeed — the gateway and shared database are up. | commands at left; abort if either fails |
| P5 | Pinned image available | The exact `sha-<commit>` tag to deploy exists in the registry (`ghcr.io/csim-sg/yacc/yacc-backend`); `docker login ghcr.io` first if the package is private. Tag = the commit being deployed; **never `latest`**. | registry/browser check |
| P6 | Gateway TLS resolver name | The shared gateway's ACME resolver is actually named `le` (read-only config check with the gateway owner/operating docs). If it differs: **stop and record** — do not edit the gateway in this procedure. | gateway config |
| P7 | SMTP relay (only if email flows matter) | `YACC_AUTH_EMAIL_PROVIDER=smtp` needs a reachable relay on the host; email sending is not part of this procedure's evidence steps. | operator-verified |

---

## 3. One-time setup — decrypt, then replace placeholders

### 3.1 Decrypt the secret artifact (hardened flow, same discipline as [compose-local.md](compose-local.md) §3.1)

```bash
cd <repo-root>
umask 077
# NEVER redirect (`>`) straight onto deploy/compose/secrets/staging.env:
# a shell redirect follows symlinks, so a stale or planted symlink at that
# path would have its TARGET truncated before any content is written.
# Decrypt into a fresh mode-0600 temp file and atomically rename it into
# place — rename(2) replaces the final path WITHOUT following it, and
# mktemp+umask make the temp 0600 at birth:
TMPENV="$(mktemp deploy/compose/secrets/.staging.env.XXXXXX)"  # fresh file, born 0600 (umask 077)
chmod 600 "$TMPENV"                              # ACTIVE enforcement — before any secret exists
stat -c '%a' "$TMPENV"                           # MUST print 600 — verify BEFORE decrypting
sops -d deploy/compose/secrets/staging.sops.env > "$TMPENV"
mv -fT "$TMPENV" deploy/compose/secrets/staging.env   # atomic rename (same dir; replaces any stale symlink, never follows it)
stat -c '%a' deploy/compose/secrets/staging.env  # MUST print 600 — verify before use
#    If sops fails, remove the temp and stop: rm -f "$TMPENV" (the final path was not touched).
#    If staging.env already exists as a symlink or directory, investigate and remove it
#    deliberately — never decrypt onto it.
```

`deploy/compose/secrets/*.env` is git-ignored; the encrypted `staging.sops.env` is the only committed secret artifact. Never commit, log, or paste the decrypted file or any of its values. Never `source` or `eval` it — it is data only (Compose consumes it via `env_file`; §4's render gate greps it only through the rendered config inside a private terminal).

### 3.2 Replace every placeholder value (mandatory before the first real deploy)

The committed `staging.sops.env` carries **disposable builder-generated placeholder values** (each marked `[REPLACE]` in its comments, which survive decryption). After decrypting, edit the **decrypted** `staging.env` (mode 0600, editor without swap/history, values never in argv or shell history) and replace:

| Key | Replace with |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD` | the shared PostgreSQL server's real `yacc_client` credentials |
| `YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL`, `YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL` | the operator-chosen bootstrap identity (ADR-025); keeping the placeholder credential past the first run means the §5 forced-change branch replaces it — record that as the environment mutation it is |
| `YACC_AUTH_TOKEN_SIGNING_KEY` | an operator-generated RSA-2048 key, base64 PKCS#8 DER (the placeholder is a real key of the correct shape, but its plaintext existed only transiently and is not an operator-controlled secret) |
| `YACC_INTEGRATION_ENCRYPTION_MASTER_KEY` | an operator-generated 32-byte base64 key |
| `RECOVERY_KEY`, `YACC_RECOVERY_KEY_HASH` | a matching operator-generated pair — only if recovery mode is deliberately enabled; `RECOVERY_MODE=` empty keeps recovery off |
| `YACC_AUTH_EMAIL_SENDGRID_API_KEY` | leave empty while provider is `smtp` |

If the first deploy happens **before** §3.2 is complete, that is still a legitimate first-boot rehearsal — the §5 forced-change branch then performs and records the bootstrap credential replacement. Deploying with a placeholder signing key or master key past rehearsal is **not** acceptable: regenerate via §3.2 and redeploy (§8) before the stack is considered operated.

---

## 4. Validate and deploy

### 4.1 Render validation (after §3 — the required env_file must exist for `config` to pass)

```bash
# The render contains decrypted values — write it to a private temp file,
# never to a shared terminal log; remove it immediately after the checks.
umask 077
RENDER="$(mktemp)"
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env config > "$RENDER" || { echo "ABORT: render failed"; rm -f "$RENDER"; exit 1; }

# Env-name contract gate (TM-003 non-regression): 14 required names present,
# 3 legacy names absent — same gate the local verifier enforces.
REQUIRED_ENV_NAMES=(DATABASE_URL
  YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL
  YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL
  RECOVERY_MODE
  RECOVERY_KEY
  YACC_RECOVERY_KEY_HASH
  YACC_AUTH_TOKEN_SIGNING_KEY
  YACC_INTEGRATION_ENCRYPTION_MASTER_KEY
  YACC_AUTH_AS_ISSUER
  YACC_AUTH_EMAIL_PROVIDER
  YACC_AUTH_EMAIL_FROM
  YACC_AUTH_EMAIL_SENDGRID_API_KEY
  YACC_AUTH_EMAIL_BASE_URL
  YACC_REALTIME_WS_ALLOWED_ORIGINS)
LEGACY_ENV_NAMES=(BOOTSTRAP_SUPER_ADMIN_EMAIL BOOTSTRAP_SUPER_ADMIN_PASSWORD SENDGRID_API_KEY)
gate_failed=0
for name in "${REQUIRED_ENV_NAMES[@]}"; do
  grep -Eq "^[[:space:]]*-? ${name}:" "$RENDER" || { echo "ABORT: rendered config missing required env name: $name"; gate_failed=1; }
done
for name in "${LEGACY_ENV_NAMES[@]}"; do
  grep -Eq "^[[:space:]]*-? ${name}:" "$RENDER" && { echo "ABORT: legacy env name present: $name"; gate_failed=1; }
done
# Origin rule + shared-DB target pins (values are non-secret; safe to echo):
grep -q 'YACC_AUTH_AS_ISSUER: https://staging.riotingnerds.com' "$RENDER" || { echo "ABORT: issuer is not the staging origin"; gate_failed=1; }
grep -q 'DATABASE_URL: jdbc:postgresql://antpolis-database-postgres-1:5432/yacc_client' "$RENDER" || { echo "ABORT: DATABASE_URL is not the shared server/database"; gate_failed=1; }
[ "$gate_failed" -eq 0 ] || { rm -f "$RENDER"; exit 1; }
echo "render gate OK (14 required / 0 legacy / origin + DB target pinned)"
rm -f "$RENDER"   # contains decrypted values — always removed
```

Also confirm before deploying: the compose file defines no `ports:` for the backend (AC of the artifact) and the only networks are the two external ones.

### 4.2 Deploy (manual, pinned image — ADR-032 posture)

```bash
export YACC_BACKEND_IMAGE=ghcr.io/csim-sg/yacc/yacc-backend:sha-<commit>   # ← record this exact value for §6
# (set it in backend.staging.env, or export it for one deploy — the compose
# file requires it and refuses a missing/empty value)
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env up -d
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env ps      # wait for health (start_period allows 90s boot)
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env logs --tail 60 backend > /tmp/backend-staging.log && \
  grep -E 'Started YaccApplication|Flyway' /tmp/backend-staging.log && rm -f /tmp/backend-staging.log
```

**Gate**: container reports `healthy` and the log shows Flyway activity + `Started YaccApplication`. Red ⇒ abort per §7.

**Shared-server blast radius (binding):** this project defines no database container and no volume. `docker compose … down` removes only the app container and its network attachments — it cannot touch the shared PostgreSQL server's data. Never run any destructive statement against the shared server (`psql` `DROP`/`TRUNCATE`/schema changes, `down -v` on a foreign project, anything addressing `antpolis-database-*` resources) from this procedure: the staging target is a **guest** of shared infrastructure, not its owner.

---

## 5. Evidence sequence (all through the public host)

Every step fills one row of the §6 template at execution time. **Credential/token discipline (non-negotiable):** no credential or token value in argv (`ps`-visible), shell history, logs, or evidence records — request bodies travel via mode-`0600` files read by `curl`'s `--data-binary @file`; tokens are extracted in-process into mode-`0600` files; stdout shows pass/fail and non-secret fields only; excerpts are redacted (no user-data payloads).

**What proves what (read before running):**
- `/health/live` + `/health/ready` through `https://staging.riotingnerds.com` prove the backend is up, declares readiness, **and that the shared gateway forwards** to it.
- `/health/ready` is an **application-readiness** signal only (`readinessState` health group — `services/backend-java/src/main/resources/application.yml`). It is **not** a database/dependency proof, and the 2026-11-12 reachability observation proves even less. **The authenticated `GET /api/conversations` (HTTP 200) is the data-path proof**: it exercises the gateway, JWT authentication, authorization, a database read, and serialization end to end.

### Step 1 — Deploy record

Record (§6 row 1): the exact `YACC_BACKEND_IMAGE` value (immutable `sha-<commit>` tag — optionally the registry digest), the commit SHA, UTC timestamp, and the `up -d` result. This row is the anchor for every later row.

### Step 2 — Health through the public host

```bash
curl -i https://staging.riotingnerds.com/health/live    # expect HTTP 200
curl -i https://staging.riotingnerds.com/health/ready   # expect HTTP 200
```

Gate: both 200. Interpretation guard: readiness ≠ database proof — do not document it as one.

### Step 3 — Authenticated sign-in

`POST /api/auth/sign-in/email` (frozen contract `AuthSessionResponse`) returns `{user, accessToken, refreshToken, mustChangePassword}`. Subsequent calls use `Authorization: Bearer <accessToken>`.

```bash
umask 077
# Request-body file (0600) — paste the sign-in JSON, e.g.
#   {"email":"<operator-email>","password":"<operator-password>"}
# Edit with an editor that keeps no swap/history; values must never reach
# argv or shell history.
REQ_FILE="$(mktemp)"
"${EDITOR:-vi}" "$REQ_FILE"

# Sign in; extract the token in-process. The accessToken goes to a 0600 file;
# stdout shows only non-secret fields — never a token byte.
TOK_FILE="$(mktemp)"
curl -sf -X POST "https://staging.riotingnerds.com/api/auth/sign-in/email" \
  -H 'Content-Type: application/json' \
  --data-binary @"$REQ_FILE" \
| AUTH_TOKEN_OUT="$TOK_FILE" python3 -c '
import json, os, sys
doc = json.load(sys.stdin)
with open(os.environ["AUTH_TOKEN_OUT"], "w") as fh:
    fh.write(doc["accessToken"])
print("user:", doc["user"].get("id"), doc["user"].get("email"))
print("mustChangePassword:", doc["mustChangePassword"])
' \
|| { echo "ABORT: sign-in failed (see §7)"; rm -f "$REQ_FILE" "$TOK_FILE"; exit 1; }

# Header file (0600) for authenticated calls — the token never enters argv.
HDR_FILE="$(mktemp)"
printf 'Authorization: Bearer %s\n' "$(cat "$TOK_FILE")" > "$HDR_FILE"
```

**Step 3b — the forced-password-change branch (expected behaviour, not a defect).** A bootstrap identity carries `mustChangePassword=true`, and `ForcedPasswordChangeFilter` (ADR-025) then returns **403 `{"error": "Password change required"}` on every path outside `/api/auth/`, `/health`, `/actuator`** — `/api/conversations` included — until the credential is replaced. Take one path explicitly and record which:

- **Path A — dedicated identity (preferred; does not mutate the bootstrap credential).** Sign in as a pre-provisioned non-bootstrap operator identity; expect `mustChangePassword=false` and proceed to Step 4.
- **Path B — complete the forced change (mutates the environment — record it).** With the bootstrap identity, call `POST /api/auth/change-password` (body `{"currentPassword": "...", "newPassword": "..."}`, min 8 chars; allowed under `/api/auth/`), then **re-run the Step 3 sign-in block** and confirm `mustChangePassword=false`. Record the credential replacement as an environment mutation in the §6 row.

```bash
# Branch state check — prints only non-secret fields (get-session = {user, mustChangePassword})
curl -sf -H @"$HDR_FILE" "https://staging.riotingnerds.com/api/auth/get-session" \
| python3 -c 'import json,sys; d=json.load(sys.stdin); print("user:", d["user"].get("id")); print("mustChangePassword:", d["mustChangePassword"])'

# Path B only — replace the credential (fresh REQ_FILE with the change-password JSON),
# then re-run the Step 3 sign-in block above before Step 4.
curl -sf -X POST "https://staging.riotingnerds.com/api/auth/change-password" \
  -H 'Content-Type: application/json' --data-binary @"$REQ_FILE" >/dev/null
```

A 403 from `/api/conversations` while `mustChangePassword=true` is the filter working as designed — record it as the observed forced-change state, resolve it via Path A or B, and only then claim Step 4.

### Step 4 — Data-path proof: `GET /api/conversations`

```bash
CONV_FILE="$(mktemp)"
STATUS="$(curl -s -o "$CONV_FILE" -w '%{http_code}' -H @"$HDR_FILE" "https://staging.riotingnerds.com/api/conversations")"
echo "GET /api/conversations -> $STATUS"   # expect 200

# Redacted excerpt only: the envelope shape ({data,page,limit,total}), never the payload.
python3 - "$CONV_FILE" <<'PY'
import json, sys
doc = json.load(open(sys.argv[1]))
print("envelope keys:", sorted(doc.keys()), "| rows:", len(doc.get("data", [])), "| total:", doc.get("total"))
PY
```

**Gate**: HTTP **200** — this is the founder-required data-path proof (gateway + auth + **database read** + serialization). A 401/403 after the forced-change branch is resolved is a finding, not a pass.

### Step 5 — `/ws` handshake (raw WebSocket, ADR-026)

A successful upgrade for a **valid** token plus a **refused** handshake for an invalid one. The token comes from the 0600 file via the environment (never argv); stdout shows only the status lines.

```bash
WS_TOKEN="$(cat "$TOK_FILE")" python3 <<'PYEOF'
import os, socket, ssl
token, host = os.environ["WS_TOKEN"], "staging.riotingnerds.com"
def probe(tok):
    ctx = ssl.create_default_context()   # public ACME certificate — normal verification
    s = ctx.wrap_socket(socket.create_connection((host, 443), timeout=15))
    req = ("GET /ws?token=" + tok + " HTTP/1.1\r\nHost: " + host + "\r\n"
           "Upgrade: websocket\r\nConnection: Upgrade\r\n"
           "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n"
           "Origin: https://" + host + "\r\n\r\n")
    s.sendall(req.encode())
    first = s.recv(4096).decode(errors="replace").splitlines()[0]
    s.close()
    return first
print("VALID:", probe(token))
print("INVALID:", probe("not-a-valid-token"))
PYEOF
# Expect: VALID: HTTP/1.1 101 Switching Protocols ; INVALID: HTTP/1.1 401 (or 403)
```

Gate: 101 for the valid token, 40x for the invalid one. (Traefik forwards the `Upgrade`/`Connection` headers natively; the backend's handshake interceptor owns the JWT check.)

### Session cleanup

```bash
rm -f "$REQ_FILE" "$TOK_FILE" "$HDR_FILE" "$CONV_FILE"
```

---

## 6. Evidence-record template (the AC-MIG-070-3 record shape)

One row per step, filled at execution time by the operator. **All fields start empty — this template is unusable as "proof" until a human fills it.** Excerpts/artifacts must be redacted: no tokens, no credentials, no user-data payloads.

| # | Step | Operator | Timestamp (UTC) | Commit SHA | Image tag (digest) | Environment | Command (shape) | Result | Evidence link |
|---|------|----------|-----------------|------------|--------------------|-------------|-----------------|--------|---------------|
| 1 | Deploy (`up -d`) | | | | | `staging` | | | `<artifact-link>` |
| 2 | Health via public host | | | | | `staging` | | | `<artifact-link>` |
| 3 | Sign-in | | | | | `staging` | | | `<artifact-link>` |
| 3b | Forced-change branch (A/B) | | | | | `staging` | | | `<artifact-link>` |
| 4 | `GET /api/conversations` | | | | | `staging` | | | `<artifact-link>` |
| 5 | `/ws` handshake | | | | | `staging` | | | `<artifact-link>` |

Rules: timestamps in UTC; the Environment column names the staging target (`staging` — compose project `yacc-app`, host `staging.riotingnerds.com`); HTTP statuses recorded exactly (a 403 forced-change observation is recorded, never silently retried away); which forced-change path (A or B) is pinned in row 3b, including any environment mutation; empty rows mean the step did not happen; deviations recorded, never normalized. **This procedure is not evidence** — completed records live on **#361**; this document stays a procedure.

---

## 7. Abort criteria

Abort immediately, record the rows filled so far, and halt if any of these occurs:

- Any §2 prerequisite is unmet or lapses mid-run (including either external network missing).
- The render gate (§4.1) fails for any reason, or `up -d` fails, or the backend does not become `healthy`, or the log lacks Flyway/`Started YaccApplication`.
- Either health endpoint is non-200 through `https://staging.riotingnerds.com`.
- Sign-in fails for a provisioned identity (record the status; do not retry with varied credentials — that is a finding, not a workaround).
- `GET /api/conversations` is not 200 after the forced-change branch is resolved, or `/ws` is not 101/40x as expected.
- Any command would modify the shared gateway's configuration, the shared PostgreSQL server or its data, DNS, or any resource outside the `yacc-app` project.
- Any credential or token value would surface in argv, a log, a record, or a terminal shared with others.

On abort: report on **#361**; no partial pass may be claimed.

---

## 8. Recovery and roll-forward (pointer)

- **No rollback, ever.** The Flyway schema is forward-only (ADR-027): an older image against a forward-migrated database is an undefined state. Recovery is **roll-forward only** — a newer pinned `sha-<commit>` tag through §4.2 (stop-and-replace with a brief planned interruption; ADR-032 accepted loss). This posture supersedes the K8s-era rollback document, which owns no step here.
- Container-level recovery is manual: `docker compose … ps` (health column), `docker compose … logs backend`, `docker compose … restart backend`, or a fresh §4.2 deploy of a pinned tag. `healthcheck` marks unhealthy but nothing restarts or unroutes on it.
- **MIG-070e (#488)** owns the Compose successors to the operational runbook set: backup/restore, reset/recovery/secret-rotation, rehearsal/stop-authority, and the detailed roll-forward procedure. Until those merge, the only recovery action authorized by this document is the forward re-deploy above.

---

## 9. What not to do

- **No cluster tooling.** No `kubectl`, Helm, cluster, namespace, or release operation anywhere — K3s/Helm is retired (ADR-032); the four K8s-shaped runbooks own no step in this procedure.
- **No secret values anywhere.** Only variable names and SOPS-encrypted artifacts are committed; decrypted values never enter argv, logs, PRs, or evidence records; private age identities never leave the operator.
- **No gateway or infrastructure edits.** This procedure never modifies the shared Traefik (routing, TLS, dashboard/API flags — the control-surface finding is founder-owned), DNS/Cloudflare, or the shared PostgreSQL server. The staging stack is a guest on shared networks; it assumes ownership of nothing.
- **No placeholder values past rehearsal.** §3.2 replacements are mandatory before the stack is considered operated.
- **No claims from this document.** A filled §6 template attached to #361 is the evidence; editing this file never creates one.

---

**Last Updated**: 2026-11-13 (authored by MIG-070d #487; procedure only — no execution claimed)
