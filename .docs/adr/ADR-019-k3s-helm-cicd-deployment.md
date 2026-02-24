**Status:** Accepted  
**Date:** 2026-02-20  
**Deciders:** Enterprise Architect + Product Owner  
**Related:** ADR-016 (06-tasks as task map), ADR-018 (Bun runtime migration)

---

# Architecture Decision Record

## Title
Adopt K3s + Helm as CI/CD Deployment Target (MVP and Beyond)

## Context

YACC currently references a "single VPS Docker" deployment model in multiple documents. We are standardizing the delivery pipeline and runtime target to Kubernetes, specifically:

- **K3s** as the Kubernetes distribution (lightweight, suitable for single-tenant MVP)
- **Helm** as the packaging/deployment mechanism

We want a repeatable CI/CD flow where:

- The backend application is deployed via Helm charts
- Platform dependencies are installed via Helm (e.g., PostgreSQL, Redis)
- Frontend (React SPA) is deployed independently via S3 + CloudFront (separate pipeline)
- Environments (dev/staging/prod) are reproducible and auditable

## Decision

1. **Backend Deployment**: K3s + Helm is the standard target. All backend deploy pipelines assume a K3s cluster.
2. **Frontend Deployment**: React SPA deployed independently to AWS S3 + CloudFront. Frontend is **NOT** part of Kubernetes Helm charts.
3. **Helm is the standard backend installer.** Helm installs:
   - YACC backend application chart
   - Supporting dependencies (PostgreSQL, Redis, etc.)
4. **Dependency policy (MVP default):** Platform dependencies are installed via Helm into the cluster unless explicitly documented as managed external services.
5. **Artifacts:** Build artifacts remain container images; backend deployment uses `helm upgrade --install`.

## Consequences

### Pros

- Repeatable deployments with versioned manifests and values
- Easier promotion (staging -> prod) via Helm values
- Enables horizontal scaling and standardized ops practices

### Cons / Risks

- Additional operational complexity vs single Docker host
- Requires cluster lifecycle management (ingress, certs, storage)
- Helm chart discipline required (no ad-hoc kubectl changes)

## Frontend Deployment Rationale (Product Owner - 2026-02-23)

Frontend deployment is explicitly **out of Helm scope** for these reasons:

- **Deployment Independence**: Frontend and backend have independent lifecycle/cadence; no shared downtime
- **Cost & Performance**: AWS S3 + CloudFront optimized for static assets (CDN native, global distribution)
- **Operational Simplicity**: Kubernetes pods unnecessary for serving static SPA; reduces operational burden
- **MVP Scope**: AGENTS.md establishes S3/CloudFront model; no need to unify at this stage

This decision is fixed for MVP. Post-MVP multi-region deployments may revisit unified Helm-based frontend delivery.

## Guardrails

- No secrets in repo: use Kubernetes Secrets sealed/externalized per environment
- Helm charts must be idempotent and support rollback
- Postgres/Redis values must be explicitly documented (storage, resource requests/limits)
- Backend Helm chart scope is explicit: backend service + PostgreSQL + Redis only (no frontend)

---

## Section 3.5: Secret Management Strategy

### Decision: K8s Secrets (KISS Principle)

**Chosen Approach**: Native Kubernetes Secrets (unencrypted at rest, encrypted in transit)

**Rationale**:
1. **MVP KISS Principle**: Simple, idempotent, minimal operational overhead
2. **Sealed Secrets Deferred**: Sealed Secrets / External Secrets Operator (post-MVP, if multi-cluster)
3. **Sufficient for MVP**: Single-tenant, controlled cluster access
4. **Fast Iteration**: No additional tooling setup needed; focus on feature delivery

### Secret Types & Storage

**Backend Application Secrets** (in K8s Secret: `yacc-backend-secrets`):
```yaml
DATABASE_URL: "postgresql://user:password@postgres-svc:5432/yacc"
REDIS_URL: "redis://:password@redis-svc:6379/0"
TELEGRAM_BOT_TOKEN: "xxxxx:xxxxx"
TELEGRAM_WEBHOOK_SECRET: "xxxxx"
SESSION_SECRET: "xxxxx"
JWT_SECRET: "xxxxx"
```

**Deployment Reference** (in `deployment.yaml`):
```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: yacc-backend-secrets
        key: DATABASE_URL
```

### Secret Creation & Updates

**Initial Setup** (one-time, by ops):
```bash
kubectl create secret generic yacc-backend-secrets \
  --from-literal=DATABASE_URL="..." \
  --from-literal=REDIS_URL="..." \
  --from-literal=TELEGRAM_BOT_TOKEN="..." \
  -n yacc-staging
```

**Updates** (via kubectl or Helm Secret values):
```bash
kubectl patch secret yacc-backend-secrets -p \
  '{"data":{"TELEGRAM_BOT_TOKEN":"'$(echo -n "new-token" | base64)'"}}' \
  -n yacc-staging
```

**Post-MVP Roadmap**:
- Sealed Secrets for prod (multi-cluster)
- HashiCorp Vault integration (advanced teams)
- AWS Secrets Manager for managed K8s (EKS)

---

## Section 3.6: Rollback Procedure

### Decision: Manual Rollback via Helm History

**Chosen Approach**: Helm rollback command with documented runbook (no automated rollback to avoid cascading failures)

**Rationale**:
1. **Safety First**: Manual review ensures no cascade of bad deployments
2. **Traceability**: Audit trail of rollback decisions (who, when, why)
3. **Simplicity**: No additional automation framework needed (MVP)
4. **Post-MVP Automation**: Monitoring-driven rollback (post-MVP, if production SLAs demand)

### Rollback Steps (Operator Runbook)

**Reference**: See `.docs/runbooks/helm-rollback.md` (full detailed procedure)

**Quick Summary**:
```bash
# 1. View deployment history
helm history yacc-backend -n yacc-staging

# 2. Identify last good revision (e.g., revision 5)
# 3. Rollback to that revision
helm rollback yacc-backend 5 -n yacc-staging

# 4. Monitor pod restart
kubectl rollout status deployment/yacc-backend -n yacc-staging

# 5. Verify health
curl http://backend-svc:8080/health -n yacc-staging
```

**Rollback Trigger Conditions**:
- Pod fails to reach Running state (30+ seconds)
- Health endpoint returns non-200 status
- Pod logs show startup errors
- Database migrations fail
- Smoke test fails (connectivity, API calls)

**Decision Record**:
- Rollback logged in audit trail (who triggered, timestamp, revision)
- Post-rollback investigation required (document root cause in issue/PR)
- Prod rollback requires manager+ approval (documented decision)

### Post-MVP Enhancements
- Automated monitoring-driven rollback (Prometheus + Alertmanager)
- Canary deployments (Flagger + Istio) for gradual rollout
- Blue-green deployments for zero-downtime rollback

---

## Section 3.7: Environment Specifications

### Kubernetes Version & Requirements

**MVP Standard**: K3s 1.30+ (released April 2024, LTS track)

**Rationale**:
- Long-term support (critical for stability)
- Proven stable in production (wedding-wp reference)
- Native features: local-path storage, Traefik ingress, CoreDNS
- No additional component installation needed

**VPS Hardware Spec** (single-node K3s cluster):
```
CPU:    2 cores (t3.small equivalent)
Memory: 4 GB RAM (3 GB free after K3s runtime)
Disk:   20 GB (10 GB K3s system + local-path storage)
Network: 1 Gbps public IP + private networking
```

**Rationale for Specs**:
- Backend pod: 500m CPU / 512 MB RAM (development footprint)
- PostgreSQL pod: 500m CPU / 1 GB RAM (development footprint)
- Redis pod: 250m CPU / 256 MB RAM (development footprint)
- K3s system (kubelet, apiserver, etcd): ~1 GB RAM
- Buffer: 25% headroom for spikes + OS

### Storage Configuration

**Storage Class: `local-path` (K3s default)**

```yaml
provisioner: rancher.io/local-path
allowVolumeExpansion: true
reclaimPolicy: Delete
```

**Volume Allocation**:
- PostgreSQL: 5 GB PersistentVolumeClaim (local-path)
- Redis: 500 MB PersistentVolumeClaim (local-path)
- Backend temp: 500 MB ConfigMap (read-only)

**Rationale**:
- Local-path sufficient for MVP (single node, no HA)
- Backup policy: Daily snapshots of PV to S3 (post-MVP automated backup)
- Migration path: Migrate to external PostgreSQL (managed RDS) post-MVP

### Ingress & TLS

**Ingress Controller: Traefik** (K3s default, auto-installed)

**Configuration** (Helm values-staging.yaml):
```yaml
ingress:
  enabled: true
  className: traefik
  hosts:
    - host: api-staging.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: yacc-backend-tls
      hosts:
        - api-staging.example.com
```

**TLS Certificate Management**:
- **Dev**: Self-signed (generated via Helm hook)
- **Staging**: Let's Encrypt via cert-manager (post-MVP) or manual renewal
- **Prod**: Let's Encrypt via cert-manager (mandatory post-MVP)

**Rationale**: Traefik native integration simplifies Helm chart (no nginx-ingress complexity)

### Network Configuration

**Namespaces** (logical separation):
- `yacc-staging`: Staging environment (backend + PostgreSQL + Redis)
- `yacc-prod`: Production environment (same chart, different values)
- `kube-system`: K3s system pods (ingress, DNS, etc.)

**DNS Resolution** (internal):
- PostgreSQL: `postgres-svc.yacc-staging.svc.cluster.local:5432`
- Redis: `redis-svc.yacc-staging.svc.cluster.local:6379`
- Backend: `yacc-backend.yacc-staging.svc.cluster.local:8080`

**External Access**:
- Ingress: `api-staging.example.com` → Traefik → backend service
- Database: Internal only (no external exposure; backend connects via service DNS)
- Redis: Internal only (backend connects via service DNS)

### Observability & Monitoring (Post-MVP)

**Baseline Metrics** (monitoring integration):
- Pod CPU/memory usage (via Metrics Server, auto-installed in K3s)
- Pod restart count (Kubernetes native)
- Application logs (kubectl logs aggregation)

**Post-MVP Roadmap**:
- Prometheus for metrics scraping
- Grafana dashboards for visualization
- Alertmanager for incident notifications

### Resource Requests & Limits

**Backend Deployment**:
```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

**PostgreSQL StatefulSet**:
```yaml
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 1000m
    memory: 2Gi
```

**Redis StatefulSet**:
```yaml
resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

**Rationale**: Requests ensure pod placement; limits prevent node overload (cascade failure protection)

## Approval

**Architect Approval:**
- Name: Enterprise/Solution Architect
- Date: 2026-02-20
- Status: ✅ APPROVED

**Product Owner Approval:**
- Name: Product Owner (YACC Project)
- Date: 2026-02-24
- Status: ✅ APPROVED
- Comments: Frontend deployment explicitly out of K3s/Helm scope (S3/CloudFront independent). Backend-only scope confirmed. Smoke deploy criteria + documentation scope detailed in GOV-032. Conditional on ADR-020 (Secret Management) resolution by Infrastructure Team.
