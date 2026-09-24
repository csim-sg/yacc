# ADR-024: Java/Spring Backend Replacement Architecture

**Status:** Accepted
**Date:** 2026-09-24
**Owner:** Tech-lead (technical author), Founder (decision authority)
**Type:** Architecture
**Replaces:** ADR-005 TS guardrails (do not map to Spring)

## Context

The TS guardrails (flat `src/` folders, one-definition-per-file, config-vs-infra, no-global-prefix, Drizzle-only, Zod validation) do not map to Spring. A Java-specific guardrail set is required.

## Decision

- **Package layout (KISS, single module):** package-by-feature at top level (`auth`, `user`, `conversation`, `message`, `note`, `tag`, `routingrule`, `notification`, `audit`, `dlq`, `queue`, `integration`, `realtime`, `connector`, `config`, `common`), each with `controller`/`service`/`repository`/`model` sub-layers. One bounded context per package; no cross-package service→repository leakage.
- **Build/tooling:** Gradle, Spring Boot, Temurin 21.
- **DI:** constructor injection only; no field injection.
- **Typing:** no `Object`/raw casts in domain code; records for DTOs/immutables; `@Valid` bean validation.
- **Config vs infrastructure:** `@ConfigurationProperties` for env binding; `@Configuration` + `@Bean` for singleton clients.
- **REST:** `@RestController`, `/api` at controller `@RequestMapping` level (no global prefix), centralized `@ControllerAdvice`.
- **Data access:** Spring Data JPA + Flyway (no raw SQL in services). See ADR-027.

## Alternatives Considered

- **Hexagonal/clean layers:** rejected — over-engineered for a single-tenant single-instance service; package-by-feature is the KISS target.
- **jOOQ:** rejected as default (later ADR only if justified); Spring Data JPA is the simplest correct default.

## Consequences

- A new ARCH guardrails doc codifies these rules (replaces AGENTS.md TS guardrails for the Java service).
- Review gate applies KISS, separation of concerns, and layer placement as mandatory findings.

## Standards Alignment

- TOGAF: application architecture.
- AWS Well-Architected: operational excellence (simplicity, DI).
