# Staging API Evidence Procedure — `staging-api-evidence.md`

**Status**: Documented procedure (MIG-070c #454). **Not evidence of execution.**
**Superseded (deployment target)**: the staging deploy path is now Docker Compose (ADR-032) — see [compose-staging.md](compose-staging.md) (MIG-070d #487) for the current staging procedure. This K8s/Helm-shaped document is retained for history only and owns no step against the Compose target; retirement belongs to MIG-080 (#364).
**Audience**: the named operator executing the first authorized staging deploy (MIG-070 #361)
**Source issue**: https://github.com/csim-sg/yacc/issues/454
**Related**: [cutover-rehearsal.md](cutover-rehearsal.md) · [backup-restore.md](backup-restore.md) · [helm-rollback.md](helm-rollback.md) · ADR-029 (deployment envelope, frozen probe wire paths) · ADR-025 (bootstrap/recovery, forced credential replacement) · ADR-027 (Flyway, forward-only)

> **This is a procedure, not evidence.** Nothing in this document asserts that a deploy, rollout, health check, sign-in, or API call has happened or will succeed. The staging environment itself is not provisioned yet: the chart's staging values ship `ingress.enabled: false` on the placeholder host `api.staging.yacc.example.com` (`deploy/helm/yacc-backend/values-staging.yaml`), and cluster access, real DNS, and secret material are human prerequisites owned by **MIG-070 (#361)**. This document only pins how the first authorized run is performed and recorded.
>
> **What proves what** (read before running):
> - `/health/live` and `/health/ready` returned through `<staging-host>` prove the pod is up, declares readiness, **and that the ingress path forwards** to the service.
> - `/health/ready` is an **application-readiness** signal only: the `ready` health group includes `readinessState` alone (`services/backend-java/src/main/resources/application.yml`, `management.endpoint.health.group.ready`). It is **not** a database/dependency proof — do not document it as one.
> - **The authenticated `GET /api/conversations` (HTTP 200) is the data-path proof**: it exercises ingress, JWT authentication, authorization, a database read, and serialization end to end.

---

## 1. Preconditions (all must hold before starting)

| # | Item | Requirement | Owner |
| - | ---- | ----------- | ----- |
| P1 | Authorization + named operator | The staging deploy is founder-authorized and recorded on #361; a named operator owns execution — `<founder to name>`. | Founder |
| P2 | Staging cluster access | Kube context `<staging-context>` reachable; `KUBE_CONFIG_STAGING` wired so the CI deploy job runs instead of skipping; a dedicated staging namespace `<candidate-namespace>` hosting no unrelated live release. | Ops |
| P3 | Real staging host | `<staging-host>` resolves to the staging ingress with TLS and forwards to the `yacc-backend` service. `values-staging.yaml` ships `enabled: false` + a placeholder host on purpose; enabling ingress and provisioning DNS is an ops/founder action, never a runbook step and never a chart edit inside this procedure. | Ops |
| P4 | Secret material present | Secret *objects* exist in `<candidate-namespace>` (names only; values are never copied into any file, command, log, or evidence record): `yacc-backend-secrets` (`DATABASE_URL`), `yacc-auth-secrets` (bootstrap credential, token signing key, recovery key + hash), `yacc-email-secrets`, `yacc-integration-secrets` (encryption master key), `postgresql-credentials`. | Ops |
| P5 | Image + chart pinned | Image pinned by an **immutable OCI tag** `<image-tag>` — the CI-published `sha-<commit>` tag; **never `latest`** or another mutable tag. **Tag only, never a digest**: the chart's `yacc-backend.image` helper renders the image strictly as `[registry/]repository:tag` and has no digest field. Chart at a pinned commit (`<artifact link>`). | Operator |
| P6 | Operator tooling | `bash`, `kubectl`, `helm` ≥ 3, `curl`, `python3` (standard library only — in-process token extraction). | Operator |

**Stop** if any row is unmet. Record the abort per §4, halt, and do not partially execute.

---

## 2. Evidence sequence (overview)

```
helm deploy → rollout status → health via <staging-host>
  → authenticated sign-in → forced-password-change branch → get-session
  → GET /api/conversations (200) → (optional) /ws check
```

Every step fills one row of the §3 evidence template at execution time.

**Credential/token discipline (non-negotiable, same posture as [backup-restore.md](backup-restore.md)):** no credential or token value in argv (`ps`-visible), shell history, logs, CI step summaries, or evidence artifacts. Request bodies travel via mode-`0600` files read by `curl`'s `--data-binary @file`; tokens are extracted in-process to mode-`0600` files and attached via header files; stdout shows pass/fail and non-secret fields only. Record HTTP status codes and redacted excerpts — never raw payloads containing user data.

### Step 1 — Deploy

```bash
# Context guard (fail closed) — the staging context, nothing else
test "$(kubectl config current-context)" = "<staging-context>" \
  || { echo "ABORT: wrong cluster context — refusing to deploy"; exit 1; }

# The existing pinned deploy command shape (mirrors the CI deploy job's helm step)
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n <candidate-namespace> \
  --values deploy/helm/yacc-backend/values-staging.yaml \
  --set image.registry=<registry> \
  --set image.repository=<repository> \
  --set image.tag=<image-tag> \
  --wait --timeout 5m
```

Release name `yacc-backend` is the CI convention: the chart's fullname helper names resources `yacc-backend` (a release name containing `yacc-backend` is used as-is). When this procedure runs against a *candidate* environment instead of the reserved staging namespace, apply the stricter isolation guards (G1–G5) from [cutover-rehearsal.md](cutover-rehearsal.md) Step 1 first.

### Step 2 — Rollout

```bash
kubectl rollout status deployment/yacc-backend -n <candidate-namespace> --timeout=5m
kubectl get pods -n <candidate-namespace> -l app.kubernetes.io/name=yacc-backend
```

**Gate**: rollout complete, pod(s) `Running`. Red ⇒ abort per §4. Recovery is **roll-forward only** — see [helm-rollback.md](helm-rollback.md). Never roll a release back: the Flyway schema is forward-only (ADR-027), so an older image against a forward-migrated database is an undefined state.

### Step 3 — Health via `<staging-host>`

The probe wire paths are the frozen actuator paths `/health/live` and `/health/ready` (ADR-029; public, no auth). **Run them through the intended ingress host** — that is the wiring evidence:

```bash
curl -i "https://<staging-host>/health/live"    # expect HTTP 200
curl -i "https://<staging-host>/health/ready"   # expect HTTP 200
```

**Port-forward fallback (diagnostics only — NOT ingress evidence).** If `<staging-host>` is not provisioned yet (ingress disabled, DNS pending), a tunnel proves the pod serves the endpoints but proves nothing about ingress:

```bash
kubectl port-forward -n <candidate-namespace> svc/yacc-backend 8080:8080 &
sleep 2
curl -i http://localhost:8080/health/live    # expect 200
curl -i http://localhost:8080/health/ready   # expect 200
kill %1
```

If only the fallback succeeds, record the host-level health rows as **FAIL/blocked** in §3 — never as ingress evidence.

Interpretation guard: 200 on `/health/ready` means the application declares readiness (`readinessState`); it does **not** prove database reachability. Step 5 is the dependency and data-path proof.

### Step 4 — Authenticated sign-in

`POST /api/auth/sign-in/email` (frozen contract `AuthSessionResponse`) returns `{user, accessToken, refreshToken, mustChangePassword}`. The operator credential comes from the bootstrap secret (`yacc-auth-secrets`) or — preferred, Step 4b Path A — a dedicated non-bootstrap identity. Authentication on subsequent calls uses the `Authorization: Bearer <accessToken>` header (resource-server JWT converter).

```bash
umask 077

# Request-body file (0600) — paste the sign-in JSON, e.g.
#   {"email":"<operator-email>","password":"<operator-password>"}
# Edit with an editor that keeps no swap/history (same editor discipline as
# backup-restore.md §4.1); the values must never reach argv or history.
REQ_FILE="$(mktemp)"
"${EDITOR:-vi}" "$REQ_FILE"

# Sign in; extract the token in-process. The accessToken goes to a 0600 file;
# stdout shows only non-secret fields — never a token byte.
TOK_FILE="$(mktemp)"
curl -sf -X POST "https://<staging-host>/api/auth/sign-in/email" \
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
|| { echo "ABORT: sign-in failed (see §4)"; rm -f "$REQ_FILE" "$TOK_FILE"; exit 1; }

# Header file (0600) for authenticated calls — the token never enters argv.
HDR_FILE="$(mktemp)"
printf 'Authorization: Bearer %s\n' "$(cat "$TOK_FILE")" > "$HDR_FILE"
```

**Step 4b — the forced-password-change branch (expected behaviour, not a defect).** A bootstrap identity carries `mustChangePassword=true`, and `ForcedPasswordChangeFilter` (ADR-025) then returns **403 `{"error": "Password change required"}` on every path outside `/api/auth/`, `/health`, `/actuator`** — `/api/conversations` included — until the credential is replaced. The procedure must take one path explicitly and record which:

- **Path A — dedicated identity (preferred; does not mutate the bootstrap credential).** Sign in as a pre-provisioned non-bootstrap operator identity; expect `mustChangePassword=false` and proceed to Step 5. The bootstrap credential stays untouched.
- **Path B — complete the forced change (mutates the environment — record it).** With the bootstrap identity, call `POST /api/auth/change-password` (body `{"currentPassword": "...", "newPassword": "..."}`, min 8 chars; allowed under `/api/auth/`), then **re-run the Step 4 sign-in block** and confirm `mustChangePassword=false`. Record the credential replacement as an environment mutation in the §3 row (who, when, which identity).

```bash
# Branch state check — prints only non-secret fields (get-session = {user, mustChangePassword})
curl -sf -H @"$HDR_FILE" "https://<staging-host>/api/auth/get-session" \
| python3 -c 'import json,sys; d=json.load(sys.stdin); print("user:", d["user"].get("id")); print("mustChangePassword:", d["mustChangePassword"])'

# Path B only — replace the credential (fresh REQ_FILE with the change-password JSON),
# then re-run the Step 4 sign-in block above before Step 5.
curl -sf -X POST "https://<staging-host>/api/auth/change-password" \
  -H 'Content-Type: application/json' --data-binary @"$REQ_FILE" >/dev/null
```

A `403` from `/api/conversations` while `mustChangePassword=true` is the filter working as designed — record it as the observed forced-change state, resolve it via Path A or B, and only then claim Step 5.

### Step 5 — Data-path proof: `GET /api/conversations`

```bash
CONV_FILE="$(mktemp)"
STATUS="$(curl -s -o "$CONV_FILE" -w '%{http_code}' -H @"$HDR_FILE" "https://<staging-host>/api/conversations")"
echo "GET /api/conversations -> $STATUS"   # expect 200

# Redacted excerpt only: the envelope shape ({data,page,limit,total}), never the payload.
python3 - "$CONV_FILE" <<'PY'
import json, sys
doc = json.load(open(sys.argv[1]))
print("envelope keys:", sorted(doc.keys()), "| rows:", len(doc.get("data", [])), "| total:", doc.get("total"))
PY

# Session cleanup — remove every credential/token/response file when done.
rm -f "$REQ_FILE" "$TOK_FILE" "$HDR_FILE" "$CONV_FILE"
```

**Gate**: HTTP **200**. This is the founder-required data-path proof; health checks do not substitute for it. A 401/403 after the forced-change branch is resolved is a finding (auth wiring), not a pass.

### Step 6 — (Optional) `/ws` connectivity — `<scope: confirm with founder>`

Whether the WebSocket upgrade counts as #361 evidence is `<scope: confirm with founder>`. The raw WebSocket endpoint is `/ws` (ADR-026; no Socket.io/STOMP/SockJS), and the handshake verifies the JWT and identity status. If confirmed in scope: evidence is a successful upgrade for a valid token plus a rejected handshake for an invalid one, recorded in §3 like any other row.

---

## 3. Evidence-record template

One row per step, filled at execution time by the actor. **All fields start empty** — this template is unusable as "proof" until a human fills it. Excerpts/artifacts must be redacted: no tokens, no credentials, no user-data payloads.

| # | Step | Actor (role) | Actor (name) | Timestamp (UTC) | Commit SHA | Image tag | Host | Command (shape) | HTTP status(es) | Redacted excerpt / `<artifact-link>` | Pass/Fail | Deviations |
| - | ---- | ------------ | ------------ | --------------- | ---------- | --------- | ---- | --------------- | --------------- | ------------------------------------ | --------- | ---------- |
| 1 | Deploy | `<role>` | `<name>` | | | | | | | | | |
| 2 | Rollout | `<role>` | `<name>` | | | | | | | | | |
| 3 | Health via host | `<role>` | `<name>` | | | | | | | | | |
| 4 | Sign-in | `<role>` | `<name>` | | | | | | | | | |
| 4b | Forced-change branch (A/B) | `<role>` | `<name>` | | | | | | | | | |
| 5 | `GET /api/conversations` | `<role>` | `<name>` | | | | | | | | | |
| 6 | `/ws` (optional) | `<role>` | `<name>` | | | | | | | | | |

Rules: timestamps in UTC; HTTP statuses recorded exactly (a `403` forced-change observation is recorded, never silently retried away); which forced-change path (A or B) is pinned in row 4b, including any environment mutation; empty rows mean the step did not happen; deviations recorded, never normalized. Completed records live on **#361** — this document stays a procedure.

---

## 4. Abort criteria

Abort immediately, record the rows filled so far, and halt if any of these occurs:

- Any §1 precondition is unmet or lapses mid-run.
- The context guard fails, or any `helm`/`kubectl` command fails for any reason other than an explicitly expected result.
- Rollout does not complete, or either health endpoint is non-200 through `<staging-host>` (fallback-only success is a FAIL/blocked row, not a workaround).
- Sign-in fails for a provisioned identity. Record the status; do not retry with varied credentials — that is a finding, not a workaround.
- `GET /api/conversations` is not 200 after the forced-change branch is resolved.
- A step would touch another namespace/release/cluster, or any credential or token would surface in argv, a log, a step summary, or a record.

On abort: report to the named operator/owner (`<founder to name>`); no partial pass may be claimed. Recovering a broken release is roll-forward only ([helm-rollback.md](helm-rollback.md)); database restore is DR, not rollback ([backup-restore.md](backup-restore.md)).

---

## 5. What not to do

- **No `helm rollback`.** Not after a forward migration, not as a quick fix (ADR-027; [helm-rollback.md](helm-rollback.md)). Recovery is a forward-fix deploy — a new immutable image tag through the normal gate.
- **No credential or token values anywhere.** No token in argv, logs, CI step summaries, or evidence artifacts; status codes and redacted excerpts only.
- **No claims from this document.** A filled §3 template attached to #361 is the evidence; this file never becomes one by being edited.
- **No chart/value edits to invent a host.** `<staging-host>`, ingress enablement, TLS, and DNS are ops/founder provisioning actions; this procedure keeps placeholders until then.
- **No production resources.** The run targets `<staging-context>` / `<candidate-namespace>` only; stop and escalate if any command would resolve elsewhere.

---

**Last Updated**: 2026-11-06 (authored by MIG-070c #454; procedure only — no execution claimed)
