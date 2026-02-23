# Secrets Management & Environment Configuration

**Author**: Enterprise Architect  
**Date**: 2026-02-26  
**Status**: Final (ADR-019 Approved)  
**Audience**: DevOps, Operations, Backend Developers  
**Related**: ADR-019 (K3s + Helm decision, Sections 3.5), K3s Cluster Requirements

---

## Table of Contents

1. [Secrets Strategy](#secrets-strategy)
2. [Secret Types & Inventory](#secret-types--inventory)
3. [Environment Configuration](#environment-configuration)
4. [Secret Creation & Management](#secret-creation--management)
5. [Secret Rotation & Updates](#secret-rotation--updates)
6. [Security Best Practices](#security-best-practices)
7. [Post-MVP Roadmap](#post-mvp-roadmap)

---

## Secrets Strategy

### MVP Approach: Kubernetes Secrets (Unencrypted at Rest)

**Decision Rationale** (ADR-019 Section 3.5):
- **KISS Principle**: Simple, no additional tooling setup
- **MVP Sufficient**: Single-tenant, controlled cluster access
- **Sealed Secrets Deferred**: Post-MVP, if multi-cluster or public cloud
- **Fast Iteration**: No overhead, focus on feature delivery

**Characteristics**:
- ✅ Encrypted in transit (via kubeconfig + HTTPS)
- ✅ RBAC-protected (only authorized pods can read)
- ✅ Idempotent (safely reapplied without duplication)
- ❌ NOT encrypted at rest (readable if cluster accessed)
- ❌ NOT rotated automatically (manual process)

### Secret Types

| Type | Purpose | Storage | Rotation | Access Control |
|------|---------|---------|----------|-----------------|
| **Application Secrets** | DB credentials, API tokens | K8s Secret | Manual | Pod environment |
| **TLS Certificates** | HTTPS cert + key | K8s Secret | Manual (future: cert-manager) | Traefik ingress |
| **SSH Keys** | Git deploy, cluster access | Not in K8s | Via SSH agent | Bastion/GitHub Actions |
| **API Keys** | Telegram token, R2 credentials | K8s Secret | Manual (90-day rotation) | Pod environment |

---

## Secret Types & Inventory

### 1. Application Secrets (yacc-backend-secrets)

**Secret Name**: `yacc-backend-secrets` (K8s Secret)  
**Namespace**: `yacc-staging` (and `yacc-prod` separately)  
**Injected As**: Environment variables

**Keys**:

| Key | Format | Example | Rotation | Required |
|-----|--------|---------|----------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@postgres-svc:5432/yacc` | Manual (30-day review) | ✅ |
| `REDIS_URL` | Redis connection string | `redis://:pass@redis-svc:6379/0` | Manual (30-day review) | ✅ |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token | `123456:ABCDEFGH...` | 90-day (Telegram recommends) | ✅ |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook signature validation | `secret123abc...` | 90-day | ✅ |
| `SESSION_SECRET` | Express session encryption | Random 32+ char string | Never (unless compromise) | ✅ |
| `JWT_SECRET` | JWT signing key | Random 32+ char string | Never (invalidates existing tokens) | ✅ |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 API key | `d1234567890...` | 90-day | ✅ |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret | `1234567890abcdef...` | 90-day | ✅ |

### 2. TLS Certificate Secret (yacc-backend-tls)

**Secret Name**: `yacc-backend-tls` (K8s Secret, type: `kubernetes.io/tls`)  
**Namespace**: `yacc-staging`  
**Used By**: Traefik Ingress

**Content**:
```bash
# tls.crt - SSL certificate (PEM format)
-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAL...
-----END CERTIFICATE-----

# tls.key - Private key (PEM format, KEEP SECRET!)
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----
```

**Rotation**:
- **Development**: Self-signed, no rotation needed
- **Staging**: 60-day manual renewal (or Let's Encrypt post-MVP)
- **Production**: Automated via cert-manager (post-MVP)

---

## Environment Configuration

### Configuration vs Secrets

**ConfigMap** (non-sensitive, committed to git):
```yaml
# .docs/infrastructure/values-staging.yaml
NODE_ENV: staging
LOG_LEVEL: info
PORT: 8080
DATABASE_POOL_SIZE: 15
REDIS_RETRY_STRATEGY: exponential
```

**Secrets** (sensitive, NOT committed):
```yaml
# Only in Kubernetes cluster
DATABASE_URL: postgresql://...
TELEGRAM_BOT_TOKEN: 123456:ABC...
```

### Values Files Hierarchy

**values.yaml** (defaults, committed):
```yaml
replicaCount: 1
nodeEnv: development
logLevel: debug
image:
  repository: yacc-backend
  tag: v1.0.0
database:
  poolSize: 10
redis:
  retryStrategy: exponential
attachments:
  maxSize: 5242880  # 5 MB
```

**values-staging.yaml** (overrides, committed):
```yaml
# Only non-sensitive overrides
nodeEnv: staging
logLevel: info
database:
  poolSize: 15
# Secrets NOT here (handled separately)
```

**values-prod.yaml** (post-MVP, committed):
```yaml
# Only non-sensitive overrides
nodeEnv: production
logLevel: warn
replicaCount: 2  # HA in production
database:
  poolSize: 20
```

### Environment Variables Injection Path

```
1. Helm values-staging.yaml
       ↓
2. Helm template rendering (deployment.yaml)
       ↓
3. K8s ConfigMap (app-config)
       ↓
4. K8s Secret (yacc-backend-secrets)
       ↓
5. kubelet environment injection
       ↓
6. Pod container startup
       ↓
7. Application code reads process.env.*
```

### Application Code Access

**Node.js Backend**:
```typescript
import { config } from 'dotenv';
config();  // Load from process.env

// Access secrets
const dbUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;

// Access config
const nodeEnv = process.env.NODE_ENV;
const logLevel = process.env.LOG_LEVEL;

// Validation
if (!dbUrl) {
  throw new Error('DATABASE_URL not set');
}
```

---

## Secret Creation & Management

### Initial Secret Setup (One-Time)

**Step 1: Generate Secret Values**

```bash
# Generate random secrets (32+ characters)
SESSION_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

echo "SESSION_SECRET=$SESSION_SECRET"
echo "JWT_SECRET=$JWT_SECRET"
```

**Step 2: Create K8s Namespace**

```bash
kubectl create namespace yacc-staging
```

**Step 3: Create Secret**

```bash
# Option A: Command-line (simple, error-prone)
kubectl create secret generic yacc-backend-secrets \
  --from-literal=DATABASE_URL="postgresql://user:pass@postgres-svc:5432/yacc" \
  --from-literal=REDIS_URL="redis://:redis-pass@redis-svc:6379/0" \
  --from-literal=TELEGRAM_BOT_TOKEN="123456:ABCDEFGH..." \
  --from-literal=TELEGRAM_WEBHOOK_SECRET="secret123..." \
  --from-literal=SESSION_SECRET="$SESSION_SECRET" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=R2_ACCESS_KEY_ID="d1234567890..." \
  --from-literal=R2_SECRET_ACCESS_KEY="1234567890abcdef..." \
  -n yacc-staging
```

```bash
# Option B: From file (safer, auditable)
cat > secrets.env <<EOF
DATABASE_URL=postgresql://user:pass@postgres-svc:5432/yacc
REDIS_URL=redis://:redis-pass@redis-svc:6379/0
TELEGRAM_BOT_TOKEN=123456:ABCDEFGH...
TELEGRAM_WEBHOOK_SECRET=secret123...
SESSION_SECRET=$SESSION_SECRET
JWT_SECRET=$JWT_SECRET
R2_ACCESS_KEY_ID=d1234567890...
R2_SECRET_ACCESS_KEY=1234567890abcdef...
EOF

kubectl create secret generic yacc-backend-secrets \
  --from-env-file=secrets.env \
  -n yacc-staging

# Clean up sensitive file
shred -vfz -n 3 secrets.env
```

**Step 4: Verify Secret Created**

```bash
# List secrets
kubectl get secrets -n yacc-staging

# Expected: yacc-backend-secrets listed

# Verify keys (values are base64-encoded, NOT displayed)
kubectl get secret yacc-backend-secrets -n yacc-staging -o yaml

# Expected: shows data keys (DATABASE_URL, REDIS_URL, etc.) without values
```

**Step 5: Create TLS Certificate**

```bash
# Generate self-signed certificate (development)
openssl req -x509 -newkey rsa:4096 -keyout tls.key -out tls.crt \
  -days 365 -nodes \
  -subj "/CN=api-staging.example.com"

# Create K8s TLS secret
kubectl create secret tls yacc-backend-tls \
  --cert=tls.crt \
  --key=tls.key \
  -n yacc-staging

# Clean up
rm tls.crt tls.key
```

### Secret Updates (After Deployment)

**Scenario**: Telegram token rotated, need to update secret

**Option A: Replace Entire Secret**

```bash
# 1. Create new secret with updated values
kubectl create secret generic yacc-backend-secrets-new \
  --from-literal=DATABASE_URL="..." \
  --from-literal=TELEGRAM_BOT_TOKEN="new-token-123..." \
  --from-literal=... \
  -n yacc-staging

# 2. Update deployment to use new secret
kubectl patch deployment yacc-backend \
  -p '{"spec":{"template":{"spec":{"containers":[{"env":[{"name":"SECRET_VERSION","value":"2"}]}]}}}}' \
  -n yacc-staging

# 3. Delete old secret
kubectl delete secret yacc-backend-secrets -n yacc-staging

# 4. Rename new secret to standard name
kubectl patch secret yacc-backend-secrets-new -p \
  '{"metadata":{"name":"yacc-backend-secrets"}}' \
  -n yacc-staging
```

**Option B: Patch Individual Keys** (simpler)

```bash
# Update single key (base64-encode first)
NEW_TOKEN=$(echo -n "new-telegram-token-xyz" | base64)

kubectl patch secret yacc-backend-secrets \
  -p '{"data":{"TELEGRAM_BOT_TOKEN":"'$NEW_TOKEN'"}}' \
  -n yacc-staging

# Pod picks up new secret automatically (or restart pod to force)
kubectl rollout restart deployment/yacc-backend -n yacc-staging
```

**Option C: Via kubectl edit** (interactive)

```bash
# Opens editor (vi/nano) to edit secret directly
kubectl edit secret yacc-backend-secrets -n yacc-staging

# Update values (remember they're base64-encoded)
# Save and close editor to apply changes
```

---

## Secret Rotation & Updates

### Rotation Schedule

| Secret | Frequency | Reason | Process |
|--------|-----------|--------|---------|
| **Telegram Token** | 90 days | Telegram recommends | Rotate via Telegram console, update K8s secret |
| **R2 Keys** | 90 days | Industry standard | Rotate via Cloudflare console, update K8s secret |
| **Database Password** | 180 days | Security policy | Update PostgreSQL + K8s secret simultaneously |
| **JWT Secret** | Never* | Invalidates tokens | Only rotate if compromise detected |
| **Session Secret** | Never* | User sessions invalidated | Only rotate if compromise detected |

*Exception: Rotate if compromise suspected (security breach)

### Rotation Process

**Step 1: Generate New Credential** (in source system)

```bash
# Example: Telegram Bot token rotation
# 1. Go to @BotFather on Telegram
# 2. /revoke (revoke old token)
# 3. /newtoken (generate new token)
# 4. Copy new token
```

**Step 2: Update K8s Secret**

```bash
# Patch secret with new value
NEW_TOKEN=$(echo -n "new-token-from-source" | base64)
kubectl patch secret yacc-backend-secrets \
  -p '{"data":{"TELEGRAM_BOT_TOKEN":"'$NEW_TOKEN'"}}' \
  -n yacc-staging
```

**Step 3: Verify Application Picks Up Change**

```bash
# Check if pod restarted (should auto-restart on secret update)
# OR force restart
kubectl rollout restart deployment/yacc-backend -n yacc-staging

# Verify new token is active (check logs for successful connection)
kubectl logs -n yacc-staging -l app=yacc-backend | grep -i "telegram\|connected"
```

**Step 4: Document Rotation**

```bash
# Log in audit trail / ticketing system:
# - Date rotated: 2026-02-28
# - Secret: TELEGRAM_BOT_TOKEN
# - Reason: Scheduled 90-day rotation
# - Verified: App logs show successful connection
```

### Automated Rotation (Post-MVP)

**Future Integration** (sealed-secrets or Vault):
```yaml
# Post-MVP: Add automatic secret rotation
apiVersion: vault.hashicorp.com/v1
kind: VaultSecret
metadata:
  name: yacc-backend-secrets
spec:
  vaultAddress: "https://vault.example.com"
  path: "secret/yacc-backend"
  rotationPeriod: 90d  # Automatic rotation
```

---

## Security Best Practices

### ✅ DO

- ✅ Store secrets ONLY in K8s Secrets (not in code, config files, or git)
- ✅ Use strong passwords (32+ random characters for SESSION_SECRET, JWT_SECRET)
- ✅ Rotate external API keys every 90 days
- ✅ Use `kubectl describe secret` to verify secret exists (values hidden)
- ✅ Limit secret access via RBAC (only backend pods and ops team)
- ✅ Use separate secrets for each environment (staging vs prod)
- ✅ Document all secrets in inventory (not values, just names + rotation schedule)
- ✅ Audit secret access (who created, who accessed, when)

### ❌ DON'T

- ❌ Commit secrets to git (even accidentally)
- ❌ Log sensitive values (sanitize logs, mask tokens)
- ❌ Share secrets via email, Slack, chat (use secure vault only)
- ❌ Use the same secret across environments (separate per env)
- ❌ Leave secrets in shell history (use `history -c` to clear)
- ❌ Print secrets in pod logs (configure JSON logging, filter sensitive fields)
- ❌ Hardcode secrets in Docker images (use environment variables)
- ❌ Assume default K8s security (implement RBAC, network policies post-MVP)

### Git Hygiene

**If Secret Accidentally Committed**:

```bash
# 1. IMMEDIATELY rotate the secret (it's now public!)
# 2. Remove from git history
git filter-branch --tree-filter 'rm -f <secret-file>' HEAD

# 3. Force push (WARNING: affects all developers)
git push origin --force

# 4. Notify team to re-clone
```

**Prevention**:

```bash
# Add to .gitignore
.env
.env.local
secrets.env
deploy/secrets/

# Pre-commit hook (warn on suspicious files)
#!/bin/bash
if git diff-index --check --cached HEAD | grep -E "DATABASE_URL|TOKEN|SECRET|PASSWORD"; then
  echo "❌ ERROR: Possible secret detected in commit"
  exit 1
fi
```

### Secret Access Control (RBAC)

**Backend Pod RBAC** (can read secret):

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: backend-reader
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]
    resourceNames: ["yacc-backend-secrets"]  # Only this secret
```

**Operator Access** (can create/update secrets):

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: secret-manager
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list", "create", "update", "patch", "delete"]
```

---

## Post-MVP Roadmap

### Phase 2: Sealed Secrets (Multi-Cluster)

**Goal**: Encrypt secrets at rest (cluster-specific keys)

**Implementation**:
```bash
# Install sealed-secrets controller
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system

# Seal secret
echo -n 'my-secret' | kubectl create secret generic mysecret --dry-run --from-file=/dev/stdin -o yaml | \
  kubeseal -f - > mysealedsecret.yaml

# Commit sealed secret to git (safe)
git add mysealedsecret.yaml
git push
```

### Phase 3: HashiCorp Vault (Advanced)

**Goal**: Centralized secret management with audit trail

**Features**:
- Automatic secret rotation
- Policy-based access (who can read what)
- Audit logging (all access recorded)
- Multi-cluster support
- Integration with Kubernetes auth

### Phase 4: AWS Secrets Manager (for EKS)

**Goal**: AWS-native secret management

**Features**:
- Zero cluster-side overhead
- Automatic rotation integration
- CloudTrail audit logging
- Cost-effective ($.40/secret/month)

---

## Troubleshooting

### Secret Not Found

```bash
# Problem: "cannot get secret yacc-backend-secrets"

# Check if secret exists
kubectl get secret yacc-backend-secrets -n yacc-staging

# If not found:
# 1. Verify namespace
kubectl get namespaces

# 2. Create secret
kubectl create secret generic yacc-backend-secrets --from-literal=... -n yacc-staging
```

### Pod Can't Read Secret

```bash
# Problem: "cannot read from secret" in pod logs

# Check if pod has permission (RBAC)
kubectl auth can-i get secrets --as=system:serviceaccount:yacc-staging:default

# Check secret mount in pod
kubectl exec -it <pod-name> -n yacc-staging -- env | grep DATABASE_URL

# If env var not set: Secret not injected
# Restart pod to pick up changes
kubectl rollout restart deployment/yacc-backend -n yacc-staging
```

### Secret Value Wrong

```bash
# Problem: "authentication failed" but secret looks correct

# Verify secret content (base64-decode)
kubectl get secret yacc-backend-secrets -n yacc-staging -o jsonpath='{.data.DATABASE_URL}' | base64 -d

# Expected: Should match actual DATABASE_URL
# If wrong: Patch secret with correct value
```

### Secret Accidentally Exposed

```bash
# Problem: Secret displayed in logs or console

# IMMEDIATE ACTIONS:
# 1. Rotate the secret (assume compromise)
# 2. Review audit logs (who accessed)
# 3. Update other systems depending on this secret
# 4. Document incident in incident report

# Example: Telegram token exposed
# → Revoke old token in @BotFather
# → Update K8s secret with new token
# → Restart backend pods
# → Check application logs for new token usage
```

---

## Related Documentation

- **ADR-019**: K3s + Helm deployment decision (Section 3.5: Secret Management)
- **K3s Cluster Requirements**: `.docs/infrastructure/k3s-cluster-requirements.md`
- **Implementation Guide**: `.docs/03-implementation-guide.md` (Helm section)
- **Kubernetes Secrets**: https://kubernetes.io/docs/concepts/configuration/secret/
- **Best Practices**: https://kubernetes.io/docs/concepts/configuration/overview/

---

**Last Updated**: 2026-02-26  
**Next Review**: 2026-06-26 (post-MVP security audit)
