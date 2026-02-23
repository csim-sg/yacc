# DEV-013-015 Coordination Memo
## K3s + Helm Infrastructure Standardization

**Date**: 2026-02-23  
**Status**: ⏸️ **COORDINATION PHASE - AWAITING BLOCKER RESOLUTION**  
**Target Start**: 2026-02-25 (Conditional)

---

## Executive Summary

**DEV-013, DEV-014, DEV-015** implement Kubernetes/Helm deployment infrastructure for YACC MVP. 

**Architect Analysis**: ✅ Technical approach sound; 9 critical blockers prevent development start  
**Product Owner Analysis**: ✅ Architecturally aligned; zero user impact; can be deferred post-MVP if needed  

**Recommendation**: Resolve 9 blockers by **2026-02-25**, then proceed parallel to FE-001-021 fixes.

---

## Task Overview

| Task | Owner | Effort | Dependencies | Status |
|------|-------|--------|--------------|--------|
| **DEV-013** | Architect | 2 days | None | ⏸️ Blocked on decisions |
| **DEV-014** | Backend Dev | 3-5 days | DEV-013 + Secret decision | ⏸️ Blocked on decisions |
| **DEV-015** | Backend Dev | 2-3 days | DEV-014 + K3s access | ⏸️ Blocked on decisions |

**Sequential Timeline**: DEV-013 → DEV-014 → DEV-015 (one after another)  
**Total Effort**: 7-10 days

---

## Critical Blockers (Must Resolve Before Start)

### 1. **Frontend Deployment Scope Clarification** 🟢 **RESOLVED**

**Issue**: DEV-014 AC says "and frontend if deployed in-cluster", but AGENTS.md specifies "Frontend to AWS S3 + CloudFront"

**Current State**: Ambiguous (2026-02-23 10:00 AM)  
**Decision Made**: Frontend OUT of Helm scope  
**Owner**: Product Owner  
**Timeline**: ✅ TODAY (2026-02-23 14:30)  
**Impact**: DEV-014 scope is backend-only Helm chart

**DECISION RECORD:**
- ✅ **Option A Selected**: Frontend stays S3/CloudFront (out of Helm scope)
- **Rationale**:
  1. Deployment independence (frontend ≠ backend lifecycle)
  2. Cost optimization (CDN native, no container overhead)
  3. Performance (static asset serving on CloudFront)
  4. MVP scope alignment (AGENTS.md establishes this model)
  5. Development velocity (+2-3 days saved vs Option B)
- **Action**: Updated DEV-014 GitHub issue #288 AC (confirmed backend-only scope)

**Documentation Updated**:
- ✅ DEV-014 GitHub issue AC (backend-only, frontend out of scope)
- ✅ This memo (Blocker #1 marked RESOLVED)
- 🟡 ADR-019 section 3.2 needs update: add "Frontend Deployment" clarification
- 🟡 00-INDEX.md: mark blocker as resolved in Infrastructure Phase status

---

### 2. **K3s Cluster Provisioning Status** 🔴 **BLOCKING**

**Issue**: Unknown if K3s cluster exists, where located, who manages it

**Current State**: Unknown  
**Decision Needed**: 
- Is K3s cluster already provisioned?
- Where? (VPS? Cloud? Local dev?)
- Who manages lifecycle?
- Network access from GitHub Actions?

**Owner**: Infrastructure / DevOps (outside YACC team?)  
**Timeline**: 2026-02-24  
**Impact**: 
- If not provisioned: DEV-014 can use k3d (local), DEV-015 blocked until cluster ready
- If provisioned but network-locked: DEV-015 requires self-hosted GitHub runner
- If not provisioned by 2026-02-25: Defer to post-MVP

**Resolution**:
- [ ] Contact infrastructure team
- [ ] Confirm cluster status + provisioning timeline
- [ ] Document network access method (public endpoint vs VPN vs self-hosted runner)
- [ ] Create K3s cluster or confirm k3d is sufficient for DEV-014 testing

---

### 3. **Secret Management Decision** 🔴 **BLOCKING**

**Issue**: How are secrets (DB password, Telegram token, IRC password, JWT secret) stored/injected?

**Current State**: Undecided  
**Options**:
- **Option A**: Kubernetes Secrets (base64, stored in etcd)
- **Option B**: Sealed Secrets (encrypted, committable to Git)
- **Option C**: External Secrets (Vault/HashiCorp) - too complex for MVP

**Owner**: Architect (security/ops decision)  
**Timeline**: 2026-02-24  
**Impact**: 
- Determines Helm chart `secret.yaml` template structure
- Blocks DEV-014 finalizing chart templates
- Affects CI/CD secret injection method (DEV-015)

**Resolution**:
- [ ] Architect decides: **Sealed Secrets** (recommended by EA) or **Kubernetes Secrets**?
- [ ] Create ADR-020 documenting decision
- [ ] Provide sealed secret examples or k8s secret creation instructions
- [ ] Document key rotation / backup procedure

**Architect Recommendation**: Sealed Secrets (ADR Section 3.5)

---

### 4. **GitHub Actions K3s Network Access** 🔴 **BLOCKING**

**Issue**: How does GitHub Actions reach K3s cluster?

**Current State**: Unknown  
**Decision Needed**:
- Is K3s cluster publicly accessible (firewall rules)?
- Or VPN-required (need self-hosted runner)?
- Where is kubeconfig stored?
- How is it injected into GitHub Actions?

**Owner**: Infrastructure / DevOps  
**Timeline**: 2026-02-25  
**Impact**: 
- DEV-015 GitHub Actions workflow won't deploy without cluster access
- Determines CI/CD architecture (GitHub-hosted vs self-hosted runner)

**Resolution**:
- [ ] Infrastructure confirms K3s cluster network accessibility
- [ ] Provides kubeconfig for GitHub Secrets (base64 encoded)
- [ ] Documents network path (public IP, DNS, VPN, self-hosted runner)
- [ ] Tests kubeconfig connectivity from GitHub Actions

---

### 5. **"Smoke Deploy" Success Criteria Definition** 🔴 **BLOCKING**

**Issue**: DEV-014 & DEV-015 AC say "smoke deploy works on K3s", but success criteria undefined

**Current State**: Vague  
**Definition Needed**: What constitutes successful smoke deploy?

**Options**:
- [ ] Backend pod in Running state?
- [ ] Health check endpoint returns 200 OK?
- [ ] Database migrations applied successfully?
- [ ] End-to-end message flow test (send message → receive)?
- [ ] All of above?

**Owner**: Product Owner + Backend Lead  
**Timeline**: 2026-02-25  
**Impact**: 
- Acceptance criteria clarity for DEV-014 & DEV-015
- Test automation scope
- What QA validates

**Resolution**:
- [ ] Product Owner + Backend define smoke test suite
- [ ] Document in DEV-014/015 acceptance criteria
- [ ] Specify automation requirements (curl health? E2E? Manual?)
- [ ] Example: "DEV-014 AC: Pods reach Running state + health check returns 200 + logs show no errors"

**Recommended Smoke Tests**:
1. Pod status: `kubectl get pods -n yacc-staging` → all Running
2. Health check: `curl -f http://localhost:3000/health` → 200 OK
3. Database ready: Pod logs show "Database connected"
4. Redis ready: Pod logs show "Redis connected"

---

### 6. **Rollback Procedure & Triggers** 🔴 **BLOCKING**

**Issue**: "Rollback approach captured" is vague

**Current State**: Undefined  
**Decision Needed**:
- Manual rollback or automatic on failure?
- Rollback triggers (deployment failure? Smoke test failure? Manual?)
- Database migration rollback included?
- Rollback timing (immediate? Observation window?)

**Owner**: Architect + Backend Lead  
**Timeline**: 2026-02-25  
**Impact**: 
- DEV-013 ADR-019 documenting rollback strategy
- DEV-015 CI pipeline error handling logic
- Ops runbook completeness

**Resolution**:
- [ ] Architect decides: Manual rollback (recommended for MVP) or automated?
- [ ] Create `.docs/runbooks/helm-rollback.md` with step-by-step procedure
- [ ] Document triggers: "Rollback if pods don't reach Ready in 5 min" OR "manual operator decision"
- [ ] Address database migration rollback (requires manual down migrations)

**Recommended MVP Approach**: 
- Manual rollback (no automatic rollback)
- Trigger: Operator observes deployment issues
- Procedure: `helm rollback yacc -n yacc-staging` + verify pods recover
- Database: Document need for manual migration revert (if applicable)

---

### 7. **Environment Requirements Documentation** 🔴 **BLOCKING**

**Issue**: K3s cluster specifications not documented (VPS sizing, resource limits, etc.)

**Current State**: Assumed but not explicit  
**Definition Needed**:
- K3s version (1.28+?)
- Minimum VPS specs (CPU, RAM, disk)?
- Storage class (local-path? NFS? Cloud PVC?)
- Ingress controller required (Traefik is default)?
- TLS/certificate management?

**Owner**: Architect + Infrastructure  
**Timeline**: 2026-02-25  
**Impact**: 
- DEV-013 documents in ADR-019 + infrastructure requirements doc
- DEV-014 values files sized appropriately
- Prevents under-provisioning on VPS

**Resolution**:
- [ ] Architect documents K3s requirements in ADR-019
- [ ] Create `.docs/infrastructure/k3s-cluster-requirements.md`
- [ ] Define resource requests/limits for backend, PostgreSQL, Redis
- [ ] Test on VPS (or k3d with similar constraints)

**Recommended Specs**:
- K3s version: 1.28+ (LTS support)
- VPS: 2 CPU, 4GB RAM, 20GB disk (minimum for MVP)
- Storage: local-path (K3s default)
- Ingress: Traefik (K3s default, no additional install needed)

---

### 8. **Documentation Scope Clarification** 🔴 **BLOCKING**

**Issue**: Which docs to update is unclear

**Current State**: Architect outlined 4 docs, but mapping to `.docs/` structure unclear

**Docs to Update/Create**:
- [ ] **ADR-019**: K3s/Helm standardization decision record
- [ ] **`.docs/technology-architecture.md`** (or create): K3s/Helm architecture section
- [ ] **`.docs/03-implementation-guide.md`**: Helm deployment section
- [ ] **`.docs/05-quick-reference.md`**: Helm commands cheat sheet
- [ ] **`.docs/infrastructure/k3s-cluster-requirements.md`** (NEW): Requirements + assumptions
- [ ] **`.docs/runbooks/helm-rollback.md`** (NEW): Rollback procedure
- [ ] **`.docs/plans/00-INDEX.md`**: Update to reflect Infrastructure Phase

**Owner**: Product Owner + Documentation Lead  
**Timeline**: 2026-02-25  
**Impact**: 
- Team clarity on K3s/Helm approach
- Runbook availability for operations

**Resolution**:
- [ ] Architect creates ADR-019 (with PO review)
- [ ] Backend dev updates implementation guide
- [ ] Product Owner ensures all 7 docs created/updated
- [ ] Check into version control as part of DEV-013

---

### 9. **ADR-019 Approval Chain** 🔴 **BLOCKING**

**Issue**: ADR-019 requires dual approval (Architect + Product Owner)

**Current State**: Pending  
**Approval Process**:
1. Architect drafts ADR-019 ✅ (included in Architect's analysis)
2. Architect self-approves ✅ 
3. **Product Owner reviews & approves** ⏸️ (pending blocker resolution)
4. Commit to `.docs/adr/ADR-019-k3s-helm-standardization.md`

**Owner**: Product Owner  
**Timeline**: 2026-02-25 (after other 8 blockers resolved)  
**Impact**: 
- Authoritative governance record
- Signals green light to development teams

**Resolution**:
- [ ] Product Owner reviews ADR-019 (technical soundness + business alignment)
- [ ] Product Owner signs ADR-019 (commit with message "Add PO sign-off to ADR-019")
- [ ] Commit to `dev` branch

---

## Blocker Resolution Checklist

**Status**: 🟡 **PARTIALLY RESOLVED** (1 of 9 resolved - Frontend scope)  
**Blocker #1**: 🟢 ✅ RESOLVED (2026-02-23 14:30)  
**Target Resolution for Remaining**: 2026-02-25 11:59 PM  
**Consequence if Delayed**: Defer DEV-013-015 to post-MVP (does not impact FE-001-021 or Phase 2 features)

| # | Blocker | Owner | Status | Target Date | Notes |
|---|---------|-------|--------|-------------|-------|
| 1 | Frontend scope (S3/CloudFront) | PO | 🟢 ✅ RESOLVED | 2026-02-23 | Decision: Frontend out of Helm scope; DEV-014 is backend-only |
| 2 | K3s cluster status | Infrastructure | ⏸️ | 2026-02-24 | Decision: Provision or use k3d for testing |
| 3 | Secret management (Sealed vs K8s) | Architect | ⏸️ | 2026-02-24 | Decision: Sealed Secrets (recommended) |
| 4 | GitHub Actions K3s access | Infrastructure | ⏸️ | 2026-02-25 | Decision: Network path + kubeconfig delivery |
| 5 | Smoke deploy criteria | PO + Backend | ⏸️ | 2026-02-25 | Decision: Pod Running + Health 200 OK |
| 6 | Rollback approach | Architect | ⏸️ | 2026-02-25 | Decision: Manual rollback + runbook |
| 7 | Environment specs (K3s sizing) | Architect | ⏸️ | 2026-02-25 | Decision: 1.28+, 2CPU/4GB RAM/20GB disk minimum |
| 8 | Documentation scope | PO | ⏸️ | 2026-02-25 | Decision: 7 docs to create/update |
| 9 | ADR-019 approval | PO | ⏸️ | 2026-02-25 | Decision: Sign ADR after other 8 resolved |

---

## Phase Coordination

**Current Status (as of 2026-02-23)**:
- Phase 1 Backend: ✅ Complete (IRC integration merged)
- Phase 1.5 Backend Refactoring (DEV-002-006): ⏳ In Progress
- Phase 1 Frontend (P0 Option 2): ⏳ In Progress (blocker fixes)
- **Phase 1.5 Infrastructure (DEV-013-015)**: ⏸️ **BLOCKED (awaiting blocker resolution)**

**Timeline Decision**:
- **If all 9 blockers resolved by 2026-02-25 11:59 PM**: 
  - ✅ Start DEV-013 on 2026-02-26 (Architect)
  - DEV-014 starts 2026-02-28 (Backend, parallel to FE-001-021 fixes)
  - DEV-015 starts 2026-03-03 (Backend, parallel to Phase 2 prep)
  - Target completion: 2026-03-05

- **If ANY blocker unresolved by 2026-02-25 11:59 PM**:
  - 🔴 Defer DEV-013-015 to post-MVP (Infrastructure Phase)
  - Continue FE-001-021 + Phase 2 (tags/notes/assignments/rules) uninterrupted
  - Re-evaluate 2026-03-10 (after Phase 2 starts)

---

## Dependency Map

```
DEV-013 (ADR-019 Approval)
├── Blocker 1: Frontend scope
├── Blocker 3: Secret management
├── Blocker 6: Rollback approach
├── Blocker 7: Environment specs
├── Blocker 8: Documentation scope
└── Blocker 9: ADR-019 approval
       ↓
DEV-014 (Helm Charts)
├── Blocker 2: K3s cluster OR k3d for testing
├── Blocker 5: Smoke deploy criteria
└── DEV-013 (ADR-019 approved)
       ↓
DEV-015 (CI Pipeline)
├── Blocker 4: GitHub Actions K3s access
└── DEV-014 (Helm charts tested)
```

---

## Success Criteria

### DEV-013 Complete ✅
- [ ] ADR-019 approved by Architect + Product Owner
- [ ] Technology architecture doc updated (K3s/Helm section)
- [ ] Implementation guide has Helm deployment section
- [ ] Quick reference has Helm commands
- [ ] Infrastructure requirements doc created
- [ ] All 4 docs committed to `dev` branch
- [ ] Team has clear understanding of K3s/Helm approach

### DEV-014 Complete ✅
- [ ] Backend Helm chart created (backend, PostgreSQL, Redis)
- [ ] Chart passes lint validation
- [ ] Chart templates render valid YAML
- [ ] Smoke deploy succeeds on k3d (all pods Running)
- [ ] Health check passes (`curl /health` → 200 OK)
- [ ] Idempotency verified (multiple `helm upgrade --install` succeed)
- [ ] Environment values files created (dev, staging)
- [ ] PR merged to `dev` branch

### DEV-015 Complete ✅
- [ ] GitHub Actions workflow created (`.github/workflows/deploy-staging.yaml`)
- [ ] Kubeconfig added to GitHub Secrets
- [ ] Workflow deploys to `yacc-staging` namespace via Helm
- [ ] Smoke tests run post-deploy (health check, pod readiness)
- [ ] Helm rollback procedure documented (`.docs/runbooks/helm-rollback.md`)
- [ ] CI pipeline passes (build → deploy → smoke tests)
- [ ] Idempotency verified (multiple CI runs succeed)
- [ ] PR merged to `dev` branch

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| K3s cluster not provisioned by 2026-02-25 | Medium | Blocks DEV-015 | Use k3d for DEV-014 testing; defer production deploy to post-MVP |
| Secret management decision delays | Low | Blocks DEV-014 | Architect makes decision by 2026-02-24; use Sealed Secrets (default) |
| GitHub Actions network access fails | Medium | Blocks DEV-015 | Test kubeconfig connectivity early (2026-02-25); use self-hosted runner if needed |
| Database migration rollback complexity | Low | Blocks production rollback | Document manual procedure; address in runbook; deferred to ops training |
| VPS under-provisioned | Medium | Deployment fails/OOM | Test on k3d with resource limits; right-size before staging deploy |
| Helm chart idempotency issues | Low | Deployment unreliable | Test multiple deploys locally; use `--wait` flag in Helm command |

---

## Next Actions

### Immediate (TODAY - 2026-02-23)

**Product Owner**:
- [x] ✅ **DONE** Confirm frontend deployment scope (S3/CloudFront only, not Helm)
- [x] ✅ **DONE** Update DEV-014 GitHub issue AC (backend-only Helm chart scope)
- [x] ✅ **DONE** Update ADR-019 with frontend deployment rationale
- [x] ✅ **DONE** Record Blocker #1 resolution in this memo
- [ ] Update 00-INDEX.md Infrastructure Phase status
- [ ] Share blocker resolution with Architect + Backend team
- [ ] Confirm remaining 8 blockers on track for 2026-02-25

**Architect**:
- [ ] Review Product Owner blocker analysis
- [ ] Begin ADR-019 draft (3 hours)
- [ ] Prepare decision recommendations for blockers 3, 6, 7

### Short-Term (2026-02-24 - 2026-02-25)

**Architect**:
- [ ] Complete ADR-019 draft ✅
- [ ] Finalize secret management decision (Sealed Secrets recommended)
- [ ] Document environment requirements (K3s 1.28+, VPS sizing)
- [ ] Document rollback approach (manual, with runbook)

**Infrastructure / DevOps**:
- [ ] Confirm K3s cluster status (provisioned? location? timeline?)
- [ ] Confirm GitHub Actions network access method
- [ ] Provide kubeconfig (if K3s ready) or confirm k3d sufficient

**Backend Lead**:
- [ ] Prepare for DEV-013-015 kickoff (review Architect's analysis)
- [ ] Confirm Helm expertise or plan training

**Product Owner**:
- [ ] Review ADR-019 draft (blockers 1-9 resolved)
- [ ] Approve ADR-019 signature
- [ ] Verify all 7 docs created/updated

### Go/No-Go Decision (2026-02-25 5:00 PM)

**Decision**: All 9 blockers resolved?
- ✅ **YES** → Proceed with DEV-013-015 starting 2026-02-26
- ❌ **NO** → Defer to post-MVP; continue FE-001-021 + Phase 2

---

## Contacts & Escalations

| Role | Contact | Escalation Trigger |
|------|---------|-------------------|
| **Product Owner** | — | Blocker 1, 8, 9 decisions; final gate |
| **Architect** | — | Blocker 3, 6, 7 decisions; ADR-019 approval |
| **Backend Lead** | — | DEV-014/015 timeline; resource allocation |
| **Infrastructure/DevOps** | — | Blocker 2, 4; K3s provisioning + access |
| **Engineering Lead** | — | Final approval for deferral (if blockers unresolved) |

---

## Document References

- **Architect Analysis**: `Architect's YACC DEV-013-015 Analysis` (provided in slack/email)
- **Product Owner Analysis**: `Product Owner GAP ANALYSIS for DEV-013-015` (provided in slack/email)
- **ADR-019 (Draft)**: Pending Architect handoff
- **GitHub Issues**: #287 (DEV-013), #288 (DEV-014), #289 (DEV-015)
- **GitHub Project**: https://github.com/users/csim-sg/projects/1/views/1

---

**Prepared By**: Product Owner (Orchestration Role)  
**Date**: 2026-02-23 10:00 AM  
**Status**: ⏸️ **AWAITING BLOCKER RESOLUTION**  
**Next Review**: 2026-02-25 5:00 PM (Go/No-Go Decision)
