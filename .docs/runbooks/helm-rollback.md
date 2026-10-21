# Backend Incident Runbook (Roll-Forward) — `helm-rollback.md`

**Author**: Enterprise Architect  
**Date**: 2026-02-26 (rewritten 2026-10-18, MIG-090 #365)  
**Status**: Current for the Java/Spring service (ADR-029 envelope)  
**Audience**: Operations/SRE, On-Call Engineers, DevOps Team  
**Related**: ADR-019 (K3s + Helm), ADR-029 (JVM deployment envelope), K3s Cluster Requirements

> **Why this file keeps its name**: `deploy/helm/yacc-backend/README.md` links to `.docs/runbooks/helm-rollback.md` by path. The **procedure** below is roll-forward: `helm rollback` is not the primary recovery path. The historical rollback runbook was retired with the migration posture (ARCH-004 §1; ADR-030 Decision 6).
>
> **Rehearsal status**: the rehearsal-evidenced incident/stop-authority procedure is **AC-MIG-070-2 (#361)**. The documented procedures to execute are [cutover-rehearsal.md](cutover-rehearsal.md) (with [backup-restore.md](backup-restore.md)); until that rehearsal evidences them, the content below is documented intent.

---

## Table of Contents

1. [Posture: Roll-Forward Only](#posture-roll-forward-only)
2. [Trigger Conditions](#trigger-conditions)
3. [Incident Procedure](#incident-procedure)
4. [Forward-Verification](#forward-verification)
5. [Stop Authority & Escalation](#stop-authority--escalation)
6. [Audit Trail](#audit-trail)
7. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
8. [Communication Templates](#communication-templates)

---

## Posture: Roll-Forward Only

**Guiding principle**: remediate by deploying a forward fix. Do **not** run `helm rollback` to "un-break" a release.

- **Schema state is forward-only**: Flyway migrations (ADR-027) are not designed for reversal; a rolled-back image against a forward-migrated database is an undefined state.
- **Rolling updates, not reversions**: the Deployment strategy is `RollingUpdate`; the recovery unit is a new image tag.
- **Manual review required** for every forward-fix deploy during an incident (no automated redeploy).
- **Traceability mandatory**: who triggered, when, why, which image tag (see Audit Trail).
- **Post-incident investigation required**: root cause documented in an issue within 24 hours.

`helm history` remains an **audit tool** (what was deployed, when, by whom) — not a recovery mechanism.

---

## Trigger Conditions

### Act immediately (deploy a forward fix or stop traffic)

- ✅ `/health/live` returns non-200 (pod restart loop — liveness failing 3×)
- ✅ Pod in `CrashLoopBackOff` (repeated startup failure)
- ✅ Flyway migration failure at startup (check logs for `migration failed`)
- ✅ Critical API endpoint returns 5xx for >50% of requests for 5+ minutes
- ✅ Pod unable to reach `Running` within 2 minutes of rollout

### Investigate first (do not redeploy in panic)

- ⚠️ Single pod temporarily unavailable (may self-recover; check events)
- ⚠️ Intermittent 5xx below the 50% failure threshold
- ⚠️ Non-critical feature degraded
- ⚠️ Ingress not responding (likely DNS/TLS, not the backend)

### Do not touch the deployment (underlying infrastructure issue)

- ⛔ PostgreSQL pod unhealthy → fix the database first (a new backend pod will not help)
- ⛔ Missing/invalid secrets → fix the Secret, then restart the deployment

---

## Incident Procedure

### Step 1: Verify the problem

```bash
# 1a. Pod status
kubectl get pods -n yacc-staging -o wide

# 1b. Pod logs (last 50 lines) — look for:
#   - "Flyway" / "migration failed"
#   - HikariPool / connection errors
#   - JVM heap ("OutOfMemoryError") / "ExitOnOutOfMemoryError" exits
kubectl logs -n yacc-staging -l app.kubernetes.io/name=yacc-backend --tail=50

# 1c. Events
kubectl describe pod <pod-name> -n yacc-staging | grep -A 20 "Events:"

# 1d. Health endpoints (actuator wire paths, ADR-029)
kubectl port-forward -n yacc-staging svc/yacc-backend 8080:8080 &
sleep 2
curl -i http://localhost:8080/health/live
curl -i http://localhost:8080/health/ready
kill %1
```

### Step 2: Capture the audit state (before changing anything)

```bash
helm history yacc-backend -n yacc-staging          # deployed revisions + image tags
helm get values yacc-backend -n yacc-staging > /tmp/yacc-values-$(date +%s).yaml
kubectl get events -n yacc-staging --sort-by='.lastTimestamp' > /tmp/yacc-events-$(date +%s).txt
```

### Step 3: Classify and decide

```
Is the failure caused by the release (image/config)?
├─ YES → Forward fix (Step 4)
├─ NO  → Is PostgreSQL/cluster healthy?
│        ├─ NO  → Fix infrastructure first (Step 5; no backend redeploy)
│        └─ YES → Investigate (Step 1 evidence) before any deploy
```

### Step 4: Forward fix

```bash
# 4a. Fix the defect on a branch; merge through the normal PR gate.
#     (Emergency hotfixes still go through review — see Stop Authority.)

# 4b. Deploy the fixed image tag
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging --set image.tag=<fixed-tag>

# 4c. Monitor the forward rollout
kubectl rollout status deployment/yacc-backend -n yacc-staging --timeout=2m
```

### Step 5: Infrastructure-first failures

```bash
# PostgreSQL down → restore the database, not the app
kubectl get pods -n yacc-staging -l app=postgres
kubectl rollout restart statefulset/postgres -n yacc-staging   # if restart helps
# Restore from backup if data is corrupted — see .docs/runbooks/backup-restore.md

# Secret invalid → fix the Secret, then bounce the workload
kubectl patch secret yacc-backend-secrets -p '{"data":{...}}' -n yacc-staging
kubectl rollout restart deployment/yacc-backend -n yacc-staging
```

---

## Forward-Verification

### Immediately after the forward deploy (30 seconds)

```bash
# 1. Pods Running
kubectl get pods -n yacc-staging -o wide

# 2. Health endpoints (actuator groups)
kubectl port-forward -n yacc-staging svc/yacc-backend 8080:8080 &
sleep 2
curl -s http://localhost:8080/health/live | jq '.'
curl -s http://localhost:8080/health/ready | jq '.'
kill %1

# 3. Startup logs clean (Flyway applied, no ERROR/FATAL)
kubectl logs -n yacc-staging -l app.kubernetes.io/name=yacc-backend --tail=20
```

### Service verification (2–3 minutes)

```bash
# 1. Database connectivity/tables present
kubectl logs -n yacc-staging -l app.kubernetes.io/name=yacc-backend | grep -i "flyway\|hikari"

# 2. Critical API path
kubectl run -it --rm --image=curlimages/curl --restart=Never debug -- \
  curl -s -X GET "http://yacc-backend.yacc-staging.svc.cluster.local:8080/api/auth/get-session" \
  -H "Authorization: Bearer <test-token>"
# Expect: 401 for an invalid token (proves the route + security chain), 2xx for a valid one.

# 3. Real-time channel
#   WebSocket upgrade at /ws?token=<jwt> must complete for a valid token
#   (handshake interceptor verifies JWT + identity status).
```

### Verification checklist

```bash
echo "=== FORWARD-VERIFICATION ==="
echo "[?] Pod Status:";  kubectl get pods -n yacc-staging -l app.kubernetes.io/name=yacc-backend -o wide
echo "[?] Liveness:";     kubectl exec -it $(kubectl get pod -n yacc-staging -l app.kubernetes.io/name=yacc-backend -o name | head -1) -- curl -s http://localhost:8080/health/live
echo "[?] Readiness:";    kubectl exec -it $(kubectl get pod -n yacc-staging -l app.kubernetes.io/name=yacc-backend -o name | head -1) -- curl -s http://localhost:8080/health/ready
echo "[?] Migration:";    kubectl logs -n yacc-staging -l app.kubernetes.io/name=yacc-backend | grep -i flyway | tail -3
```

---

## Stop Authority & Escalation

**Stop authority** = the explicit decision to halt deployments/traffic rather than continue forward-fixing. **[The rehearsal-evidenced stop-authority drill is AC-MIG-070-2 (#361); the matrix below is documented intent.]**

| Level | Role | Authority | Triggered when |
| ----- | ---- | ---------- | --------------- |
| 1 | On-Call Engineer | Execute the forward fix; monitor; open the incident ticket | Any trigger condition fires |
| 2 | DevOps Lead | Halt further deploys; order infrastructure-first recovery; own RCA | Forward fix fails, DB impaired, multiple simultaneous failures |
| 3 | Founder / VP Engineering | Service stop/traffic cut; customer communication | Service down >30 min, suspected data loss, security incident |

Rules:

- Escalate one level after **two failed forward-fix attempts** of the same defect.
- Level 2+ stop authority is **explicit and recorded** (who, when, why — see Audit Trail); it is never implicit.
- Never trade data integrity for availability: if in doubt between migrating forward and preserving state, stop and escalate.

---

## Audit Trail

Every incident records, in the incident issue:

1. **Timeline**: detection → decision → deploy(s) → verification → closure (UTC).
2. **Revisions**: `helm history` output before and after; the exact image tags deployed.
3. **Actors**: who executed each deploy and who exercised stop authority.
4. **Evidence**: log/event exports (`/tmp` captures from Step 2), health-check outputs.
5. **RCA + prevention**: root cause, forward fix PR link, prevention item merged within 48 hours.

Artifact capture:

```bash
kubectl logs -n yacc-staging -l app.kubernetes.io/name=yacc-backend --all-containers=true --timestamps=true \
  > /tmp/yacc-backend-logs-$(date +%s).txt
helm get all yacc-backend -n yacc-staging > /tmp/yacc-full-state-$(date +%s).yaml
```

---

## Common Issues & Troubleshooting

### Issue 1: Rollout hangs (pod stuck "Terminating")

```bash
kubectl delete pod <pod-name> -n yacc-staging --grace-period=0 --force
kubectl get pods -n yacc-staging -w
```

### Issue 2: New pod also fails (forward fix incomplete)

- The defect is not fully fixed — do **not** roll back; fix forward again.
- Two failed attempts → escalate to Level 2 (Stop Authority).

### Issue 3: Flyway migration failed at startup

```bash
kubectl logs -n yacc-staging -l app.kubernetes.io/name=yacc-backend | grep -i flyway
```

- Migration failures fail the boot (fail-closed by design). Fix the migration in a **new** forward migration; never edit an applied one.

### Issue 4: Secrets invalid after redeploy

```bash
kubectl get secret yacc-backend-secrets -n yacc-staging -o yaml
kubectl get secret yacc-auth-secrets -n yacc-staging -o yaml   # ADR-025 bootstrap/recovery keys
kubectl rollout restart deployment/yacc-backend -n yacc-staging
```

### Issue 5: OOMKilled / JVM exits

- The envelope is 1Gi request / 2Gi limit with `MaxRAMPercentage=75` (ADR-029); heap dumps go to `/app/heap-dumps`.
- Persistent pressure → raise the node/limit envelope via a reviewed values change (forward fix), not ad-hoc `kubectl set resources` in production.

---

## Communication Templates

**Immediate**:

```
🚨 INCIDENT #123: YACC backend (staging)
- Severity: [HIGH/MEDIUM/LOW]
- Status: FORWARD FIX IN PROGRESS
- Failing revision/image: <tag>
- Fix tag: <tag>
- Details: https://github.com/csim-sg/yacc/issues/123
```

**After the forward deploy**:

```
✅ FORWARD FIX DEPLOYED: YACC backend
- Previous image: <tag> (failing)
- Deployed image: <tag>
- Verification: /health/live + /health/ready 200, rollout clean
- RCA: investigating <summary>
- Thread: <link>
```

**Post-incident (24h)**:

```
📋 INCIDENT REPORT #123 PUBLISHED
- Root cause: <description>
- Fix merged: PR #456
- Prevention: <action>
- Review: <link to RCA>
```

---

## Quick Reference (Copy-Paste)

```bash
# Audit: what is deployed
helm history yacc-backend -n yacc-staging

# Forward fix
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging --set image.tag=<fixed-tag>
kubectl rollout status deployment/yacc-backend -n yacc-staging --timeout=2m

# Health (actuator wires)
kubectl port-forward -n yacc-staging svc/yacc-backend 8080:8080 &
curl http://localhost:8080/health/live
curl http://localhost:8080/health/ready
kill %1

# Evidence capture
kubectl logs -n yacc-staging -l app.kubernetes.io/name=yacc-backend --all-containers=true --timestamps=true > /tmp/logs.txt
```

---

## Related Documentation

- **ADR-019**: K3s + Helm deployment decision (envelope amended by ADR-029)
- **ADR-027**: Flyway-only schema management (why rollback is not a recovery path)
- **K3s Cluster Requirements**: `.docs/infrastructure/k3s-cluster-requirements.md`
- **Implementation Guide**: `.docs/03-implementation-guide.md` (Helm section)
- **Helm Official Docs**: https://helm.sh/docs/
- **Kubernetes Docs**: https://kubernetes.io/docs/

---

**Last Updated**: 2026-10-18 (roll-forward rewrite, MIG-090 #365)  
**Next Review**: at the MIG-070 (#361) cutover rehearsal — the rehearsal evidences the stop-authority drill and finalizes this runbook  
**Feedback**: Send issues to #infrastructure-engineering
