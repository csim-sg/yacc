# 05. Quick Reference Card

**YACC - One-Page MVP Decision Summary**

---

## Project Overview

YACC — omni-channel social inbox. MVP platforms: Telegram + IRC. Additional platforms (WhatsApp, WeChat, Meta, X) are post-MVP.
Phase 1 UI filters expose Telegram + IRC only (future channels remain in enums).

See [01-product-specification.md](./01-product-specification.md) for full scope and user stories, and [03-implementation-guide.md](./03-implementation-guide.md) for architecture and tech stack.

---

## Deployment & CI/CD

- Target runtime: K3s (Kubernetes)
- Installer: Helm (backend chart `deploy/helm/yacc-backend`; PostgreSQL pre-installed in the cluster — **no Redis**, ADR-028)
- Backend image: Java 21 / Spring Boot (`services/backend-java/Dockerfile`; ADR-029 envelope)
- Architecture decision: `.docs/adr/ADR-019-k3s-helm-cicd-deployment.md` (envelope amended by ADR-029)
- **Node.js v20+** required for Node-workspace CI/CD (linting, testing, building) due to `eslint-plugin-unicorn` dependency; the Java backend uses Temurin 21 (`backend-java-ci.yml`)

---

## Backend of Record: Java 21 + Spring Boot (`services/backend-java`)

```bash
cd services/backend-java
./gradlew --no-daemon bootRun        # run locally (port 8080)
./gradlew --no-daemon build          # build + tests + JaCoCo ≥85% gate
./gradlew --no-daemon test           # unit + integration (Testcontainers)
./gradlew --no-daemon contractTest   # frozen OpenAPI/AsyncAPI conformance
./gradlew --no-daemon check          # full verification gate
```

Contract source of truth: frozen `.docs/migration/{openapi.yaml,asyncapi.yaml,schemas/*}` (ADR-023). Health wires: `/health/live`, `/health/ready` (actuator); metrics: `/actuator/prometheus` (ADR-029).

---

## Package Manager: pnpm (Node workspaces — frontend + transitional packages)

YACC uses **pnpm** for monorepo management. 

**Installation:**
```bash
npm install -g pnpm@9
pnpm --version  # v9.x required
```

**Common Commands:**

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Start all dev servers |
| `pnpm test` | Run tests in all packages |
| `pnpm build` | Build all packages |
| `pnpm lint` | Run linter across all packages |

**Workspace Commands (--filter):**

```bash
pnpm --filter @yacc/backend test      # Backend tests only
pnpm --filter @yacc/frontend dev      # Frontend dev server only
pnpm --filter @yacc/common lint       # Common package linter
```

**Why pnpm?**
- Monorepo workspaces (native support)
- Content-addressable storage (disk efficient)
- Strict dependency resolution
- 2-3x faster than npm
- Integrates seamlessly with Turborepo

---

## P0 Frontend Option 2 - Feature Checklist

**Status**: ✅ Complete + E2E tested  
**Scope**: Auth, account recovery, core workflow, real-time, notifications (assignment-only)  
**Stack note**: delivered on the transitional Node/TypeScript stack; the Java backend now provides auth via Spring Security (ADR-025 — BetterAuth decommissioned) and real-time via raw WebSocket (ADR-026). Frontend target reconciliation is SPEC-003 scope.

| Feature | Status | Implementation | Test |
|---------|--------|-----------------|------|
| **Login/Logout** | ✅ | BetterAuth + JWT | AUTH-001, AUTH-003 |
| **Forgot Password** | ✅ | Email token (60m TTL) | RECOVERY-001 |
| **Reset Password** | ✅ | Redirect to login, invalidate sessions | RECOVERY-002, RECOVERY-003 |
| **RBAC Reply/Retry** | ✅ | Super Admin/Admin/Manager=all, User=assigned | AUTH-004, WORKFLOW-006 |
| **Retry Exactly Once** | ✅ | Button disabled after 1 click | WORKFLOW-004, WORKFLOW-005 |
| **WebSocket Reconnect** | ✅ | Show indicator, REST refresh on reconnect | WORKFLOW-007, WORKFLOW-008 |
| **Assignment Notifications** | ✅ | Bell icon, unread badge, mark-read | NOTIFICATION-001, NOTIFICATION-002 |

---

## P0 Role Matrix (Locked)

| Capability | Super Admin | Admin | Manager | User |
|-----------|------------|-------|---------|------|
| **View all conversations** | ✅ | ✅ | ✅ | ❌ (assigned only) |
| **View assigned conversations** | ✅ | ✅ | ✅ | ✅ |
| **Reply on conversation** | ✅ | ✅ | ✅ | ✅ (if assigned) |
| **Retry failed message** | ✅ | ✅ | ✅ | ✅ (if assigned) |
| **See all notifications** | ✅ | ✅ | ✅ | ✅ |
| **Mark notifications read** | ✅ | ✅ | ✅ | ✅ |

---

## Common Gotchas

| Gotcha | Solution | P0 Status |
|--------|----------|-----------|
| **Retry loops**: User hits retry multiple times | Disable retry button after 1 attempt, show timeout | ✅ Implemented |
| **Reset auto-login**: User expects auto-login after reset | Reset redirects to Login page (no auto-login) | ✅ Locked |
| **Notification spam**: Same conversation assigned twice | Dedup by (user_id, conversation_id, type) | ✅ P0 (assignment-only) |
| **WS no reconnect indicator**: User thinks stuck | Show "Reconnecting..." banner, REST refresh on success | ✅ Implemented |
| **Search lag**: Message not searchable immediately | Index in real-time or batch every 5 minutes | 🚫 Deferred Phase 2 |
| **Status confusion**: Conversation auto-reopens | Show reason in UI: "Reopened: new message from customer" | 🚫 Deferred Phase 2 |
| **Bulk failure silent**: 50 of 100 fail without feedback | Always return failure list with reasons | 🚫 Deferred Phase 2 |
| **Group threading wrong**: Messages in separate conversations | Design: one conversation per group (Telegram group ID) | ✅ Backend |
| **Role check missing**: User can do admin action | Enforce RBAC on every endpoint via middleware | ✅ Implemented |
| **Attachment not deleted**: R2 grows unbounded | Manual cleanup or archival policy (post-MVP) | 🚫 Deferred Phase 2 |
| **@mention notifications**: Only assignment notifications in P0 | Filter to assignment-only, defer @mentions to Phase 2 | ✅ P0 Locked |
| **Status changes in P0**: Read-only badge only | No status-change controls in P0, show as read-only | ✅ Implemented |

---

## WebSocket SLO Targets (GOV-030)

| Metric | Target | Alert |
|--------|--------|-------|
| Connection Success Rate | ≥99.5% | <99% |
| Event Latency P95 | <100ms | >150ms |
| Reconnection Success | ≥95% | <90% |
| Backlog Replay | <5s per 100 events | >5s |

### 8 Metrics Emitted

| Metric | Type | Purpose |
|--------|------|---------|
| `ws.connection.attempt` | Counter | Track connection attempts |
| `ws.connection.success` | Counter | Calculate success rate SLO |
| `ws.connection.failure` | Counter | Diagnose failure modes |
| `ws.reconnection.attempt` | Counter | Track reconnection efficiency |
| `ws.event.received` | Counter | Track event volume |
| `ws.event.processed` | Histogram | Calculate latency P95 |
| `ws.event.error` | Counter | Surface handler bugs |
| `ws.backlog.replay` | Counter | Track reconnection efficiency |

---

## Helm Deployment Commands

**Prerequisites**: Helm 3.12+ installed, K3s cluster running, kubeconfig configured

### Installation & Deployment

```bash
# Deploy backend to staging (first time)
helm install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging \
  -f deploy/helm/yacc-backend/values-staging.yaml

# Update/redeploy (idempotent)
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging \
  -f deploy/helm/yacc-backend/values-staging.yaml

# Deploy specific version
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging \
  --set image.tag=v1.2.3
```

### Monitoring & Debugging

```bash
# View release status
helm status yacc-backend -n yacc-staging

# View release history
helm history yacc-backend -n yacc-staging

# View manifest (what will be deployed)
helm template yacc-backend ./deploy/helm/yacc-backend \
  -f deploy/helm/yacc-backend/values-staging.yaml

# Get actual values (from deployed release)
helm get values yacc-backend -n yacc-staging

# Watch pod deployment
kubectl rollout status deployment/yacc-backend -n yacc-staging -w
kubectl logs -n yacc-staging -l app=yacc-backend -f

# Check pod health
kubectl get pods -n yacc-staging
kubectl exec -it <pod-name> -n yacc-staging -- curl http://localhost:8080/health/live
```

### Incident Response (Roll-Forward)

The operational posture is **roll-forward only** (ARCH-004 §1): remediate by deploying a forward fix — `helm rollback` is not the primary path. See `.docs/runbooks/helm-rollback.md` (roll-forward incident runbook; rehearsal lands with MIG-070 #361).

```bash
# Deploy a forward fix
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging --set image.tag=<fixed-tag>

# Audit trail (what is/was running)
helm history yacc-backend -n yacc-staging

# Completely remove release
helm uninstall yacc-backend -n yacc-staging

# Dry-run (validate without deploying)
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging --dry-run --debug
```

### Troubleshooting

```bash
# Chart validation (catches syntax errors early)
helm lint ./deploy/helm/yacc-backend

# Template rendering (debug variable substitution)
helm template yacc-backend ./deploy/helm/yacc-backend -f values-staging.yaml

# Check dependencies installed
helm get all yacc-backend -n yacc-staging

# View recent events
kubectl get events -n yacc-staging --sort-by='.lastTimestamp'
```

**More details**: See `.docs/infrastructure/k3s-cluster-requirements.md` and `.docs/runbooks/helm-rollback.md`

---

## Checklist for Dev Kickoff

- [ ] Read 01-product-specification.md (features + user stories)
- [ ] Review 02-api-and-data-model.md (API + data model)
- [ ] Review 03-implementation-guide.md (architecture, phases)
- [ ] Check 04-qa-and-testing.md (ACs, regression suite)
- [ ] Keep 05-quick-reference.md pinned for quick lookup
- [ ] Setup PostgreSQL locally (Java service: `services/backend-java`, Testcontainers provisions its own test DB)
- [ ] Setup Cloudflare R2 bucket (or MinIO locally)

---

## Quick Links

| Document | Purpose |
|----------|---------|
| **01-product-specification.md** | Product scope, features, user stories (20 stories, 130+ ACs) |
| **02-api-and-data-model.md** | Complete API contract + database schema |
| **03-implementation-guide.md** | Architecture, tech stack, code examples, phases |
| **04-qa-and-testing.md** | Test cases, acceptance criteria, regression suite |
| **05-quick-reference.md** | This file — one-page cheat sheet |

---

## Key Contacts / Decision Makers

**Product Owner**: [Name] — Feature scope, acceptance criteria decisions  
**Tech Lead**: [Name] — Architecture, technical implementation decisions  
**QA Lead**: [Name] — Testing strategy, release criteria  

---

**Version**: 1.1  
**Last Updated**: 2026-10-18 (Java/Spring backend — MIG-090 docs sweep)  
**Status**: Active (SPEC-002 Phases 0–6 merged; Node packages transitional until MIG-080)  

Print this page. Pin it on your wall. Reference frequently.
