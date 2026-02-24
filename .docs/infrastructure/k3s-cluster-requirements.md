# K3s Cluster Requirements & Setup Guide

**Author**: Enterprise Architect  
**Date**: 2026-02-26  
**Status**: Final (ADR-019 Approved)  
**Audience**: Ops/Infrastructure, Backend Developers, DevOps Engineers  
**Related ADRs**: ADR-019 (K3s + Helm deployment decision)

---

## Table of Contents

1. [Cluster Architecture Overview](#cluster-architecture-overview)
2. [Hardware & VPS Requirements](#hardware--vps-requirements)
3. [K3s Version & Components](#k3s-version--components)
4. [Network Configuration](#network-configuration)
5. [Storage & Persistence](#storage--persistence)
6. [Ingress & TLS](#ingress--tls)
7. [Initial Setup Checklist](#initial-setup-checklist)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Post-MVP Roadmap](#post-mvp-roadmap)

---

## Cluster Architecture Overview

### Design Philosophy

YACC MVP uses a **single-node K3s cluster** deployed on a standard VPS with the following characteristics:

- **Deployment Model**: All-in-one (control plane + worker on same node)
- **Environment Scope**: Staging and production on separate clusters (not shared)
- **Scalability**: Vertical scaling (increase node resources) for MVP; horizontal scaling (multi-node) post-MVP
- **Dependency Management**: PostgreSQL + Redis managed via Helm (not external services)
- **Access Control**: RBAC configured for user segregation (admin vs read-only)

### Logical Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      K3s Cluster (1.30+)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Traefik Ingress                       │  │
│  │        (external → api-staging.example.com)             │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼──────────────────────────────────┐  │
│  │              yacc-staging Namespace                       │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                            │  │
│  │  ┌─────────────────┐  ┌──────────────┐  ┌────────────┐   │  │
│  │  │   Backend Pod   │  │ PostgreSQL   │  │   Redis    │   │  │
│  │  │   (Node.js)     │  │   Pod        │  │   Pod      │   │  │
│  │  │   8080:8080     │  │   5432:5432  │  │   6379:6379│   │  │
│  │  │                 │  │              │  │            │   │  │
│  │  │   Service       │  │   StatefulSet│  │ StatefulSet│   │  │
│  │  │   ClusterIP     │  │              │  │            │   │  │
│  │  └─────────────────┘  └──────────────┘  └────────────┘   │  │
│  │         ↑                    ↓                  ↓          │  │
│  │         │              PV (5GB)           PV (500MB)      │  │
│  │         │                                                 │  │
│  └─────────┼─────────────────────────────────────────────────┘  │
│            │                                                    │
│  ┌─────────▼─────────────────────────────────────────────────┐  │
│  │         local-path Storage Class (K3s default)            │  │
│  │         Backend: /var/lib/rancher/k3s/storage/...        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              CoreDNS (kube-system namespace)              │  │
│  │  Internal DNS: postgres-svc.yacc-staging.svc.cluster.local │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Data Flow:
1. External request → Ingress (Traefik, port 80/443)
2. Traefik routes to backend-svc (ClusterIP: 10.43.x.x)
3. Backend pod resolves postgres-svc via CoreDNS → PostgreSQL pod
4. Backend pod resolves redis-svc via CoreDNS → Redis pod
5. Pod logs & metrics collected by kubelet (local monitoring)
```

---

## Hardware & VPS Requirements

### MVP Standard Specification

| Resource | Requirement | Rationale |
|----------|-------------|-----------|
| **CPU** | 2 cores (vCPU) | Backend (500m) + PostgreSQL (500m) + Redis (250m) + K3s system (~750m) + 25% buffer |
| **RAM** | 4 GB | 3 GB available after OS/K3s; pods ~2.3 GB; headroom for spikes |
| **Disk** | 20 GB SSD | 10 GB K3s system + 5 GB PostgreSQL storage + 1 GB app logs + 4 GB headroom |
| **Network** | 1 Gbps (public IP) | Standard; private networking for pod-to-pod communication |
| **Bandwidth** | Unmetered (typical VPS) | Development workload; not production-grade |

### VPS Provider Recommendations

**t3.small (AWS)** equivalent:
- 2 vCPU, 2 GB RAM → **Upgrade to 4 GB RAM** (add t3.small + memory)
- Cost: ~$10/month (t3.small + EBS 20GB)
- Alternative: DigitalOcean Standard ($6/month), Linode 4GB ($20/month), Hetzner Cloud (€3.29/month)

### Disk Space Breakdown

```
/var/lib/rancher/k3s/server/
├── db/                      (etcd database)       ~1 GB
├── static/                  (system manifests)    ~500 MB
└── ...

/var/lib/rancher/k3s/agent/
├── containerd/              (container images)    ~3-4 GB
├── kubelet/                 (pod data)            ~500 MB
└── ...

/var/lib/rancher/k3s/storage/
├── pvc-postgres/            (PostgreSQL PV)       ~5 GB
├── pvc-redis/               (Redis PV)            ~500 MB
└── ...

/var/log/
├── pods/                    (pod logs)            ~1 GB
└── ...

Total: ~10-11 GB used (buffer: 9 GB free)
```

**Grow Over Time**:
- PostgreSQL data grows with message volume (estimate 100 MB/year for MVP message traffic)
- Pod logs rotate (default retention: 2 weeks, 10 per pod)
- Container images grow if you rebuild frequently

**Monitoring Strategy**: Set up disk usage alerts at 75% capacity (trigger cleanup/upgrade)

---

## K3s Version & Components

### K3s Release & Version Lock

**MVP Standard**: K3s 1.30+ (LTS track, April 2024 release)

**Rationale**:
- Long-term support (critical for stability)
- Proven in production (wedding-wp reference project using 1.29)
- Includes all MVP requirements (local-path storage, Traefik, CoreDNS)
- Bug-free for Kubernetes API surface area

**Version Lock Strategy**:
```bash
# Install specific version (do NOT use latest)
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.30.0 sh -

# Verify installed version
k3s --version
# Expected: k3s version v1.30.0+k3s1 (...)

# Pin version in Helm chart values
# See: values-staging.yaml → kubeVersion: "1.30"
```

### Built-in K3s Components (Auto-Installed)

**Control Plane**:
- `kube-apiserver` - REST API server
- `etcd` - Cluster state persistence
- `kube-scheduler` - Pod scheduling
- `kube-controller-manager` - Reconciliation loop

**Worker Node**:
- `kubelet` - Node agent (pod lifecycle management)
- `kube-proxy` - Service networking (ClusterIP, NodePort)
- `containerd` - Container runtime (replacing Docker)

**Networking**:
- `coredns` - Cluster DNS (pod name resolution)
- `flannel` - Pod network (default CNI plugin)

**Ingress**:
- `traefik` - HTTP ingress controller (auto-installed, port 80/443)

**Storage**:
- `local-path-provisioner` - Local storage provisioning (auto-installed)

### K3s System Namespace (`kube-system`)

```bash
# List K3s system pods
kubectl get pods -n kube-system

# Expected output:
NAME                                      READY   STATUS    RESTARTS   AGE
coredns-7b5b94856d-m8q5z                   1/1     Running   0          2d
local-path-provisioner-6f5d4d8c5b-w9xyz    1/1     Running   0          2d
traefik-5bf685b87b-x7p9k                   1/1     Running   0          2d
svclb-traefik-xxxxx                        1/1     Running   0          2d
metrics-server-7ff846c968-k8xyz            1/1     Running   0          2d
```

### Post-MVP Component Additions

**Monitoring Stack** (post-MVP):
- Prometheus - Metrics scraping
- Grafana - Visualization
- Node Exporter - Host metrics

**Certificate Management** (post-MVP):
- cert-manager - Automated TLS certificate provisioning (Let's Encrypt)

**Advanced Networking** (post-MVP):
- Istio - Service mesh (traffic management, security)
- Calico - Advanced network policies (multi-node setup)

---

## Network Configuration

### Pod Network Topology

**Flannel CNI** (Container Network Interface):
- Pod CIDR: 10.42.0.0/16 (default K3s)
- Service CIDR: 10.43.0.0/16 (default K3s)
- Each pod gets unique IP within pod CIDR

**Service Discovery** (CoreDNS):
```bash
# Internal DNS names:
postgres-svc.yacc-staging.svc.cluster.local  → ClusterIP (e.g., 10.43.56.78)
redis-svc.yacc-staging.svc.cluster.local     → ClusterIP (e.g., 10.43.99.12)
yacc-backend.yacc-staging.svc.cluster.local  → ClusterIP (e.g., 10.43.12.34)

# Environment injection (Kubernetes auto-populates):
POSTGRES_SVC_SERVICE_HOST=10.43.56.78
POSTGRES_SVC_SERVICE_PORT=5432
POSTGRES_SVC_PORT=tcp://10.43.56.78:5432
```

### Ingress Network (External Access)

**Traffic Flow** (external request):
```
Client (external IP)
    ↓ (80/443)
    ↓
Host Machine (VPS public IP)
    ↓ (iptables NAT rules from K3s kubeproxy)
    ↓
Traefik Ingress Controller (pod IP: 10.42.x.x)
    ↓ (routing rules from Ingress resource)
    ↓
Backend Service (ClusterIP: 10.43.x.x)
    ↓ (DNS resolution)
    ↓
Backend Pod (10.42.x.x)
```

**Firewall Rules** (on VPS host):
```bash
# K3s automatically creates iptables rules:
# Allow port 80, 443 (ingress)
iptables -L -n | grep 80

# Allow port 6443 (K8s API, for kubectl access via kubeconfig)
# Allow inter-pod communication (10.42.0.0/16 and 10.43.0.0/16)
```

**Configuration** (Helm values-staging.yaml):
```yaml
ingress:
  enabled: true
  className: traefik
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
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

### DNS Configuration (External)

**DNS A Record** (point domain to VPS):
```
api-staging.example.com  A  <VPS_PUBLIC_IP>

# E.g., api-staging.example.com  A  34.201.56.78
```

**Verification**:
```bash
nslookup api-staging.example.com
# Expected: 34.201.56.78

curl -I https://api-staging.example.com
# Expected: 200 OK (from backend pod, routed via Traefik)
```

### Namespaces (Logical Isolation)

**Staging Namespace**:
```bash
kubectl create namespace yacc-staging

# Deploy backend + PostgreSQL + Redis to this namespace
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging \
  -f deploy/helm/yacc-backend/values-staging.yaml
```

**Production Namespace** (separate cluster):
```bash
# Same Helm chart, different values
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-prod \
  -f deploy/helm/yacc-backend/values-prod.yaml
```

**Isolation Benefits**:
- Separate ServiceAccounts (RBAC rules)
- Separate Secrets (credentials don't cross namespaces)
- Resource quotas per namespace (CPU/memory limits)

---

## Storage & Persistence

### Local-Path Provisioner (K3s Default)

**Characteristics**:
- Node-local storage (not shared across nodes)
- Sufficient for MVP (single node)
- Volumes stored at `/var/lib/rancher/k3s/storage/`
- Deletion policy: PersistentVolume deleted when PersistentVolumeClaim deleted

**StorageClass Definition** (built into K3s):
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

### PostgreSQL Persistence

**PersistentVolume Requirements**:
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 5Gi  # Starting allocation
```

**Growth Projection** (MVP):
- Initial: 500 MB (schema + sample data)
- Year 1 (100K messages/year): +100 MB
- Year 2+: Monitor and increase as needed

**Backup Strategy** (post-MVP):
- Daily snapshots of `/var/lib/rancher/k3s/storage/pvc-postgres-*`
- Upload to S3 for off-site retention
- Restore procedure: Copy snapshot back to local storage, restart pod

### Redis Persistence

**PersistentVolume**:
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 500Mi  # RDB file + AOF log
```

**Configuration** (in Helm values):
```yaml
redis:
  persistence:
    enabled: true
    size: 500Mi
    # RDB snapshots every 60 seconds (default)
    # AOF enabled for durability
```

### Attachment Storage (Cloudflare R2)

**Design**: Attachments stored externally (NOT on K8s local-path)

**Rationale**:
- Decouples cluster lifecycle from attachment availability
- Enables cluster recovery without attachment re-upload
- CDN delivery via R2 edge locations
- Cost-effective (R2 cheaper than EBS/local storage)

**Configuration** (in backend application):
```env
R2_ACCOUNT_ID=xxxxx
R2_ACCESS_KEY_ID=xxxxx
R2_SECRET_ACCESS_KEY=xxxxx
R2_BUCKET_NAME=yacc-attachments
```

**Pod Access** (via K8s Secret):
```yaml
env:
  - name: R2_ACCESS_KEY_ID
    valueFrom:
      secretKeyRef:
        name: yacc-backend-secrets
        key: R2_ACCESS_KEY_ID
```

---

## Ingress & TLS

### Traefik Ingress Controller

**Auto-Installed** (K3s bundled, default):
```bash
# Verify Traefik is running
kubectl get pods -n kube-system | grep traefik

# Expected:
# traefik-5bf685b87b-x7p9k                   1/1     Running   0          2d
```

**Traefik Service** (exposed externally):
```bash
kubectl get svc -n kube-system | grep traefik

# Expected:
# traefik         ClusterIP      10.43.xx.xx   <none>        80/TCP,443/TCP,8080/TCP
# svclb-traefik   LoadBalancer   10.43.yy.yy   <external-ip> 80:xxxxx/TCP,443:yyyyy/TCP
```

**Configuration** (Helm Ingress resource):
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: yacc-backend-ingress
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
spec:
  ingressClassName: traefik
  rules:
    - host: api-staging.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: yacc-backend
                port:
                  number: 8080
  tls:
    - secretName: yacc-backend-tls
      hosts:
        - api-staging.example.com
```

### TLS Certificate Management

**Development** (self-signed):
```bash
# Generate self-signed cert (local testing only)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/CN=api-staging.example.com"

# Create K8s Secret
kubectl create secret tls yacc-backend-tls --cert=cert.pem --key=key.pem -n yacc-staging
```

**Staging/Production** (Let's Encrypt, post-MVP):
```yaml
# Install cert-manager (post-MVP)
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace

# Create Certificate resource (auto-renewal)
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: yacc-backend-tls
spec:
  secretName: yacc-backend-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - api-staging.example.com
```

**Traefik Auto-Redirect** (HTTP → HTTPS):
```yaml
annotations:
  traefik.ingress.kubernetes.io/router.middlewares: yacc-staging@kubernetescrd:https-redirect
```

---

## Initial Setup Checklist

### Pre-K3s Setup

- [ ] **VPS Provisioned**: SSH access confirmed, 2 CPU / 4 GB RAM / 20 GB disk
- [ ] **OS Ready**: Ubuntu 22.04 LTS or similar (Linux kernel 5.4+)
- [ ] **Dependencies Installed**:
  ```bash
  sudo apt update && sudo apt install -y curl wget git
  ```
- [ ] **Firewall Rules**:
  ```bash
  # Allow SSH, HTTP, HTTPS, K8s API
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw allow 6443/tcp
  ```
- [ ] **DNS Domain** Registered & A record pointing to VPS IP

### K3s Installation

- [ ] **Install K3s** (specific version):
  ```bash
  curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.30.0 sh -
  ```
- [ ] **Verify Installation**:
  ```bash
  k3s --version
  kubectl get nodes
  ```
- [ ] **Kubeconfig Setup** (local machine):
  ```bash
  # Copy kubeconfig from server
  scp user@vps:/etc/rancher/k3s/k3s.yaml ~/.kube/config-yacc-staging
  
  # Update server IP in config
  export KUBECONFIG=~/.kube/config-yacc-staging
  kubectl cluster-info
  ```

### Helm Installation

- [ ] **Install Helm** (local + server):
  ```bash
  curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
  ```
- [ ] **Add Helm Repository** (if using external charts):
  ```bash
  helm repo add stable https://charts.helm.sh/stable
  helm repo update
  ```

### Secrets Setup

- [ ] **Create K8s Secrets** (one-time):
  ```bash
  kubectl create namespace yacc-staging
  
  kubectl create secret generic yacc-backend-secrets \
    --from-literal=DATABASE_URL="postgresql://user:pass@postgres-svc:5432/yacc" \
    --from-literal=REDIS_URL="redis://:pass@redis-svc:6379/0" \
    --from-literal=TELEGRAM_BOT_TOKEN="xxxxx:xxxxx" \
    -n yacc-staging
  ```

### Backend Helm Deployment

- [ ] **Clone Repository** (locally):
  ```bash
  git clone https://github.com/csim-sg/yacc.git
  cd yacc
  ```
- [ ] **Deploy via Helm**:
  ```bash
  helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
    -n yacc-staging \
    -f deploy/helm/yacc-backend/values-staging.yaml
  ```
- [ ] **Verify Deployment**:
  ```bash
  kubectl get pods -n yacc-staging
  kubectl logs -n yacc-staging -l app=yacc-backend --tail=50
  kubectl get svc -n yacc-staging
  ```

### Smoke Test Deployment

- [ ] **Pod Running**:
  ```bash
  kubectl get pods -n yacc-staging
  # Expected: yacc-backend pod in "Running" state
  ```
- [ ] **Health Endpoint** (200 OK):
  ```bash
  kubectl port-forward -n yacc-staging svc/yacc-backend 8080:8080
  curl http://localhost:8080/health
  # Expected: { "status": "ok" }
  ```
- [ ] **Database Connectivity**:
  ```bash
  # Check logs for successful connection
  kubectl logs -n yacc-staging -l app=yacc-backend | grep "Database connected"
  ```
- [ ] **Ingress Working**:
  ```bash
  curl -I https://api-staging.example.com
  # Expected: 200 OK
  ```

---

## Troubleshooting Guide

### Pod Fails to Start

**Symptoms**: Pod stuck in `Pending`, `ImagePullBackOff`, or `CrashLoopBackOff`

**Diagnosis**:
```bash
# Check pod status
kubectl describe pod <pod-name> -n yacc-staging

# Check pod logs
kubectl logs <pod-name> -n yacc-staging

# Check events
kubectl get events -n yacc-staging --sort-by='.lastTimestamp'
```

**Common Causes & Fixes**:

| Error | Cause | Fix |
|-------|-------|-----|
| `ImagePullBackOff` | Image not found in registry | Verify image name/tag in values.yaml |
| `CrashLoopBackOff` | Application startup error | Check logs: `kubectl logs <pod>` |
| `Pending` | Insufficient resources | Check node capacity: `kubectl top nodes` |
| `FailedScheduling` | PVC not mounted | Verify StorageClass: `kubectl get sc` |

**Recovery Steps**:
```bash
# 1. Examine logs
kubectl logs <pod-name> -n yacc-staging --previous

# 2. Check resource availability
kubectl describe node

# 3. Delete and redeploy
kubectl delete pod <pod-name> -n yacc-staging
# Pod auto-recreates via deployment

# 4. If persistent, rollback deployment
helm rollback yacc-backend -n yacc-staging
```

### Database Connection Failed

**Symptoms**: Backend pod crashes with "cannot connect to database"

**Diagnosis**:
```bash
# Check PostgreSQL pod
kubectl get pods -n yacc-staging -l app=postgres

# Check PostgreSQL logs
kubectl logs -n yacc-staging -l app=postgres

# Test connectivity from backend pod
kubectl exec -it <backend-pod> -n yacc-staging -- \
  psql -h postgres-svc -U user -d yacc -c "SELECT 1"
```

**Common Causes & Fixes**:

| Error | Cause | Fix |
|-------|-------|-----|
| "Connection refused" | PostgreSQL pod not running | Restart: `kubectl delete pod postgres-xxx` |
| "Authentication failed" | Wrong password | Verify secret: `kubectl get secret -n yacc-staging` |
| "unknown host" | DNS not resolving | Check CoreDNS: `kubectl get pods -n kube-system` |
| "Disk full" | PVC out of space | Check PVC: `kubectl get pvc -n yacc-staging` |

**Recovery Steps**:
```bash
# 1. Check secret values
kubectl get secret yacc-backend-secrets -n yacc-staging -o yaml

# 2. Verify PostgreSQL is running
kubectl get statefulset -n yacc-staging

# 3. Restart PostgreSQL
kubectl rollout restart statefulset/postgres -n yacc-staging

# 4. Re-check backend pod
kubectl get pods -n yacc-staging
```

### Out of Disk Space

**Symptoms**: Pods evicted, node pressure (`disk.pressure=true`)

**Diagnosis**:
```bash
# Check node disk usage
df -h /var/lib/rancher/k3s/storage/

# Check K8s-reported capacity
kubectl describe node

# Check pod eviction status
kubectl get pods -n yacc-staging
```

**Recovery Steps**:
```bash
# 1. Identify large PVCs
du -sh /var/lib/rancher/k3s/storage/pvc-*

# 2. Clean up old logs
docker system prune -a --force  # or containerd equivalent
find /var/lib/rancher/k3s -type f -name "*.log" -mtime +7 -delete

# 3. Expand VPS disk (add volume, repartition)

# 4. Restart K3s to refresh capacity
sudo systemctl restart k3s
```

### Network Issues (Pod-to-Pod Communication)

**Symptoms**: Backend can't reach PostgreSQL/Redis despite DNS resolution

**Diagnosis**:
```bash
# Test DNS resolution
kubectl exec -it <backend-pod> -n yacc-staging -- nslookup postgres-svc

# Test network connectivity
kubectl exec -it <backend-pod> -n yacc-staging -- curl -v telnet://postgres-svc:5432

# Check network policies (if any)
kubectl get networkpolicies -n yacc-staging
```

**Recovery Steps**:
```bash
# 1. Restart CoreDNS
kubectl rollout restart deployment/coredns -n kube-system

# 2. Check Flannel CNI
kubectl get pods -n kube-system -l app=flannel

# 3. Verify services
kubectl get svc -n yacc-staging

# 4. If all else fails, restart entire cluster
sudo systemctl restart k3s
```

### Ingress Not Working (Domain Not Resolving)

**Symptoms**: `curl api-staging.example.com` → "connection refused" or DNS timeout

**Diagnosis**:
```bash
# Check DNS propagation
nslookup api-staging.example.com
dig api-staging.example.com

# Check Traefik pod
kubectl get pods -n kube-system -l app=traefik

# Check Ingress resource
kubectl get ingress -n yacc-staging
kubectl describe ingress -n yacc-staging

# Check Traefik logs
kubectl logs -n kube-system -l app=traefik --tail=100
```

**Recovery Steps**:
```bash
# 1. Verify DNS A record
nslookup api-staging.example.com
# Expected: <VPS_PUBLIC_IP>

# 2. Restart Traefik
kubectl rollout restart deployment/traefik -n kube-system

# 3. Verify Ingress resource syntax
kubectl apply -f ingress.yaml --dry-run=client -o yaml

# 4. Test port forwarding as fallback
kubectl port-forward -n yacc-staging svc/yacc-backend 8080:8080
curl http://localhost:8080
```

### Memory Pressure on Node

**Symptoms**: Pods evicted with `memory.pressure=true`, OOM kills

**Diagnosis**:
```bash
# Check node memory usage
kubectl top nodes

# Check pod memory usage
kubectl top pods -n yacc-staging

# Check memory requests vs limits
kubectl get pods -n yacc-staging -o json | \
  jq '.items[] | {name: .metadata.name, memory: .spec.containers[].resources}'
```

**Recovery Steps**:
```bash
# 1. Increase node RAM (upgrade VPS)

# 2. Lower resource requests/limits temporarily
kubectl set resources deployment yacc-backend \
  --limits=memory=512Mi \
  --requests=memory=256Mi \
  -n yacc-staging

# 3. Delete non-essential pods
kubectl delete pod <pod-name> -n yacc-staging
```

---

## Post-MVP Roadmap

### Phase 2: Multi-Node Cluster (3-month timeline)

**Goal**: Enable horizontal scaling, high availability

**Changes**:
- Add 2+ worker nodes to cluster
- Migrate local-path storage to Ceph or EBS
- Setup pod disruption budgets (no simultaneous pod evictions)
- Enable multi-zone deployment (AWS availability zones)

### Phase 3: Monitoring & Observability (concurrent with Phase 2)

**Stack**:
- Prometheus - Metrics collection
- Grafana - Visualization & dashboards
- Loki - Log aggregation
- AlertManager - Incident notifications

### Phase 4: Advanced Security (Phase 3 follow-up)

**Hardening**:
- Network policies (deny-all default, explicit allow rules)
- Pod security policies (restrict privileged pods)
- RBAC fine-tuning (principle of least privilege)
- Secret encryption at rest (sealed-secrets or Vault)

### Phase 5: GitOps Workflow (Phase 3 follow-up)

**Tools**: ArgoCD or Flux

**Benefits**:
- Version-controlled infrastructure (Helm charts in git)
- Automatic sync (cluster state matches git state)
- Audit trail (all deployments via git commits)
- Easy rollback (revert commit, ArgoCD syncs)

---

## Related Documentation

- **ADR-019**: K3s + Helm deployment decision & rationale
- **Helm Rollback Runbook**: `.docs/runbooks/helm-rollback.md`
- **Secrets Management**: `.docs/infrastructure/secrets-management.md` (post-MVP)
- **K3s Official Docs**: https://docs.k3s.io/
- **Kubernetes Docs**: https://kubernetes.io/docs/

---

**Last Updated**: 2026-02-26  
**Next Review**: 2026-06-26 (post-MVP security audit)
