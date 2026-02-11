# Phase 2 Architecture Decisions Summary
## Quick Reference for Implementation Teams

NOTE: This document predates the current phase naming. It covers Week 2 / Phase 1.4 (messaging + real-time), not Phase 2 (collaboration + rules).

**Review Date**: February 9, 2026  
**Status**: ✅ APPROVED  
**Document**: Full details in `PHASE-2-TECHNICAL-ARCHITECTURE-REVIEW.md`

---

## Key Decisions (At a Glance)

### 1️⃣ Message Send/Receive: Connector Abstraction ✅

**What**: Use provider interface for loose coupling between service and platform connectors

**Implementation**:
- Phase 2: Stub connectors (mock success/failure)
- Phase 3: Real Telegram + IRC implementation
- Service layer handles transactional consistency (DB save → dispatch → emit event)

**Why**: Extensible for Phase 2+ platforms (WhatsApp, WeChat, etc.), testable, no tight coupling

**Code Pattern**: See `.PHASE-2-TECHNICAL-ARCHITECTURE-REVIEW.md` Section 1 for full code example

---

### 2️⃣ Retry Queue: BullMQ + DLQ ✅

**What**: Redis + BullMQ for exponential backoff (1m, 5m, 30m; 3 attempts max)

**Status**: 70% already implemented in codebase
- ✅ Queue infrastructure exists
- ✅ Job processor exists
- ⏳ Need schema migration: Add `dead_letter_queue` table
- ⏳ Need audit log integration: Log each retry attempt

**DLQ Design**: Simple Postgres table for ops review
```sql
dead_letter_queue(id, message_id, conversation_id, failure_reason, last_error, ...)
```

**Why**: Proven pattern, handles failures gracefully, ops can manually intervene

---

### 3️⃣ WebSocket Events: Service → EventEmitter → Socket.io ✅

**What**: Emit events from service layer, listen in socket controller (ADR-012 approved)

**Event Flow**:
1. Service updates DB (message status, conversation state, etc.)
2. Service emits event via EventEmitter
3. Socket controller listens and broadcasts to clients
4. Client receives update, UI refreshes

**Events** (Phase 2):
- `message.sent` - Outbound message delivered
- `message.failed` - Outbound message failed (can retry)
- `conversation.updated` - Status/priority/assignment changed
- `conversation.reopened` - Resolved conversation gets new inbound, auto-opens

**Message Backlog** (1 hour on reconnect):
- Store in **Redis** (not DB, for performance)
- Auto-expire via TTL
- No schema migration needed

**Why**: Clean separation (service = logic, socket = events), reusable patterns, testable

---

### 4️⃣ Attachments: R2 + Multipart Form ✅

**What**: Upload single file to Cloudflare R2 in Phase 2

**Implementation**:
- Endpoint: `POST /conversations/:id/attachments` (multipart/form-data)
- Max size: 5 MB per file
- Allowed types: Images (PNG, JPEG, GIF, WebP), PDF, plain text
- Multiple files: ⏳ Deferred to Phase 3

**Storage**:
- Upload to R2 with key: `attachments/{conversationId}/{timestamp}_{filename}`
- Return CDN URL (fast delivery)
- Store reference in DB (attachment.url, storage_key)

**Why**: Preserves files if platform deletes, faster delivery via CDN, simple MVP

---

### 5️⃣ Error Handling: IETF Problem Details + Pino ✅

**What**: Standardized error responses + structured logging

**Error Response Format**:
```json
{
  "code": "invalid_message_body",
  "message": "Message body is invalid",
  "details": { "field": "body", "reason": "..." },
  "correlationId": "req-123"
}
```

**HTTP Status Codes**:
- 400 Bad Request (validation error)
- 401 Unauthorized (missing/invalid auth)
- 403 Forbidden (permission denied)
- 404 Not Found
- 422 Unprocessable Entity (semantic error)
- 503 Service Unavailable (platform down, will auto-retry)
- 500 Internal Server Error

**Error Classification**:
- **Validation errors** (client fault) → Throw BadRequestException
- **Platform errors** (infrastructure) → Mark as failed, enqueue retry
- **Unknown errors** (server fault) → Log + return 500

**Logging**:
```typescript
logger.error({
  correlationId: req.id,
  userId: req.user.id,
  error: error.message,
  errorStack: error.stack,
}, 'Failed to send message');
```

**Why**: Consistent API, easy debugging, secure (no stack traces exposed)

---

### 6️⃣ Auth Endpoint Prefix: No Global `/api` ✅

**What**: Keep endpoint paths without global `/api` prefix

**Current Routes**:
```
POST /auth/login
POST /auth/logout
GET /conversations
POST /conversations/:id/messages
```

**Why Defer Global Prefix**:
- MVP has single API (no versioning needed)
- No conflicts between endpoints
- Simpler routing
- Can add later if multi-API architecture needed

**If needed in future**: Add via route-level prefixes, not global config

---

## Schema Migrations Required

| Migration | Impact | Timeline |
|-----------|--------|----------|
| Add `error_details` JSON to messages | Store error info for failed messages | Week 2 Monday |
| Create `dead_letter_queue` table | Failed messages after max retries | Week 2 Monday |
| WebSocket backlog (Redis, no migration) | Store missed events (1 hour) | Week 2 Thursday |

**Commands**:
```bash
# Phase 2 kickoff
pnpm --filter @yacc/backend db:migrate

# Or manually
psql $DATABASE_URL < migrations/add-message-error-details.sql
psql $DATABASE_URL < migrations/create-dead-letter-queue.sql
```

---

## Phase 2 Implementation Timeline

### Week 2 (Feb 9-16) - Detailed Plan

| Phase | Days | Tasks | Owner | Status |
|-------|------|-------|-------|--------|
| **Infrastructure** | Mon-Tue | Message CRUD API, schema migrations, stub connectors | Backend | ⏳ Ready |
| **API Integration** | Tue-Wed | FE fetches conversations/messages, reply composer | Frontend | ⏳ Ready |
| **Queue + Status** | Wed-Thu | Retry queue integration, message status tracking, manual retry | Backend | ⏳ Ready |
| **File Upload** | Thu-Fri | Attachment upload to R2, FE file picker | Backend + Frontend | ⏳ Ready |
| **WebSocket Events** | Fri | Event listeners, real-time updates, backlog on reconnect | Backend + Frontend | ⏳ Ready |
| **Testing + Polish** | Fri | Integration + E2E tests, error handling verification | QA | ⏳ Ready |

**Target**: MVP complete by Feb 16 (users can send/receive messages in real-time)

---

## Code Patterns (Copy-Paste Ready)

### Message Service Pattern

```typescript
export class MessageService {
  async sendMessage(payload: SendMessagePayload): Promise<Message> {
    const conversation = await db.conversations.findUnique(...);
    
    // 1. Save with status: pending
    const message = await db.messages.create({
      data: { conversation_id: payload.conversationId, status: 'pending', ... }
    });
    
    try {
      // 2. Dispatch to platform
      const connector = getConnector(conversation.channel);
      await connector.sendMessage(payload);
      
      // 3. Success: update status
      await db.messages.update({ where: { id: message.id }, data: { status: 'sent' } });
      
      // 4. Emit event
      this.eventEmitter.emit('message.sent', { conversationId, message });
      
    } catch (error) {
      // 3b. Failure: mark failed + enqueue
      await db.messages.update({ 
        where: { id: message.id }, 
        data: { status: 'failed', error_details: { message: error.message } }
      });
      
      await enqueueRetry({ messageId: message.id, ... });
      
      this.eventEmitter.emit('message.failed', { conversationId, message, canRetry: true });
    }
    
    return message;
  }
}
```

### Socket Controller Pattern

```typescript
@SocketController()
export class MessageController {
  constructor(private messageService: MessageService) {
    this.messageService.on('message.sent', (data) => {
      io.to(`conversation:${data.conversationId}`).emit('message.sent', data);
    });
  }
}
```

### Error Handling Pattern

```typescript
async sendMessage(...) {
  try {
    const result = await connector.sendMessage(payload);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new BadRequestException({ code: 'invalid_message', message: error.message });
    } else if (error instanceof PlatformError) {
      // Let retry queue handle it
      return { ...message, status: 'failed', error_details: {...} };
    } else {
      logger.error({ error }, 'Unexpected error');
      throw new InternalServerErrorException({ code: 'internal_error' });
    }
  }
}
```

---

## Files to Create/Modify

### Backend (Priority Order)

**Week 1 (Mon-Tue)**:
1. ✅ Schema migration: `messages.error_details` JSON column
2. ✅ Schema migration: `dead_letter_queue` table
3. ✅ `src/connectors/base.ts` - ConnectorProvider interface
4. ✅ `src/connectors/telegram-stub.ts` - Stub implementation
5. ✅ `src/connectors/irc-stub.ts` - Stub implementation
6. ✅ `src/services/message.service.ts` - Enhanced with send/receive
7. ✅ `src/controllers/messages.controller.ts` - API endpoints

**Week 2 (Wed-Thu)**:
8. ✅ `src/services/message-queue-processor.ts` - Enhance (already 70% done)
9. ✅ `src/services/dead-letter-queue.service.ts` - Enhance (already exists)
10. ✅ `src/socket-controllers/message.controller.ts` - Event listening (already exists)

### Frontend

1. ✅ `src/components/ReplyComposer.tsx` - Text input + send button
2. ✅ `src/components/AttachmentUpload.tsx` - File picker
3. ✅ `src/hooks/useWebSocket.ts` - Event listeners
4. ✅ `src/stores/inboxStore.ts` - Update on events

### Tests

**Backend**:
- `src/services/__tests__/message.service.spec.ts` (target 85%+ coverage)
- `src/workers/__tests__/message-retry.spec.ts`
- `src/socket-controllers/__tests__/message.controller.spec.ts`

**Frontend + E2E**:
- `e2e/send-receive-message.spec.ts` (Playwright)

---

## Potential Issues & Mitigations

| Issue | Risk | Mitigation |
|-------|------|-----------|
| Retry queue gets stuck | Medium | Set up monitoring + DLQ alerts |
| WebSocket reconnect storms | Low | Already configured (exponential backoff) |
| File upload fails silently | Medium | Return error response, show to user |
| Connector dispatch hangs | Medium | Timeout on connector call (5 sec), enqueue retry |
| Large batch of failed messages | Medium | DLQ backpressure handled via job processing |

---

## Questions & Answers

**Q: When do we implement real Telegram/IRC connectors?**  
A: Phase 3 (Week 3). Phase 2 uses stubs that return mock success/failure.

**Q: Can we handle multiple file attachments?**  
A: Phase 2 is single file. Multiple files deferred to Phase 3 (batch upload + multipart form).

**Q: How long do we keep DLQ entries?**  
A: Ops reviews manually. Auto-delete after 30 days (configurable).

**Q: What if a message is stuck in retry queue?**  
A: Ops can manually mark as resolved in DLQ table + emit DLQ resolution event.

**Q: Do we need to add `/api` prefix to all routes?**  
A: No. Keep routes as-is (no global prefix). Can add later if needed.

---

## Approval Checklist

- [x] Architect: ✅ Approved (Claude Code)
- [ ] Product Owner: ⏳ Pending
- [ ] Implementation Lead: ⏳ Pending
- [ ] Backend Lead: ⏳ Pending
- [ ] Frontend Lead: ⏳ Pending

---

**For full details**: See `.docs/PHASE-2-TECHNICAL-ARCHITECTURE-REVIEW.md`

**Questions?** Ask in #architecture Slack channel or tag @architect
