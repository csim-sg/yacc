# ADR-005-Addendum-2: External Platform Adapters in Infrastructure

**Date:** 2026-02-20  
**Status:** Accepted  
**Parent ADR:** ADR-005 (Simple Infrastructure and Config Pattern)  
**Type:** Architecture Refinement

---

## Context

YACC integrates with external messaging platforms (e.g., IRC, Telegram). We want:

- Fewer file jumps when working on integrations
- A single orchestration point for message exchange (inbound + outbound)
- Platform-specific translation/transformation to remain the adapter/connector responsibility

ADR-005 currently constrains `packages/backend/src/infrastructure/` to client initialization and discourages business logic there. However, adapter code is boundary translation and protocol/SDK interaction, not YACC business workflows.

---

## Decision

### 1) Expand the scope of `infrastructure/` to include external platform adapter code

**Allowed in** `packages/backend/src/infrastructure/`:

- Platform SDK/protocol interaction code (HTTP calls, socket wiring)
- Platform-specific request/response mapping (raw payload -> normalized DTO)
- Input/output sanitization required by the external protocol (e.g., IRC message sanitization)
- Retryable error classification and mapping to YACC error shapes (but not scheduling retries)

**Not allowed in** `packages/backend/src/infrastructure/`:

- Database reads/writes
- Routing rules evaluation
- Audit logging decisions
- WebSocket emission
- Any workflow that mutates YACC state beyond returning normalized DTOs

Those orchestration concerns remain in the gateway service (application/service layer), e.g. `packages/backend/src/services/gateway-exchange.ts`.

### 2) Keep infrastructure flat (no subfolders)

This addendum does not re-introduce nested infra folders. External adapters must live at the same level as other infra files.

**Naming convention (recommended):**

- `packages/backend/src/infrastructure/irc.adapter.ts`
- `packages/backend/src/infrastructure/telegram.adapter.ts`

### 3) Gateway composes adapters; adapters do not compose services

Dependency direction:

- `services/gateway-exchange.ts` -> `infrastructure/<platform>.adapter.ts`
- `infrastructure/<platform>.adapter.ts` may depend on config + low-level libraries/SDKs
- `infrastructure/<platform>.adapter.ts` must not import `services/*`

---

## Consequences

### Pros

- Easier discoverability: external integration boundary code lives in one place
- Clear separation: adapters translate; gateway orchestrates
- Consistent layering: external-specific complexity does not leak into services

### Cons / Risks

- Infrastructure folder becomes broader; requires discipline to keep orchestration out
- Potential confusion between "client" vs "adapter" responsibilities

### Guardrails

- Adapters must be pure translation + SDK/protocol interaction (no DB, WS, audit)
- Gateway is the only place that persists messages/conversations and triggers side effects

---

## Related Documents

- ADR-005: Simple Infrastructure and Config Pattern
- ADR-005-Addendum-1: Flat Infrastructure + DI Pattern

---

## Approval

**Architect Approval:**
- Name: Enterprise/Solution Architect
- Date: 2026-02-20
- Status: ✅ APPROVED

**Product Owner Approval:**
- Name: _________________
- Date: _________________
- Comments: _________________
