# BE-206: Socket-Controllers Migration Plan

**Date**: February 6, 2026  
**Status**: 🚀 IN PROGRESS  
**Feature Branch**: `feature/BE-206-socket-controllers-migration`  
**Target Completion**: February 13, 2026

---

## Overview

Migrate Socket.io WebSocket implementation from manual event handlers to **socket-controllers** - a TypeStack framework for declarative socket event handling with decorators.

### Benefits
- ✅ **Declarative API**: Use `@SocketController` decorators instead of manual event registration
- ✅ **Type Safety**: Full TypeScript support with automatic type inference
- ✅ **Middleware Support**: Integrates with Express/routing-controllers middleware pattern
- ✅ **Consistency**: Aligns with routing-controllers patterns used for REST API
- ✅ **Maintainability**: Cleaner code structure, easier to test and debug
- ✅ **Auto-Discovery**: Controllers auto-registered, no manual wiring needed

---

## Current Implementation (To Be Replaced)

### Socket.io Manual Setup
```typescript
// Current: src/websockets/websocket.server.ts
this.io.on('connection', (socket) => {
  socket.on('subscribe', (data) => { ... });
  socket.on('unsubscribe', (data) => { ... });
  socket.on('disconnect', () => { ... });
});
```

### Manual Handler Registry
```typescript
// Current: src/services/websocket/handler-registry.ts
const eventHandlers = {
  'conversation.updated': handleConversationUpdated,
  'message.sent': handleMessageSent,
  // ... manual mapping
};
```

---

## New Implementation (Socket-Controllers)

### Declarative Socket Controllers
```typescript
// New: src/socketcontrollers/conversation.socket-controller.ts
@SocketController()
export class ConversationSocketController {
  @OnConnect()
  onConnect(socket: Socket): void { ... }
  
  @OnDisconnect()
  onDisconnect(socket: Socket): void { ... }
  
  @OnMessage('subscribe.conversation')
  async onSubscribeToConversation(socket: Socket, data: any): Promise<void> { ... }
}
```

### Server Setup (Simplified)
```typescript
// Updated: src/index.ts
import { useSocketServer } from 'socket-controllers';
import { ConversationSocketController } from './socketcontrollers/conversation.socket-controller';

useSocketServer(io, {
  controllers: [
    ConversationSocketController,
    MessageSocketController,
    TypingSocketController,
    PresenceSocketController,
    ReactionSocketController,
  ],
  middlewares: [webSocketAuthMiddleware],
});
```

---

## Migration Steps

### Phase 1: Setup & Infrastructure ✅ (In Progress)

- [x] Install socket-controllers dependency
- [x] Create socketcontrollers directory
- [x] Create base socket controller template
- [ ] Update WebSocket server initialization in index.ts
- [ ] Migrate auth middleware to socket-controllers format

### Phase 2: Event Controllers (This Week)

- [ ] **ConversationSocketController** (conversation events)
  - onConnect, onDisconnect (lifecycle)
  - onSubscribeToConversation, onUnsubscribeFromConversation (room management)
  - onConversationUpdated (event emission)

- [ ] **MessageSocketController** (message events)
  - onMessageSent (message delivery success)
  - onMessageFailed (message delivery failure)
  - onMessageRetry (retry request)

- [ ] **TypingSocketController** (typing indicators)
  - onTypingStarted
  - onTypingStopped

- [ ] **PresenceSocketController** (user presence)
  - onPresenceUpdated
  - onUserOnline, onUserOffline

- [ ] **ReactionSocketController** (message reactions)
  - onReactionAdded
  - onReactionRemoved

### Phase 3: Integration & Testing

- [ ] Update WebSocketGateway to work with socket-controllers
- [ ] Update event emission from services to use new architecture
- [ ] Migrate all event handlers to decorated methods
- [ ] Write/update unit tests for socket controllers
- [ ] Write/update integration tests for WebSocket flows
- [ ] Run regression tests (existing WebSocket tests)

### Phase 4: Cleanup & Documentation

- [ ] Remove old handler registry (src/services/websocket/handler-registry.ts)
- [ ] Remove old event handler files
- [ ] Update WebSocket documentation
- [ ] Update API contract documentation
- [ ] Create socket-controllers usage guide
- [ ] Verify no regressions in dev environment

---

## Architecture Alignment

### Before Migration

```
packages/backend/src/
├── websockets/
│   ├── websocket.server.ts ❌ Manual socket.on() setup
│   ├── auth.middleware.ts
│   └── wsConstants.ts
├── services/
│   └── websocket/
│       ├── handler-registry.ts ❌ Manual event mapping
│       ├── conversation.handler.ts
│       ├── message.handler.ts
│       ├── typing.handler.ts
│       ├── presence.handler.ts
│       └── reaction.handler.ts
└── index.ts (WebSocket initialization)
```

### After Migration

```
packages/backend/src/
├── socketcontrollers/ ✅ NEW
│   ├── conversation.socket-controller.ts
│   ├── message.socket-controller.ts
│   ├── typing.socket-controller.ts
│   ├── presence.socket-controller.ts
│   ├── reaction.socket-controller.ts
│   └── auth.socket-middleware.ts
├── websockets/
│   ├── websocket.server.ts (simplified - no manual event handlers)
│   └── wsConstants.ts
├── services/
│   └── websocket/
│       └── websocket-gateway.ts (updated for socket-controllers)
└── index.ts (uses useSocketServer)
```

---

## Code Patterns

### Socket Controller Pattern

```typescript
import { SocketController, OnConnect, OnDisconnect, OnMessage } from 'socket-controllers';
import type { Socket } from 'socket.io';

@SocketController()
export class ExampleSocketController {
  // Lifecycle Events
  @OnConnect()
  onConnect(socket: Socket): void {
    logger.debug('Client connected', { socketId: socket.id });
  }

  @OnDisconnect()
  onDisconnect(socket: Socket): void {
    logger.debug('Client disconnected', { socketId: socket.id });
  }

  // Message Events
  @OnMessage('event.name')
  async onEventName(socket: Socket, payload: EventPayload): Promise<void> {
    // Handle event
    socket.emit('event.response', { result: 'success' });
  }

  // Broadcast to room
  @OnMessage('broadcast.to.room')
  async onBroadcastToRoom(socket: Socket, data: any): Promise<void> {
    const room = `room:${data.roomId}`;
    socket.to(room).emit('event.broadcasted', data);
  }
}
```

### Auth Middleware Pattern

```typescript
import { UseSocketMiddleware } from 'socket-controllers';
import type { Socket } from 'socket.io';

@UseSocketMiddleware()
export class WebSocketAuthMiddleware {
  use(socket: Socket, next: (err?: any) => void): void {
    // Validate auth token
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Auth token required'));
    }
    // Attach user to socket
    socket.userId = validateToken(token);
    next();
  }
}
```

### Event Emission Pattern (Gateway)

```typescript
import { getSocketServer } from 'socket-controllers';

export async function emitToRoom(
  roomId: string,
  event: string,
  payload: any
): Promise<void> {
  const io = getSocketServer();
  io.to(`room:${roomId}`).emit(event, payload);
}
```

---

## Testing Strategy

### Unit Tests
- Test each socket controller independently
- Mock Socket instance
- Test event handlers, lifecycle, room management

### Integration Tests
- Test complete WebSocket flows
- Test multi-user scenarios
- Test message broadcasting

### Regression Tests
- Run existing WebSocket test suite
- Verify all existing events still work
- Test client reconnection scenarios

---

## Backwards Compatibility

### Client Impact
- ✅ **NO client changes required** - Event names and payloads remain identical
- ✅ **Seamless upgrade** - Clients don't need to update

### Server Impact
- ✅ **No REST API changes** - Only WebSocket implementation changes
- ✅ **Existing integrations unaffected** - Telegram, IRC connectors work as-is

---

## Rollback Plan

If issues arise during migration:
1. Keep old handler registry in place until full migration complete
2. Maintain git commits for easy rollback
3. Test thoroughly in dev before merging to main
4. Have git tag marking pre-migration state

---

## Timeline

| Phase | Task | Duration | Target |
|-------|------|----------|--------|
| 1 | Setup & Infrastructure | 2 hours | Feb 6 |
| 2 | Event Controllers (5 controllers) | 8 hours | Feb 9-10 |
| 3 | Integration & Testing | 6 hours | Feb 11-12 |
| 4 | Cleanup & Documentation | 2 hours | Feb 13 |
| **Total** | | **18 hours** | **Feb 13** |

---

## Success Criteria

✅ **Functional**
- All WebSocket events working (conversation, message, typing, presence, reaction)
- Real-time updates flowing correctly
- Client-server communication seamless

✅ **Quality**
- All tests passing (unit, integration, regression)
- Zero TypeScript errors
- Code follows architecture standards

✅ **Documentation**
- Socket-controllers usage guide created
- API contract updated with new patterns
- Migration summary documented

✅ **No Regressions**
- Existing WebSocket features work identically
- No client-side changes needed
- Performance metrics unchanged

---

## Next Steps (Immediate)

1. ✅ Install socket-controllers
2. ✅ Create conversation socket controller
3. **Next**: Create remaining event controllers (message, typing, presence, reaction)
4. **Then**: Update WebSocket server initialization
5. **Then**: Migrate auth middleware
6. **Finally**: Integration testing and cleanup

---

## Related Issues & PRs

- **Related to**: Phase 1.5 real-time updates
- **Related to**: GOV-005 WebSocket client requirements
- **Blocks**: None currently
- **Blocked by**: None currently

---

## References

- **socket-controllers Docs**: https://github.com/typestack/socket-controllers
- **routing-controllers Docs**: https://github.com/typestack/routing-controllers (similar patterns)
- **WebSocket Types**: `.docs/02-api-and-data-model.md` (WebSocket events section)
- **Current Implementation**: `src/websockets/`, `src/services/websocket/`

---

## Notes

- Socket-controllers is maintained by TypeStack (same team as routing-controllers)
- API is very similar to routing-controllers, making migration natural
- Full TypeScript support with zero runtime overhead
- No breaking changes to client API - only server-side implementation change

---

**Status**: Ready for Phase 2 (Event Controllers Implementation)

