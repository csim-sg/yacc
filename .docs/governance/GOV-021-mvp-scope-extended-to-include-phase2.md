# GOV-021: MVP Scope Extended to Include Phase 2 (Collaboration + Rules)

**Date**: 2026-02-11  
**Status**: ✅ Approved  
**Decision Owner**: Architect + Product Owner

---

## Context

The current execution plans and several documents used inconsistent definitions of "Phase 2" (sometimes meaning Week 2 messaging/real-time work, sometimes meaning collaboration/rules, and sometimes meaning additional external platforms).

To unblock development and provide an auditable scope baseline, we need a single MVP definition and phase mapping.

---

## Decision

MVP scope is extended to include **Phase 2: Collaboration + Rules**.

Phase mapping (authoritative for planning):
- **Phase 1 (MVP Core)**: inbox + messaging + retry + WebSocket + Telegram/IRC
- **Phase 2 (MVP Extension)**: tags, notes, assignments, routing rules, notifications, bulk actions, audit query/export
- **Post-MVP**: additional external platforms (WhatsApp, WeChat, Meta, X), email notifications, multi-tenant/vault

Defaults approved to avoid Phase 2 blockers:
- **@mention mapping**: `@username` matches the local-part of `users.email` (before `@`).
- **Audit scope**: audit logs support multiple `entity_type` values and are queryable across entity types.

---

## Consequences

- Phase 2 becomes release-critical for MVP sign-off.
- Documentation must reflect the new MVP boundary and remove phase naming conflicts.
- Any work previously labeled "Phase 2" but actually Week 2 messaging/real-time must be renamed to avoid confusion.

---

## Documentation Updated (traceability)

- `.docs/plans/PHASE-2-EXECUTION-PLAN.md`
- `.docs/plans/PHASE-2-COLLABORATION-RULES-HANDOFF.md`
- `.docs/plans/WEEK-2-MESSAGING-REALTIME-EXECUTION-PLAN.md`
- `.docs/01-product-specification.md`
- `.docs/02-api-and-data-model.md`
- `.docs/03-implementation-guide.md`
- `AGENTS.md`
