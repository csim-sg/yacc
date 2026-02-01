# YACC Project - Next Session Quick Start

**Session Date:** January 31, 2026  
**Current Branch:** `task/BE-006-websocket-infrastructure`  
**Work In Progress:** Socket.io Gateway + Message Queue Implementation

---

## 🚀 Your Situation Right Now

### ✅ What's Done
- **Week 1:** 4/4 tasks complete (Auth + Logging + RBAC)
- **Week 2 Phase 1:** 4/4 tasks complete (Frontend auth integration)
- **Week 2 Phase 2:** 2/2 tasks complete (WebSocket real-time + Timeline) - ✅ MERGED!
- **Infrastructure Refactoring:** 70% complete (ready for feature implementation)

### 📊 Progress Meter
- **10/12 core tasks complete** (83%)
- **150+ tests passing** (80%+ coverage)
- **Zero blocking issues** (ready to continue immediately)

### ⏳ What's Blocked
- **BE-006:** WebSocket Infrastructure (30% left to implement)
- **BE-007:** Message Routing (blocked by BE-006 completion)

### 🎯 Your Next Task
Complete BE-006 WebSocket Infrastructure, then start BE-007

---

## ⏱️ This Session Checklist (30 Minutes)

Follow this sequence to get oriented:

```
□ Read NEXT-SESSION-QUICKSTART.md (this file) - 5 min
□ Read HANDOFF-SUMMARY.md - 10 min
□ Read BE-006-CONTINUATION-PLAN.md (your implementation guide) - 10 min
□ Run: pnpm install - 2 min
□ Run: pnpm test (verify no regressions) - 2 min
□ Check: git status - 1 min
```

**After checklist:** You're ready to continue BE-006 implementation

---

## 🔨 Immediate Tasks (In Order)

### Session 1 (This Session) - 3-4 hours
**Socket.io Gateway Setup:**
1. Create websocket.types.ts (event payload interfaces)
2. Create socket-events.ts (8 event constants)
3. Create websocket-auth.middleware.ts (JWT validation)
4. Create websocket.ts (singleton wrapper)
5. Create socket-gateway.ts (initialization)
6. Wire socket gateway into main.ts
7. Write tests (target 85%+ coverage)

### Session 2 - 2-3 hours
**Event Handlers Implementation:**
1. Create event-handlers/ directory structure
2. Implement 8 event handlers (conversation, message, typing, presence, reaction)
3. Create handler-registry.ts
4. Write tests

### Session 3 - 3-4 hours
**Message Queue Setup:**
1. Create queue infrastructure (BullMQ singleton)
2. Create message queue service
3. Create queue worker (with retry logic)
4. Write tests

### Session 4 - 1-2 hours
**Integration & PR:**
1. Test socket.io + queue together
2. Manual test with frontend
3. Create PR (target: dev branch)

---

## 📚 Key Documents (Bookmark These)

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **HANDOFF-SUMMARY.md** | Complete project status + overview | 10 min |
| **BE-006-CONTINUATION-PLAN.md** | Step-by-step implementation guide | 15 min |
| **.docs/plans/00-INDEX.md** | Overall project tracker | 15 min |
| **.docs/02-api-and-data-model.md** | WebSocket API contract + specs | 20 min |
| **.docs/architecture/ADR-005.md** | Infrastructure pattern (MUST READ) | 10 min |

---

## ✅ Code Standards (Non-Negotiable)

### ❌ Prohibited
- No `any` types (TypeScript strict mode required)
- No barrel exports (`index.ts`)
- No global `@Controller('/api')` prefix
- No layered architecture (domain/, infrastructure/ folders)
- No hardcoded config in code

### ✅ Required
- **Flat folder structure** - `controllers/`, `middleware/`, `services/` at same level
- **One definition per file** - One class, one interface, one service
- **Direct imports only** - No `index.ts` re-exports
- **85%+ test coverage minimum**
- **Config pattern:** const objects with env vars in `config/` folder
- **Infrastructure pattern:** Singletons with initialization logic in `infrastructure/`
- **Routing-controllers patterns:** Middleware via config, never `app.use()`

---

## 🔧 Essential Commands

```bash
# Install dependencies
pnpm install

# Start dev servers (frontend + backend)
pnpm dev

# Run all tests
pnpm test

# Run backend tests only
pnpm --filter @yacc/backend test

# Check TypeScript (MUST PASS)
npx tsc --noEmit

# Check linting (MUST PASS)
pnpm lint

# Check test coverage
pnpm test --coverage

# Docker status (verify services running)
docker-compose ps
```

---

## 🚦 Git Workflow

### Current Status
```bash
git status                        # See current uncommitted work
git log --oneline -5              # See recent commits
git branch                        # Confirm on task/BE-006-websocket-infrastructure
```

### To Commit & Push
```bash
git add packages/backend/...      # Stage your changes
git commit -m "feat: Brief description of what you did"
git push origin task/BE-006-websocket-infrastructure
```

### When Complete (Create PR)
```
1. Go to https://github.com/csim-sg/yacc
2. Create Pull Request: task/BE-006-websocket-infrastructure → dev
3. Request review from: architect + product owner
4. Wait for approval
5. After approval: Squash merge to dev
6. Delete feature branch
```

---

## 🎯 Success Criteria for BE-006

Before creating PR, verify ALL of these:

```
□ Socket.io gateway initializes correctly (no errors on startup)
□ All 8 WebSocket event types implemented
□ Event handlers properly registered
□ Message queue (BullMQ) configured with exponential backoff
□ Retry logic working (1m, 5m, 30m; max 3 attempts)
□ Dead-letter queue captures failed messages after max retries
□ 85%+ test coverage across all new files
□ Zero TypeScript errors (npx tsc --noEmit)
□ All existing tests still pass (150+)
□ Manual test with frontend (FE-005 client) successful
□ Linting passes (pnpm lint)
□ Code follows flat structure + standards
□ No `any` types anywhere
```

**Only create PR when ALL are checked**

---

## ⚠️ Common Gotchas to Avoid

### Socket.io Authentication
- Middleware order matters (auth middleware must run first)
- Don't forget to attach user data to `socket.data`
- Test with invalid/expired tokens

### Namespace Isolation (SECURITY)
- Always validate user can access conversation before broadcasting
- Use `socket.to('conversation:${id}')` for targeting rooms
- Test that user A can't receive messages from conversations they can't access

### Message Queue Persistence
- Redis persists data in Docker (good for dev)
- Verify BullMQ retry backoff is correct (1m, 5m, 30m)
- Test that DLQ receives messages after 3 failed attempts

### Event Payload Structure
- Match FE-005 expectations exactly (check frontend code)
- Include all required fields in payloads
- Validate payloads before processing

### TypeScript Type Safety
- Create proper interfaces for all event payloads in `websocket.types.ts`
- Don't skip type checking
- Run `npx tsc --noEmit` frequently

---

## 🆘 If You Get Stuck

### Socket.io Connection Failing
```
1. Check JWT token in Socket.io handshake (enable debug logs)
2. Verify middleware chain order in gateway
3. Check CORS settings in Socket.io config
4. Test with curl: curl -i http://localhost:3000/
```

### Message Queue Not Working
```
1. Verify Redis running: docker-compose ps
2. Check BullMQ config (host, port, database)
3. Verify queue name matches in client + worker
4. Check Redis logs: docker-compose logs redis
```

### TypeScript Errors
```
1. Run: npx tsc --noEmit (see all errors)
2. Check for missing imports
3. Verify type definitions exist
4. Ask architect if truly stuck
```

### Test Coverage Too Low
```
1. Check test files exist (.spec.ts or __tests__)
2. Verify mocks are set up correctly
3. Test both success AND error scenarios
4. Run: pnpm test --coverage (see gaps)
```

---

## 📋 8 WebSocket Events You'll Implement

1. **conversation.updated** - Conversation info changed
2. **message.sent** - Message delivered successfully
3. **message.failed** - Message delivery failed (will retry)
4. **typing.started** - User typing in conversation
5. **typing.stopped** - User stopped typing
6. **presence.updated** - User online/offline status
7. **reaction.added** - Emoji reaction added to message
8. **reaction.removed** - Emoji reaction removed from message

All events documented in `.docs/02-api-and-data-model.md`

---

## 📖 Timeline Estimate

| Phase | Duration | What |
|-------|----------|------|
| **Session 1** | 3-4h | Socket.io gateway + tests |
| **Session 2** | 2-3h | Event handlers + tests |
| **Session 3** | 3-4h | Message queue + tests |
| **Session 4** | 1-2h | Integration + PR |
| **Total** | 9-13h | BE-006 Complete |

Then: Start BE-007 (Message Routing & Status)

---

## 🎓 Lessons from Phase 2

### What Worked
✅ Frontend and backend developed in parallel (Phase 2a + 2b)  
✅ WebSocket implementation on frontend validated backend API contract  
✅ Testing early caught integration issues  
✅ Code standards enforced from day 1 (no refactoring needed)  

### What to Watch
⚠️ TypeScript strict mode requires discipline (catch errors early)  
⚠️ Synchronize frontend + backend WebSocket events carefully (test both)  
⚠️ Redis/BullMQ queue setup can be tricky (test manually)  
⚠️ Socket.io namespace isolation critical for security  

---

## 🔍 Quick Reference

### Essential Files
```
packages/backend/src/
├── services/websocket/          ← FOCUS AREA (what you'll create)
│   ├── socket-gateway.ts
│   ├── socket-events.ts
│   ├── event-handlers/
│   └── handler-registry.ts
├── services/queue/              ← FOCUS AREA
│   ├── message-queue.ts
│   └── queue-worker.ts
├── api/middleware/
│   └── websocket-auth.middleware.ts ← NEW
├── infrastructure/
│   ├── websocket.ts             ← NEW (singleton)
│   └── queue.ts                 ← NEW (singleton)
└── types/
    └── websocket.types.ts       ← NEW (interfaces)
```

### Documentation Links
- Project status: `.docs/HANDOFF-SUMMARY.md`
- Implementation guide: `.docs/plans/BE-006-CONTINUATION-PLAN.md`
- Project tracker: `.docs/plans/00-INDEX.md`
- API contract: `.docs/02-api-and-data-model.md`
- Infrastructure pattern: `.docs/architecture/ADR-005.md`

### Test Files to Create
```
packages/backend/tests/
├── services/websocket/
│   ├── socket-gateway.spec.ts
│   ├── event-handlers.spec.ts
│   └── socket-events.spec.ts
└── services/queue/
    ├── message-queue.spec.ts
    └── queue-worker.spec.ts
```

---

## 🎉 You're Ready!

### Next Step
Read **`BE-006-CONTINUATION-PLAN.md`** - it has:
- Exactly what to build
- Implementation order
- Code patterns & examples
- Test scenarios
- Definition of done

Then start implementing Phase 1 (Socket.io Gateway - 2-3 hours).

### Questions?
1. Check relevant document first
2. Ask architect if stuck
3. Reference code examples in BE-006-CONTINUATION-PLAN.md

---

**Status:** Ready to start BE-006 Socket.io Implementation  
**Estimated Completion:** 4-5 development days  
**Then:** BE-007 Message Routing + Final QA

Good luck! 🚀
