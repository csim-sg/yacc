# 06. Phase 1 Execution Guide (MVP Core)

**Status**: ⏳ Phase 1.4 in progress (see plans index)  
**Authoritative Status**: `.docs/plans/00-INDEX.md`

---

## Purpose

This document is the stable entrypoint for Phase 1 scope and execution references.

Phase 1 delivers the MVP core:
- Auth + RBAC
- Unified inbox (list + detail)
- Messaging (send/receive) + delivery status
- Retry queue (exponential backoff) + DLQ
- Real-time updates (WebSocket)
- MVP integrations: Telegram + IRC

---

## Execution Plans

- Current execution status and active work: `.docs/plans/00-INDEX.md`
- Week 2 (Phase 1.4) plan: `.docs/plans/WEEK-2-MESSAGING-REALTIME-EXECUTION-PLAN.md`
- Phase 1 completion snapshot: `.docs/plans/PHASE-1-COMPLETION-SUMMARY.md`

---

## Acceptance Criteria Source

Phase 1 acceptance criteria are defined in:
- `.docs/01-product-specification.md` (stories 1-5, 4.2 real-time, 15.x retry/status)
- `.docs/02-api-and-data-model.md` (endpoints + WebSocket event shapes)
- `.docs/04-qa-and-testing.md` (test cases and regression expectations)

---

## Notes

- MVP scope is extended to include Phase 2 (collaboration + rules). See `.docs/governance/GOV-021-mvp-scope-extended-to-include-phase2.md`.
