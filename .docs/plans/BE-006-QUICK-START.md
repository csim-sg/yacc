# 🚀 BE-006: WebSocket Infrastructure - Quick Start

**Status:** 🟢 READY TO START IMMEDIATELY  
**Date:** 2026-01-26 (Unblocked by FE-004 merge)  
**Priority:** HIGH (Critical path for Phase 2)  
**Estimated Duration:** 12-14 hours  

---

## Unblocking Details

### What Just Happened
✅ **FE-004 Merged** (PR #158, Commit b5eb3ad)
- API integration layer complete
- Query hooks production-ready
- Error handling comprehensive
- 100% type safe

### What This Unblocks
✅ **BE-006 Can Now Start**
- Has FE-004 API hooks available
- FE-004 error handling patterns in place
- No blocking dependencies remain

### Prerequisites Met
✅ **FE-001** (Auth) - Complete  
✅ **FE-002** (Login UI) - Complete  
✅ **FE-003** (RBAC) - Complete  
✅ **FE-004** (API Layer) - ✅ JUST MERGED  
✅ **BE-003** (BetterAuth) - Complete  
✅ **BE-004** (Forgot Password) - Complete  
✅ **BE-005** (RBAC) - Complete  

---

## Before You Start (1 hour prep)

### 1. Read FE-004 Deliverables (20 min)
📄 **Location:** `packages/frontend/HOOKS_DOCUMENTATION.md`

**Key Sections to Understand:**
- useConversations hook interface
- useMessages hook interface
- useUser hook interface
- Error handling patterns
- Cache invalidation strategy
- Loading/error state management

### 2. Understand WebSocket Requirements (25 min)
📄 **Location:** `.docs/plans/week2-product-owner-review.md` Section 6

**Key Features:**
- Real-time events (8 event types)
- 60-second heartbeat
- 1-hour message backlog on reconnect
- Exponential backoff reconnection
- Graceful disconnection handling

### 3. Review Architecture Patterns (15 min)
📄 **Location:** `.docs/plans/week2-architect-review.md` Section 4

**Key Patterns:**
- WebSocket + REST separation
- Event serialization
- Reconnection strategy
- Error recovery
- Type-safe events (Zod)

---

## Technology Stack Reminder

### Frontend (Already Done in FE-004)
- TanStack Query (caching)
- Zod schemas (validation)
- Fetch API (HTTP)
- Error handlers (centralized)

### Backend (Your Task - BE-006)
- Socket.io (WebSocket library)
- TypeScript (strict mode)
- Zod (schema validation)
- Type augmentation (event types)

### Shared
- 8 event types to define
- Shared Zod schemas
- Common error formats

---

## Task Overview

### What You're Building
A production-grade WebSocket server that:
1. Handles 8 event types (conversation updates, messages, notifications, etc.)
2. Implements heartbeat (every 60 seconds)
3. Stores event backlog (1 hour retention)
4. Auto-reconnects with exponential backoff
5. Handles disconnections gracefully
6. Validates all events with Zod
7. Tracks online/offline status
8. Supports typing indicators

### Deliverables Checklist
- [ ] Socket.io server setup
- [ ] 8 event handlers (emit & receive)
- [ ] Zod schemas for all events
- [ ] Heartbeat mechanism
- [ ] Event backlog storage
- [ ] Reconnection logic
- [ ] Presence tracking
- [ ] Typing indicators
- [ ] 30+ test scenarios
- [ ] Complete documentation

---

## Critical Files to Create

### Backend Core (5 files)
```
packages/backend/src/
├── infrastructure/
│   └── websocket/
│       ├── socket-server.ts         (Socket.io setup)
│       └── event-handlers.ts        (Event handling)
├── services/
│   └── websocket-service.ts         (Business logic)
├── schemas/
│   └── websocket-events.ts          (Zod schemas)
└── types/
    └── websocket.types.ts           (TypeScript types)
```

### Tests (2 files)
```
packages/backend/tests/
├── be-006-websocket-events.spec.ts  (15+ scenarios)
└── be-006-reconnection.spec.ts      (10+ scenarios)
```

### Documentation (1 file)
```
packages/backend/WEBSOCKET_DOCUMENTATION.md (500+ lines)
```

---

## Key Integration Points

### 1. With FE-004 (API Layer)
**What to Expect:**
- `useConversations()` hook available
- `useMessages()` hook available
- Error handlers in place
- Cache invalidation patterns

**How to Integrate:**
- WebSocket events trigger query invalidation
- Example: `conversation_updated` → invalidate conversations cache
- Error events follow FE-004 patterns

### 2. With BE-003 (Auth)
**What to Expect:**
- User sessions already working
- JWT tokens available
- Role-based access configured

**How to Integrate:**
- Validate user on WebSocket connection
- Authorize events based on user role
- Attach user context to socket

### 3. With BE-005 (RBAC)
**What to Expect:**
- Permission decorators available
- Role checking infrastructure in place

**How to Integrate:**
- Use permission checks in event handlers
- Verify user can access conversation before sending updates

---

## Common Pitfalls to Avoid

❌ **DON'T:** Use raw Socket.io events without Zod validation  
✅ **DO:** Define Zod schemas for all event types

❌ **DON'T:** Store backlog indefinitely  
✅ **DO:** Implement 1-hour TTL for stored events

❌ **DON'T:** Reconnect immediately on disconnect  
✅ **DO:** Use exponential backoff (1s → 60s max)

❌ **DON'T:** Mix WebSocket and REST event handling  
✅ **DO:** Keep clear separation (WebSocket for real-time only)

❌ **DON'T:** Forget type safety for events  
✅ **DO:** Use Zod + TypeScript for full type inference

---

## Acceptance Criteria Summary

### Core Features (MUST HAVE)
✅ Socket.io server configured  
✅ 8 event types implemented (emit & receive)  
✅ Zod schemas for validation  
✅ Heartbeat every 60 seconds  
✅ Event backlog (1 hour retention)  
✅ Exponential backoff reconnection  
✅ Presence tracking (online/offline)  
✅ Typing indicators  

### Quality Requirements (MUST HAVE)
✅ 30+ test scenarios  
✅ 95%+ test coverage  
✅ Zero TypeScript errors  
✅ Zero `any` types  
✅ Complete documentation  
✅ Error handling for all paths  
✅ No breaking changes  

### Integration Requirements (MUST HAVE)
✅ Works with FE-004 hooks  
✅ Works with BE-003/BE-005 auth  
✅ Proper error serialization  
✅ Event logging  

---

## Recommended Approach

### Day 1 (8 hours)
1. **Setup Socket.io** (2h)
   - Initialize server
   - Configure CORS
   - Add authentication middleware

2. **Event Schemas** (2h)
   - Define 8 event types
   - Zod validation for each
   - TypeScript type generation

3. **Core Event Handlers** (3h)
   - Emit: conversation_updated
   - Emit: message.sent/failed
   - Emit: notification.received
   - Receive: user acknowledgement

4. **Reconnection Logic** (1h)
   - Exponential backoff
   - Auto-reconnect mechanism

### Day 2 (6 hours)
1. **Advanced Features** (3h)
   - Presence tracking
   - Typing indicators
   - Event backlog retrieval

2. **Testing** (2h)
   - 30+ test scenarios
   - Reconnection tests
   - Error handling tests

3. **Documentation** (1h)
   - Usage guide
   - Event reference
   - Integration examples

---

## Success Metrics

### By End of Task
- ✅ 8 event types fully implemented
- ✅ 30+ test scenarios passing
- ✅ 500+ lines of documentation
- ✅ Zero TypeScript errors
- ✅ 95%+ code coverage
- ✅ Production ready

### Ready for BE-007?
- ✅ Stable WebSocket server
- ✅ Proven event handling
- ✅ Tested reconnection
- ✅ Clean architecture for message routing

---

## Questions? Reference Docs

| Question | Document |
|----------|----------|
| Feature requirements | `.docs/plans/week2-product-owner-review.md` |
| Technical patterns | `.docs/plans/week2-architect-review.md` |
| Timeline details | `.docs/plans/week2-action-plan.md` |
| API contracts | `.docs/02-api-and-data-model.md` |
| FE-004 hooks | `packages/frontend/HOOKS_DOCUMENTATION.md` |

---

**Ready to Start?** Create a feature branch and begin!

```bash
git checkout -b task/BE-006-websocket-infrastructure dev
```

**Good luck! You've got this! 🚀**

---

**Created:** 2026-01-26 (FE-004 merge day)  
**Status:** Ready for immediate start  
**Next Task:** BE-006 WebSocket Infrastructure
