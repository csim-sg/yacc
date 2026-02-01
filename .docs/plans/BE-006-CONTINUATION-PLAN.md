# BE-006: WebSocket Infrastructure - Continuation Plan

**Current Status:** Refactoring phase complete (70% done)  
**Branch:** `task/BE-006-websocket-infrastructure`  
**Last Work:** Infrastructure singleton pattern + middleware fixes  
**Next Phase:** Socket.io gateway + event handlers  
**Estimated Remaining:** 8-10 hours

---

## 📋 What's Been Done

### ✅ Completed in Previous Session

1. **Infrastructure Refactoring** (100% done)
   - Converted old DI pattern to singleton pattern (ADR-005 compliant)
   - Fixed TypeScript errors in infrastructure layer
   - Updated middleware registration (routing-controllers compliant)
   - Cleaned up old config file imports
   - All imports verified and working

2. **Code Organization** (100% done)
   - Flat folder structure verified
   - No type errors remaining
   - All compilation errors resolved
   - Ready for feature implementation

### Commits Completed
- `15b5d4d` - Refactor: Convert to singleton pattern (ADR-005 original)
- `581d919` - Fix: Old config file imports removed
- `b5212ec` - Feat: Fix TypeScript errors in infrastructure
- `d7fd56e` - Refactor: Fix critical files for BE-006
- `e998d5e` - Refactor: Update middleware/controllers for new infrastructure

---

## 🎯 Remaining Work (THIS SESSION)

### Phase 1: Socket.io Gateway Setup (2-3 hours)

**What to Build:**
1. Create `services/websocket/socket-gateway.ts`
   - Initialize Socket.io server
   - Configure namespaces (`/conversations`, `/notifications`)
   - Implement connection middleware for auth
   - Handle connection/disconnection events

2. Create `services/websocket/socket-events.ts`
   - Define 8 event types as constants
   - Map event handlers to event names
   - Create event payload interfaces

3. Create `api/middleware/websocket-auth.middleware.ts`
   - Extract JWT token from Socket.io handshake
   - Validate token
   - Attach user to socket context
   - Reject unauthorized connections

4. Create `infrastructure/websocket.ts` (singleton)
   - Wrap Socket.io server instance
   - Provide methods: emit, broadcast, join, leave
   - Manage room subscriptions

**Expected Files:**
```
packages/backend/src/
├── services/websocket/
│   ├── socket-gateway.ts (initialization)
│   ├── socket-events.ts (event types & constants)
│   └── event-handlers.ts (empty, structure only)
├── api/middleware/
│   └── websocket-auth.middleware.ts (JWT validation)
├── infrastructure/
│   └── websocket.ts (singleton wrapper)
└── types/
    └── websocket.types.ts (event payloads)
```

**Test Scenarios (Write tests as you build):**
- [ ] Socket.io server initializes correctly
- [ ] Valid JWT token allows connection
- [ ] Invalid JWT token rejects connection
- [ ] User attached to socket context
- [ ] Namespaces properly configured
- [ ] Connection event fires
- [ ] Disconnection event fires

---

### Phase 2: WebSocket Event Handlers (3-4 hours)

**8 Event Types to Implement:**

1. **conversation.updated**
   - Emitted when: Conversation status changes, priority changes, assignment changes
   - Payload: { conversationId, updatedFields: {...}, changedBy: userId }
   - Handler: Update TanStack Query cache for conversation detail

2. **message.sent**
   - Emitted when: Message successfully delivered to platform
   - Payload: { messageId, conversationId, status: "sent", sentAt: ISO8601 }
   - Handler: Update message status in timeline

3. **message.failed**
   - Emitted when: Message delivery failed (will retry)
   - Payload: { messageId, conversationId, status: "failed", error: string, retryAt: ISO8601 }
   - Handler: Update message status, show retry option

4. **typing.started**
   - Emitted when: User starts typing in conversation
   - Payload: { conversationId, userId, name: string }
   - Handler: Show typing indicator

5. **typing.stopped**
   - Emitted when: User stops typing (timeout or explicit)
   - Payload: { conversationId, userId }
   - Handler: Hide typing indicator

6. **presence.updated**
   - Emitted when: User comes online/offline
   - Payload: { userId, status: "online" | "offline", lastSeen: ISO8601 }
   - Handler: Update user presence in timeline header

7. **reaction.added**
   - Emitted when: User adds emoji reaction to message
   - Payload: { messageId, conversationId, emoji: string, userId, name: string }
   - Handler: Add reaction to message in timeline

8. **reaction.removed**
   - Emitted when: User removes emoji reaction from message
   - Payload: { messageId, conversationId, emoji: string, userId }
   - Handler: Remove reaction from message in timeline

**Expected Files:**
```
packages/backend/src/services/websocket/
├── event-handlers/
│   ├── conversation.handler.ts
│   ├── message.handler.ts
│   ├── typing.handler.ts
│   ├── presence.handler.ts
│   ├── reaction.handler.ts
│   └── index.ts (export all)
└── handler-registry.ts (register handlers with gateway)
```

**Test Scenarios:**
- [ ] Event payload validates correctly
- [ ] Handler processes event correctly
- [ ] WebSocket broadcasts to correct namespace/room
- [ ] Event reaches subscribed clients
- [ ] Error handling works (invalid payload)

---

### Phase 3: Offline Message Queue Setup (2-3 hours)

**What to Build:**

1. Create `services/queue/message-queue.ts`
   - Initialize BullMQ queue
   - Configure retry strategy (exponential backoff: 1m, 5m, 30m; max 3 attempts)
   - Implement job processing
   - Implement dead-letter queue (DLQ) handling

2. Create `services/queue/queue-worker.ts`
   - Process queued messages
   - Attempt to send to platform (Telegram/IRC)
   - On success: emit `message.sent` event
   - On failure (retry 3x): emit `message.failed` event
   - On final failure: move to DLQ

3. Create `api/controllers/queue.controller.ts` (optional, for ops)
   - `GET /api/admin/queue/status` - Queue stats
   - `GET /api/admin/queue/dlq` - Dead-letter queue messages
   - `POST /api/admin/queue/retry/:id` - Retry failed message

**Expected Files:**
```
packages/backend/src/
├── services/queue/
│   ├── message-queue.ts
│   ├── queue-worker.ts
│   └── queue-config.ts
├── infrastructure/
│   └── queue.ts (BullMQ client singleton)
└── api/controllers/
    └── queue.controller.ts (admin endpoints)
```

**Test Scenarios:**
- [ ] BullMQ queue initializes
- [ ] Message added to queue successfully
- [ ] Job retries on failure (exponential backoff)
- [ ] DLQ captures after max retries
- [ ] Job processing emits WebSocket events
- [ ] Queue status endpoint works
- [ ] Retry endpoint reprocesses failed messages

---

### Phase 4: Comprehensive Testing (1-2 hours)

**Test Coverage Targets:**
- [ ] Socket.io gateway: 85%+
- [ ] Event handlers: 85%+
- [ ] Queue service: 85%+
- [ ] Integration between components: 90%+

**Test Files to Create:**
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

## 📝 Implementation Order (Follow This Sequence)

### Day 1 (2-3 hours): Socket.io Gateway
1. Create `websocket.types.ts` - Event payload interfaces
2. Create `socket-events.ts` - Event constants
3. Create `websocket-auth.middleware.ts` - Auth validation
4. Create `websocket.ts` - Singleton wrapper
5. Create `socket-gateway.ts` - Gateway initialization
6. Wire socket gateway in `main.ts` (or `app.ts`)
7. Write gateway tests
8. **Verify:** No TS errors, tests pass

### Day 2 (2-3 hours): Event Handlers
1. Create event handler files in `event-handlers/` directory
2. Create `handler-registry.ts` - Register all handlers
3. Implement each handler (conversation, message, typing, presence, reaction)
4. Wire handlers in gateway
5. Write handler tests
6. **Verify:** All 8 event types tested

### Day 3 (2-3 hours): Message Queue
1. Create queue infrastructure (`queue.ts` singleton)
2. Create queue configuration
3. Create message queue service
4. Create queue worker
5. Create queue controller (optional)
6. Write queue tests
7. **Verify:** Queue retries working, DLQ receiving failed messages

### Day 4 (1-2 hours): Integration & Final Testing
1. Test socket.io + message queue together
2. Test message flow: User sends → Queue processes → Event emits → Client receives
3. Test offline scenario: Disconnect → Queue retries → Reconnect → Receives events
4. Manual testing with frontend (FE-005 WebSocket client)
5. Verify all tests pass (85%+ coverage)
6. **Verify:** Ready for BE-007

---

## 🔧 Code Patterns & Examples

### Socket.io Gateway Initialization
```typescript
// services/websocket/socket-gateway.ts
import { Server } from "socket.io";
import type { IncomingMessage } from "http";

export class SocketGateway {
  private io: Server;

  constructor(httpServer: IncomingMessage) {
    this.io = new Server(httpServer, {
      cors: { origin: process.env.FRONTEND_URL },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Middleware
    this.io.use(websocketAuthMiddleware);

    // Event listeners
    this.io.on("connection", (socket) => {
      console.log(`User ${socket.data.user.id} connected`);
      socket.emit("connected", { userId: socket.data.user.id });

      socket.on("disconnect", () => {
        console.log(`User ${socket.data.user.id} disconnected`);
      });
    });
  }

  public getIO(): Server {
    return this.io;
  }

  public emit(event: string, data: unknown): void {
    this.io.emit(event, data);
  }

  public broadcast(room: string, event: string, data: unknown): void {
    this.io.to(room).emit(event, data);
  }
}
```

### Event Handler Pattern
```typescript
// services/websocket/event-handlers/message.handler.ts
import type { Socket } from "socket.io";

export async function handleMessageSent(
  socket: Socket,
  data: MessageSentPayload
): Promise<void> {
  // Validate payload
  if (!data.messageId || !data.conversationId) {
    socket.emit("error", { code: "INVALID_PAYLOAD" });
    return;
  }

  // Update database (if needed)
  // const message = await db.messages.update(...);

  // Broadcast to conversation room
  socket.to(`conversation:${data.conversationId}`).emit("message.sent", data);
}
```

### Queue Worker Pattern
```typescript
// services/queue/queue-worker.ts
import { Queue } from "bullmq";

export async function processMessageQueue(queue: Queue): Promise<void> {
  queue.process(async (job) => {
    const { messageId, conversationId, text, channelId } = job.data;

    try {
      // Send message to platform
      const result = await sendToTelegram(channelId, text);

      // Emit success event
      socketGateway.broadcast(
        `conversation:${conversationId}`,
        "message.sent",
        { messageId, status: "sent" }
      );

      return { success: true };
    } catch (error) {
      // Will retry automatically based on queue config
      throw error;
    }
  });

  // Handle failed jobs (moved to DLQ)
  queue.on("failed", (job) => {
    console.error(`Job ${job.id} failed after ${job.attemptsMade} attempts`);
    // Move to DLQ
  });
}
```

---

## ✅ Definition of Done (BE-006 Complete)

Before marking as complete:

- [ ] **Socket.io Gateway**
  - [ ] Proper connection handling (auth, namespaces)
  - [ ] 85%+ test coverage
  - [ ] No TypeScript errors

- [ ] **Event Handlers**
  - [ ] All 8 events implemented
  - [ ] Correct payloads (match API contract)
  - [ ] 85%+ test coverage

- [ ] **Message Queue**
  - [ ] BullMQ configured
  - [ ] Exponential backoff working (1m, 5m, 30m)
  - [ ] DLQ capturing failed messages
  - [ ] 85%+ test coverage

- [ ] **Integration**
  - [ ] Socket.io + Queue working together
  - [ ] Manual test with frontend (FE-005) ✅
  - [ ] Offline scenario tested
  - [ ] Message status flows end-to-end

- [ ] **Documentation**
  - [ ] WebSocket event payloads documented
  - [ ] Queue architecture documented
  - [ ] Integration points mapped

- [ ] **Code Quality**
  - [ ] No `any` types
  - [ ] Flat structure maintained
  - [ ] All tests passing
  - [ ] Linting passes

---

## 🚨 Known Issues & Workarounds

### Issue: TypeScript Build Errors
- **Status:** ⚠️ May reappear during socket.io setup
- **Solution:** Run `npx tsc --noEmit` frequently
- **Workaround:** Use `// @ts-expect-error` only if approved by architect

### Issue: Socket.io Namespace Isolation
- **Status:** ⚠️ Important for security
- **Solution:** Always validate user can access conversation before broadcasting
- **Test:** Verify user can't receive messages from conversations they don't have access to

### Issue: Message Queue Persistence
- **Status:** ⚠️ Redis data loss on restart (dev only)
- **Solution:** Use Redis persistence in Docker (already configured)
- **Test:** Stop/start Docker, verify queue survives

---

## 📞 When You Get Stuck

| Problem | First Check | Who to Ask |
|---------|------------|-----------|
| Socket.io auth failing | Middleware order in gateway | Architect (middleware registration) |
| Events not broadcasting | Room subscription, namespace path | Architect (Socket.io patterns) |
| Queue not retrying | BullMQ config, backoff settings | Architect (queue configuration) |
| TypeScript errors | Check imports, type augmentation | Architect (types) |
| Test coverage low | Check mocking strategy | QA/Architect (testing patterns) |

---

## 🎯 Success Metrics

**When Complete:**
- ✅ 150+ tests passing (all Phase 1 + 2 tests + new BE-006 tests)
- ✅ 85%+ code coverage overall
- ✅ Zero TypeScript errors
- ✅ All linting passes
- ✅ Manual test with FE-005 successful
- ✅ PR approved by architect + product owner
- ✅ Ready to start BE-007

---

**Current Date:** January 31, 2026  
**Estimated Completion:** February 4, 2026 (4-5 days)  
**Status:** Ready to continue Phase 1 implementation
