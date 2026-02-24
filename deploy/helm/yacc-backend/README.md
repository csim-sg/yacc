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
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │  PostgreSQL   │  │    Redis      │  │ YACC Backend  │   │
│  │  (pre-installed)│  │ (pre-installed)│  │  (this chart) │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│                                                              │
│  Secrets Required:                                          │
│  - postgresql-credentials (database-url)                   │
│  - redis-credentials (redis-url)                           │
│  - yacc-auth-secrets (better-auth-secret, jwt-secret)      │
│  - yacc-cloudflare-secrets (R2 credentials)                │
│  - yacc-email-secrets (SendGrid/SMTP credentials)          │
│  - yacc-integration-secrets (Telegram/IRC tokens)          │
└─────────────────────────────────────────────────────────────┘
```

**Note:** PostgreSQL and Redis are pre-installed in the K3s cluster. This chart only deploys the backend application.

## Quick Start

### Local Development (k3d)

```bash
# 1. Create k3d cluster
k3d cluster create yacc-dev --registry-create yacc-registry:5000

# 2. Build and push backend image
docker build -t localhost:5000/yacc-backend:latest -f packages/backend/Dockerfile .
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
kubectl port-forward -n yacc-dev svc/yacc-backend 3000:3000

# 7. Test health endpoint
curl http://localhost:3000/health
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

# Resources
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 256Mi

# Health probes
livenessProbe:
  path: /health/live
  port: 3000

readinessProbe:
  path: /health/ready
  port: 3000
```

## Secrets

### Required Secrets

Create these secrets before deploying:

#### 1. PostgreSQL Credentials
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgresql-credentials
type: Opaque
stringData:
  database-url: postgresql://user:password@postgresql:5432/yacc_inbox
```

#### 2. Redis Credentials
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: redis-credentials
type: Opaque
stringData:
  redis-url: redis://:password@redis:6379
```

#### 3. Auth Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: yacc-auth-secrets
type: Opaque
stringData:
  better-auth-secret: "your-secret-min-32-chars"
  jwt-secret: "your-jwt-secret-min-32-chars"
```

#### 4. Cloudflare R2 Secrets
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

#### 5. Email Secrets
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

#### 6. Integration Secrets (Optional)
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

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/health` | Full health check with dependencies | `{"status":"healthy",...}` |
| `/health/live` | Liveness probe (process alive) | `{"status":"alive"}` |
| `/health/ready` | Readiness probe (can handle traffic) | `{"status":"ready"}` |

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
kubectl port-forward -n yacc-staging svc/yacc-backend 3000:3000 &
curl http://localhost:3000/health
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
