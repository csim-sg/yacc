# Backend Incident Runbook (Roll-Forward, Compose) — `compose-roll-forward.md`

**Status**: Documented procedure (MIG-070e #488; successor to the retired `helm-rollback.md`, which owns no step against the Compose target).
**Audience**: the founder/sole operator (OPC)
**Source issue**: https://github.com/csim-sg/yacc/issues/488
**Related**: ADR-032 (Compose target; roll-forward-only posture; **recovery is manual**) · ADR-027 (Flyway, forward-only) · ADR-029 (runtime envelope, frozen probe wire paths) · ADR-025 (bootstrap/recovery, fail-closed secrets) · [compose-staging.md](compose-staging.md) (deploy/operate procedure + §4.2 forward re-deploy) · [compose-backup-restore.md](compose-backup-restore.md) (data-recovery path) · [compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md) (stop-authority drill)

> **Why this file exists**: the staging deploy path is Docker Compose (ADR-032); the Helm-era incident runbook is retired with that target (MIG-080 #364 owns its removal). The **procedure** below is roll-forward: a rollback is not a recovery path on this stack, and every rollback mention in this document is a prohibition.
>
> **Rehearsal status**: the rehearsal-evidenced incident/stop-authority procedure is **AC-MIG-070-2 (#361)**, exercised through [compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md) Step 7. Until that rehearsal evidences it, the content below is documented intent — **this is a procedure, not evidence.**
>
> **Amended 2026-11-13:** the rehearsal-evidenced requirement named above was retired by the founder scope decision of 2026-11-13 (“no need for such DR processes” — SPEC-002 “Scope amendment — 2026-11-13”, Antpolis/documentation PR #24, merge `e4c0ead`). As amended, **AC-MIG-070-2 is “roll-forward incident runbook exists”** — this document is that runbook and no rehearsal evidences it; the drill referenced above may still be run voluntarily through [compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md) but is not a gate.

---

## Posture: Roll-Forward Only

**Guiding principle**: remediate by deploying a forward fix. Do **not** run `helm rollback` — that command is retired with the Helm target (ADR-032) and owns no step here. Do **not** re-deploy an older image tag either: with a forward-only schema, an older image against a forward-migrated database is an undefined state — reverting the image is a rollback by another name and is prohibited with it.

- **Schema state is forward-only**: Flyway migrations (ADR-027) are not designed for reversal; boot fails closed on a migration failure rather than running a damaged schema.
- **The recovery unit is a new pinned image tag**: deploys are stop-and-replace with a brief planned interruption (ADR-032 accepted loss); there is no rolling update and no automated rollback tooling.
- **Recovery is manual** (ADR-032): the container `healthcheck` provides **visibility only** — Docker does not restart a still-running unhealthy container, `restart: unless-stopped` acts on process exit only, and the shared gateway routes without readiness gating. An unhealthy-but-running backend stays routed until the operator intervenes.
- **Manual review required** for every forward-fix deploy during an incident (no automated redeploy).
- **Traceability mandatory**: who triggered, when, why, which image tag (see Audit Trail).
- **Post-incident investigation required**: root cause documented in an issue within 24 hours.

---

## Trigger Conditions

### Act immediately (deploy a forward fix or stop)

- ✅ `/health/live` non-200 through `https://staging.riotingnerds.com` (frozen wire paths, ADR-029)
- ✅ Backend container repeatedly restarting / exiting (`docker compose ps` restart churn)
- ✅ Flyway migration failure at startup (boot fails closed — check logs for `migration`/`Flyway` errors)
- ✅ Critical API endpoint returns 5xx for >50% of requests for 5+ minutes
- ✅ Container not `healthy` within the healthcheck window (`start_period` 90s + retries)

### Investigate first (do not redeploy in panic)

- ⚠️ Single transient 5xx below the 50% threshold
- ⚠️ Non-critical feature degraded
- ⚠️ Gateway-level symptom without a backend error (likely DNS/TLS at the shared Traefik — founder-owned infrastructure; the backend deploy will not fix it)

### Do not touch the deployment (underlying infrastructure issue)

- ⛔ Shared PostgreSQL (`antpolis-database-postgres-1`) impaired → fix/restore the database first (data path: [compose-backup-restore.md](compose-backup-restore.md)); a new backend deploy will not help, and this procedure never writes to the shared server
- ⛔ Missing/invalid secrets → fix the operator env + re-encrypt ([compose-staging.md](compose-staging.md) §3), then recreate — fail-closed controls (ADR-025/ADR-027) keep the backend down on purpose until the secret is right

---

## Incident Procedure

All commands run from the repository checkout on the staging host with the standard invocation shape:

```bash
COMPOSE="docker compose -f deploy/compose/docker-compose.staging.yml --env-file deploy/compose/backend.staging.env"
```

### Step 1: Verify the problem

```bash
# 1a. Container + health status
$COMPOSE ps

# 1b. Logs (last 60 lines) — look for:
#   - "Flyway" / migration failures (boot fails closed)
#   - HikariPool / connection errors to the shared server
#   - JVM heap ("OutOfMemoryError") / "ExitOnOutOfMemoryError" exits
$COMPOSE logs --tail 60 backend > /tmp/backend-incident.log && tail -40 /tmp/backend-incident.log

# 1c. Health endpoints through the public host (actuator wire paths, ADR-029)
curl -i https://staging.riotingnerds.com/health/live
curl -i https://staging.riotingnerds.com/health/ready
```

### Step 2: Capture the audit state (before changing anything)

```bash
# 2a. The exact running image (tag + digest if resolvable)
docker inspect --format '{{.Config.Image}} {{.Image}}' yacc-app-backend-1 > /tmp/yacc-image-before.txt

# 2b. Rendered configuration hash of record. The render inlines the decrypted
# env_file values, so it goes to a private 0600 temp; only the hash (non-secret)
# is kept and the render is removed immediately.
umask 077; RENDER="$(mktemp)"
$COMPOSE config > "$RENDER" && sha256sum "$RENDER" | awk '{print $1}' > /tmp/yacc-config-hash.txt
rm -f "$RENDER"

# 2c. Log/event export for the record
$COMPOSE logs --timestamps backend > /tmp/yacc-backend-logs-$(date -u +%Y%m%dT%H%M%SZ).log
```

### Step 3: Classify and decide

```
Is the failure caused by the release (image/config)?
├─ YES → Forward fix (Step 4)
├─ NO  → Is the shared PostgreSQL healthy?
│        ├─ NO  → Infrastructure first: data path via compose-backup-restore.md
│        │        (founder-authorized disaster restore); no backend redeploy
│        └─ YES → Investigate (Step 1 evidence) before any deploy
```

### Step 4: Forward fix

```bash
# 4a. Fix the defect on a branch; merge through the normal PR gate.
#     (Emergency hotfixes still go through review — see Stop Authority.)

# 4b. Deploy the fixed image: CI publishes ghcr.io/csim-sg/yacc/yacc-backend:sha-<commit>.
#     Pin the new immutable tag in backend.staging.env (YACC_BACKEND_IMAGE) — the
#     committed pin is the deploy record — then stop-and-replace (compose-staging.md §4.2).
$COMPOSE up -d
$COMPOSE ps        # wait for healthy (start_period allows 90s boot)

# 4c. Verify the forward rollout: the deployed container runs exactly the new tag
docker inspect --format '{{.Config.Image}}' yacc-app-backend-1   # must end in :sha-<new-commit>
$COMPOSE logs --tail 40 backend | grep -E 'Flyway|Started YaccApplication'
```

**Gate**: container `healthy`, image tag is the new `sha-<commit>`, log shows Flyway + `Started YaccApplication`, and both health endpoints return 200 through the public host. Red ⇒ do **not** revert the image; fix forward again (Step 4a) or exercise stop authority. There is **no rollback path** — by design, not by omission (ADR-032).

### Step 5: Infrastructure-first failures

```bash
# Shared PostgreSQL impaired → the data path owns recovery, not the app deploy.
# A corrupted datastore is restored from a verified backup per
# compose-backup-restore.md (candidate restore; in-place disaster restore is
# founder-authorized). Never run destructive statements from this runbook.

# Secret invalid → fix the operator env (compose-staging.md §3: edit the decrypted
# 0600 file with a no-swap/no-history editor), re-encrypt the SOPS artifact
# (compose-reset-recovery-rotation.md §7.7 shape), then recreate:
$COMPOSE up -d && $COMPOSE ps
```

---

## Forward-Verification

### Immediately after the forward deploy

```bash
# 1. Container healthy
$COMPOSE ps

# 2. Health endpoints through the public host
curl -s https://staging.riotingnerds.com/health/live
curl -s https://staging.riotingnerds.com/health/ready

# 3. Startup logs clean (Flyway applied, no ERROR/FATAL)
$COMPOSE logs --tail 30 backend | grep -iE 'error|fatal|flyway' || echo "boot log clean of error/fatal markers"
```

### Service verification (2–5 minutes)

The full evidence sequence — authenticated sign-in, forced-change branch handling, `GET /api/conversations` 200 as the data-path proof, `/ws` handshake — is [compose-staging.md](compose-staging.md) §5 with its §6 record template. Run it after any incident forward-fix that touched auth, database access, or the image itself; a health endpoint alone is not deployment evidence.

**Interpretation guard (unchanged from the accepted posture):** `/health/ready` is an application-readiness signal (`readinessState`), not a database/dependency proof — the authenticated data-path call is the proof.

---

## Stop Authority

**Stop authority** = the explicit decision to halt deploys/changes rather than continue forward-fixing. Under the OPC operating model (SPEC-002 AC-10 as amended, `17ea19d6`) there is no on-call ladder: **the founder/sole operator holds stop authority directly**. [The rehearsal-evidenced stop-authority drill is AC-MIG-070-1 (#361), exercised via compose-rehearsal-stop-authority.md Step 6; the rules below are documented intent until then.]

**Amended 2026-11-13:** the rehearsal-evidenced stop-authority drill named above was retired by the founder scope decision of 2026-11-13 (“no need for such DR processes” — SPEC-002 “Scope amendment — 2026-11-13”, Antpolis/documentation PR #24, merge `e4c0ead`). As amended, **AC-MIG-070-1 is the staging health gates (`/health/live` + `/health/ready` through the deployed host) plus one authenticated read (`GET /api/conversations` 200)** — not a drill record; the drill may still be run voluntarily via [compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md) and records nothing toward acceptance. Real stop authority is unchanged: the founder/sole operator holds it directly, and it is exercised at the real irreversible gate (MIG-072, #363); the rules below stand unchanged.

Rules:

- Stop authority is **explicit and recorded** (who, when, why — see Audit Trail); it is never implicit.
- Escalate to an explicit stop decision after **two failed forward-fix attempts** of the same defect.
- A halt means: no new deploys, no configuration or secret changes, no destructive steps — until an explicit, recorded resume.
- Never trade data integrity for availability: if in doubt between migrating forward and preserving state, stop and escalate to the founder.

---

## Audit Trail

Every incident records, in an incident issue:

1. **Timeline**: detection → decision → deploy(s) → verification → closure (UTC).
2. **Images**: the exact before/after image tags (Step 2a capture; the `YACC_BACKEND_IMAGE` line of `backend.staging.env` is the deploy pin of record).
3. **Actors**: who executed each deploy and who exercised stop authority (the founder/sole operator).
4. **Evidence**: log exports (`/tmp` captures from Step 2), health-check outputs, config hash.
5. **RCA + prevention**: root cause, forward fix PR link, prevention item merged within 48 hours.

---

## Common Issues & Troubleshooting

### Issue 1: Container unhealthy but running (no auto-recovery)

`healthcheck` is visibility only (ADR-032). Diagnose via `$COMPOSE logs`, fix forward (Step 4), or `$COMPOSE restart backend` for a transient state — a restart is an operator intervention, not a recovery mechanism, and is recorded as a deviation if used mid-incident.

### Issue 2: Forward fix incomplete (new image also fails)

- The defect is not fully fixed — do **not** revert to the old image (that is a prohibited rollback against a possibly forward-migrated schema); fix forward again.
- Two failed attempts → founder stop decision (Stop Authority).

### Issue 3: Flyway migration failed at startup

```bash
$COMPOSE logs --tail 100 backend | grep -i flyway
```

Migration failures fail the boot (fail-closed by design; ADR-027). Fix the migration in a **new** forward migration; never edit an applied one. If the failure stems from data state, the data path ([compose-backup-restore.md](compose-backup-restore.md)) owns recovery — founder-authorized.

### Issue 4: Secrets invalid after a recreate

The fail-closed controls (ADR-025/ADR-027) keep the backend down until the secret is right — that is correct behaviour. Fix the operator env ([compose-staging.md](compose-staging.md) §3), re-encrypt the artifact ([compose-reset-recovery-rotation.md](compose-reset-recovery-rotation.md) §7.7 shape), recreate. `RECOVERY_MODE` is **not** an incident tool: it is the founder's single-use recovery flag with its own procedure (§6 there) — never enabled ad hoc during an incident.

### Issue 5: Memory/CPU pressure (OOM within the 2 Gi cap)

The ADR-029 envelope (2 Gi cap / 1 Gi advisory reservation, 1.0 CPU) is part of the committed compose file. Persistent pressure → raise the envelope via a reviewed compose change (forward fix), never by ad-hoc runtime flags on a live container; note that `reservations.memory` is advisory in plain Compose (ADR-032) while `limits.memory` is a hard cgroup cap.

---

## Communication Templates

**Immediate**:

```
🚨 INCIDENT: YACC backend (staging, Compose)
- Severity: [HIGH/MEDIUM/LOW]
- Status: FORWARD FIX IN PROGRESS
- Failing image: <image-tag>
- Fix image: <image-tag>
- Stop authority: founder (decided: continue / halt)
- Details: <issue link>
```

**After the forward deploy**:

```
✅ FORWARD FIX DEPLOYED: YACC backend
- Previous image: <image-tag> (failing)
- Deployed image: <image-tag>
- Verification: /health/live + /health/ready 200 via public host, container healthy
- Data-path: GET /api/conversations 200 (compose-staging.md §5) [if run]
- RCA: investigating <summary>
- Thread: <issue link>
```

**Post-incident (24h)**:

```
📋 INCIDENT REPORT PUBLISHED
- Root cause: <description>
- Fix merged: <PR link>
- Prevention: <action>
- Review: <RCA link>
```

---

## Quick Reference (Copy-Paste)

```bash
# Audit: what is deployed
docker inspect --format '{{.Config.Image}}' yacc-app-backend-1

# Forward fix (compose-staging.md §4.2): pin the new sha-<commit> tag, then
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env up -d
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env ps

# Health (frozen wire paths, through the public host)
curl -i https://staging.riotingnerds.com/health/live
curl -i https://staging.riotingnerds.com/health/ready

# Evidence capture
docker compose -f deploy/compose/docker-compose.staging.yml \
  --env-file deploy/compose/backend.staging.env logs --timestamps backend > /tmp/logs.txt
```

---

## Related Documentation

- **ADR-032**: Docker Compose deployment decision (roll-forward-only posture; manual recovery; accepted losses)
- **ADR-027**: Flyway-only schema management (why an image reversion is not a recovery path)
- **ADR-029**: JVM deployment envelope + observability (frozen probe wire paths)
- **ADR-025**: bootstrap/recovery controls (fail-closed secrets; `RECOVERY_MODE` discipline)
- **[compose-staging.md](compose-staging.md)**: deploy/operate procedure + evidence template
- **[compose-backup-restore.md](compose-backup-restore.md)**: data-recovery path (disaster restore)
- **[compose-rehearsal-stop-authority.md](compose-rehearsal-stop-authority.md)**: rehearsal + stop-authority drill

---

**Last Updated**: 2026-11-13 (authored by MIG-070e #488 as the Compose successor to the retired `helm-rollback.md`; roll-forward-only posture preserved — every rollback mention is a prohibition, manual recovery stated, forward-fix image discipline and stop authority carried; procedure only — no execution claimed)
