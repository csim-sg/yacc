# 001 Technology Architecture

**Last Updated**: 2026-02-14  
**Lifecycle**: MVP

---

## Purpose
Define the approved technology stack, runtime environments, deployment model, and operational standards for YACC MVP.

## Technology Standards (MVP)
### Runtime & Frameworks
- Backend: Node.js 18+, Express, routing-controllers
- Frontend: React 18, TanStack Start

### Data & Messaging
- Database: PostgreSQL 14+ (FTS for search)
- Cache / Queue: Redis + BullMQ

### Storage
- Object storage: Cloudflare R2 (attachments + raw payloads)

### Real-time
- WebSockets: Socket.io

### Auth
- BetterAuth (email/password, sessions/JWT per implementation)

### Tooling
- Monorepo: pnpm workspaces + Turborepo
- Tests: Vitest (unit/integration), Playwright (E2E)

## Deployment Architecture (MVP)
### Targets
- Frontend: AWS S3 + CloudFront
- Backend: K3s (Kubernetes) cluster

### Delivery / CI/CD
- Deployment target: K3s
- Installer: Helm (application charts + dependencies)
- Reference: ADR-019

### Mermaid – High-Level Deployment
```mermaid
flowchart LR
  U[Users] --> CF[CloudFront]
  CF --> S3[S3 Static Frontend]
  U --> API[Backend API - K3s]
  API --> PG[(PostgreSQL - Helm)]
  API --> R[(Redis - Helm)]
  API --> R2[(Cloudflare R2)]
```

## Observability (MVP)
- Structured logging aligned with ADR-004
- Request correlation where available
- SLO reference: `.docs/observability-slo.md`

## Forbidden / Deferred (Post-MVP)
- Multi-tenant architecture (deferred)
- Secrets vault integration (deferred)

## References
- ADR-004 logging strategy: `.docs/adr/ADR-004-logging-strategy.md`
- ADR-005 config/infrastructure pattern: `.docs/adr/ADR-005-infrastructure-config-pattern.md`
- ADR-019 K3s + Helm CI/CD target: `.docs/adr/ADR-019-k3s-helm-cicd-deployment.md`
