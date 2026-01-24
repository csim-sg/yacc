**Status:** Accepted  
**Date:** 2026-01-24  
**Deciders:** Architecture Team, Development Team  
**Technical Story:** Phase 1 - PR #131 Blocker Fixes

---

# Governance Log

## Decision Summary
Fix PR #131 blockers by correcting retry queue backoff schedule to strict 1m/5m/30m and temporarily restricting channel types to IRC-only for Phase 1 MVP scope. This channel restriction was later superseded by ADR-003 (Telegram + IRC Phase 1).

## Governance Trigger
Blockers #134 and #135 from PR #131 preventing merge of WebSocket client implementation.

## Compliance Assessment
Aligned with architecture principles: Cloud-ready by default, observability is mandatory, reuse before build.

## Impact Assessment

### Retry Queue Changes (#134)
- Removed BullMQ exponential backoff (produces 1m, 2m, 4m, 8m...)
- Implemented strict delay schedule: Attempt 1=60s, Attempt 2=300s, Attempt 3=1800s
- Fixed `removeFromQueue()` to use correct BullMQ API signature
- Enhanced observability with removedCount logging

### Channel Type Changes (#135)
- Restricted `channelTypeEnum` to `['irc']` only for Phase 1 MVP (superseded by ADR-003)
- Removed `telegram`, `email`, `slack` from:
  - Backend schema and migrations
  - Common package types and schemas
  - Frontend types and UI (removed Telegram channel button)
- Updated test expectations accordingly

## Risk Acceptance / Waivers
No waivers required. Retry queue changes remain approved; channel scope was later updated by ADR-003.

## Approved Controls / Conditions

### Retry Queue
- Verify BullMQ job delay calculation matches 1m/5m/30m specification
- Monitor `removeFromQueue()` operation in production
- Ensure retry jobs respect MAX_ATTEMPTS=3 limit

### Channel Types
- Phase 2+ must include ADR approval for adding telegram/email/slack channels
- Database migration required when expanding channel types
- Frontend UI must dynamically support new channels

## Implementation Oversight
- Backend dev implemented retry queue fixes
- Fullstack dev updated channel types across all packages
- Architect to review and approve changes

## Traceability
- Issue #134: BE-013 Retry backoff schedule
- Issue #135: BE-001 Channel type restrictions
- PR #142: fix(blockers): Resolve PR #131 blockers
- ADR-003: Restore Telegram + IRC Phase 1 scope
- Phase 1 MVP scope: IRC-only (superseded by ADR-003)

## Mermaid (Governance Flow)
```mermaid
sequenceDiagram
  participant Dev as Development Team
  participant Arch as Architecture Team
  participant PO as Product Owner
  
  PO->>Arch: PR #131 blockers identified (#134, #135)
  Arch->>Dev: Review blocker requirements
  Dev->>Dev: Fix retry queue (1m/5m/30m)
  Dev->>Dev: Restrict channel types to IRC-only
  Dev->>Arch: Submit changes for review
  Arch-->>Dev: Approve changes (later superseded)
  Dev->>Dev: Create PR #142
  Arch->>Arch: Final review and merge approval
```

## Known Constraints & Limitations
- WebSocket client (#132, #133) not implemented yet, blocked by missing client code
- Governance log for FE-012 (#136) deferred until WebSocket client is ready
- Non-MVP channels (telegram, email, slack) require Phase 2+ ADR approval (superseded by ADR-003 for Phase 1 Telegram)

## Sign-off
Approved by: [Pending Architect Review]
