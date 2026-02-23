# GOV-032 ARCHITECT IMPLEMENTATION GUIDE

**For:** Enterprise Architect (primary implementer of Docs #2-6)  
**From:** Product Owner (decision authority, GOV-032 issued 2026-02-24)  
**Timeline:** Draft by 2026-02-27 EOD; PO review same day; commit 2026-02-28  
**Status:** ✅ Ready to start

---

## YOUR TASKS (Architect)

You are responsible for drafting 6 of 7 documentation artifacts. Here's the checklist:

### ✅ Task 1: ADR-019 Signature Block (DONE)
- **Status**: ✅ COMPLETE (PO signed 2026-02-24)
- **Evidence**: `.docs/adr/ADR-019-k3s-helm-cicd-deployment.md` line 76-80
- **No further action needed**

---

### 📝 Task 2: Technology Architecture Document (NEW)

**What to Create:**  
File: `.docs/architecture/002-k3s-helm-deployment-architecture.md`

**Contents (Detailed Outline):**

```
1. Overview
   - Purpose: K3s as standard Kubernetes runtime; Helm as deployment tool
   - Scope: Backend only (frontend = S3/CloudFront, separate)
   - MVP target: Single K3s cluster (dev/staging/prod namespaces)

2. Cluster Architecture
   - Node sizing (dev: 2 vCPU/4GB RAM minimum; prod: 4 vCPU/8GB RAM recommended)
   - Storage class (local-path for MVP; persistent volumes for prod)
   - Network policy (ingress, egress, pod-to-pod communication)
   - Secrets management (ADR-020: pending Infrastructure Team)

3. Helm Chart Structure
   - Backend chart (yacc-backend)
   - Dependencies (PostgreSQL v14+, Redis v18+)
   - Values organization (values-dev.yaml, values-staging.yaml, values-prod.yaml)
   - ConfigMaps + Secrets (how app config is injected)

4. Deployment Flow
   - Trigger: Merge to dev branch → GitHub Actions
   - Steps: Lint → test → build image → helm upgrade
   - Outcomes: Pod Running → health check → service endpoint active

5. Scaling & Rollback
   - Horizontal scaling (replica count per environment)
   - Rollback strategy (helm rollback, data migration considerations)
   - Disaster recovery (backup strategy deferred)

6. Environment Mapping
   - dev: K3d local; 1 replica; no persistent storage
   - staging: K3s cluster; 2 replicas; test data retention
   - prod: K3s cluster; 3+ replicas; persistent storage (post-MVP)

7. Risk Mitigation
   - Network access security (ADR-020: GitHub Actions → K3s authentication)
   - Secrets encryption (Sealed Secrets vs External Secrets)
   - Rollback triggers (health check failure, E2E test failure)
```

**PO Review Criteria:**
- [ ] Cluster topology is clear (node count, sizing, namespaces)
- [ ] Chart structure matches what backend dev will implement in DEV-014
- [ ] Scaling model is documented
- [ ] Rollback strategy is actionable

---

### 📝 Task 3: Implementation Guide - Helm Section (UPDATE)

**What to Update:**  
File: `.docs/03-implementation-guide.md` → Section 7.8 (or create new section)

**Add Subsections:**

```
7.8 Backend Helm Deployment

7.8.1 Helm Chart Creation Workflow
   a. Initialize chart structure
      ```
      mkdir -p ./helm/backend/{templates,charts}
      cat > ./helm/backend/Chart.yaml <<EOF
      apiVersion: v2
      name: yacc-backend
      description: YACC Backend Service with PostgreSQL + Redis
      type: application
      version: 0.1.0
      appVersion: 0.1.0
      dependencies:
      - name: postgresql
        version: "14.x.x"
        repository: "https://charts.bitnami.com/bitnami"
      - name: redis
        version: "18.x.x"
        repository: "https://charts.bitnami.com/bitnami"
      EOF
      ```
   
   b. Create values files
      - values.yaml (defaults)
      - values-dev.yaml (dev overrides)
      - values-staging.yaml (staging overrides)
      - values-prod.yaml (prod overrides)
   
   c. Create templates/
      - deployment.yaml (backend service definition)
      - service.yaml (expose deployment)
      - configmap.yaml (app configuration)
      - ingress.yaml (optional, post-MVP)

7.8.2 Local Testing with k3d
   a. Install k3d: brew install k3d
   b. Create cluster: k3d cluster create yacc-local
   c. Deploy: helm upgrade --install yacc-backend ./helm/backend -n default
   d. Verify (port-forward + curl + logs) [SEE BLOCKER #5 CRITERIA]
   e. Cleanup: k3d cluster delete yacc-local

7.8.3 Values File Organization
   - values.yaml: baseline config (replicas, resources, image)
   - values-dev.yaml: dev overrides (replicaCount: 1, resources: low)
   - values-staging.yaml: staging overrides (replicaCount: 2)
   - values-prod.yaml: prod overrides (replicaCount: 3, resources: high)

7.8.4 CI/CD Integration
   - GitHub Actions workflow deploys via: helm upgrade --install yacc-backend ./helm/backend -n yacc-staging --values helm/backend/values-staging.yaml
   - Health check automation (see DEV-015 acceptance criteria)
```

**PO Review Criteria:**
- [ ] Backend dev can follow end-to-end (from mkdir to deployed pod)
- [ ] k3d local testing section is clear + testable
- [ ] Values organization prevents manual overrides
- [ ] CI/CD commands match DEV-015 requirements

---

### 📝 Task 4: Quick Reference - Helm (UPDATE/EXPAND)

**What to Update:**  
File: `.docs/05-quick-reference.md` → Add "Helm + K3s Quick Commands" section

**Add Section:**

```
## Helm + K3s Quick Commands

### Helm Chart Management
| Task | Command | Notes |
|------|---------|-------|
| Initialize chart | mkdir -p helm/backend/{templates,charts} | Create structure |
| Lint chart | helm lint ./helm/backend | Validate syntax |
| Install locally | helm install yacc-backend ./helm/backend -n default | First deploy |
| Upgrade locally | helm upgrade yacc-backend ./helm/backend -n default | Subsequent deploys |
| Idempotent deploy | helm upgrade --install yacc-backend ./helm/backend | Install or upgrade |
| Rollback | helm rollback yacc-backend -n default | Go to previous revision |
| History | helm history yacc-backend -n default | See all revisions |
| Status | helm status yacc-backend -n default | Current deployment state |
| Values override | helm upgrade --values values-staging.yaml ... | Use different values |

### K3d (Local Kubernetes)
| Task | Command | Notes |
|------|---------|-------|
| Install k3d | brew install k3d | macOS |
| Create cluster | k3d cluster create yacc-local | Create local cluster |
| List clusters | k3d cluster list | Show all clusters |
| Delete cluster | k3d cluster delete yacc-local | Clean up |
| Get kubeconfig | k3d kubeconfig get yacc-local | Export config |

### Kubernetes Verification
| Task | Command | Notes |
|------|---------|-------|
| List pods | kubectl get pods -n default | Show running pods |
| Pod logs | kubectl logs deployment/yacc-backend -n default | See pod output |
| Port forward | kubectl port-forward svc/yacc-backend 3000:3000 | Local access |
| Health check | curl http://localhost:3000/health | Verify running |
| Describe pod | kubectl describe pod <pod-name> -n default | Debug info |

### Troubleshooting
| Issue | Solution |
|-------|----------|
| Pod won't start (CrashLoopBackOff) | `kubectl logs <pod>` → check startup errors |
| Health check fails | `kubectl port-forward` + `curl` → verify service |
| Values not applied | `helm values <release> -n <ns>` → check current values |
| Helm install hangs | `--timeout 5m` flag in helm upgrade (see DEV-015) |
```

**PO Review Criteria:**
- [ ] 1-page quick reference (printable if needed)
- [ ] All common commands present (install, upgrade, rollback, k3d, kubectl verify)
- [ ] Troubleshooting covers most likely issues

---

### 📝 Task 5: Infrastructure Requirements Document (NEW)

**What to Create:**  
File: `.docs/infrastructure/k3s-cluster-requirements.md`

**Contents (Detailed Outline):**

```
# K3s Cluster Requirements (MVP)

## 1. Node Sizing

### Development (k3d local)
- CPU: 2 vCPU minimum (shared)
- Memory: 4 GB minimum (shared)
- Disk: 10 GB minimum
- Network: Localhost (127.0.0.1)

### Staging (K3s single-node or cluster)
- CPU: 4 vCPU
- Memory: 8 GB
- Disk: 20 GB (persistent volumes for PostgreSQL/Redis)
- Network: Internal network; GitHub Actions must reach via tunnel/VPN/public endpoint (ADR-020)

### Production (Post-MVP)
- CPU: 8+ vCPU (distributed across 3+ nodes)
- Memory: 16+ GB (distributed)
- Disk: 50+ GB (persistent volumes)
- Network: Public or private with ingress controller

## 2. Storage Requirements

### Dev (k3d)
- local-path storage class (default in k3d)
- Transient data OK (ephemeral)

### Staging
- Persistent volume (PV) for PostgreSQL data
- Persistent volume for Redis persistence (RDB backup)
- Recommended: 10 GB for PostgreSQL + 5 GB for Redis

### Prod (Post-MVP)
- Redundant storage (NAS, EBS, cloud storage)
- Backup strategy (snapshots, replication)

## 3. Network Policy

### Pod-to-Pod Communication
- All pods in same cluster can communicate (default)
- Service discovery via CoreDNS (built-in)

### Egress (Pod → External)
- Pods must reach: Telegram API, IRC servers
- Firewall rules: Outbound TCP 443 (Telegram), outbound 6667+ (IRC)

### Ingress (External → Pod)
- GitHub Actions → K3s: SSH tunnel or VPN (ADR-020: pending decision)
- Admin access: `kubectl` CLI (kubeconfig file)

### DNS
- Internal: CoreDNS (built-in K3s)
- External: Public domain (if ingress controller added)

## 4. Secrets Management (BLOCKED ON ADR-020)

**Decision Pending:** Infrastructure Team to provide ADR-020 by 2026-02-24

Options:
- **Sealed Secrets**: Encrypt secrets in Git; K3s operator decrypts on cluster
- **External Secrets Operator**: Reference Vault/AWS Secrets Manager
- **Kubernetes Secrets**: Bare secrets in cluster (dev-only, not recommended for prod)

### MVP Default (Temporary)
- Environment variables: Use `configMap` for non-sensitive config; env-var references in pod spec
- Secrets: Sealed Secrets or manually pre-loaded into cluster (tooling TBD by Infrastructure Team)

## 5. Resource Requests/Limits

### Backend Pod
- CPU request: 100m (dev), 500m (staging)
- CPU limit: 500m (dev), 1000m (staging)
- Memory request: 256 Mi (dev), 512 Mi (staging)
- Memory limit: 512 Mi (dev), 1024 Mi (staging)

### PostgreSQL Pod
- CPU request: 250m
- CPU limit: 1000m
- Memory request: 512 Mi
- Memory limit: 1024 Mi

### Redis Pod
- CPU request: 100m
- CPU limit: 500m
- Memory request: 256 Mi
- Memory limit: 512 Mi

## 6. Logging & Observability

### Dev (k3d)
- Pod logs via `kubectl logs` (sufficient)
- No persistent logging (ephemeral)

### Staging
- Pod logs persisted (24-hour retention minimum)
- Optional: ELK stack (Elasticsearch/Logstash/Kibana) or Loki (post-MVP)

### Prod (Post-MVP)
- Centralized logging (ELK, Loki, Datadog, etc.)
- Metrics collection (Prometheus)
- Alerting (Alertmanager)

## 7. Backup & Disaster Recovery

### MVP (Not Implemented)
- Backup strategy: TBD (post-MVP)
- Recovery objective: No guarantee

### Post-MVP
- Database backups: Daily snapshots (PostgreSQL pg_dump)
- Helm chart backups: Version control (already in Git)
- Recovery procedure: Documented runbook

## 8. Security Considerations

### API Access Control
- K3s API: Protected by kubeconfig (mutual TLS)
- GitHub Actions: Authenticate via service account token or sealed kubeconfig (ADR-020)
- Human admin: Use `kubectl` with local kubeconfig

### Network Security
- NetworkPolicy: Pod-to-pod RBAC (post-MVP, if needed)
- Secrets encryption: At-rest via encrypted storage (staging/prod)
- TLS: Ingress controller handles HTTPS (post-MVP)

### Pod Security
- Read-only root filesystem (post-MVP)
- Non-root user execution (post-MVP)
- Network policy enforcement (post-MVP)

## 9. Capacity Planning

### Initial Load (MVP, Single Cluster)
- Concurrent connections: 100 users (WebSocket multiplexing)
- Message throughput: 1000 msg/hour (burst to 5000)
- Database connections: 20 (connection pool)
- Cache connections: 10 (Redis)

### Scaling Triggers (Phase 2+)
- Pod CPU > 80% → add replica
- Pod memory > 80% → increase limits + node capacity
- Database connections > 15 → scale database
- Redis memory > 80% → increase cache size

## 10. Cluster Initialization Checklist

- [ ] K3s installed (v1.27+)
- [ ] Namespace created: `default` (dev), `yacc-staging` (staging)
- [ ] Storage class configured: local-path (dev), persistent volumes (staging)
- [ ] Helm installed (v3.12+)
- [ ] GitHub Actions authentication method in place (ADR-020)
- [ ] Secrets sealing/management tool deployed (ADR-020)
- [ ] Pod resource limits configured (see section 5)
```

**PO Review Criteria:**
- [ ] Node sizing is unambiguous (no "medium" or "production-grade", use actual vCPU/RAM)
- [ ] Network access to K3s from GitHub Actions is clear (references ADR-020)
- [ ] Storage requirements match DEV-014 (PostgreSQL + Redis persistence)
- [ ] Secrets management defers to ADR-020 (not decided yet)
- [ ] Backup strategy is documented (even if "TBD post-MVP")

---

### 📝 Task 6: Helm Rollback Runbook (NEW)

**What to Create:**  
File: `.docs/runbooks/helm-rollback.md`

**Contents (Detailed Outline):**

```
# Helm Rollback Runbook

## Overview
This runbook provides step-by-step instructions for rolling back a Helm deployment on K3s when deployment fails or health checks fail.

**Estimated Time:** 5-10 minutes  
**Risk Level:** Low (Helm rollback is idempotent)  
**Audience:** Ops team, deployment engineers

---

## When to Trigger Rollback

### Automatic Triggers (GitHub Actions)
- Health check failure: `curl http://localhost:3000/health` returns non-200
- Pod failure: Deployment stuck in CrashLoopBackOff for > 2 minutes
- Liveness probe failure: Pod terminated due to failed health check

### Manual Triggers
- E2E smoke test failure (post-deploy)
- Data corruption detected
- Performance regression (> 10% latency increase)
- Operator decision (if rollback suspected necessary)

---

## Rollback Procedure

### Step 1: Check Current Deployment Status
```bash
# List Helm releases
helm list -n yacc-staging

# Example output:
# NAME            NAMESPACE       REVISION        UPDATED                     STATUS          CHART
# yacc-backend    yacc-staging    5               2026-02-27 14:30:00 +0000   deployed        yacc-backend-0.1.0

# Check pod status
kubectl get pods -n yacc-staging | grep yacc-backend
```

### Step 2: View Rollback History
```bash
# List all revisions (deployments)
helm history yacc-backend -n yacc-staging

# Example output:
# REVISION        UPDATED                         STATUS          CHART           APP VERSION     DESCRIPTION
# 1               2026-02-26 10:00:00 +0000       superseded      yacc-backend-0.1.0  0.1.0           Initial install
# 2               2026-02-27 10:15:00 +0000       superseded      yacc-backend-0.1.0  0.1.0           Upgrade for config change
# 3               2026-02-27 11:00:00 +0000       superseded      yacc-backend-0.1.0  0.1.0           New backend image
# 4               2026-02-27 12:30:00 +0000       superseded      yacc-backend-0.1.0  0.1.0           Bad config (FAILED)
# 5               2026-02-27 14:30:00 +0000       deployed        yacc-backend-0.1.0  0.1.0           Rollback to revision 3
```

### Step 3: Identify Stable Revision
```bash
# If rolling back to immediate previous (most common):
CURRENT_REVISION=5
ROLLBACK_TO=$((CURRENT_REVISION - 1))
# ROLLBACK_TO=4

# If need to go further back:
# Check revision 3 or earlier for last known-good deployment
# ROLLBACK_TO=3
```

### Step 4: Execute Rollback
```bash
# Rollback command
helm rollback yacc-backend REVISION -n yacc-staging

# Example (rollback to revision 3):
helm rollback yacc-backend 3 -n yacc-staging

# Expected output:
# Rollback was a success! Happy Helming!
```

### Step 5: Verify Rollback
```bash
# Check pod status (should transition to Running)
kubectl get pods -n yacc-staging

# Wait for pod to be Ready (< 1 minute)
kubectl wait --for=condition=Ready pod -l app=yacc-backend -n yacc-staging --timeout=2m

# Verify health endpoint
kubectl port-forward -n yacc-staging svc/yacc-backend 3000:3000 &
sleep 2
curl -f http://localhost:3000/health && echo "✅ Health check passed" || echo "❌ Health check failed"

# Check pod logs for errors
kubectl logs deployment/yacc-backend -n yacc-staging | tail -20

# Verify no ERROR/FATAL/panic
kubectl logs deployment/yacc-backend -n yacc-staging | grep -iE "ERROR|FATAL|panic" && echo "❌ Errors found" || echo "✅ No errors"
```

### Step 6: Confirm Success
```bash
# Check deployment status
helm status yacc-backend -n yacc-staging

# Expected output:
# NAME: yacc-backend
# NAMESPACE: yacc-staging
# STATUS: deployed
# REVISION: 6 (or higher, indicating rollback was recorded as new deployment)

# Check application is responding
curl http://localhost:3000/health
# Expected: {"status":"healthy"}
```

---

## Rollback Failure Recovery

### Scenario: Rollback Fails (Pod Still CrashLoopBackOff)
```bash
# 1. Check error logs
kubectl logs deployment/yacc-backend -n yacc-staging --tail=50

# 2. Describe pod for events
kubectl describe pod <pod-name> -n yacc-staging

# 3. If issue is data corruption:
#    a. Delete pod (will be recreated by deployment)
kubectl delete pod <pod-name> -n yacc-staging

#    b. Wait for new pod to start
kubectl wait --for=condition=Ready pod -l app=yacc-backend -n yacc-staging --timeout=2m

#    c. Re-test health check
curl http://localhost:3000/health

# 4. If still failing, escalate to Architect (database migration issue, schema mismatch)
```

### Scenario: Cannot Rollback to Previous (Revision Doesn't Exist)
```bash
# 1. Check revision history again
helm history yacc-backend -n yacc-staging

# 2. If no previous revisions:
#    a. Emergency: Redeploy from scratch
helm uninstall yacc-backend -n yacc-staging
helm install yacc-backend ./helm/backend -n yacc-staging --values helm/backend/values-staging.yaml

#    b. Restore data (if applicable)
#       - Database: Restore from backup (documented separately)
#       - Cache: Redis recreated automatically (ephemeral)

# 3. Contact Infrastructure team if data loss is critical
```

---

## Rollback Timeline

| Step | Estimated Time | Notes |
|------|---|---|
| Check status | 30 seconds | Helm + kubectl commands |
| View history | 30 seconds | Identify rollback target |
| Rollback | 1-2 minutes | Helm re-deploys previous revision |
| Verify pods ready | 2-5 minutes | kubectl wait timeout |
| Health checks | 1 minute | curl + logs review |
| **Total** | **5-10 minutes** | Typical rollback duration |

---

## Post-Rollback Actions

1. **Notify Team**
   - Slack: "@channel Rollback completed. Investigating root cause."
   - Create incident ticket

2. **Root Cause Analysis**
   - Review failed deployment logs (kubectl logs + Helm status)
   - Check what changed (code, config, dependencies)
   - Document findings in incident ticket

3. **Prevention**
   - Add test to CI to catch issue earlier
   - Update documentation if process changed
   - Consider pre-deployment smoke test

---

## Emergency Contact
- Architect: [Contact info]
- Infrastructure team: [Contact info]
- On-call: [Escalation path]

---

## Related Documentation
- ADR-019: K3s/Helm deployment decision
- `.docs/infrastructure/k3s-cluster-requirements.md`
- `.docs/03-implementation-guide.md` Section 7.8
```

**PO Review Criteria:**
- [ ] Ops team can execute steps 1-6 without questions
- [ ] Rollback failure scenarios are covered
- [ ] Estimated timeline is accurate
- [ ] Post-rollback verification is clear

---

### 📝 Task 7: Planning Index Update (PO OWNS THIS)

**Note:** Product Owner will handle this update directly.

**What PO Will Do:**
- Update `.docs/plans/00-INDEX.md` section "Infrastructure Phase Status"
- Mark Blockers #5 + #8 as RESOLVED
- Add links to GOV-032 + new docs (Tasks 2-6)
- Document timeline for DEV-013-015

**No action needed from Architect**

---

## Quality Gates for PO Review (2026-02-27)

When you submit Docs #2-6, I (Product Owner) will review against these criteria:

### Doc #2 (Tech Architecture)
- [ ] **Clarity**: A backend dev can explain K3s cluster topology without additional questions
- [ ] **Accuracy**: Matches ADR-019 decisions (backend-only, frontend separate)
- [ ] **Completeness**: Node sizing, storage, network, secrets, scaling all covered
- [ ] **Alignment**: References ADR-019 + ADR-020 (where applicable)

### Doc #3 (Impl Guide - Helm)
- [ ] **Clarity**: Step-by-step workflow from mkdir to deployed pod
- [ ] **Accuracy**: Commands are copy-paste ready (no ambiguous placeholders)
- [ ] **Completeness**: Covers chart structure, local testing, values organization, CI/CD
- [ ] **Alignment**: Matches DEV-014 acceptance criteria

### Doc #4 (Quick Reference)
- [ ] **Clarity**: 1-page quick lookup for common commands
- [ ] **Accuracy**: All commands verified to work on k3d + K3s
- [ ] **Completeness**: Install, upgrade, rollback, k3d, kubectl, troubleshooting
- [ ] **Alignment**: References runbooks for detailed procedures

### Doc #5 (Infra Requirements)
- [ ] **Clarity**: Ops team knows exactly what hardware/network is needed
- [ ] **Accuracy**: Realistic sizing (no vague "production-grade")
- [ ] **Completeness**: Dev + staging + prod requirements separated
- [ ] **Alignment**: Defers secrets to ADR-020; cites cluster initialization checklist

### Doc #6 (Rollback Runbook)
- [ ] **Clarity**: Ops can execute without calling Architect
- [ ] **Accuracy**: Commands are exact (no variations needed)
- [ ] **Completeness**: Normal path + failure recovery + timeline
- [ ] **Alignment**: Matches GitHub Actions CI/CD rollback logic

---

## Submission Process

1. **Create feature branch**: `feature/DEV-013-documentation`
2. **Add/update Docs #2-6** in `.docs/` folder
3. **Update `.docs/plans/00-INDEX.md`** with links to new docs
4. **Create PR** with:
   - Title: "docs(DEV-013): Architecture + implementation + infrastructure documentation"
   - Description: List which docs added/updated + link to GOV-032
   - Assign to Product Owner for review
5. **I (PO) will review** by 2026-02-27 EOD
6. **Incorporate feedback** (same day if possible)
7. **Merge** to dev 2026-02-28

---

## Timeline Summary

```
TODAY (2026-02-24):
  ✅ GOV-032 issued + ADR-019 signed
  ✅ Tasks assigned to Architect

2026-02-25 to 2026-02-27:
  ⏳ Architect drafts Docs #2-6
  ⏳ Submit via PR for PO review

2026-02-27 EOD:
  ⏳ PO reviews + approves
  ⏳ Architect incorporates feedback

2026-02-28:
  ✅ All docs committed to dev
  ✅ Backend dev can reference during DEV-014/015

2026-03-01+:
  ✅ DEV-014 development starts (uses Impl Guide + Quick Ref)
  ✅ DEV-015 CI/CD dev starts (uses Rollback Runbook)
```

---

## Questions?

Refer to:
- **GOV-032**: Full decision record + implementation checklists
- **ADR-019**: Frontend/backend scope decisions
- **GOV-031**: Gap analysis (context for why these docs are needed)

**Contact Product Owner** if any section is unclear or requires clarification before starting.

---

**END OF IMPLEMENTATION GUIDE**
