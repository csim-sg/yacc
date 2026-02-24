**Status:** Accepted  
**Date:** 2026-02-20  
**Deciders:** Enterprise Architect + Product Owner  
**Related:** ADR-016 (06-tasks as task map), ADR-018 (Bun runtime migration)

---

# Architecture Decision Record

## Title
Adopt K3s + Helm as CI/CD Deployment Target (MVP and Beyond)

## Context

YACC currently references a "single VPS Docker" deployment model in multiple documents. We are standardizing the delivery pipeline and runtime target to Kubernetes, specifically:

- **K3s** as the Kubernetes distribution (lightweight, suitable for single-tenant MVP)
- **Helm** as the packaging/deployment mechanism

We want a repeatable CI/CD flow where:

- The backend application is deployed via Helm charts
- Platform dependencies are installed via Helm (e.g., PostgreSQL, Redis)
- Frontend (React SPA) is deployed independently via S3 + CloudFront (separate pipeline)
- Environments (dev/staging/prod) are reproducible and auditable

## Decision

1. **Backend Deployment**: K3s + Helm is the standard target. All backend deploy pipelines assume a K3s cluster.
2. **Frontend Deployment**: React SPA deployed independently to AWS S3 + CloudFront. Frontend is **NOT** part of Kubernetes Helm charts.
3. **Helm is the standard backend installer.** Helm installs:
   - YACC backend application chart
   - Supporting dependencies (PostgreSQL, Redis, etc.)
4. **Dependency policy (MVP default):** Platform dependencies are installed via Helm into the cluster unless explicitly documented as managed external services.
5. **Artifacts:** Build artifacts remain container images; backend deployment uses `helm upgrade --install`.

## Consequences

### Pros

- Repeatable deployments with versioned manifests and values
- Easier promotion (staging -> prod) via Helm values
- Enables horizontal scaling and standardized ops practices

### Cons / Risks

- Additional operational complexity vs single Docker host
- Requires cluster lifecycle management (ingress, certs, storage)
- Helm chart discipline required (no ad-hoc kubectl changes)

## Frontend Deployment Rationale (Product Owner - 2026-02-23)

Frontend deployment is explicitly **out of Helm scope** for these reasons:

- **Deployment Independence**: Frontend and backend have independent lifecycle/cadence; no shared downtime
- **Cost & Performance**: AWS S3 + CloudFront optimized for static assets (CDN native, global distribution)
- **Operational Simplicity**: Kubernetes pods unnecessary for serving static SPA; reduces operational burden
- **MVP Scope**: AGENTS.md establishes S3/CloudFront model; no need to unify at this stage

This decision is fixed for MVP. Post-MVP multi-region deployments may revisit unified Helm-based frontend delivery.

## Guardrails

- No secrets in repo: use Kubernetes Secrets sealed/externalized per environment
- Helm charts must be idempotent and support rollback
- Postgres/Redis values must be explicitly documented (storage, resource requests/limits)
- Backend Helm chart scope is explicit: backend service + PostgreSQL + Redis only (no frontend)

## Approval

**Architect Approval:**
- Name: Enterprise/Solution Architect
- Date: 2026-02-20
- Status: ✅ APPROVED

**Product Owner Approval:**
- Name: Product Owner (YACC Project)
- Date: 2026-02-24
- Status: ✅ APPROVED
- Comments: Frontend deployment explicitly out of K3s/Helm scope (S3/CloudFront independent). Backend-only scope confirmed. Smoke deploy criteria + documentation scope detailed in GOV-032. Conditional on ADR-020 (Secret Management) resolution by Infrastructure Team.
