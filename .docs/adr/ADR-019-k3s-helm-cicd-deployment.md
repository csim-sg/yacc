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

- The application (backend and optionally frontend) is deployed via Helm charts
- Platform dependencies are installed via Helm (e.g., PostgreSQL, Redis)
- Environments (dev/staging/prod) are reproducible and auditable

## Decision

1. **CI/CD target is K3s.** All deploy pipelines assume a K3s cluster.
2. **Helm is the standard installer.** Helm installs both:
   - YACC application charts
   - Supporting dependencies (PostgreSQL, Redis, etc.)
3. **Dependency policy (MVP default):** dependencies are installed via Helm into the cluster unless explicitly documented as managed external services.
4. **Artifacts:** build artifacts remain container images; deployment uses `helm upgrade --install`.

## Consequences

### Pros

- Repeatable deployments with versioned manifests and values
- Easier promotion (staging -> prod) via Helm values
- Enables horizontal scaling and standardized ops practices

### Cons / Risks

- Additional operational complexity vs single Docker host
- Requires cluster lifecycle management (ingress, certs, storage)
- Helm chart discipline required (no ad-hoc kubectl changes)

## Guardrails

- No secrets in repo: use Kubernetes Secrets sealed/externalized per environment
- Helm charts must be idempotent and support rollback
- Postgres/Redis values must be explicitly documented (storage, resource requests/limits)

## Approval

**Architect Approval:**
- Name: Enterprise/Solution Architect
- Date: 2026-02-20
- Status: ✅ APPROVED

**Product Owner Approval:**
- Name: _________________
- Date: _________________
- Comments: _________________
