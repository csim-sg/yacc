# GOV-031: Product Owner Gap Analysis - DEV-013-015 (K3s/Helm Infrastructure)

**Status:** Analysis Complete  
**Date:** 2026-02-23  
**Prepared By:** Product Owner (Primary Agent - Clarity Mode)  
**Related:** ADR-019, DEV-013, DEV-014, DEV-015

---

## Executive Summary

**DEV-013-015 (K3s/Helm Infrastructure Tasks)** represent **OPERATIONAL/INFRASTRUCTURE WORK** with **NO direct user-facing impact** on Phase 1.2 (P0 Frontend Option 2) or Phase 2 (Collaboration + Rules).

**Key Finding:** These tasks have been **prematurely scoped and classified as P0** despite:
1. Current production deployment already working (Docker on VPS → S3/CloudFront)
2. No blocking dependencies for Phase 2 feature delivery (FE-001-021, DEV-002-006)
3. **Critical blockers unresolved** (K3s cluster status, secret management decision, GitHub Actions network access)
4. **Scope ambiguities** (frontend deployment strategy, "smoke deploy" definition, rollback triggers)

---

## 1. Business Value Assessment

### Why Does YACC Need K3s/Helm?

**Answer:** **Internal operations optimization, NOT user value delivery.**

K3s/Helm standardization enables:
- **Repeatable deployments** across environments (dev/staging/prod)
- **Auditable configuration** (Helm values + versioned manifests)
- **Horizontal scaling** capability (Phase 2+)
- **Kubernetes-native operations** (logs, metrics, pod management)

**User Impact:** ZERO. Users do not see, interact with, or benefit from K3s/Helm deployment mechanics.

**Revenue Impact:** ZERO. K3s/Helm does not unlock new revenue streams or customer capabilities.

**Team Efficiency Impact:** **DEFERRED.** Current Docker deployment is working; K3s/Helm would improve ops efficiency **post-MVP**, not during MVP.

### Does This Unblock Product Features?

**NO.**

- **P0 Frontend Option 2 (FE-001-021):** Unblocked by current Docker+S3 deployment. Frontend deployment to S3/CloudFront is documented and working.
- **Phase 2 (Collaboration + Rules):** Does not require K3s/Helm. Backend services run on Docker today; service boundaries do not change.
- **IRC/Telegram Integrations:** Operational on current infrastructure; K3s is optional enhancement.

**Blocker Assessment:** DEV-013-015 does NOT block user-facing feature delivery.

---

## 2. Requirements Alignment Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| ✅ ADR-019 approved? | **PARTIAL** | Architect approved (2026-02-20); **Product Owner approval MISSING** (blank signature in ADR-019) |
| ✅ DEV-013 AC clear & testable? | ❌ **NO** | "Environment assumptions documented" - undocumented. "Rollback approach captured" - missing. |
| ✅ DEV-014 AC clear & testable? | ❌ **NO** | "Smoke deploy works on K3s" - undefined (pod running? health check? E2E test?). Frontend scope ambiguous. |
| ✅ DEV-015 AC clear & testable? | ❌ **NO** | "GitHub Actions deploy job uses Helm" - network access to K3s cluster unconfirmed. Rollback trigger undefined. |
| ✅ Acceptance criteria match GitHub issues? | ⚠️ **PARTIAL** | Issues #287-289 reference ACs; ACs exist in 06-tasks.md but lack detail. |
| ✅ Success criteria observable? | ❌ **NO** | No dashboards, logs, or manual verification steps defined. How do we verify "smoke deploy works"? |

### Gap Detail: DEV-013 (ADR-019 Approval + Documentation)

**Acceptance Criteria (from 06-tasks.md):**
```
ADR-019 approved; docs updated (technology + implementation + quick reference); 
environment assumptions documented; rollback approach captured
```

**Current State:**
- ✅ ADR-019 **technically approved** by Architect (2026-02-20)
- ✅ ADR-019 **exists** at `.docs/adr/ADR-019-k3s-helm-cicd-deployment.md`
- ❌ ADR-019 **lacks Product Owner signature** (blank signature block in document)
- ❌ "Environment assumptions" **NOT documented** (which envs? staging/prod? Ingress config? Storage class?)
- ❌ "Rollback approach" **NOT captured** (rollback to what? Docker? Previous Helm release?)
- ⚠️ "Docs updated" **UNCLEAR** - which docs? (Technology architecture? Implementation guide? Quick reference?)

**Missing from Requirement:**
1. **What is "environment assumptions documented"?** 
   - CPU/memory/disk requests/limits for K3s nodes?
   - Network policy (public ingress? private only)?
   - Storage provisioning (local vs persistent volumes)?
   - Secrets management approach (Sealed Secrets? External Secrets Operator)?
   
2. **What is "rollback approach"?**
   - Rollback helm chart version via `helm rollback`?
   - Rollback to Docker deployment (manual process)?
   - Data migration rollback (DB schema changes)?
   - Timeline for rollback execution?

3. **Which documents need updating?**
   - `.docs/03-implementation-guide.md` (already mentions K3s + Helm on line 118, 888)
   - `.docs/05-quick-reference.md` (basic reference exists; needs expansion)
   - `.docs/architecture/001-technology-architecture.md` (exists; needs rollback section)
   - **New doc needed?** Operational runbook (setup K3s, bootstrap cluster, deploy via Helm, troubleshooting)

---

### Gap Detail: DEV-014 (Create Helm Charts)

**Acceptance Criteria (from 06-tasks.md):**
```
Helm charts exist for backend (and frontend if deployed in-cluster); 
PostgreSQL + Redis installed via Helm; values separated per env; 
helm upgrade --install is idempotent; smoke deploy works on K3s
```

**Current State:**
- ❌ **Helm charts do NOT exist** (no `./helm/` or `./charts/` directory)
- ❌ **PostgreSQL/Redis Helm deployment** - undefined (official charts? custom? values location?)
- ⚠️ **"Values separated per env"** - unclear (files? `values-dev.yaml`, `values-prod.yaml`?)
- ✅ **Idempotency** - achievable with standard Helm practices
- ❌ **"Smoke deploy works"** - **UNDEFINED** (see definition gap below)

**Critical Blocker: Secret Management Decision**
- DEV-014 **cannot proceed** until secret management decided:
  - **Option A:** Sealed Secrets (encrypt secrets in repo, operator decrypts on cluster)
  - **Option B:** Kubernetes Secrets (bare secrets in cluster; external secret vault feeds values)
  - **Option C:** External Secrets Operator (references Vault/AWS Secrets Manager)
  
  **Current Status:** No decision documented. ADR-019 mentions "no secrets in repo" but does not prescribe mechanism.

**Missing from Requirement:**
1. **Frontend scope clarification** - current decision is "S3/CloudFront" (from AGENTS.md), but DEV-014 AC says "(and frontend if deployed in-cluster)"
   - Should frontend be deployed to K3s? (No, per AGENTS.md + current workflows)
   - Is "frontend if deployed in-cluster" a future option or out of scope?
   - **Recommend:** Formally scope to "backend only; frontend stays S3/CloudFront"

2. **"Smoke deploy works" definition** - needs explicit success criteria:
   - ✅ Backend pod is Running (not Pending/CrashLoopBackOff)
   - ✅ Liveness probe passes (pod is healthy)
   - ✅ Service endpoint responds to HTTP (curl test)
   - ✅ Helm chart rollback is possible (`helm rollback`)
   - ✅ Values override works (e.g., `helm upgrade --values values-staging.yaml`)
   - **Missing:** E2E test? (Manual curl? Automation script?)

3. **PostgreSQL/Redis Helm charts** - which ones?
   - Bitnami PostgreSQL chart? (most common)
   - Bitnami Redis chart?
   - Custom lightweight charts?
   - **Recommend:** Specify chart names + versions in Helm requirements

4. **Values organization** - unclear structure:
   - `/helm/values-dev.yaml`, `/helm/values-staging.yaml`, `/helm/values-prod.yaml`?
   - `/helm/backend/values.yaml` + `/helm/backend/values-staging.yaml`?
   - **Recommend:** Document values file structure + inheritance strategy

---

### Gap Detail: DEV-015 (Update CI Pipeline to Helm Deploy)

**Acceptance Criteria (from 06-tasks.md):**
```
GitHub Actions deploy job uses Helm; deploys to staging namespace; 
rollback documented; no kubectl imperative drift; pipeline passes
```

**Current State:**
- ✅ **GitHub Actions CI exists** (lint.yml, tests.yml, backend-ci.yml)
- ❌ **Deploy to Helm** - current workflows use SSH + `docker-compose up -d` (see backend-deploy.yml)
- ❌ **K3s cluster network access** - **UNCONFIRMED** (How does GitHub Actions reach K3s? SSH tunnel? Public endpoint? Webhook?)
- ⚠️ **"Staging namespace"** - K3s cluster assumed ready with namespace `staging` pre-provisioned
- ❌ **"Rollback documented"** - missing (manual rollback steps? Automated rollback trigger?)
- ✅ **"No imperative drift"** - achievable with Helm + documented process

**Critical Blocker: GitHub Actions ↔ K3s Network Connectivity**
- How will GitHub Actions runner reach K3s cluster?
  - **Option A:** K3s cluster has public ingress endpoint (risky security-wise)
  - **Option B:** GitHub Actions uses self-hosted runner with network access to K3s
  - **Option C:** GitHub Actions uploads Helm chart artifact; separate CD system deploys (GitOps pattern)
  
  **Current Status:** No decision. backend-deploy.yml uses SSH to VPS; K3s deployment strategy undefined.

**Missing from Requirement:**
1. **"Deployes to staging namespace"** - assumption that:
   - K3s cluster is provisioned and running
   - Namespace `staging` exists and is initialized
   - **Recommend:** Add ACto verify namespace exists + is healthy
   
2. **"Rollback documented"** - needs explicit procedure:
   - Helm rollback command: `helm rollback [RELEASE] [REVISION]`
   - When to trigger rollback (health check failure? E2E test failure?)
   - Rollback verification steps
   - **Missing:** Automated rollback trigger in GitHub Actions? Or manual operator decision?

3. **"Pipeline passes"** - what tests?
   - Lint ✅ (already in CI)
   - Unit tests ✅ (already in CI)
   - Integration tests ✅ (already in CI)
   - **NEW:** Health check test (pod running + endpoint responds?)
   - **NEW:** E2E smoke test (optional? or required?)
   - **Current state:** Unclear which tests must pass before Helm deploy

4. **Helm authentication** - how does GitHub Actions authenticate to K3s?
   - Kubeconfig file in secrets?
   - Service account token?
   - **Missing:** Documentation of secret setup in GitHub

---

## 3. Gap List (Product Owner Perspective)

### Gap 1: **K3s Cluster Provisioning Status (BLOCKING)**
**Description:** No evidence that K3s cluster is provisioned, accessible, or has staging namespace ready.

**Impact:** 
- DEV-015 cannot start without confirmed K3s cluster
- Estimate for provision + network setup: 2-3 days (operations/infrastructure team)
- Blocks DEV-014 testing on actual K3s cluster

**Resolution:**
- ✅ **Owner:** Infrastructure/Operations team (not in current YACC dev team)
- ✅ **Action:** Confirm K3s cluster status: version, node count, storage class, namespace(s), ingress controller
- ✅ **Dependency:** Create GitHub issue (GH-XXX) "Infrastructure: Provision K3s cluster + verify GitHub Actions access"
- ✅ **Timeline:** Must complete **before** DEV-014 testing; recommend 1 week buffer

---

### Gap 2: **Secret Management Decision (BLOCKING)**
**Description:** ADR-019 mandates "no secrets in repo" but does not prescribe how secrets are managed in K3s.

**Impact:**
- DEV-014 cannot finalize Helm charts without secret injection strategy
- Affects PostgreSQL password, Redis password, API keys, JWT secrets
- Blocks DEV-015 GitHub Actions deployment setup

**Resolution:**
- ✅ **Owner:** Architect (security decision)
- ✅ **Action:** Create ADR-020 or ADR-019 addendum documenting:
  - Chosen secret management approach (Sealed Secrets / External Secrets Operator / Environment variables)
  - Implementation details (operator installation, key rotation, disaster recovery)
  - GitHub Actions integration (how secrets flow into Helm values)
- ✅ **Product Owner responsibility:** Ensure Architect decision is documented and communicated
- ✅ **Timeline:** Must complete **before** DEV-014 implementation; recommend 2-3 days

---

### Gap 3: **"Smoke Deploy" Definition (CLARITY)**
**Description:** DEV-014 AC says "smoke deploy works on K3s" but does not define success criteria.

**Impact:**
- Backend dev unclear on what "works" means
- QA unclear on how to verify smoke deploy
- Risk: Subjective acceptance, rework on PR review

**Resolution:**
- ✅ **Owner:** Product Owner + Architect (definition) + QA (testability)
- ✅ **Action:** Define "smoke deploy" test matrix:
  ```
  1. Pod Status: kubectl get pod -n staging → phase=Running
  2. Liveness: kubectl describe pod -n staging → liveness probe passed
  3. HTTP Health: curl http://backend-service:3000/health → 200 OK
  4. Helm Rollback: helm rollback yacc-backend → success without data loss
  5. Database: kubectl exec pod → SELECT 1 FROM users → succeeds (connection works)
  ```
- ✅ **Testable:** Each criterion has a pass/fail outcome
- ✅ **Timeline:** Must define **before** DEV-014 starts; recommend 1 day

---

### Gap 4: **Frontend Deployment Scope Ambiguity (CLARITY)**
**Description:** AGENTS.md says "Frontend → S3/CloudFront"; DEV-014 AC says "(and frontend if deployed in-cluster)".

**Impact:**
- Frontend dev unclear if Helm chart needed for frontend
- Backend dev unclear on Helm chart scope
- Risk: Rework if frontend later requires K3s deployment

**Resolution:**
- ✅ **Owner:** Product Owner + Architect (deployment strategy decision)
- ✅ **Action:** Formalize decision:
  - **Current state:** Frontend → S3/CloudFront (verified in current workflows: frontend-deploy.yml uses AWS S3 + CloudFront)
  - **Decision:** Frontend deployment to K3s is OUT OF SCOPE for DEV-013-015
  - **Future option:** IF multi-region or edge deployment needed (post-MVP), evaluate Helm frontend chart
- ✅ **Update:** Modify DEV-014 AC to explicitly exclude frontend:
  ```
  "Helm charts exist for backend and dependencies (PostgreSQL, Redis); 
   frontend deployment to S3/CloudFront unchanged"
  ```
- ✅ **Timeline:** Clarify **immediately** (15 min decision)

---

### Gap 5: **Rollback Approach Undefined (CRITICAL)**
**Description:** "Rollback approach captured" (DEV-013 AC) but not documented. No clarity on rollback triggers or procedures.

**Impact:**
- Ops team unclear on how to recover from failed Helm deployment
- Risk: Service downtime if rollback mechanism not tested
- DEV-015 cannot implement rollback in GitHub Actions without this definition

**Resolution:**
- ✅ **Owner:** Architect + Backend team (implementation)
- ✅ **Action:** Document rollback procedure:
  ```
  AUTOMATIC ROLLBACK TRIGGERS:
  - Health check failure (pod liveness probe fails for 5 min)
  - E2E test failure (smoke deploy test fails)
  
  MANUAL ROLLBACK PROCEDURE:
  1. Identify last stable Helm release: helm history yacc-backend
  2. Rollback: helm rollback yacc-backend [REVISION]
  3. Verify: kubectl get pod -n staging; curl health endpoint
  4. If data migration required: kubectl exec pod → run migration rollback script
  5. Post-incident: Document failure root cause in GOV log
  
  ROLLBACK SLA:
  - Time to detect failure: 5 minutes
  - Time to execute rollback: 2 minutes
  - Expected downtime: <10 minutes
  ```
- ✅ **Test:** Rollback procedure must be tested during DEV-014 Helm chart development
- ✅ **Timeline:** Must document **before** DEV-015 CI integration; recommend 1 day

---

### Gap 6: **Environment Assumptions Not Documented (CLARITY)**
**Description:** "Environment assumptions documented" (DEV-013 AC) but file does not exist.

**Impact:**
- Ops team unclear on compute/storage requirements for K3s cluster
- Risk: Under-provisioned cluster causes performance degradation
- Unclear if same K3s cluster serves dev/staging/prod or separate clusters

**Resolution:**
- ✅ **Owner:** Architect + Backend team (requirements definition)
- ✅ **Action:** Create `.docs/infrastructure/k3s-cluster-requirements.md`:
  ```
  ## K3s Cluster Requirements (MVP)
  
  ### Compute
  - Node count: 1 (MVP single-tenant)
  - CPU per node: ≥2 cores
  - Memory per node: ≥4GB
  - Disk per node: ≥20GB (includes OS + local storage for PostgreSQL/Redis)
  
  ### Networking
  - Public ingress: YES (required for Helm deploy from GitHub Actions)
  - Private network: YES (recommended for security)
  - DNS: Internal (K3s ServiceDNS) + external (if needed)
  
  ### Storage
  - Local storage class: local-path (K3s default)
  - PostgreSQL: 10GB persistent volume
  - Redis: 2GB persistent volume
  
  ### Secrets Management
  - [TBD] Sealed Secrets OR External Secrets Operator
  
  ### Namespace Policy
  - Production namespace: `prod`
  - Staging namespace: `staging`
  - Development namespace: `dev` (optional)
  
  ### Resource Requests/Limits
  - Backend: 200m CPU / 256Mi RAM (requests); 500m CPU / 512Mi RAM (limits)
  - PostgreSQL: 250m CPU / 512Mi RAM (requests); 1000m CPU / 2Gi RAM (limits)
  - Redis: 100m CPU / 256Mi RAM (requests); 500m CPU / 512Mi RAM (limits)
  ```
- ✅ **Timeline:** Must document **before** DEV-014 implementation; recommend 1-2 days

---

### Gap 7: **GitHub Actions Network Access Not Confirmed (BLOCKING)**
**Description:** DEV-015 assumes GitHub Actions can reach K3s cluster, but mechanism not defined.

**Impact:**
- DEV-015 cannot implement Helm deploy without confirmed network path
- Risk: GitHub Actions workflow fails on first Helm command due to missing kubeconfig/network
- Blocks CI/CD integration for staging/prod

**Resolution:**
- ✅ **Owner:** Infrastructure team (network setup) + Backend team (GitHub Actions workflow)
- ✅ **Action:** Define GitHub Actions ↔ K3s connectivity:
  - **Option A (Recommended):** Self-hosted GitHub Actions runner on K3s cluster (secure, avoids network exposure)
  - **Option B:** K3s cluster exposes public API endpoint (less secure; requires RBAC hardening)
  - **Option C:** GitOps CD system (Flux/ArgoCD) watches GitHub repo, deploys independently
  
  **Current recommendation:** Option A (self-hosted runner) for security
- ✅ **Implementation:** 
  - Create GitHub issue "Infrastructure: Set up self-hosted GitHub Actions runner on K3s"
  - Document runner setup in `.docs/infrastructure/github-actions-runner-setup.md`
- ✅ **Timeline:** Must complete **before** DEV-015; recommend 2-3 days (runner installation + testing)

---

### Gap 8: **Missing Documentation Update Scope (CLARITY)**
**Description:** DEV-013 AC says "docs updated" but does not specify which docs.

**Impact:**
- Backend dev unclear on documentation responsibilities
- Risk: Incomplete docs after implementation; rework during PR review

**Resolution:**
- ✅ **Owner:** Product Owner (documentation coordination)
- ✅ **Action:** Create documentation checklist for DEV-013:
  ```
  MANDATORY DOCS UPDATES (DEV-013):
  - [ ] ADR-019: Add Product Owner signature + approval date
  - [ ] `.docs/03-implementation-guide.md`: Add section "6.1 K3s + Helm Deployment Architecture"
  - [ ] `.docs/05-quick-reference.md`: Add "Deployment: K3s + Helm (MVP)" section
  - [ ] NEW: `.docs/infrastructure/k3s-cluster-requirements.md` (see Gap 6)
  - [ ] NEW: `.docs/infrastructure/helm-deployment-runbook.md` (deployment steps, troubleshooting)
  
  UPDATES FOR DEV-014:
  - [ ] `.docs/03-implementation-guide.md`: Add Helm chart structure (app chart + dependency charts)
  - [ ] NEW: `.docs/infrastructure/helm-values-reference.md` (values.yaml documented)
  
  UPDATES FOR DEV-015:
  - [ ] `.docs/03-implementation-guide.md`: Add CI/CD section (GitHub Actions → Helm deploy flow)
  - [ ] `.docs/05-quick-reference.md`: Add "CI/CD Deployment Flow" quick ref
  - [ ] NEW: `.docs/infrastructure/ci-cd-helm-deployment.md` (GitHub Actions workflow documented)
  ```
- ✅ **Timeline:** Documentation updates must happen **in each PR** (DEV-013 → DEV-014 → DEV-015); no post-work
- ✅ **Acceptance:** Documentation must be reviewed + approved by Architect in PR

---

## 4. Role/Authority Clarification

### Question 1: **Who Approves ADR-019?**

**Current State:**
- ADR-019 signed by: Architect ✅ (2026-02-20)
- ADR-019 signed by: Product Owner ❌ (blank)

**Answer:**
- **Technical Decision (Kubernetes/Helm choice):** ✅ Architect approval sufficient
- **Business Alignment (ops work needed for MVP):** ✅ Product Owner must also approve
- **Recommendation:** Product Owner signature must be added to ADR-019 **before** DEV-013 starts

**Authority Model:**
```
ADR-019 Approval Chain:
1. Architect: "K3s + Helm is technically sound" ✅
2. Product Owner: "K3s + Helm aligns with Phase 1.5 priorities" ⏳ (PENDING)
3. Development: "Accepted; ready to implement" (follows PO/Arch approval)
```

---

### Question 2: **Who Owns "K3s Cluster Provisioned" Blocker?**

**Current State:** No owner assigned; cluster status unknown.

**Answer:**
- **Provisioning responsibility:** Infrastructure/DevOps team (not named in current YACC team)
- **YACC team responsibility:** Communicate requirements (Gap 6: resource needs, networking, storage)
- **Recommended action:** Escalate to separate infrastructure team OR assign backend dev to provision via terraform/helm
- **Timeline:** Must complete **1 week before** DEV-014 implementation

---

### Question 3: **Who Validates "Smoke Deploy Works"?**

**Current State:** Acceptance criteria vague; validator unclear.

**Answer:**
```
Validation Role:
- Definition: Product Owner (with Architect) ✅ (Gap 3)
- Implementation: Backend dev (write smoke deploy test script)
- Execution: Backend dev + QA (run smoke deploy test on K3s staging)
- Verification: Backend dev + Architect (PR code review + test results)
```

**Success Criteria (Observable):**
- ✅ PR includes shell script or GitHub Actions job demonstrating smoke deploy
- ✅ Test output shows: pod running, health check passing, HTTP 200
- ✅ Helm rollback succeeds without manual intervention
- ✅ QA has run test on K3s staging and confirmed success

---

## 5. Timeline & Phase Fit Assessment

### Current Phase Context

**Phase 1.5 Status (as of 2026-02-23):**
- ✅ **Backend Refactoring (DEV-002-006):** In Progress, target 2026-03-05
- ⏳ **Frontend P0 Option 2 (FE-001-021):** In Progress (blocker fixes), target end of sprint (~2 days)
- ⏳ **Phase 2 Planning:** Queued (starts after DEV-002-006 + FE-001-021 complete)
- ⏳ **QA Regression Suite:** Not started

### Should DEV-013-015 Start Now?

**Recommendation: DEFER DEV-013-015 until Phase 2 Ready**

**Rationale:**

| Timeline Option | Pros | Cons | Recommendation |
|-----------------|------|------|-----------------|
| **Start DEV-013-015 NOW (parallel to FE-001-021 fixes)** | Could reduce post-Phase-2 delay | 9 blockers unresolved; Architect + PO limited bandwidth; frontend QA blockers take priority | ❌ NOT RECOMMENDED |
| **Start DEV-013-015 after DEV-002-006 completes (2026-03-05)** | Backend dev available; blockers can be resolved in parallel; allows infrastructure team to provision K3s | Small delay (1-2 weeks) to Phase 2 start; frontend QA still needs attention | ⚠️ ACCEPTABLE IF blockers resolved |
| **Start DEV-013-015 after Phase 2 features complete (late March)** | All blockers resolved; infrastructure ready; team focused on single priority; cleaner workflow | Defers ops efficiency gains; Phase 1.5 to Phase 2 handoff takes longer | ✅ RECOMMENDED (lowest risk) |

### Impact of Deferral

**If deferred 2-4 weeks:**
- ✅ Phase 1.2 frontend completion unaffected (target: end of sprint)
- ✅ Phase 2 feature delivery unaffected (FE dev independent of K3s/Helm)
- ✅ Current Docker+S3 deployment continues working (no urgency)
- ⚠️ K3s/Helm ops improvements delayed (low priority relative to features)

**If started immediately:**
- ⚠️ 9 blockers must be resolved in parallel (adds coordination overhead)
- ⚠️ Architect + Backend dev split focus (competing with DEV-002-006)
- ⚠️ Frontend QA blockers deprioritized (risky for Phase 1.2 delivery)

---

## 6. Scope Clarifications Needed (Before Dev Start)

### Scope Issue 1: Frontend Deployment (RESOLVE IMMEDIATELY)

**Current State:** Ambiguous (AGENTS.md vs DEV-014 AC)

**Decision Required:**
```
QUESTION: Should Helm chart include frontend deployment?

CURRENT STATE:
- AGENTS.md: "Frontend to AWS S3 + CloudFront"
- frontend-deploy.yml: Deploys to S3 via GitHub Actions
- DEV-014 AC: "(and frontend if deployed in-cluster)"

DECISION NEEDED:
- ✅ YES, frontend in Helm: Complex; requires Docker image + ingress setup
- ❌ NO, frontend stays S3/CloudFront: Simpler; aligns with current practice

RECOMMENDATION: NO (frontend out of DEV-013-015 scope)

RATIONALE:
- Current S3/CloudFront deployment working well
- Frontend on K3s adds complexity (Docker image, ingress, TLS)
- MVP priority is backend reliability, not frontend hosting change
- Post-MVP: Can migrate frontend to K3s if needed

ACTION:
- Update DEV-014 AC to explicitly exclude frontend
- Remove "(and frontend if deployed in-cluster)" from AC
```

---

### Scope Issue 2: Rollback Triggers (RESOLVE IN DEV-013)

**Current State:** Unclear (manual vs automatic?)

**Decision Required:**
```
QUESTION: When does rollback trigger?

OPTIONS:
A) Manual only: Ops team decides rollback, executes helm rollback command
B) Automatic on health check failure: GitHub Actions monitors pod liveness, triggers rollback if probe fails
C) Automatic on E2E test failure: GitHub Actions runs smoke deploy test, triggers rollback if test fails
D) Hybrid: Automatic for health checks; manual approval for E2E test failures

RECOMMENDATION: A (Manual with clear procedures)

RATIONALE:
- MVP does not require automated rollback (ops can monitor + intervene)
- Automatic rollback risks cascading failures (if rollback itself fails)
- Clear manual procedure easier to test + document
- Post-MVP: Implement automatic rollback with ArgoCD/FluxCD

ACTION:
- Document manual rollback procedure (Gap 5)
- Include in DEV-013 deliverables (Helm deployment runbook)
- QA must test rollback procedure before DEV-014 completion
```

---

### Scope Issue 3: K3s Cluster Provisioning (RESOLVE BEFORE DEV-014)

**Current State:** Unknown (cluster exists? where? who manages?)

**Decision Required:**
```
QUESTION: Is K3s cluster already provisioned?

OPTIONS:
A) YES, cluster ready: Use immediately; start DEV-014 testing
B) NO, needs provisioning: Infrastructure team provisions (2-3 days); delayed start
C) HYBRID: Use existing cluster for DEV; provision separate staging cluster for CI/CD

RECOMMENDATION: Determine ASAP (survey infrastructure team)

ACTION:
- [ ] Send survey to operations/infrastructure lead:
      "Is K3s cluster provisioned? If yes: access details, networking, storage class."
- [ ] If NO: Create GH issue "Infrastructure: Provision K3s cluster for YACC MVP"
- [ ] If YES: Document cluster details in GOV-031-supplement.md
- [ ] Timeline: Determine status by 2026-02-24 (tomorrow)
```

---

## 7. Recommendation & Conditions for Proceeding

### Final Recommendation: **CONDITIONAL DEFER**

**Status:** ⏳ **DO NOT START DEV-013-015 until conditions below are met**

**Rationale:**
1. **No blocking user/product impact** - DEV-013-015 is ops work; Phase 1.2 + Phase 2 features do not depend on K3s/Helm
2. **9 critical blockers unresolved** - starting now risks rework + delays due to missing decisions
3. **Team bandwidth limited** - backend dev + architect focused on DEV-002-006 + FE fixes through ~2026-03-05
4. **Current deployment working** - Docker+S3 is stable; no urgency for ops changes

### Conditions for Proceeding (Must Resolve in Sequence)

| Condition | Owner | Timeline | Blocker? |
|-----------|-------|----------|----------|
| 1. **Clarify frontend scope** (out of DEV-013-015) | Product Owner | 2026-02-23 | 🔴 YES |
| 2. **K3s cluster status verified** | Infrastructure team | 2026-02-24 | 🔴 YES |
| 3. **Secret management decision made** (ADR-020) | Architect | 2026-02-24 | 🔴 YES |
| 4. **GitHub Actions network access confirmed** | Infrastructure team | 2026-02-25 | 🔴 YES |
| 5. **"Smoke deploy" definition finalized** | Product Owner + Architect | 2026-02-25 | 🔴 YES |
| 6. **Rollback procedure documented** | Architect + Backend | 2026-02-25 | 🟡 NO (can iterate in DEV-013 PR) |
| 7. **Environment requirements documented** | Architect + Backend | 2026-02-25 | 🟡 NO (can iterate in DEV-013 PR) |
| 8. **Documentation scope finalized** | Product Owner | 2026-02-25 | 🟡 NO (can iterate in each PR) |
| 9. **ADR-019 Product Owner signature** | Product Owner | 2026-02-25 | 🔴 YES |

### Recommended Timeline (If All Conditions Met)

```
2026-02-24 (Tue):    Resolve blockers 1-5 (critical path)
2026-02-25 (Wed):    Complete blockers 6-9; clear to start
2026-02-26 (Thu):    DEV-013 development begins (ADR + docs)
2026-03-05 (Wed):    Target DEV-013 completion (concurrent with DEV-002-006 finish)
2026-03-07 (Fri):    DEV-014 development begins (Helm charts)
2026-03-12 (Wed):    Target DEV-014 completion (1-2 weeks after start)
2026-03-14 (Fri):    DEV-015 development begins (CI pipeline)
2026-03-19 (Wed):    Target DEV-015 completion (1-2 weeks after start)
2026-03-21 (Fri):    Infrastructure Phase 1.5 COMPLETE
```

**Total Delay if Conditional Defer:** ~2-3 weeks (within acceptable range for Phase 1.5)

---

### If Conditions Cannot Be Met by 2026-02-25

**Decision:** **MOVE DEV-013-015 to Post-MVP Infrastructure Phase**

**Rationale:**
- Infrastructure decisions require coordination outside YACC dev team
- Deferring does not impact user feature delivery (Phase 1.2 + 2 unaffected)
- Post-MVP infrastructure team can implement K3s/Helm with proper planning

---

## 8. Approval & Next Steps

### Product Owner Final Decision: **CONDITIONAL DEFER UNTIL BLOCKERS RESOLVED**

**Key Points for Architect + Team:**

1. ✅ **ADR-019 is approved** (Architect signature present; Product Owner will add signature upon condition resolution)
2. ❌ **DEV-013-015 cannot start** until conditions 1-5 (critical blockers) are resolved
3. ⏳ **DEV-013 can proceed 2026-02-26** IF all conditions resolved by 2026-02-25 EOD
4. 📋 **Product Owner will create tracking issue** (GH-XXX) listing all 9 conditions + owners + timeline

### Deliverables from This Analysis

- ✅ This GOV-031 document (Product Owner gap analysis)
- ⏳ GH-XXX (Infrastructure blockers tracking issue) - to be created by Product Owner
- ⏳ Supplement document (blocker status updates) - updated daily through 2026-02-25
- ⏳ Updated 00-INDEX.md (Phase 1.5 status refresh)

### Next Product Owner Action

1. **Immediately (today):** 
   - Share GOV-031 with Architect + Backend lead
   - Create GitHub issue GH-XXX listing 9 blockers with owners
   - Send survey to infrastructure team: "K3s cluster status?"

2. **By 2026-02-24 EOD:**
   - Receive K3s cluster confirmation or provisioning timeline
   - Receive secret management decision from Architect (ADR-020)
   - Confirm GitHub Actions network access path

3. **By 2026-02-25 EOD:**
   - All 9 conditions resolved
   - Clear to start DEV-013 on 2026-02-26 (if yes) OR defer to post-MVP (if no)

---

## Summary: Product Owner Gaps vs Architecture Gaps

| Category | Product Owner Gaps | Architect Gaps | Status |
|----------|-------------------|---|--------|
| **Requirements Clarity** | "Smoke deploy" undefined; rollback triggers unclear | None (technical decisions sound) | ⏳ PO to resolve |
| **Business Alignment** | K3s/Helm = ops work; no user value; Phase 1.2 independent | Acknowledged; deferred to post-MVP ops | ✅ Aligned |
| **Scope Ambiguity** | Frontend deployment unclear; blockers unresolved | Technical approach sound; blockers correctly identified | ⏳ PO to clarify |
| **Documentation Gaps** | ADR-019 lacks PO signature; rollback procedure missing | ADR-019 content adequate; runbook needed | ⏳ PO + Arch to complete |
| **Risk Assessment** | No user-facing risk if deferred 2-3 weeks | Correct risk identification; network access critical | ✅ Acknowledged |

---

## References

- **ADR-019:** `.docs/adr/ADR-019-k3s-helm-cicd-deployment.md`
- **AGENTS.md:** Deployment target definition
- **06-tasks.md:** DEV-013-015 acceptance criteria
- **Current CI/CD:** `.github/workflows/backend-deploy.yml`, `.github/workflows/frontend-deploy.yml`
- **Phase 1.5 Status:** `.docs/plans/00-INDEX.md`

---

**Document Status:** ✅ Complete  
**Prepared By:** Product Owner (Clarity Mode)  
**Date:** 2026-02-23  
**Next Review:** 2026-02-25 (blocker resolution check-in)
