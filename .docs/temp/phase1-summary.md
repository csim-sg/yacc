# Phase 1 Summary

Date: January 18, 2026
Status: Active planning, scope rescope applied

## Scope Summary (Phase 1)
- Core backend: auth, RBAC, inbox APIs, messaging endpoints, audit logging, password reset
- Frontend: login + forgot/reset, inbox list + basic conversation view
- Real-time: WebSocket gateway (end of Phase 1) + message retry queue (end of Phase 1)
- IRC integration: basic connector setup, inbound message ingest, and messaging endpoints
- Explicitly deferred: Telegram integration remains Phase 2

## Key Decisions
- Auth is JWT-only via BetterAuth bearer plugin
- Access token TTL and refresh token TTL come from env vars:
  - ACCESS_TOKEN_TTL_SECONDS (48 hours)
  - REFRESH_TOKEN_TTL_SECONDS (30 days)
- Refresh token stored in HttpOnly cookie with single-use rotation
- Audit logging stays in Phase 1 for conversation actions only
- Password reset in Phase 1 uses console email transport

## Current Status
- Backend Phase 1 core was previously reported complete in earlier docs, but rescope adds WebSocket + retry queue at Phase 1 end
- Frontend integration has not started under the rescope
- Documentation needs rescope update to reflect JWT-only auth and Phase 1 WebSocket + retry

## Blockers
- Wire auth and conversation routes into backend app entry (if not already done)
- Apply missing RBAC checks on status and priority endpoints
- Confirm refresh token rotation and cookie settings in backend and frontend

## Scope Notes
- WebSocket events focus on conversation updates, message status, notifications, presence
- Retry queue uses Redis + BullMQ with backoff (1m, 5m, 30m) and DLQ
- IRC connector is included in Phase 1; Telegram remains Phase 2 and is not part of Phase 1 deliverables
- IRC messaging endpoints include send, retry, and raw payload access
- No token blacklist on logout in Phase 1; rely on token TTL

## References
- PHASE1_HANDOFF_SUMMARY.md
- PHASE1_DECISION_MEMO.md
- PHASE1_IMPLEMENTATION_CHECKLIST.md
- PHASE1_BLOCKERS_AND_DECISIONS.md
