# Product Owner Decision: Frontend Deployment Scope (DEV-013-015 Blocker #1)

**Decision ID**: PO-001  
**Date**: 2026-02-23 14:30  
**Decision Maker**: Product Owner  
**Status**: ✅ **APPROVED & IMPLEMENTED**  
**Related Issues**: #288 (DEV-014), #287 (DEV-013), #289 (DEV-015)  
**Related ADR**: ADR-019 (K3s + Helm Standardization)  

---

## Decision Summary

**Frontend deployment remains out of Kubernetes/Helm scope.**

Frontend (React SPA) continues deploying to **AWS S3 + CloudFront** via independent pipeline. Helm charts (DEV-014) are **backend-only** (backend service + PostgreSQL + Redis).

---

## Business Context

**Problem Statement**: 
- DEV-014 AC ambiguously states "and frontend if deployed in-cluster"
- AGENTS.md clearly specifies "Frontend to AWS S3 + CloudFront"
- **Blocker Impact**: Scope ambiguity delays DEV-014 task definition and effort estimation

**Options Evaluated**:
1. **Option A (Selected)**: Frontend stays S3/CloudFront (out of Helm)
2. **Option B**: Include frontend in Helm charts (backend + frontend + dependencies)

---

## Rationale for Option A

### 1. Deployment Independence
- **Frontend lifecycle**: Triggered by frontend app updates (weekly? daily?)
- **Backend lifecycle**: Triggered by backend API updates (parallel schedule)
- **Shared Helm chart = shared downtime**: Not acceptable for production UX
- **Separate pipelines = independent velocity**: Teams deploy independently

### 2. Cost & Performance Optimization
- **S3 + CloudFront**: Designed for static assets
  - CDN-backed (global distribution, fast delivery)
  - Infinitely scalable (no compute overhead)
  - Cheaper than Kubernetes pod serving static files
- **K3s pod**: Wasteful for serving static SPA
  - Takes pod CPU/memory for non-interactive work
  - Adds pod startup latency vs CDN instant delivery
  - Increases cluster cost unnecessarily

### 3. Operational Simplicity
- **Reduced cluster burden**: Fewer pods = fewer resources, less operational overhead
- **Focused Helm scope**: Backend + dependencies only (clear, well-defined)
- **No frontend build overhead**: No need to containerize frontend for deployment
- **KISS principle**: Keep It Simple, Stupid. Use the right tool for each job

### 4. MVP Scope Alignment
- **AGENTS.md establishes precedent**: "Frontend to AWS S3 + CloudFront, Backend to Docker on VPS"
- **No user impact**: Changing deployment model doesn't affect features, only ops
- **Post-MVP flexibility**: Future multi-region scaling can revisit if needed (e.g., Terraform + infrastructure-as-code)

### 5. Development Velocity
- **Option A effort**: DEV-014 = 3-5 days (backend Helm only)
- **Option B effort**: DEV-014 = 5-7 days (+ frontend containerization, nginx config, chart templating)
- **Savings**: +2-3 days dev time (can be spent on Phase 2 features or stability)

---

## Impact on DEV-014

### Before (Ambiguous AC)
```
"Helm charts exist for backend (and frontend if deployed in-cluster); 
PostgreSQL + Redis installed via Helm"
```

### After (Clarified AC)
```
✅ Backend Helm chart created for Node.js API service
✅ PostgreSQL + Redis installed/managed via Helm dependencies
✅ Environment values separated (dev, staging)
✅ `helm upgrade --install` is idempotent
✅ Smoke deploy succeeds on K3s (pods Running + health check 200 OK)
❌ Frontend NOT included in Helm scope (out of scope for DEV-014)
```

### Scope
- **IN**: Backend service, PostgreSQL, Redis, environment configs, Helm templates, smoke tests
- **OUT**: Frontend containerization, nginx ingress controller config, frontend Helm template

---

## Implementation Status

### Documentation Updates ✅

| Document | Status | Link |
|----------|--------|------|
| **DEV-014 GitHub Issue AC** | ✅ Updated | #288 (Backend-only scope clarified) |
| **ADR-019 Deployment** | ✅ Updated | § Frontend Deployment Rationale |
| **Coordination Memo** | ✅ Updated | DEV-013-015-COORDINATION-MEMO.md (Blocker #1 → RESOLVED) |
| **Planning Index** | ✅ Updated | 00-INDEX.md (Blocker status tracked) |

### Artifacts

**Commit**: `PO: Resolve Blocker #1 - Frontend deployment scope (S3/CloudFront, out of Helm)`
- Hash: d1cb1f1
- Files: 4 changed, 897 insertions

---

## Timeline Impact

### If Approved ✅ (This Decision)
- DEV-013 starts 2026-02-26 (Architect finalizes ADR-019, docs)
- DEV-014 starts 2026-02-28 (Backend dev: Helm chart, 3-5 days)
- DEV-015 starts 2026-03-03 (Backend dev: CI/CD pipeline, 2-3 days)
- Target completion: 2026-03-05

### If Rejected ❌
- Scope ambiguity continues
- Dev team wastes time debating containerization strategy
- Helm chart complexity increases (+2-3 days)
- Infrastructure Phase completion delayed to 2026-03-07+

---

## Risk Mitigation

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Frontend needs same deployment pipeline post-MVP | Low | Deferred to post-MVP infrastructure phase; revisit if multi-region scaling needed |
| Frontend deployment independence breaks ops | Very Low | S3 + CloudFront is battle-tested, industry standard (Netlify, Vercel, etc.) |
| Team confusion re: frontend vs backend deploy | Low | Clear documentation in ADR-019 + issue AC eliminates ambiguity |
| Post-MVP unification effort high | Medium | Documented as future option; not locked in at architecture level |

---

## Sign-Off

**Product Owner**:  
- Name: [Auto-signed via PO authority]  
- Date: 2026-02-23 14:30  
- Status: ✅ **APPROVED**

**Architect Review** (ADR-019):  
- Status: ⏳ Pending (ADR-019 update awaiting architect review)  
- Due: 2026-02-24

**Communication to Backend Team**:  
- ✅ DEV-014 GitHub issue AC updated
- ✅ Coordination memo blocker status updated
- ✅ Planning index status updated
- 🔲 Slack notification to backend team (pending)

---

## Related References

- **AGENTS.md**: Line 9 (deployment model specification)
- **DEV-014 Issue**: #288 (Acceptance criteria)
- **ADR-019**: § Frontend Deployment Rationale (decision record)
- **Coordination Memo**: `.docs/plans/DEV-013-015-COORDINATION-MEMO.md` (blocker tracking)
- **Planning Index**: `.docs/plans/00-INDEX.md` (status overview)

---

**Decision ID**: PO-001  
**Next Review**: 2026-02-25 (if remaining 8 blockers resolved → proceed; else defer to post-MVP)
