# Local Compose Stack Runbook — `compose-local.md`

**Status**: Documented procedure (MIG-107 #473). **Target: LOCAL ONLY.**
**Decision**: ADR-032 (Docker Compose target; Traefik ingress; SOPS secrets; manual deployment).
**Scope guard**: this runbook covers the local/dev target only. Staging/production profiles, host topology, public exposure (DNS, ACME, Cloudflare) are **deferred and separately founder-gated** — do not infer them from this document. The K3s/Helm runbooks (`helm-rollback`, `cutover-rehearsal`, `backup-restore`, `staging-api-evidence`) are untouched and transitional until MIG-080 (#364).

---

## 1. What is deployed

`deploy/compose/docker-compose.yml` (project name `yacc-local`) runs three services:

| Service | Image | Exposure |
|---|---|---|
| `postgres` | `postgres:15-alpine` | none (compose-internal network only) |
| `backend` | built from `services/backend-java/Dockerfile` (Temurin 21 JRE, uid 1000) | none — reachable only via Traefik |
| `traefik` | `traefik:v3.3.6` | `127.0.0.1:80` (→HTTPS redirect), `127.0.0.1:443` (HTTPS) |

Routing surface through Traefik: `/api`, `/health/*`, `/oauth2`, `/.well-known`, `/ws` (WebSocket upgrade pass-through — Traefik v3 forwards `Upgrade`/`Connection` headers natively). The local origin is **`https://localhost`** and `YACC_AUTH_AS_ISSUER`, `YACC_AUTH_EMAIL_BASE_URL`, `YACC_REALTIME_WS_ALLOWED_ORIGINS` are set to it (`deploy/compose/backend.env`).

Runtime envelope (ADR-029 in container terms, verified — not assumed): non-root `user: "1000:1000"`, `read_only: true`, `cap_drop: [ALL]`, `no-new-privileges`, writable paths are tmpfs only (`/tmp`, `/app/heap-dumps`, `/app/logs`), `deploy.resources.limits.memory: 2g` (hard cgroup RAM cap), `reservations.memory: 1g` (**advisory in plain Compose — no scheduler admission; NOT a Kubernetes request equivalent**), `limits.cpus: "1.0"` (CFS quota).

## 2. Prerequisites

- Docker + compose plugin, `curl`, `openssl`, `python3`, `sops` (with **age**).
- The **private age identity** for the committed SOPS artifact is held by the operator/founder — never by the repo, a PR, a log, or an agent handover.

## 3. One-time setup

```bash
# 3.1 Decrypt secrets (operator with the private identity) → git-ignored path.
#     The target file is created mode 0600 BEFORE decryption writes into it
#     (umask 077 + pre-created empty file + ACTIVE chmod — the chmod lines
#     below are real commands, not comments), then the mode is verified:
cd <repo-root>
umask 077
: > deploy/compose/secrets/local.env            # empty file born 0600 (umask 077)
chmod 600 deploy/compose/secrets/local.env      # ACTIVE enforcement — before any secret exists
sops -d deploy/compose/secrets/local.sops.env > deploy/compose/secrets/local.env
chmod 600 deploy/compose/secrets/local.env      # no-op safety net (still a real command)
stat -c '%a' deploy/compose/secrets/local.env   # MUST print 600 — verify before use

#    deploy/compose/secrets/*.env is git-ignored; the encrypted *.sops.env is
#    the only committed secret artifact. Never commit, log, or paste the
#    decrypted file or its values. Never `source` or `eval` the decrypted
#    file — the verification script parses it as strict KEY=value data
#    (allowlist only), and Compose consumes it via `--env-file` (data, not
#    code). ./deploy/compose/verify-local-stack.sh applies the same flow
#    automatically (mode-0600 mktemp + atomic rename) when it decrypts.
```

# 3.2 Local TLS certificate (self-signed; NO ACME/Let's Encrypt — a host with
#     no public DNS cannot complete the challenge). The verification script
#     generates it if absent; to generate manually:
mkdir -p deploy/compose/tls
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 825 \
  -keyout deploy/compose/tls/localhost.key -out deploy/compose/tls/localhost.crt \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

**Certificate location**: `deploy/compose/tls/localhost.crt` + `localhost.key` (git-ignored), mounted read-only into Traefik at `/etc/traefik/certs/`. Regenerate the same way; restart Traefik after regenerating.

## 4. Start / stop / logs / health

```bash
# NOTE: every compose invocation needs --env-file — the compose file
# interpolates required secrets, so even read-only commands (`ps`, `logs`)
# fail without it. Start (builds the backend image from the repo Dockerfile
# — local iteration path):
docker compose -f deploy/compose/docker-compose.yml \
  --env-file deploy/compose/secrets/local.env up -d --build

# State / logs (same --env-file rule)
docker compose -f deploy/compose/docker-compose.yml \
  --env-file deploy/compose/secrets/local.env ps
docker compose -f deploy/compose/docker-compose.yml \
  --env-file deploy/compose/secrets/local.env logs -f backend   # JSON logs (production profile)

# Health (curl -k is REQUIRED and acceptable only for the local self-signed cert)
curl -k https://localhost/health/live
curl -k https://localhost/health/ready   # application readiness — NOT a database/dependency proof

# Stop / reset (same --env-file rule)
docker compose -f deploy/compose/docker-compose.yml --env-file deploy/compose/secrets/local.env down      # keep DB volume
docker compose -f deploy/compose/docker-compose.yml --env-file deploy/compose/secrets/local.env down -v   # full reset (drops data)

# One-run verification of all issue ACs (full reset + evidence; see script header)
./deploy/compose/verify-local-stack.sh
```

**Ports in use?** 127.0.0.1:80/443 must be free. If taken, stop the conflicting listener or add a `deploy/compose/docker-compose.override.yml` remapping the published ports — then update the origin values in `deploy/compose/backend.env` (issuer/origins must match the origin actually served).

## 5. Verification

`./deploy/compose/verify-local-stack.sh` proves the issue ACs in one run: SOPS artifact contract (encrypted to exactly the two founder recipients, no private key used), `docker compose config` + env-name contract gate (14 required `YACC_*`/`RECOVERY_*`/`DATABASE_URL` names present, legacy names absent — TM-003 non-regression), stack boot (Flyway + `Started YaccApplication`), HTTPS health through Traefik, authenticated sign-in → forced credential change → `GET /api/conversations` 200, `/ws` upgrade 101 valid / 401 invalid, uid-1000 + read-only FS + memory/CPU limits via `docker inspect`, loopback-only binding audit, and repository secrets-discipline scan.

**Secret handling in the verifier (binding):** it never `source`s or `eval`s the decrypted env — a strict allowlist `KEY=value` data parser reads it (values never printed, shell syntax in values inert). When it decrypts, the plaintext is written to a mode-0600 `mktemp` file in the secrets directory under `umask 077` (mode verified **before** writing) and atomically renamed into place; an existing file is forced to 0600 before any read.

**Cleanup semantics:** on ANY exit — success, check failure, or interruption (Ctrl-C/SIGTERM) — the script removes its temp files and, once it has started the stack itself, runs a project-scoped `docker compose down -v --remove-orphans` limited to the `yacc-local` project (its containers, network, and its own postgres volume; unrelated Docker resources are untouched; no prune/kill patterns). `--keep` is the only way to leave the stack running, and the original exit status is always preserved.

## 6. What health/restart/recovery actually give (read this before trusting the stack)

- `healthcheck` provides **visibility only**: `docker compose ps` and `docker inspect` show `healthy`/`unhealthy`. **Docker does not restart a still-running unhealthy container.**
- `restart: unless-stopped` acts on **process exit** only (crash/OOM). It does nothing for an unhealthy-but-running backend.
- **Traefik is not readiness-gated**: routers forward to the backend unconditionally (file-provider static config, no health-aware policy configured or verified). While the backend boots or runs unhealthy, requests through Traefik fail (502/504). This accepted loss is recorded in ADR-032.
- **Recovery is manual**: check `docker compose ps` (health column), `docker compose logs backend`, restart the service (`docker compose restart backend`), or re-deploy the pinned image. No self-healing exists or is claimed.

## 7. Secrets discipline (binding)

- The only committed secret artifact is `deploy/compose/secrets/local.sops.env` — SOPS-encrypted to the two founder-supplied public age recipients (`.sops.yaml` creation rule is path-scoped to `deploy/compose/secrets/*.sops.env`).
- Decrypted output (`deploy/compose/secrets/local.env`) is git-ignored and transient; never commit it, never print its values into logs, PRs, or handovers. It must be mode **0600** (§3.1 creates it 0600 from birth; the verifier enforces 0600 before reading it).
- **Never `source` or `eval` the decrypted file** — treat it as data only (strict `KEY=value` parsing / Compose `--env-file`). A crafted or compromised value must never be able to execute shell code.
- Private age identities never enter the repository, a PR, a log, or chat.
- No plaintext secret defaults exist anywhere in the stack: the compose file requires `POSTGRES_USER`/`POSTGRES_PASSWORD` via interpolation from the decrypted file (fails closed if absent) and the backend gets secret values only through the decrypted `env_file`.
