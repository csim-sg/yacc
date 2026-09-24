# ADR-023: Contract Source of Truth — OpenAPI 3.1 + AsyncAPI/JSON Schema

**Status:** Accepted
**Date:** 2026-09-24
**Owner:** Tech-lead (technical author), Founder (decision authority)
**Type:** Architecture
**Supersedes:** ADR-020 (Zod schema source of truth)

## Context

ADR-020 made Zod schemas in `@yacc/common` the validation/contract source of truth. The founder-directed Java/Spring backend replacement cannot consume TypeScript Zod schemas, and the frontend is also adapting its auth and real-time layers. With both sides changing, a TypeScript-only contract source guarantees drift.

## Decision

Adopt a language-neutral contract source:

- **REST:** OpenAPI 3.1, generated from Spring controllers via springdoc-openapi, consumed by the frontend via codegen (openapi-typescript).
- **Real-time:** AsyncAPI + JSON Schema for the WebSocket event surface (19 event constants, `{event,data,timestamp}` envelope).

Both Java DTOs and frontend TS types are generated from these sources. Contract tests assert conformance on both sides.

## Alternatives Considered

- **Keep Zod (ADR-020):** rejected — not consumable by Java; forces duplication or a black-box harness with no single source.
- **Black-box contract harness only:** rejected as the enduring source (useful as a verification supplement, not the authoritative contract).
- **OpenAPI only (no AsyncAPI):** rejected — real-time events need an event-contract representation.

## Consequences

- ADR-020 is superseded; `@yacc/common` Zod schemas are removed at decommission (Phase 8).
- Contract generation must be wired into CI before REST/real-time parity work begins.
- Positive: single language-neutral source removes the two-API-client / two-socket-stack drift.

## Standards Alignment

- TOGAF: data architecture (canonical contract).
- AWS Well-Architected: operational excellence (change-controlled contracts).
