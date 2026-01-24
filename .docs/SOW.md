# Statement of Work (SOW) - Phase 1

**Project:** YACC (Yet Another Chat Client)  
**Phase:** Phase 1 (MVP)  
**Scope:** Telegram + IRC integrations  
**Date:** January 24, 2026

---

## 1. Scope & Objectives

This Statement of Work (SOW) defines the Phase 1 delivery for YACC, a single-tenant unified inbox for team-based social communications. Phase 1 scope includes **Telegram and IRC integrations**, core inbox operations, authentication, routing, real-time updates, and audit logging. The focus is to ship a stable MVP with essential workflows for ingesting inbound messages, replying from a unified UI, and managing conversations with role-based controls.

**In scope (Phase 1):**
- Integrations: Telegram + IRC connectors (inbound/outbound messaging)
- Unified inbox: conversation list, filters, search, and status lifecycle (open/pending/resolved)
- Authentication & RBAC: Super Admin, Admin, Manager, User
- Messaging: send/receive, delivery status (pending/sent/failed), retry queue
- Real-time: WebSocket updates for message status and inbox changes
- Collaboration: tags, notes, assignments
- Audit logging: action log retention per Phase 1 requirements
- Storage: attachments and raw payloads via Cloudflare R2 (per MVP constraints)

**Out of scope (Phase 1 / deferred to Phase 2):**
- Platforms: WhatsApp, WeChat, Meta (FB/Instagram), X/Twitter
- Email notifications
- Multi-tenant support and credential vault
- Advanced analytics and reporting

**Important:** The **channel enum remains forward-compatible**, retaining `email` and `slack` values for future phases, but these are not part of Phase 1 delivery.

---

## 2. Deliverables (Phase 1)

1. **Backend API & Data Layer**
   - REST endpoints for auth, conversations, messages, tags, notes, assignments, audit logs
   - PostgreSQL schema and migrations (channel enums include future channels for forward compatibility)
   - Redis + BullMQ retry queue with 1m/5m/30m backoff
   - Cloudflare R2 integration for attachments and raw payload storage
2. **Integrations**
   - Telegram connector (inbound + outbound)
   - IRC connector (inbound + outbound)
   - Connector health/status endpoints and admin configuration API
3. **Frontend**
   - Login/forgot/reset password flows
   - Inbox list with filters/search
   - Conversation detail view with reply composer
   - Real-time updates (WebSocket client)
   - Role-based UI visibility
4. **Governance & Documentation**
   - ADR-003 and GOV-006 confirming Phase 1 scope
   - Updated product, QA, implementation, and quick reference docs
   - SOW aligned to Telegram + IRC Phase 1 scope

---

## 3. Acceptance Criteria

Phase 1 is accepted when:
- **Telegram + IRC are live in Phase 1**
  - Inbound Telegram and IRC messages appear in the unified inbox
  - Outbound replies from UI are delivered to Telegram/IRC
- **Inbox operations are functional**
  - Filters: channel, status, assignee, tag, priority, date range
  - Search returns relevant conversations/messages
- **Message lifecycle is correct**
  - Status transitions: pending → sent/failed
  - Retry queue uses 1m/5m/30m backoff and 3 attempts max
  - Failed messages appear in DLQ
- **Auth and RBAC operate correctly**
  - Roles enforce permissions per matrix (Super Admin/Admin/Manager/User)
  - Protected endpoints reject unauthorized users
- **Real-time updates**
  - WebSocket events update UI for message status and conversation changes
- **Audit logging**
  - Actions logged with actor, action, entity, and timestamp
- **Governance alignment**
  - Phase 1 scope matches ADR-003/GOV-006 and this SOW

---

## 4. Out of Scope (Phase 2+)

- Platforms: WhatsApp, WeChat, Meta (FB/Instagram), X/Twitter
- Multi-tenant support or credential vault
- Email notifications
- Advanced analytics/reporting

---

## 5. Assumptions & Dependencies

- Single-tenant deployment
- Telegram bot token and IRC credentials available
- PostgreSQL and Redis provisioned
- Cloudflare R2 available for file storage

---

## 6. Risks

- Telegram/IRC connector instability → mitigated by retry queue and monitoring
- Credential availability delays → mitigated by early collection of integration keys
