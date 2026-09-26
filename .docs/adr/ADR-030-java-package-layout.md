# ADR-030: Java Package Layout + Guardrail Codification (Draft)

**Status:** Proposed
**Date:** 2026-09-26
**Owner:** Tech-lead (technical author), Founder (decision authority)
**Type:** Architecture
**Acceptance:** Scheduled for acceptance in MIG-005 (#339), per MIG-004 (#337) AC-MIG-004-3. This draft records the decision; nothing here is binding until MIG-005 flips it to Accepted.
**Related:** ADR-024 (Java/Spring replacement architecture — parent decision), ADR-023 (contract source), ADR-025..029 (auth, WS, data, async, envelope)

## Context

ADR-024 fixed the Java/Spring replacement at the level of principles (package-by-feature, constructor DI, JPA + Flyway, config-vs-infrastructure). SPEC-002 (TR-01) requires the concrete package layout to be codified **before any Java code exists**, so every later phase (MIG-010 scaffold onward) builds against one architecture contract. The TypeScript guardrails in `AGENTS.md` (flat `src/` folders, one-definition-per-file, index-const exports, config-vs-infra, no-global-prefix, Drizzle-only, Zod validation) do not map to Spring and must be explicitly replaced or marked non-applicable.

## Decision

1. **Single Gradle module, package-by-feature top level** (KISS):
   `auth`, `user`, `conversation`, `message`, `note`, `tag`, `routingrule`, `notification`, `audit`, `dlq`, `queue`, `integration`, `realtime`, `connector`, `config`, `common`.
2. **Each feature package uses exactly four sub-layers:** `controller` (REST/WS entry), `service` (business logic), `repository` (Spring Data JPA persistence), `model` (entities, records/DTOs, enums). No deeper nesting.
3. **Boundary rule:** one bounded context per package; services may depend on another package's *service* API but **never on another package's repository**. Cross-feature workflows compose through services.
4. **Cross-cutting placement:** environment binding via `@ConfigurationProperties` classes colocated in their feature package (platform-wide ones in `config`); singleton infrastructure clients via `@Configuration`+`@Bean` in the owning feature (e.g. `integration` owns the S3/R2 client); shared pure utilities/types in `common`.
5. **Full guardrail set** (DI, typing, REST conventions, raw WS, data, auth, async, observability, deployment, KISS) codified in the companion ARCH document `.docs/architecture/004-java-backend-guardrails.md`, which maps every AGENTS.md TS guardrail to its Java equivalent or explicit N/A.
6. Founder-fixed decisions are codified, not reopened: dual-role OIDC (embedded Spring Authorization Server), raw Spring WebSocket, Quartz + DB DLQ (Redis dropped), full reset, single instance, roll-forward only.

## Alternatives Considered

- **Hexagonal / clean-architecture layering (`domain`/`application`/`infrastructure` rings):** rejected — over-engineered for a single-tenant, single-instance service (ADR-024); violates the SPEC-002 KISS constraint.
- **Layer-first packages (`controllers/`, `services/`, `repositories/` at top level — the TS flat-folder shape transplanted):** rejected — scatters one feature across packages and invites cross-package repository leakage; package-by-feature keeps the bounded context cohesive.
- **Multi-module Gradle build (per-feature Jars):** rejected as default — build complexity with no current need; revisit only via a reviewed ADR-level finding.
- **jOOQ or query-builder data access:** rejected as default (ADR-024/ADR-027); Spring Data JPA is the simplest correct default.

## Consequences

- **Stability:** every MIG-010..091 issue has one authoritative layout to implement against; review can enforce placement mechanically (wrong-layer/wrong-package = blocking finding).
- **Cost:** slight upfront discipline (package declarations, boundary checks) versus the POC's flat folders; no new tooling required.
- **Security:** feature boundaries give auth/audit checks a single seam (controller layer) per context; supports the RBAC/status-enforcement evidence (AC-04/AC-11).
- **Operability:** predictable file locations reduce onboarding cost for the three-developer team (AC-10 handover).

## Standards Alignment

- TOGAF: application architecture (component & boundary model).
- AWS Well-Architected: operational excellence (simplicity, consistency), security (bounded auth surface).
- ISO 27001: support for access-control structure (single controller seam per bounded context).
