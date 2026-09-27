# YACC Backend Helm Chart

This Helm chart deploys the YACC backend service to a Kubernetes cluster (K3s).

## Prerequisites

- Kubernetes cluster (K3s recommended for MVP)
- Helm 3.12+
- kubectl configured to access the cluster
- Container image built and pushed to registry

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     K3s Cluster                              │
│  ┌───────────────┐  ┌───────────────┐                       │
│  │  PostgreSQL   │  │ YACC Backend  │                       │
│  │  (pre-installed)│ │ (this chart)  │                       │
│  └───────────────┘  └───────────────┘                       │
│                                                              │
│  Secrets Required:                                          │
│  - yacc-backend-secrets (DATABASE_URL)                      │
│  - yacc-auth-secrets (bootstrap-super-admin-email,          │
│    bootstrap-super-admin-password, recovery-mode,           │
│    recovery-key)                                            │
│  - yacc-cloudflare-secrets (R2 credentials)                 │
│  - yacc-email-secrets (SendGrid/SMTP credentials)           │
│  - yacc-integration-secrets (Telegram/IRC tokens)           │
└─────────────────────────────────────────────────────────────┘
```

**Note:** PostgreSQL is pre-installed in the K3s cluster. This chart only deploys the backend application.
**Redis is removed** (ADR-028): async processing uses Quartz (DB-backed) + a PostgreSQL DLQ, and the WS
backlog is re-homed to PostgreSQL — no Redis dependency exists in the migration target.

The backend image is built from `services/backend-java/Dockerfile` (Temurin 21 JRE, non-root uid 1000,
read-only root filesystem, pod envelope ≥ 1Gi request / 2Gi limit — ADR-029).

## Quick Start

### Local Development (k3d)

```bash
# 1. Create k3d cluster
k3d cluster create yacc-dev --registry-create yacc-registry:5000

# 2. Build and push backend image
docker build -t localhost:5000/yacc-backend:latest -f services/backend-java/Dockerfile services/backend-java
docker push localhost:5000/yacc-backend:latest

# 3. Create namespace and secrets
kubectl create namespace yacc-dev

# Create required secrets (see Secrets section below)
kubectl apply -f -n yacc-dev - <<EOF
# ... secret manifests ...
EOF

# 4. Deploy with Helm
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-dev \
  --values deploy/helm/yacc-backend/values-dev.yaml \
  --set image.registry=localhost:5000 \
  --set image.tag=latest

# 5. Verify deployment
kubectl get pods -n yacc-dev
kubectl logs -f deployment/yacc-backend -n yacc-dev

# 6. Port-forward to access locally
kubectl port-forward -n yacc-dev svc/yacc-backend 8080:8080

# 7. Test health endpoint
curl http://localhost:8080/health
```

### Staging Deployment

```bash
# Deploy to staging namespace
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging \
  --create-namespace \
  --values deploy/helm/yacc-backend/values-staging.yaml \
  --wait --timeout 5m
```

## Configuration

### Values Files

| File | Purpose |
|------|---------|
| `values.yaml` | Default values (base configuration) |
| `values-dev.yaml` | Development environment overrides |
| `values-staging.yaml` | Staging environment overrides |

### Key Configuration Options

```yaml
# Replica count
replicaCount: 1

# Container image
image:
  registry: ghcr.io
  repository: csim-sg/yacc/yacc-backend
  tag: ""  # Uses appVersion from Chart.yaml

# Resources (ADR-029 envelope: >= 1Gi request / 2Gi limit)
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: "1"
    memory: 2Gi

# Health probes (Spring actuator health endpoints — ADR-029/MIG-003 §5)
livenessProbe:
  path: /health/live
  port: http   # container port 8080

readinessProbe:
  path: /health/ready
  port: http   # container port 8080
```

## Secrets

### Required Secrets

Create these secrets before deploying:

#### 1. PostgreSQL Credentials
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: yacc-backend-secrets
type: Opaque
stringData:
  DATABASE_URL: postgresql://user:password@postgresql:5432/yacc_inbox
```

#### 2. Spring Auth + Recovery Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: yacc-auth-secrets
type: Opaque
stringData:
  # Deterministic first-run Super Admin bootstrap (ADR-025)
  bootstrap-super-admin-email: "founder@example.com"
  bootstrap-super-admin-password: "one-time-initial-credential"
  # Founder-controlled recovery (env-gated restart flag, ADR-025/F4)
  recovery-mode: "once"        # only set when a recovery restart is intended
  recovery-key: "founder-held-recovery-key"
```

**Decommissioned POC secrets:** `better-auth-secret`, `jwt-secret`, `redis-credentials` — the Java
service uses Spring Security (no bespoke token crypto) and no Redis (ADR-028).

#### 3. Cloudflare R2 Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: yacc-cloudflare-secrets
type: Opaque
stringData:
  r2-endpoint: "https://<account>.r2.cloudflarestorage.com"
  r2-access-key: "your-access-key"
  r2-secret-key: "your-secret-key"
  r2-bucket: "yacc-inbox"
  cdn-url: "https://cdn.example.com"
```

#### 4. Email Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: yacc-email-secrets
type: Opaque
stringData:
  sendgrid-api-key: "SG.xxxxx"
  sendgrid-from-email: "noreply@example.com"
  sendgrid-from-name: "YACC Inbox"
```

#### 5. Integration Secrets (Optional)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: yacc-integration-secrets
type: Opaque
stringData:
  telegram-bot-token: "your-bot-token"
  irc-password: "your-irc-password"
```

## Health Endpoints

Spring Boot actuator health endpoints (management base path `/`, ADR-029/MIG-003 §5):

| Endpoint | Purpose | Backed by |
|----------|---------|-----------|
| `/health` | Aggregate health | actuator `health` endpoint |
| `/health/live` | Liveness probe (process alive) | `livenessState` group |
| `/health/ready` | Readiness probe (can handle traffic) | `readinessState` group |

## Rollback

```bash
# View deployment history
helm history yacc-backend -n yacc-staging

# Rollback to previous revision
helm rollback yacc-backend -n yacc-staging

# Rollback to specific revision
helm rollback yacc-backend 3 -n yacc-staging
```

See `.docs/runbooks/helm-rollback.md` for detailed rollback procedure.

## Troubleshooting

### Pod won't start
```bash
# Check pod status
kubectl get pods -n yacc-staging

# Check pod events
kubectl describe pod <pod-name> -n yacc-staging

# Check logs
kubectl logs <pod-name> -n yacc-staging
```

### Health check fails
```bash
# Port-forward and test
kubectl port-forward -n yacc-staging svc/yacc-backend 8080:8080 &
curl http://localhost:8080/health
```

### Database connection issues
```bash
# Check secret exists
kubectl get secret postgresql-credentials -n yacc-staging

# Verify DATABASE_URL
kubectl exec -it deployment/yacc-backend -n yacc-staging -- env | grep DATABASE
```

## Related Documentation

- ADR-019: K3s/Helm deployment decision
- `.docs/infrastructure/k3s-cluster-requirements.md`: Cluster specs
- `.docs/runbooks/helm-rollback.md`: Rollback procedure
- `.docs/05-quick-reference.md`: Helm commands cheat sheet
