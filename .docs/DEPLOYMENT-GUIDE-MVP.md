# YACC MVP Deployment Guide

**Author**: DevOps/Infrastructure Team  
**Date**: 2026-02-26  
**Status**: MVP Ready (Phase 1.4 Complete)  
**Audience**: DevOps, SRE, Developers  

---

## Executive Summary

YACC MVP backend is deployed to Kubernetes (K3s) via Helm. This guide covers:

- **Local Development**: k3d single-node cluster (testing & validation)
- **Staging Environment**: K3s 1.30+ on VPS (public testing)
- **GitHub Actions**: Automated CI/CD pipeline (push-to-deploy)

**Timeline**: Deploy → Health Check → Smoke Tests → Ready for Users (5-10 minutes)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Deployment (k3d)](#local-development-deployment-k3d)
3. [Staging Deployment (K3s VPS)](#staging-deployment-k3s-vps)
4. [GitHub Actions CI/CD](#github-actions-cicd)
5. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
6. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Tools (Local Development)

```bash
# Install Helm 3.12+
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/

# Install k3d (for local testing only)
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

# Verify installations
helm version
kubectl version --client
k3d version
```

### Required Secrets (All Environments)

Before deploying, create a K8s Secret named `yacc-backend-secrets`:

```bash
# Generate secret values
SESSION_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

# Create secret (staging example)
kubectl create secret generic yacc-backend-secrets \
  --from-literal=DATABASE_URL="postgresql://postgres:password@postgresql:5432/yacc" \
  --from-literal=REDIS_URL="redis://:password@redis:6379/0" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=BETTER_AUTH_SECRET="$SESSION_SECRET" \
  --from-literal=TELEGRAM_BOT_TOKEN="123456:ABCDEFGHIJKLMNOP" \
  -n yacc-staging

# Verify
kubectl get secret yacc-backend-secrets -n yacc-staging
```

**Secure Storage**:
- Keep secret values in `.env.local` (git-ignored)
- Store in password manager (1Password, Vault)
- Rotate every 90 days (Telegram, R2 keys)
- Never commit to git

---

## Local Development Deployment (k3d)

### Step 1: Create k3d Cluster

```bash
# Create single-node K3s cluster for development
k3d cluster create yacc-dev \
  --agents 0 \
  --servers 1 \
  --image rancher/k3s:v1.30.0 \
  --volume /tmp/k3s-storage:/var/lib/rancher/k3s/storage \
  --port 8080:80@loadbalancer \
  --port 8443:443@loadbalancer \
  --wait

# Verify cluster
kubectl cluster-info
kubectl get nodes

# Get kubeconfig (auto-merged into ~/.kube/config)
kubectl config view
```

### Step 2: Create Namespace

```bash
kubectl create namespace yacc-staging
kubectl get namespace
```

### Step 3: Create Secrets

```bash
# Copy secrets from Step 1 (Prerequisites section)
kubectl create secret generic yacc-backend-secrets \
  --from-literal=DATABASE_URL="postgresql://postgres:password@postgresql:5432/yacc" \
  --from-literal=REDIS_URL="redis://:password@redis:6379/0" \
  --from-literal=JWT_SECRET="..." \
  -n yacc-staging

# Verify
kubectl get secrets -n yacc-staging
```

### Step 4: Deploy Backend via Helm

```bash
# From repository root
cd /path/to/yacc

# Deploy
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging \
  -f deploy/helm/yacc-backend/values-dev.yaml

# Monitor rollout
kubectl rollout status deployment/yacc-backend -n yacc-staging -w
```

### Step 5: Verify Deployment

```bash
# Check pods
kubectl get pods -n yacc-staging

# View logs
kubectl logs -n yacc-staging -l app.kubernetes.io/name=yacc-backend -f

# Port forward
kubectl port-forward -n yacc-staging svc/yacc-backend 8080:8080 &

# Health check
curl http://localhost:8080/health/live
curl http://localhost:8080/health/ready
curl http://localhost:8080/health | jq '.'
```

### Step 6: Clean Up (After Testing)

```bash
# Delete cluster
k3d cluster delete yacc-dev

# Clean up volumes
rm -rf /tmp/k3s-storage
```

---

## Staging Deployment (K3s VPS)

### Prerequisite: K3s Cluster Setup

If not already set up:

```bash
# On VPS server (SSH access required)
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install K3s (v1.30+)
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.30.0 sh -

# 3. Verify
k3s --version
kubectl cluster-info

# 4. Get kubeconfig (for local kubectl access)
sudo cat /etc/rancher/k3s/k3s.yaml
# Copy output, update server IP to VPS public IP
```

### Step 1: Configure Local kubectl

```bash
# On local machine
# Create kubeconfig from VPS
mkdir -p ~/.kube

# Copy VPS kubeconfig and update server IP
scp user@vps-ip:/path/to/k3s.yaml ~/.kube/config-staging

# Update server: https://vps-ip:6443
export KUBECONFIG=~/.kube/config-staging

# Verify
kubectl cluster-info
```

### Step 2: Create Namespace & Secrets

```bash
# Create namespace
kubectl create namespace yacc-staging

# Create secrets (same as local, with real values)
kubectl create secret generic yacc-backend-secrets \
  --from-literal=DATABASE_URL="postgresql://postgres:password@postgresql:5432/yacc" \
  --from-literal=REDIS_URL="redis://:password@redis:6379/0" \
  --from-literal=JWT_SECRET="..." \
  --from-literal=TELEGRAM_BOT_TOKEN="..." \
  -n yacc-staging
```

### Step 3: Deploy via Helm

```bash
# From local machine (or VPS)
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging \
  -f deploy/helm/yacc-backend/values-staging.yaml \
  --set image.tag=latest

# Monitor
kubectl rollout status deployment/yacc-backend -n yacc-staging --timeout=5m
```

### Step 4: Verify & Access

```bash
# Check status
kubectl get pods -n yacc-staging
kubectl logs -n yacc-staging -l app.kubernetes.io/name=yacc-backend

# Port forward (for local testing)
kubectl port-forward -n yacc-staging svc/yacc-backend 8080:8080

# Health check
curl http://localhost:8080/health
```

### Step 5: Setup Ingress (Optional)

If using Traefik ingress:

```bash
# Enable ingress in values-staging.yaml
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

# Deploy
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging \
  -f deploy/helm/yacc-backend/values-staging.yaml

# Create TLS secret
kubectl create secret tls yacc-backend-tls \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem \
  -n yacc-staging
```

---

## GitHub Actions CI/CD

### Setup (One-Time)

#### 1. Create GitHub Secret: KUBE_CONFIG_STAGING

```bash
# On VPS, get kubeconfig and encode it
sudo cat /etc/rancher/k3s/k3s.yaml | base64 -w0 > /tmp/kubeconfig.b64

# Copy the base64 output
cat /tmp/kubeconfig.b64

# In GitHub repository settings:
# Settings → Secrets and variables → Actions → New repository secret
# Name: KUBE_CONFIG_STAGING
# Value: [paste base64 kubeconfig]
```

#### 2. Verify Container Registry Access

```bash
# GitHub generates token automatically (GITHUB_TOKEN)
# Verify packages are being pushed to ghcr.io/csim-sg/yacc/yacc-backend
gh package list --owner csim-sg
```

### Trigger Deployment

Deployment is **automatic** on:
- Push to `dev` branch with backend changes
- Push to `dev` branch with Helm changes
- Manual trigger via GitHub Actions UI

### Monitor Deployment

```bash
# View workflow runs
gh run list --workflow=deploy-staging.yaml

# View specific run
gh run view <run-id>

# View logs
gh run view <run-id> --log

# Cancel run
gh run cancel <run-id>
```

### Workflow Stages

1. **Build** (5 min): Docker image build + push to ghcr.io
2. **Deploy** (2 min): Helm deployment to staging
3. **Smoke Tests** (2 min): Health checks + pod verification
4. **Verify Rollback** (1 min): Confirm rollback capability
5. **Notify** (1 min): Summary printed

**Total time**: ~10-15 minutes end-to-end

---

## Monitoring & Troubleshooting

### Real-Time Monitoring

```bash
# Watch pods
kubectl get pods -n yacc-staging -w

# Stream logs
kubectl logs -n yacc-staging -l app.kubernetes.io/name=yacc-backend -f

# Monitor events
kubectl get events -n yacc-staging --sort-by='.lastTimestamp' -w

# Check resource usage
kubectl top nodes
kubectl top pods -n yacc-staging
```

### Common Issues

#### Pod stuck in CrashLoopBackOff

```bash
# Check logs
kubectl logs -n yacc-staging <pod-name>

# Check events
kubectl describe pod -n yacc-staging <pod-name>

# Common causes:
# - Secret missing: kubectl get secret yacc-backend-secrets -n yacc-staging
# - Database down: kubectl get pods -n yacc-staging -l app=postgres
# - Memory OOM: kubectl top pods -n yacc-staging
```

#### Health endpoint returning 503

```bash
# Readiness probe failing (dependencies not ready)
# Check dependencies:
kubectl get pods -n yacc-staging  # All pods should be Running

# Check logs for database errors:
kubectl logs -n yacc-staging -l app.kubernetes.io/name=yacc-backend | grep -i "database\|redis"
```

#### Deployment not rolling out

```bash
# Check rollout status
kubectl rollout status deployment/yacc-backend -n yacc-staging

# If stuck, check resource availability
kubectl describe node

# Check pod events
kubectl describe pod -n yacc-staging <pod-name>
```

---

## Rollback Procedures

### Quick Rollback (Emergency)

```bash
# View history
helm history yacc-backend -n yacc-staging

# Rollback to previous release
helm rollback yacc-backend -n yacc-staging

# Monitor rollback
kubectl rollout status deployment/yacc-backend -n yacc-staging --timeout=2m
```

### Rollback to Specific Revision

```bash
# Identify good revision
helm history yacc-backend -n yacc-staging

# Rollback to revision (e.g., 5)
helm rollback yacc-backend 5 -n yacc-staging

# Verify
kubectl get pods -n yacc-staging
```

### Detailed Rollback Procedure

See `.docs/runbooks/helm-rollback.md` for comprehensive procedures including:
- Pre-rollback verification
- Root cause analysis
- Post-rollback testing
- Prevention strategies

---

## Post-Deployment Verification Checklist

After deployment:

- [ ] Pod running (kubectl get pods)
- [ ] Health check passing (curl /health/live, /health/ready)
- [ ] Logs clean (no ERROR/FATAL)
- [ ] Database connected (logs show "Database connected")
- [ ] Redis connected (logs show "Redis connected")
- [ ] Helm release healthy (helm status)
- [ ] Resource allocation verified (kubectl top pods)
- [ ] Rollback capability confirmed (helm history)

---

## Useful Commands Reference

### Helm

```bash
# Deploy
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend -n yacc-staging -f values-staging.yaml

# View
helm status yacc-backend -n yacc-staging
helm get values yacc-backend -n yacc-staging
helm get manifest yacc-backend -n yacc-staging

# Troubleshoot
helm template yacc-backend ./deploy/helm/yacc-backend -f values-staging.yaml
helm lint ./deploy/helm/yacc-backend

# Rollback
helm history yacc-backend -n yacc-staging
helm rollback yacc-backend 1 -n yacc-staging
```

### kubectl

```bash
# View
kubectl get pods -n yacc-staging
kubectl get svc -n yacc-staging
kubectl get secret -n yacc-staging

# Describe
kubectl describe pod -n yacc-staging <pod-name>
kubectl describe deployment -n yacc-staging yacc-backend

# Logs
kubectl logs -n yacc-staging -l app.kubernetes.io/name=yacc-backend
kubectl logs -n yacc-staging <pod-name> --previous  # Last run

# Port forward
kubectl port-forward -n yacc-staging svc/yacc-backend 8080:8080

# Execute in pod
kubectl exec -it -n yacc-staging <pod-name> -- sh
```

### GitHub Actions

```bash
# List runs
gh run list --workflow=deploy-staging.yaml

# View run
gh run view <run-id>

# Stream logs
gh run view <run-id> --log

# Cancel run
gh run cancel <run-id>
```

---

## Related Documentation

- **ADR-019**: K3s + Helm architecture decision
- **K3s Requirements**: `.docs/infrastructure/k3s-cluster-requirements.md`
- **Helm Architecture**: `.docs/architecture/TECH-ARCH-006-helm-deployment-architecture.md`
- **Rollback Runbook**: `.docs/runbooks/helm-rollback.md`
- **Secrets Management**: `.docs/infrastructure/secrets-management-and-environment-configuration.md`
- **Implementation Guide**: `.docs/03-implementation-guide.md` (Section 7: Helm Deployment)

---

**Last Updated**: 2026-02-26  
**Status**: MVP Ready (All tests passed)  
**Next Steps**: Production deployment (post-MVP) with multi-region HA
