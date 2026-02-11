# Phase 2 Execution Plan (MVP Extension) - Collaboration + Rules

**Status**: ⏳ READY (execute after Phase 1.4 stabilizes)  
**MVP Definition Update**: MVP includes Phase 1 + Phase 2.

---

## Objective

Deliver the collaboration and automation layer on top of the unified inbox:
- Tags, notes, assignments
- Routing rules (first match wins)
- Notifications (assignment + @mention)
- Bulk actions (best-effort)
- Audit logging coverage + query/export

---

## References (authoritative)

- Product stories + ACs: `.docs/01-product-specification.md`
- API contract + schema: `.docs/02-api-and-data-model.md`
- Phase 2 handoff details: `.docs/plans/PHASE-2-COLLABORATION-RULES-HANDOFF.md`
- Architecture constraints: `AGENTS.md` + ADR-005

---

## Sequencing (KISS)

1) Tags (CRUD + attach/detach)
2) Notes (create/list) + @mention parsing
3) Assignments (assign/reassign) + notification
4) Notifications center endpoints + WS emit
5) Routing rules CRUD
6) Rules evaluation + execution logs
7) Bulk actions (assign/tag/status) + audit
8) Audit query + CSV export (admin UI)

---

## Deliverables Checklist

Backend
- Tags endpoints + audit events
- Notes endpoints + mention notifications + audit
- Assign endpoint + notification + audit
- Notifications endpoints + WebSocket `notification.received`
- Routing rules CRUD + executions query
- Bulk actions endpoint (max 100, best-effort)
- Audit endpoints (query/filter, export)

Frontend
- Conversation right panel (tags, notes, assignment)
- Notification center UI
- Bulk action UX (multi-select, results summary)
- Rules admin UI (super admin)
- Audit log viewer + export (manager+)

QA
- RBAC tests across endpoints
- Mention notification tests (dedup + persistence)
- Rules evaluation tests (priority, first match wins)
- Bulk partial failures + max 100 validation
- Audit coverage assertions (metadata includes old/new, rule execution details)

---

## Definition Of Done

- All Phase 2 stories in `.docs/01-product-specification.md` are testable and pass
- No architecture constraint violations (flat structure, no `any`, no barrel exports)
- Test coverage target met for new code
- Docs updated: `.docs/plans/00-INDEX.md` + any API changes in `.docs/02-api-and-data-model.md`
- Governance entry recorded for any explicit deferrals
