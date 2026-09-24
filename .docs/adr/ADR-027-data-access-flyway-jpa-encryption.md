# ADR-027: Data Access + Migration Tooling (Flyway + Spring Data JPA + Encryption)

**Status:** Accepted
**Date:** 2026-09-24
**Owner:** Tech-lead (technical author), Founder (decision authority)
**Type:** Architecture
**Replaces:** Drizzle/TypeScript data access (no direct ADR superseded)

## Context

Drizzle does not exist on the JVM. The founder fixed a full reset (no legacy data migration). The POC has 20 tables, 11 hand-written Drizzle migrations (duplicate `0005_*` + `0006_*` numbering to resolve), and IRC AES-256-GCM credential encryption.

## Decision

- **Migrations:** Flyway, single clean `V1` baseline re-expressing all 20 tables; resolve duplicate numbering into a monotonic sequence. Enums mapped to Java enums.
- **Data access:** Spring Data JPA (repositories + entities); no raw SQL in services; no query-builder sprawl.
- **Encryption:** `AES/GCM/NoPadding` for new IRC credentials (fresh key/IV from secret); no POC-format replication (full reset).
- **Seed:** deterministic fresh seed, not migrated data.

## Alternatives Considered

- **Liquibase:** rejected — Flyway is the simpler default for greenfield schema re-expression.
- **jOOQ:** rejected as default (see ADR-024); JPA is sufficient.

## Consequences

- Full reset removes credential/session/schema migration work; data phase = schema re-expression + fresh seed + bootstrap identity.
- Duplicate migration files are cleaned up (never carried forward).

## Standards Alignment

- TOGAF: data architecture.
- AWS Well-Architected: security (encryption at rest/in-transit for credentials).
