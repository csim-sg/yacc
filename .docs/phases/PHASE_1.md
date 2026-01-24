# Phase 1 - Telegram + IRC MVP

**Scope Source of Truth:** This document is the authoritative Phase 1 reference. It summarizes scope, deliverables, acceptance, and constraints for Phase 1 execution.

**Governance:** ADR-003, GOV-006, GOV-007

---

## 1. Scope

**In scope (Phase 1):**
- Telegram + IRC integrations (inbound/outbound messaging)
- Unified inbox with filters, search, and status lifecycle (open/pending/resolved)
- Authentication & RBAC (Super Admin/Admin/Manager/User)
- Messaging lifecycle (pending → sent/failed), retry queue (1m/5m/30m, 3 attempts), DLQ
- Real-time updates via WebSocket events
- Collaboration: tags, notes, assignments
- Audit logging (action log retention per Phase 1 requirements)
- Storage: attachments + raw payloads via Cloudflare R2

**Out of scope (Phase 2+):**
- Platforms: WhatsApp, WeChat, Meta (FB/Instagram), X/Twitter
- Email notifications
- Multi-tenant support / credential vault
- Advanced analytics/reporting

**Enum policy:** channel enums include future channels (email, slack, whatsapp, wechat, meta, x) for forward compatibility. Phase 1 UI filters must only show Telegram + IRC.

---

## 2. Deliverables

- Backend APIs for auth, conversations, messages, tags, notes, assignments, audit logs
- PostgreSQL schema + migrations
- Redis + BullMQ retry queue
- Cloudflare R2 storage for attachments/raw payloads
- Telegram + IRC connectors with status endpoints
- Frontend: login, inbox, conversation detail, reply composer, role-based UI
- WebSocket client for real-time updates

---

## 3. Acceptance Criteria

- Telegram + IRC messages appear in inbox; outbound replies delivered
- Inbox filters/search operational
- Message status tracking + retry/DLQ behavior verified
- RBAC enforced for all protected endpoints
- WebSocket events update UI state
- Audit logs recorded for all key actions
- Storage constraints enforced (attachments <= 5 MB; raw payload retention 7 days)

---

## 4. Timeline (High-Level)

- **Duration:** 2 weeks
- **Week 1:** Auth/RBAC, data model, inbox APIs, Telegram + IRC ingestion, UI skeleton
- **Week 2:** Messaging send/retry, real-time updates, integration testing, audit logging

---

## 5. References

- `.docs/SOW.md`
- `.docs/PHASE1_TODO.md`
- `.docs/01-product-specification.md`
- `.docs/02-api-and-data-model.md`
- `.docs/03-implementation-guide.md`
- `.docs/04-qa-and-testing.md`
- `.docs/05-quick-reference.md`
