**Status:** Accepted  
**Date:** 2026-01-22  
**Deciders:** Architecture Team, Development Team  
**Technical Story:** Phase 1 - Schema Alignment

---

# Architecture Decision Record

## Context / Problem Statement
Several non-core tables (`tags`, `conversation_tags`, `routing_rule_executions`, `raw_payloads`) are internal-only and not exposed as primary page views or public API identifiers. Converting them to UUIDs would add migration complexity without external benefit.

## Drivers & Constraints
- Avoid unnecessary schema churn for internal-only entities.
- Preserve existing integer-based identifiers where they do not leak externally.
- Keep the UUID strategy focused on page-view entities.

## Assumptions
- These tables are not exposed as public identifiers in routes.
- References from core UUID tables remain compatible.

## Options Considered
1. Convert all remaining tables to UUIDs.
2. Keep non-core internal tables as integer IDs. ✅

## Decision
Keep `tags`, `conversation_tags`, `routing_rule_executions`, and `raw_payloads` as integer-backed IDs. No UUID migration required for these tables.

## Implications & Consequences
- No changes required to existing integer-backed schemas for these tables.
- API contracts must avoid presenting these IDs as UUIDs.

## Architecture Principle Alignment
- **Configuration Over Customization:** avoid unnecessary schema changes.
- **Lifecycle Ownership:** reduce migration risk in early phases.

## Security / Compliance Impact
- No external exposure of internal identifiers.

## Operational Impact
- Lower migration risk during Phase 1.

## Risks & Mitigations
- **Risk:** mismatch with shared types/docs.  
  **Mitigation:** keep API contracts aligned to integer IDs for these entities.

## Traceability
- BE-002 (schema) and PR #111

## Sign-off
Approved by: Chris Sim (Solution Architect)
