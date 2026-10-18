# Technology Architecture: Helm Deployment for YACC Backend

**Author**: Enterprise Architect  
**Date**: 2026-02-26  
**Status**: Final (ADR-019 Approved)  
**Document ID**: TECH-ARCH-006  
**Related**: ADR-019 (K3s + Helm decision), K3s Cluster Requirements, Helm Rollback Runbook

---

## Executive Summary

This document details the **technical architecture** for deploying YACC backend to Kubernetes using Helm. It defines:

- Helm chart structure and composition
- Kubernetes manifest organization
- Service mesh (internal networking)
- Resource allocation and autoscaling policy
- GitOps workflow integration
- Namespace and RBAC strategy

**Scope**: Backend deployment only (PostgreSQL + Java/Spring API). Frontend deployment remains AWS S3 + CloudFront (out of Kubernetes).

> **Java migration note (SPEC-002 / ADR-029, MIG-012)**: the chart deploys the Java 21 service built from `services/backend-java/Dockerfile` (Temurin 21 JRE, non-root uid 1000, read-only root filesystem). **Redis was removed** (ADR-028: Quartz + PostgreSQL DLQ/WS-backlog replace it) — the Redis StatefulSet/PVC/`REDIS_URL` below are historical Node-era artifacts corrected in place; the pod envelope is ≥1Gi request / 2Gi limit (ADR-029) and probes use the actuator wire paths `/health/live` + `/health/ready`.

**Target Audience**: Backend developers, DevOps engineers, infrastructure architects

---

## Table of Contents

1. [Helm Chart Architecture](#helm-chart-architecture)
2. [Kubernetes Manifest Organization](#kubernetes-manifest-organization)
3. [Service Mesh & Networking](#service-mesh--networking)
4. [Resource Allocation & Autoscaling](#resource-allocation--autoscaling)
5. [StatefulSet vs Deployment Strategy](#statefulset-vs-deployment-strategy)
6. [Configuration Management](#configuration-management)
7. [Secrets & Security](#secrets--security)
8. [Volume & Storage Strategy](#volume--storage-strategy)
9. [Monitoring & Observability](#monitoring--observability)

---

## Helm Chart Architecture

### Chart Structure

```
deploy/helm/yacc-backend/
├── Chart.yaml                      # Metadata (name, version, description)
├── values.yaml                     # Default values (development)
├── values-dev.yaml                 # Development environment overrides
├── values-staging.yaml             # Staging environment overrides
├── values-prod.yaml                # Production environment overrides (post-MVP)
├── charts/                         # Subchart dependencies (if any)
└── templates/
    ├── _helpers.tpl                # Helper functions (template macros)
    ├── deployment.yaml             # Backend app deployment
    ├── service.yaml                # Backend ClusterIP service
    ├── serviceaccount.yaml         # RBAC service account
    ├── configmap.yaml              # Application configuration
    ├── secret.yaml                 # (Optional) externalized secrets
    ├── ingress.yaml                # Traefik ingress (external routing)
    ├── hpa.yaml                    # Horizontal Pod Autoscaler (post-MVP)
    ├── pdb.yaml                    # Pod Disruption Budget (post-MVP)
    └── tests/
        └── test-connection.yaml    # Smoke test pod
```

### Chart.yaml Definition

```yaml
apiVersion: v2
name: yacc-backend
description: YACC unified inbox backend deployment
type: application
version: 1.0.0
appVersion: "v1.0.0"

keywords:
  - yacc
  - backend
  - kubernetes
  - helm

maintainers:
  - name: YACC Engineering
    email: engineering@example.com

dependencies: []  # Empty for MVP (no subchart dependencies)
```

### Values.yaml Hierarchy

**Priority Order** (highest to lowest):
1. Command-line overrides: `helm upgrade --set key=value`
2. Environment-specific values: `values-prod.yaml`
3. Default values: `values.yaml`

**Rationale**: Allows safe environment-specific configuration without duplicating entire values file

### Deployment Workflow

```
Local Development → Staging → Production
      ↓              ↓           ↓
   values.yaml  values-staging  values-prod.yaml
                  .yaml

Same Helm chart, different configurations
```

---

## Kubernetes Manifest Organization

### Deployment: Backend Application

**File**: `templates/deployment.yaml`

**Key Characteristics**:
- **Type**: Deployment (manages ReplicaSet, rolling updates)
- **Replicas**: 1 (MVP), scale to 2-3+ for high availability
- **Strategy**: RollingUpdate (0 downtime during updates)
- **Liveness Probe**: HTTP GET `/health/live` (actuator liveness group, ADR-029; every 30s, fail after 3 tries = 90s)
- **Readiness Probe**: HTTP GET `/health/ready` (actuator readiness group; every 10s, fail after 3 tries = 30s)

**Manifest Template** (pseudocode):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "yacc-backend.fullname" . }}
  labels:
    {{- include "yacc-backend.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # Allow 1 extra pod during update
      maxUnavailable: 0    # Zero downtime
  selector:
    matchLabels:
      {{- include "yacc-backend.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "yacc-backend.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "yacc-backend.serviceAccountName" . }}
      containers:
      - name: backend
        image: {{ .Values.image.repository }}:{{ .Values.image.tag }}
        imagePullPolicy: IfNotPresent
        ports:
        - name: http
          containerPort: 8080
          protocol: TCP
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: "{{ .Values.config.SPRING_PROFILES_ACTIVE }}"
        - name: SERVER_PORT
          value: "8080"
        envFrom:
        - configMapRef:
            name: {{ include "yacc-backend.fullname" . }}-config
        - secretRef:
            name: yacc-backend-secrets
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 1000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /health/live
            port: http
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: http
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
```

### Service: Backend ClusterIP

**File**: `templates/service.yaml`

**Type**: ClusterIP (internal only, no external port)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "yacc-backend.fullname" . }}
  labels:
    {{- include "yacc-backend.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
  - port: 8080
    targetPort: http
    protocol: TCP
    name: http
  selector:
    {{- include "yacc-backend.selectorLabels" . | nindent 4 }}
```

**Service Discovery** (internal DNS):
```
yacc-backend.yacc-staging.svc.cluster.local:8080
                ↑              ↑
            namespace      cluster.local
```

### ServiceAccount & RBAC

**File**: `templates/serviceaccount.yaml`

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "yacc-backend.serviceAccountName" . }}
  labels:
    {{- include "yacc-backend.labels" . | nindent 4 }}
```

**RBAC Role** (future, if backend needs K8s API access):
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: {{ include "yacc-backend.fullname" . }}
rules:
  # Example: backend reads ConfigMaps for feature flags
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "watch"]
```

---

## Service Mesh & Networking

### Pod-to-Pod Communication

**Architecture**:
```
Backend Pod (10.42.x.x)
    ↓ (DNS query)
CoreDNS (kube-system namespace)
    ↓ (resolves: postgres-svc.yacc-staging.svc.cluster.local)
    ↓
PostgreSQL Service ClusterIP (10.43.y.y:5432)
    ↓ (kube-proxy iptables NAT)
    ↓
PostgreSQL Pod (10.42.z.z:5432)
```

### Service Discovery (Environment Injection)

Kubernetes auto-injects service endpoint variables into pod environment:

```bash
# Example environment variables injected by kubelet:
POSTGRES_SVC_SERVICE_HOST=10.43.100.200
POSTGRES_SVC_SERVICE_PORT=5432
POSTGRES_SVC_PORT=tcp://10.43.100.200:5432
POSTGRES_SVC_PORT_5432_TCP=tcp://10.43.100.200:5432
POSTGRES_SVC_PORT_5432_TCP_PROTO=tcp
POSTGRES_SVC_PORT_5432_TCP_ADDR=10.43.100.200
POSTGRES_SVC_PORT_5432_TCP_PORT=5432
```

### DNS Resolution (CoreDNS)

**Short Names** (within same namespace):
```bash
postgres-svc              # Resolves to: 10.43.100.200
```

**Fully Qualified Names** (across namespaces):
```bash
postgres-svc.yacc-staging.svc.cluster.local
kube-dns.kube-system.svc.cluster.local
```

> Redis service examples were removed: there is no Redis service in the cluster (ADR-028).

### Network Policies (Post-MVP)

**MVP Design** (open, no restrictions):
```
All pods can communicate with all other pods (no network policies)
```

**Post-MVP Design** (restrictive):
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-network-policy
spec:
  podSelector:
    matchLabels:
      app: yacc-backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: traefik
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  # Allow DNS (CoreDNS)
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: UDP
      port: 53
```

---

## Resource Allocation & Autoscaling

### Pod Resource Requests & Limits

**Backend Pod**:
```yaml
resources:
  requests:
    cpu: 500m              # Minimum guaranteed
    memory: 1Gi            # Minimum guaranteed (ADR-029 JVM envelope)
  limits:
    cpu: 1000m             # Maximum allowed
    memory: 2Gi            # Maximum allowed (JVM heap sizes from the limit)
```

**Rationale**:
- **Requests**: Scheduler uses to place pod; cluster needs at least this much free
- **Limits**: Kubernetes kills pod if exceeds (prevent runaway processes); the JVM sizes heap via `MaxRAMPercentage=75`
- **Envelope floor**: ADR-029 requires ≥1Gi request / 2Gi limit (the Node-era 512Mi/1Gi was too small for the JVM)

### Resource Calculations (MVP Single Node)

```
Node Capacity:
  CPU: 2000m (2 cores)
  Memory: 4 GB (3 GB usable after OS)

Pod Allocations:
  Backend:     500m / 1 Gi request (ADR-029 envelope)
  PostgreSQL:  500m / 1 GB request
  K3s system:  750m / 1 GB (kubelet, apiserver, etcd, etc.)
  ──────────────────────────
  Total:       1750m / 3 GB (~90% of usable memory at request level)
  Buffer:      250m / 1 GB — size the node accordingly (4 GB is the floor; prefer more headroom)

(No Redis allocation — Redis was removed, ADR-028.)
```

### Horizontal Pod Autoscaling (Post-MVP)

**HPA Configuration** (future, when CPU monitoring added):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: yacc-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: yacc-backend
  minReplicas: 2
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
```

---

## StatefulSet vs Deployment Strategy

### Backend: Deployment (Stateless)

**Why Deployment**:
- Backend is stateless (all state in PostgreSQL; async durability via the Quartz job store, DLQ and WS-backlog tables — ADR-028)
- Any pod replica is interchangeable
- Rolling updates work cleanly (no data consistency issues)

```yaml
kind: Deployment
spec:
  replicas: 1  # MVP: single replica (HA post-MVP)
  # ...
```

### PostgreSQL: StatefulSet (Stateful)

**Why StatefulSet**:
- PostgreSQL pod maintains persistent state (database files)
- Pod identity matters (pod-0, pod-1, pod-2)
- Stable DNS names required (postgres-0.postgres-svc.yacc-staging.svc.cluster.local)
- Ordinal scaling (scale down from highest ordinal first)

```yaml
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres  # Headless service for DNS
  replicas: 1  # MVP: single instance (streaming replication post-MVP)
  # ...
```

### Async Durability: PostgreSQL (no Redis StatefulSet)

**Why no queue StatefulSet**:
- ADR-028 replaced Redis/BullMQ with Quartz backed by the PostgreSQL JDBC job store, plus the `dead_letter_queue` and `websocket_backlog` tables
- There is no Redis pod, service, PVC, or `REDIS_URL` in the current chart (MIG-012 removed them)

```yaml
# Historical Node-era example removed — nothing to deploy.
# Retry/queue state lives in PostgreSQL (Flyway-managed tables).
```

---

## Configuration Management

### ConfigMap: Application Configuration

**File**: `templates/configmap.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "yacc-backend.fullname" . }}-config
data:
  SPRING_PROFILES_ACTIVE: "{{ .Values.config.SPRING_PROFILES_ACTIVE }}"
  SERVER_PORT: "8080"
  LOGGING_LEVEL_ROOT: "{{ .Values.config.LOGGING_LEVEL_ROOT }}"
  TZ: "UTC"
  MESSAGE_RETRY_ATTEMPTS: "{{ .Values.config.MESSAGE_RETRY_ATTEMPTS }}"
  ATTACHMENT_MAX_SIZE_MB: "{{ .Values.config.ATTACHMENT_MAX_SIZE_MB }}"
```

**Environment Injection** (deployment.yaml):
```yaml
envFrom:
- configMapRef:
    name: yacc-backend-config
- secretRef:
    name: yacc-backend-secrets
```

### Values File Structure

**values.yaml** (defaults):
```yaml
replicaCount: 1

image:
  repository: yacc-backend
  tag: "v1.0.0"
  pullPolicy: IfNotPresent

config:
  SPRING_PROFILES_ACTIVE: production
  LOGGING_LEVEL_ROOT: info

database:
  poolSize: 10

attachments:
  maxSize: 5242880  # 5 MB
```

**values-staging.yaml** (overrides):
```yaml
config:
  SPRING_PROFILES_ACTIVE: production
  LOGGING_LEVEL_ROOT: info

database:
  poolSize: 15

# Inherits other values from values.yaml
```

---

## Secrets & Security

### Secret Management Strategy

**MVP Approach** (simple, K8s Secrets):
```bash
# Create once, referenced by deployment
kubectl create secret generic yacc-backend-secrets \
  --from-literal=DATABASE_URL="..." \
  --from-literal=TELEGRAM_BOT_TOKEN="..." \
  -n yacc-staging
```

**Secret Types** (K8s Secrets):
- `DATABASE_URL` - PostgreSQL connection string
- Bootstrap Super Admin + founder recovery keys (ADR-025: `yacc-auth-secrets`; the POC's `JWT_SECRET`/`BETTER_AUTH_SECRET`/`SESSION_SECRET` are decommissioned)
- `TELEGRAM_BOT_TOKEN` - Telegram API credential

### Secret Rotation (Post-MVP)

**Post-MVP Integration** (sealed-secrets or Vault):
```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: yacc-backend-secrets
  namespace: yacc-staging
spec:
  encryptedData:
    DATABASE_URL: AgBvEX4i/x8...  # Encrypted at rest
    # ...
```

### Environment Variable Injection

**Path** (deployment → pod):
```
values.yaml (secrets reference)
    ↓
values-staging.yaml (override)
    ↓
Helm template rendering
    ↓
deployment.yaml (envFrom: secretRef)
    ↓
Pod startup (secrets mounted as env vars)
```

---

## Volume & Storage Strategy

### PersistentVolume (PV) Strategy

**PostgreSQL PV**:
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  storageClassName: local-path  # K3s default
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
```

> The Redis PV example was removed — there is no Redis PVC (ADR-028).

### Storage Class Definition

**K3s Built-in `local-path`**:
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-path
provisioner: rancher.io/local-path
allowVolumeExpansion: true
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
```

**Characteristics**:
- Stores data at `/var/lib/rancher/k3s/storage/` on node
- Deleted when PVC deleted (cleanup)
- Single-node only (not replicated)
- Sufficient for MVP

### Attachment Storage (External)

**Architecture** (NOT in Kubernetes):
```
Backend Pod
    ↓ (uploads file)
    ↓
Cloudflare R2 API
    ↓ (stores file)
    ↓
R2 Storage (persistent, replicated)
    ↓ (retrieves via CDN)
    ↓
Client Browser
```

**Rationale** (separate from K8s):
- Decouples attachments from cluster lifecycle
- Enables easy cluster recreation (attachments persist)
- CDN delivery (faster downloads)
- Cost-effective (R2 cheaper than EBS/local storage)

---

## Monitoring & Observability

### Health Probes

**Liveness Probe** (`/health`):
- Checks if pod should restart
- Return 200 OK = pod is alive
- Return 5xx or timeout = pod restart

**Readiness Probe** (`/ready`):
- Checks if pod should receive traffic
- Return 200 OK = pod ready for requests
- Return 5xx = remove from load balancer

**Implementation** (backend code):
```java
// Spring Boot actuator (management base path "/"):
// GET /health/live   -> liveness group (livenessState only)
// GET /health/ready  -> readiness group (readinessState only)
// No external dependencies in the probe verdict (ADR-029).
```

### Metrics Exposure

**Prometheus metrics** (ADR-029, live):
```yaml
# Backend pod exposes Micrometer metrics at /actuator/prometheus
# (ADR-029 frozen scrape path; management endpoints include health + prometheus)
```

### Logging Strategy

**Pod Logs** (captured by kubelet):
```bash
# View logs (live, last 50 lines)
kubectl logs -n yacc-staging -l app=yacc-backend --tail=50 -f

# Export logs for analysis
kubectl logs -n yacc-staging -l app=yacc-backend --all-containers=true \
  --timestamps=true > backend-logs.txt
```

**Log Aggregation** (Post-MVP):
- Fluent Bit → Elasticsearch → Kibana
- Or: Loki (lightweight, Prometheus-compatible)

---

## GitOps & Deployment Workflow

### Version Control

**Git Structure**:
```
yacc/
├── deploy/helm/yacc-backend/
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── values-staging.yaml
│   └── templates/
└── .github/workflows/
    └── deploy-staging.yaml
```

### CI/CD Integration (GitHub Actions)

**Workflow** (deploy-staging.yaml):
```yaml
name: Deploy to Staging
on:
  push:
    branches: [dev]
    paths:
      - 'services/backend-java/**'
      - 'deploy/helm/yacc-backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build image
        run: docker build -t yacc-backend:${{ github.sha }} .
      - name: Deploy Helm
        run: |
          helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
            -n yacc-staging \
            --set image.tag=${{ github.sha }}
      - name: Smoke test
        run: kubectl rollout status deployment/yacc-backend -n yacc-staging
```

---

## Architecture Decision Rationale

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Chart Structure** | Flat (no subcharts) | Simplicity for MVP; add subcharts if >5 components |
| **Replica Count** | 1 (MVP) | Single node cluster; scale post-MVP for HA |
| **Rolling Update** | Zero downtime | No customer impact during deployments |
| **Probes** | Actuator `/health/live` + `/health/ready` | Standard, requires no extra tools (ADR-029) |
| **Pod Envelope** | 500m/1Gi request, 1 CPU/2Gi limit | ADR-029 JVM envelope (amends ADR-019) |
| **Async durability** | Quartz + PostgreSQL job store/DLQ | ADR-028; no Redis in the cluster |
| **Storage** | local-path (MVP) | Sufficient for MVP; migrate to managed storage (EBS/EFS) post-MVP |
| **Secrets** | K8s Secrets (MVP) | Simple; upgrade to sealed-secrets post-MVP if multi-cluster |
| **Network** | No policies (MVP) | Simpler; add network policies post-MVP for security |
| **Service Type** | ClusterIP | Internal only; Ingress handles external routing |

---

## Related Documentation

- **ADR-019**: K3s + Helm deployment decision (pod spec amended by ADR-029)
- **K3s Cluster Requirements**: Infrastructure specs, networking, troubleshooting
- **Incident Runbook**: `.docs/runbooks/helm-rollback.md` (roll-forward incident procedure)
- **Implementation Guide**: Backend architecture + component overview
- **Helm Official Docs**: https://helm.sh/docs/

---

**Last Updated**: 2026-02-26  
**Next Review**: 2026-06-26 (post-MVP HA/autoscaling assessment)
