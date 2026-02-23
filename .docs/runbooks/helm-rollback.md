# Helm Rollback Operational Runbook

**Author**: Enterprise Architect  
**Date**: 2026-02-26  
**Status**: Final (ADR-019 Approved)  
**Audience**: Operations/SRE, On-Call Engineers, DevOps Team  
**Related**: ADR-019 (Rollback Decision), K3s Cluster Requirements

---

## Table of Contents

1. [Overview & Trigger Conditions](#overview--trigger-conditions)
2. [Pre-Rollback Checklist](#pre-rollback-checklist)
3. [Rollback Procedures](#rollback-procedures)
4. [Post-Rollback Verification](#post-rollback-verification)
5. [Root Cause Analysis](#root-cause-analysis)
6. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
7. [Escalation & Communication](#escalation--communication)

---

## Overview & Trigger Conditions

### When to Rollback (Decision Tree)

**IMMEDIATE ROLLBACK** (no investigation):
- ✅ Health endpoint returns non-200 (5xx error, timeout)
- ✅ Pod in `CrashLoopBackOff` state (repeated restart failure)
- ✅ Database migrations failed (startup error in logs)
- ✅ Critical API endpoint returns 500+ errors (>50% failure rate, 5+ min)
- ✅ Pod unable to reach Running state after 2 minutes (debugging afterward)

**INVESTIGATION FIRST** (do NOT rollback):
- ⚠️ Single pod temporarily unavailable (may self-recover)
- ⚠️ Intermittent 5xx errors (<50% failure rate)
- ⚠️ Non-critical feature degraded (proceed with caution)
- ⚠️ Ingress not responding (may be DNS/TLS issue, not code)

### Rollback Philosophy

**Guiding Principle**: "When in doubt about root cause, rolling back is safer than investigating in production."

- **Manual review required** for every rollback (no automated rollback to avoid cascades)
- **Traceability mandatory** (who triggered, when, why, what revision)
- **Post-rollback investigation required** (root cause must be documented in issue/PR)
- **Communication essential** (notify team, document decision)

---

## Pre-Rollback Checklist

**CRITICAL**: Complete these steps BEFORE executing rollback.

### Step 1: Verify the Problem

```bash
# 1a. Check pod status
kubectl get pods -n yacc-staging -o wide

# Expected output should show clear failure:
# NAME                             READY   STATUS             RESTARTS   AGE
# yacc-backend-7f8c9d4b9b-xxxxx    0/1     CrashLoopBackOff   5          2m

# 1b. Check pod logs (last 50 lines)
kubectl logs -n yacc-staging -l app=yacc-backend --tail=50

# Look for error messages:
# - "cannot connect to database"
# - "failed to start"
# - "panic:"
# - "migration failed"

# 1c. Check pod events
kubectl describe pod <pod-name> -n yacc-staging | grep -A 20 "Events:"

# 1d. Test health endpoint (if accessible)
kubectl port-forward -n yacc-staging svc/yacc-backend 8080:8080 &
sleep 2
curl -i http://localhost:8080/health
kill %1

# Expected: 200 OK with { "status": "ok" }
# If failing: Confirm need for rollback
```

### Step 2: Notify Team

```bash
# Send message to ops channel (Slack/Teams):
"""
🚨 INCIDENT: YACC Backend deployment failure
- Status: CrashLoopBackOff (pod not starting)
- First detected: <timestamp>
- Deployed version: <commit-sha>
- Action: Investigating, may rollback
- Slack thread: <link>
"""
```

### Step 3: Check Deployment History

```bash
# View recent Helm releases
helm history yacc-backend -n yacc-staging

# Expected output:
# REVISION  UPDATED                     STATUS      CHART            APP VERSION  DESCRIPTION
# 1         Thu Feb 26 10:00:00 2026    superseded  yacc-backend-1.0.0  v1.0.0
# 2         Thu Feb 26 10:05:00 2026    superseded  yacc-backend-1.0.0  v1.0.1      upgraded
# 3         Thu Feb 26 10:15:00 2026    deployed    yacc-backend-1.0.0  v1.0.2      upgraded

# Revision 3 = current (failed)
# Revision 2 = last known good
```

### Step 4: Verify Rollback Is Safe

```bash
# Check if backing services (DB, Redis, Secrets) are healthy
kubectl get pods -n yacc-staging -l app=postgres
kubectl get pods -n yacc-staging -l app=redis

# Expected: Both pods in "Running" state
# If either is down: DO NOT ROLLBACK (underlying issue, not deployment)

# Verify secrets exist
kubectl get secret yacc-backend-secrets -n yacc-staging

# Expected: Secret should exist
# If missing: DO NOT ROLLBACK (secrets issue, not deployment)
```

---

## Rollback Procedures

### Procedure A: Quick Helm Rollback (Recommended)

**Use Case**: Pod won't start, health check failing, clear deployment issue

**Duration**: ~30 seconds

```bash
# Step 1: Identify last good revision
helm history yacc-backend -n yacc-staging

# Example output (look for last "deployed" or "superseded" with healthy app):
# REVISION  UPDATED                     STATUS      CHART                    APP VERSION
# 1         Thu Feb 26 10:00:00 2026    superseded  yacc-backend-1.0.0      v1.0.0    
# 2         Thu Feb 26 10:05:00 2026    deployed    yacc-backend-1.0.0      v1.0.1
# 3         Thu Feb 26 10:15:00 2026    deployed    yacc-backend-1.0.0      v1.0.2  ← CURRENT (FAILED)

# Step 2: Rollback to revision 2 (last known good)
helm rollback yacc-backend 2 -n yacc-staging

# Expected output:
# Rollback "yacc-backend" from release version 2 to 1
# release "yacc-backend" rolled back to revision 2

# Step 3: Monitor pod restart
kubectl rollout status deployment/yacc-backend -n yacc-staging --timeout=2m

# Expected: Deployment rolled out successfully
# If timeout: Check logs, may need manual intervention
```

### Procedure B: Rollback via Specific Revision Number

**Use Case**: You know exact revision to rollback to

```bash
# Rollback to specific revision (e.g., revision 1)
helm rollback yacc-backend 1 -n yacc-staging

# Monitor
kubectl rollout status deployment/yacc-backend -n yacc-staging --timeout=2m
```

### Procedure C: Rollback N Revisions Ago

**Use Case**: You want to go back 2-3 versions quickly

```bash
# Get current revision
CURRENT_REVISION=$(helm list -n yacc-staging -o json | \
  jq '.[] | select(.name=="yacc-backend") | .revision')

echo "Current revision: $CURRENT_REVISION"

# Calculate target revision (e.g., 2 versions back)
TARGET_REVISION=$((CURRENT_REVISION - 2))

echo "Rolling back to revision: $TARGET_REVISION"

# Perform rollback
helm rollback yacc-backend $TARGET_REVISION -n yacc-staging

# Monitor
kubectl rollout status deployment/yacc-backend -n yacc-staging --timeout=2m
```

### Procedure D: Full Cluster State Rollback (Emergency Only)

**Use Case**: Multiple services broken, cluster unstable, need full revert

**WARNING**: This removes entire deployment and re-installs from scratch

```bash
# STEP 1: Delete entire Helm release (removes all pods)
helm uninstall yacc-backend -n yacc-staging

# Expected: release "yacc-backend" uninstalled

# STEP 2: Wait for pods to terminate
kubectl get pods -n yacc-staging
# Should show no yacc-backend pods

# STEP 3: Re-install from last known good values
helm install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging \
  -f deploy/helm/yacc-backend/values-staging.yaml.backup

# Note: values-staging.yaml.backup must be pre-saved (see Pre-Deployment Checklist)

# STEP 4: Verify
kubectl rollout status deployment/yacc-backend -n yacc-staging --timeout=2m
```

---

## Post-Rollback Verification

### Immediate Verification (30 seconds)

```bash
# 1. Check pod status
kubectl get pods -n yacc-staging -o wide

# Expected:
# NAME                             READY   STATUS    RESTARTS   AGE
# yacc-backend-7f8c9d4b9b-yyyyy    1/1     Running   0          10s

# 2. Check health endpoint
kubectl port-forward -n yacc-staging svc/yacc-backend 8080:8080 &
sleep 2
HEALTH=$(curl -s http://localhost:8080/health)
kill %1

echo "$HEALTH" | jq '.'
# Expected: { "status": "ok" }

# 3. Check logs for startup success
kubectl logs -n yacc-staging -l app=yacc-backend --tail=20 | tail -5

# Expected: No error messages, should see "Server started on port 8080"
```

### Full Service Verification (2-3 minutes)

```bash
# 1. Check database connectivity
kubectl logs -n yacc-staging -l app=yacc-backend | grep -i "database\|connected\|migration"

# Expected: "Database connected", "migrations completed"

# 2. Check Redis connectivity
kubectl logs -n yacc-staging -l app=yacc-backend | grep -i "redis\|cache"

# Expected: "Redis connected", no connection errors

# 3. Test critical API endpoint
BACKEND_IP=$(kubectl get svc yacc-backend -n yacc-staging -o jsonpath='{.spec.clusterIP}')

kubectl run -it --rm --image=curlimages/curl --restart=Never debug -- \
  curl -s -X GET "http://$BACKEND_IP:8080/api/conversations?limit=1" \
  -H "Authorization: Bearer <test-token>"

# Expected: 200 OK with message data (or 401 if auth required)
```

### Smoke Test Deployment (Full)

```bash
# Run integration test suite (if available)
kubectl run -it --rm --image=<yacc-test-image> --restart=Never \
  test-runner -- npm run test:smoke

# OR manually test critical flows:
# 1. Login endpoint
curl -X POST http://<backend-ip>:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# 2. Conversations list
curl -X GET http://<backend-ip>:8080/api/conversations \
  -H "Authorization: Bearer <token>"

# 3. Messaging
curl -X POST http://<backend-ip>:8080/api/conversations/<id>/messages \
  -H "Authorization: Bearer <token>" \
  -d '{"body":"Test message"}'

# All should return 2xx status
```

### Verification Checklist

```bash
# Use this template to verify all critical systems:

echo "=== POST-ROLLBACK VERIFICATION ==="
echo ""
echo "[?] Pod Status:"
kubectl get pods -n yacc-staging -l app=yacc-backend -o wide
echo ""

echo "[?] Health Check:"
kubectl exec -it $(kubectl get pod -n yacc-staging -l app=yacc-backend -o name | head -1) \
  -- curl -s http://localhost:8080/health | jq '.'
echo ""

echo "[?] Database:"
kubectl logs -n yacc-staging -l app=yacc-backend | grep -i "database" | tail -1
echo ""

echo "[?] Redis:"
kubectl logs -n yacc-staging -l app=yacc-backend | grep -i "redis" | tail -1
echo ""

echo "[?] API Response:"
kubectl port-forward -n yacc-staging svc/yacc-backend 8080:8080 &
sleep 1
curl -s http://localhost:8080/api/conversations | jq '.' | head -5
kill %1
```

---

## Root Cause Analysis

### Post-Rollback Investigation (Required)

**Purpose**: Prevent same issue from happening again

**Timeline**: Complete within 24 hours of rollback

### Step 1: Collect Artifacts

```bash
# 1a. Export pod logs (full history)
kubectl logs -n yacc-staging -l app=yacc-backend --all-containers=true --timestamps=true \
  > /tmp/yacc-backend-logs-$(date +%s).txt

# 1b. Export pod events
kubectl get events -n yacc-staging --sort-by='.lastTimestamp' \
  > /tmp/yacc-events-$(date +%s).txt

# 1c. Export Helm values used (from failed release)
helm get values yacc-backend -n yacc-staging --revision 3 \
  > /tmp/yacc-values-failed-revision-3.yaml

# 1d. Export Helm release metadata
helm get all yacc-backend -n yacc-staging --revision 3 \
  > /tmp/yacc-full-state-revision-3.yaml
```

### Step 2: Identify Root Cause

**Use Decision Tree**:

```
Was pod in CrashLoopBackOff?
├─ YES → Check logs for: "cannot connect to database", "panic:", "migration failed"
│  ├─ Database error → Check: Is PostgreSQL pod running? Secret values correct?
│  ├─ Migration error → Check: Was schema changed? Is migration reversible?
│  └─ Application error → Check: Was code change deployed? Is version compatible?
│
└─ NO (pod stuck in Pending)
   ├─ Check: Is storage claim pending? → Local-path provisioner issue
   ├─ Check: Is memory/CPU insufficient? → Resource quota issue
   └─ Check: Are node selectors blocking? → Check node labels
```

### Step 3: Document Findings

**Create GitHub Issue** with template:

```markdown
# Rollback RCA: [Release Version] (Revision X)

## Incident Summary
- **Date**: [timestamp]
- **Duration**: [how long before rollback]
- **Symptom**: [CrashLoopBackOff / Pending / Health check failing]
- **Rolled back to**: Revision [X]

## Root Cause
[Describe root cause in detail]

Example:
- Database migration script had syntax error
- PostgreSQL pod was down during deployment
- New environment variable was missing from K8s Secret

## Evidence
[Link to logs, events, code changes]

## Fix Applied
- Merged PR #123 to fix migration script
- Redeployed with revision [X]
- All systems healthy

## Prevention
- Add migration syntax validation to CI/CD
- Add health check for dependency services before deployment
- Implement automated secret validation

## Related PRs
- Fixes: #456
- Depends on: #789
```

### Step 4: Implement Prevention

**Example Preventions**:

| Root Cause | Prevention |
|-----------|-----------|
| Migration script error | Run migrations against test DB in CI before deploy |
| Missing secret | Pre-validate all required secrets before deployment |
| Resource conflict | Run capacity test before deploying large resource changes |
| Code incompatibility | Run E2E tests in staging before prod deployment |
| Dependency down | Add pre-deployment health check for all dependencies |

---

## Common Issues & Troubleshooting

### Issue 1: Rollback Hangs (Pod Stuck in "Terminating")

**Symptoms**: Rollback command runs, but pod never restarts

**Diagnosis**:
```bash
# Check pod status
kubectl describe pod <pod-name> -n yacc-staging

# Look for: "Termination Grace Period" (default 30s)
```

**Solution**:
```bash
# Force delete pod (triggers immediate restart)
kubectl delete pod <pod-name> -n yacc-staging --grace-period=0 --force

# Monitor restart
kubectl get pods -n yacc-staging -w

# Pod should restart with new replica
```

### Issue 2: Rollback Completes, But Pod Still Fails

**Symptoms**: Rollback succeeds, but new pod also crashes

**Diagnosis**:
```bash
# The previous revision was also broken (cascading failure)
helm history yacc-backend -n yacc-staging

# Check if older revisions were healthy
# May need to rollback further (e.g., 2-3 revisions ago)
```

**Solution**:
```bash
# Try earlier revision
helm rollback yacc-backend 1 -n yacc-staging  # Go back further

# Monitor
kubectl rollout status deployment/yacc-backend -n yacc-staging --timeout=2m

# If all revisions fail: Issue with cluster (DB, secrets, resources)
# Escalate to infrastructure team
```

### Issue 3: Database Corrupted After Rollback

**Symptoms**: Pod running, but database errors in logs

**Diagnosis**:
```bash
# Check PostgreSQL pod
kubectl get pods -n yacc-staging -l app=postgres

# Check PostgreSQL logs
kubectl logs -n yacc-staging -l app=postgres | tail -50
```

**Solution**:
```bash
# Restore from backup (if available)
# OR restart PostgreSQL pod (may auto-repair minor corruption)
kubectl rollout restart statefulset/postgres -n yacc-staging

# Monitor restart
kubectl rollout status statefulset/postgres -n yacc-staging --timeout=2m
```

### Issue 4: Secrets Invalid After Rollback

**Symptoms**: Pod running, but auth/connection errors in logs

**Diagnosis**:
```bash
# Check secrets
kubectl get secret yacc-backend-secrets -n yacc-staging -o yaml

# Verify values match environment
echo $DATABASE_URL
echo $REDIS_URL

# Check if secrets were updated between deployments
```

**Solution**:
```bash
# Update secret if values changed
kubectl patch secret yacc-backend-secrets \
  -p '{"data":{"DATABASE_URL":"'$(echo -n "$DATABASE_URL" | base64)'"}}' \
  -n yacc-staging

# Restart pod to pick up new secret
kubectl rollout restart deployment/yacc-backend -n yacc-staging
```

### Issue 5: Helm Rollback Fails ("no revision x")

**Symptoms**: Error "release history for rollback must include at least 1 revision"

**Diagnosis**:
```bash
# Check release history
helm history yacc-backend -n yacc-staging

# May show: "No release history"
# Happens if release was uninstalled and reinstalled
```

**Solution**:
```bash
# Cannot use helm rollback (history lost)
# Must manually redeploy from known-good values

# Option 1: Use values backup (should exist)
helm install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging \
  -f deploy/helm/yacc-backend/values-staging.yaml.backup

# Option 2: Redeploy from git tag (known good version)
git checkout v1.0.1
helm install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging \
  -f deploy/helm/yacc-backend/values-staging.yaml
```

---

## Escalation & Communication

### Escalation Matrix

**Level 1: On-Call Engineer** (YOU)
- Detect incident (health check, alert, customer report)
- Verify problem severity
- Execute rollback (Procedures A-C above)
- Monitor post-rollback (30 minutes)
- Create incident ticket

**Level 2: DevOps Lead**
- Triggered if: Rollback fails, DB corrupted, multiple failures
- Responsibility: Root cause analysis, prevent recurrence
- Notify: Engineering lead + Product owner

**Level 3: VP Engineering**
- Triggered if: Service down >30 min, data loss suspected, security incident
- Responsibility: Customer communication, status page
- Notify: Customer support, executive team

### Communication Template

**Slack/Teams Notification** (Immediate):
```
🚨 INCIDENT #123: YACC Backend Deployment Failed
- Severity: [HIGH/MEDIUM/LOW]
- Status: ROLLBACK IN PROGRESS
- ETA: 2 minutes
- Details: https://github.com/csim-sg/yacc/issues/123
```

**Update After Rollback** (5 minutes):
```
✅ ROLLBACK COMPLETE: YACC Backend
- Previous version: Revision 3 (failed)
- Rolled back to: Revision 2 (stable)
- Status: HEALTHY (all services online)
- RCA: Investigating [root cause summary]
- Next: Will deploy fix tomorrow AM
- Slack thread: https://slack.com/archives/...
```

**Post-Incident Update** (24 hours):
```
📋 INCIDENT REPORT #123 PUBLISHED
- Root cause: [Description]
- Fix merged: PR #456
- Prevention: [Action taken]
- Will redeploy: [timestamp]
- Review: [link to RCA document]
```

### Documentation Requirements

**After every rollback, create:**

1. **GitHub Issue** (incident ticket)
   - Symptom, timeline, root cause
   - Link to logs/artifacts
   - Fix status

2. **RCA Document** (GitHub wiki or Confluence)
   - What happened
   - Why it happened
   - What we did
   - How we prevent next time

3. **PR with Prevention** (merge within 48 hours)
   - Code fix OR
   - CI/CD validation OR
   - Documentation update

---

## Related Documentation

- **ADR-019**: K3s + Helm deployment decision (Sections 3.6)
- **K3s Cluster Requirements**: `.docs/infrastructure/k3s-cluster-requirements.md`
- **Implementation Guide**: `.docs/03-implementation-guide.md` (Helm section)
- **Helm Official Docs**: https://helm.sh/docs/
- **Kubernetes Docs**: https://kubernetes.io/docs/

---

## Quick Reference (Copy-Paste Commands)

```bash
# Emergency Rollback (30 seconds)
helm rollback yacc-backend -n yacc-staging
kubectl rollout status deployment/yacc-backend -n yacc-staging --timeout=2m

# View history
helm history yacc-backend -n yacc-staging

# Rollback to specific revision
helm rollback yacc-backend 2 -n yacc-staging

# Health check
kubectl port-forward -n yacc-staging svc/yacc-backend 8080:8080 &
curl http://localhost:8080/health
kill %1

# Collect logs for RCA
kubectl logs -n yacc-staging -l app=yacc-backend --all-containers=true --timestamps=true > /tmp/logs.txt

# Notify team
echo "🚨 Rolled back to Revision X, all healthy. RCA in progress."
```

---

**Last Updated**: 2026-02-26  
**Next Review**: 2026-06-26 (post-MVP monitoring integration)  
**Feedback**: Send issues to #infrastructure-engineering
