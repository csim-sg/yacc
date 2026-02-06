# GOV-014: Socket-Controllers Implementation Guide

**Date**: February 6, 2026  
**Status**: ✅ APPROVED FOR IMPLEMENTATION  
**Reference**: ADR-012 (Technology Decision)  
**Task**: BE-206 (Socket-Controllers Migration)  
**PR**: #208  

---

## Overview

This document provides implementation patterns, best practices, and operational guidelines for using socket-controllers in YACC's real-time WebSocket layer.

**Target Audience**: Backend developers implementing WebSocket event handlers

---

## Architecture Overview

### Socket-Controllers Stack

```
Frontend (WebSocket Client)
         ↓
  Socket.io Protocol
         ↓
Express HTTP Server
         ↓
Socket.io Namespace
         ↓
Auth Middleware (webSocketAuthMiddleware)
         ↓
SocketControllers Framework
         ↓
6 Socket Controllers:
  ├─ ConversationController
  ├─ MessageController
  ├─ TypingController
  ├─ PresenceController
  ├─ ReactionController
  └─ ConnectorController
```

### Server Initialization

```typescript
// packages/backend/src/index.ts
import { SocketControllers } from 'socket-controllers';
import { socketControllers } from './socket-controllers';
import { webSocketAuthMiddleware } from './websockets/auth.middleware';

// After Express setup...
const io = new Server(httpServer, {
  cors: { origin: config.frontend.url, credentials: true },
});

// Auth middleware validates every connection
io.use(webSocketAuthMiddleware);

// Initialize socket-controllers
new SocketControllers({
  io,
  controllers: socketControllers,
  container: { get: (Class: any) => new Class() },
});
```

---

## Implementation Patterns

### Pattern 1: Basic Event Handler

**When to Use**: Simple message events with minimal logic

```typescript
import { SocketController, OnMessage } from 'socket-controllers';
import type { Socket } from 'socket.io';
import { logger } from '../infrastructure/logger';

@SocketController()
export class ExampleController {
  @OnMessage('example.event')
  async onExampleEvent(
    socket: Socket,
    payload: ExamplePayload
  ): Promise<void> {
    try {
      logger.debug({
        socketId: socket.id,
        payload,
      }, 'Handling example.event');

      // Process event
      // Emit response
      socket.emit('example.response', { success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        socketId: socket.id,
        error: errorMessage,
      }, 'Failed to handle example.event');
      throw error;
    }
  }
}
```

---

### Pattern 2: Lifecycle Events

**When to Use**: Connection/disconnection handling, resource cleanup

```typescript
import { SocketController, OnConnect, OnDisconnect } from 'socket-controllers';
import type { Socket } from 'socket.io';
import type { AuthenticatedSocket } from '../websockets/auth.middleware';
import { logger } from '../infrastructure/logger';

@SocketController()
export class LifecycleController {
  @OnConnect()
  onConnect(socket: Socket): void {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;

    logger.debug({
      socketId: socket.id,
      userId,
    }, 'Client connected');

    // Join user-specific room
    if (userId) {
      socket.join(`user:${userId}`);
    }
  }

  @OnDisconnect()
  onDisconnect(socket: Socket): void {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;

    logger.debug({
      socketId: socket.id,
      userId,
    }, 'Client disconnected');

    // Broadcast offline status
    if (userId) {
      socket.broadcast.emit('presence.updated', {
        userId,
        status: 'offline',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

---

### Pattern 3: Room Broadcasting

**When to Use**: Sending updates to multiple clients

```typescript
@OnMessage('conversation.updated')
async onConversationUpdated(
  socket: Socket,
  payload: ConversationUpdatedPayload
): Promise<void> {
  const room = `conversation:${payload.conversationId}`;

  try {
    logger.debug({
      conversationId: payload.conversationId,
      room,
      changedBy: payload.changedBy,
    }, 'Broadcasting conversation.updated');

    // Send to all in room except sender
    socket.to(room).emit('conversation.updated', payload);

    // Or send to all including sender:
    // socket.emit('conversation.updated', payload);
    // socket.broadcast.to(room).emit('conversation.updated', payload);
  } catch (error) {
    logger.error({ error }, 'Failed to broadcast');
    throw error;
  }
}
```

---

### Pattern 4: Requesting Data

**When to Use**: Client requests current state/list

```typescript
@OnMessage('request.online.users')
async onRequestOnlineUsers(socket: Socket): Promise<void> {
  try {
    // Get all connected sockets
    const io: Server = (socket.nsp as any).server;
    const sockets = await io.fetchSockets();

    // Extract user IDs
    const onlineUserIds = new Set<string>();
    for (const connectedSocket of sockets) {
      const authSocket = connectedSocket as unknown as AuthenticatedSocket;
      if (authSocket.userId) {
        onlineUserIds.add(authSocket.userId);
      }
    }

    // Send back to requesting client
    socket.emit('online.users', {
      users: Array.from(onlineUserIds),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get online users');
    socket.emit('error', { message: 'Failed to fetch online users' });
  }
}
```

---

### Pattern 5: Acknowledgments

**When to Use**: Client action confirmation

```typescript
@OnMessage('subscribe.conversation')
async onSubscribeToConversation(
  socket: Socket,
  conversationId: string
): Promise<void> {
  try {
    socket.join(`conversation:${conversationId}`);
    logger.debug({
      socketId: socket.id,
      conversationId,
    }, 'Client subscribed');

    // Acknowledge subscription
    socket.emit('conversation.subscribed', { conversationId });
  } catch (error) {
    logger.error({ error }, 'Failed to subscribe');
    socket.emit('error', { message: 'Failed to subscribe' });
  }
}
```

---

## Type Safety Guidelines

### Rule 1: Use AuthenticatedSocket for User Context

```typescript
// ✅ CORRECT
const authSocket = socket as AuthenticatedSocket;
const userId = authSocket.userId;
const userRole = authSocket.role;

// ❌ WRONG
const userId = (socket as any).userId;  // No any!
```

### Rule 2: Type All Event Payloads

```typescript
// ✅ CORRECT
interface ConversationUpdatedPayload {
  conversationId: string;
  status: 'open' | 'pending' | 'resolved';
  changedBy: string;
  timestamp: string;
}

@OnMessage('conversation.updated')
async onConversationUpdated(
  socket: Socket,
  payload: ConversationUpdatedPayload
): Promise<void> { }

// ❌ WRONG
@OnMessage('conversation.updated')
async onConversationUpdated(socket: Socket, payload: any): Promise<void> { }
```

### Rule 3: Handle Type Narrowing for Remote Sockets

```typescript
// ✅ CORRECT
for (const connectedSocket of sockets) {
  const authSocket = connectedSocket as unknown as AuthenticatedSocket;
  const userId = authSocket.userId;
  if (userId && typeof userId === 'string') {
    onlineUserIds.add(userId);
  }
}

// ❌ WRONG
for (const connectedSocket of sockets) {
  const userId = (connectedSocket as any).userId;  // No any!
}
```

---

## Error Handling

### Standard Error Pattern

```typescript
@OnMessage('example.event')
async onExampleEvent(
  socket: Socket,
  payload: ExamplePayload
): Promise<void> {
  try {
    // Validate input
    if (!payload.requiredField) {
      throw new Error('Missing required field: requiredField');
    }

    logger.debug({ payload }, 'Processing event');

    // Process...
    const result = await processEvent(payload);

    // Send response
    socket.emit('example.response', { success: true, data: result });
  } catch (error) {
    // Extract error message
    const errorMessage = error instanceof Error 
      ? error.message 
      : String(error);

    // Log with context
    logger.error({
      socketId: socket.id,
      payload,
      error: errorMessage,
    }, 'Failed to handle example.event');

    // Send generic error to client (don't expose details)
    socket.emit('error', {
      message: 'Failed to process event',
      code: 'PROCESS_ERROR',
    });

    // Rethrow for monitoring
    throw error;
  }
}
```

---

## Logging Standards

### Log Levels

| Level | When | Example |
|-------|------|---------|
| **debug** | Event received, processing started | Socket connected, message sent |
| **info** | Significant state changes | User authentication, room subscription |
| **warn** | Unexpected but recoverable | Auth failure, user inactive |
| **error** | Exception or failure | Crash, unhandled error |

### Log Format

```typescript
// ✅ CORRECT: Structured logging with context
logger.debug({
  socketId: socket.id,
  userId: authSocket.userId,
  conversationId: payload.conversationId,
  eventType: 'subscribe.conversation',
}, 'Client subscribed to conversation');

// ❌ WRONG: String concatenation
logger.debug(`User ${userId} subscribed to conversation ${conversationId}`);
```

---

## SLOs & Observability

### Service Level Objectives (SLOs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Event Latency** | <100ms p99 | Time from receipt to emit/response |
| **Error Rate** | <0.1% | Failed events / total events |
| **Availability** | 99.9% | Uptime of WebSocket server |
| **Connection Success** | 99% | Successful auth + connect / total attempts |

### Metrics to Track

```typescript
// Example metrics collection (future implementation)
const eventMetrics = {
  'conversation.updated': {
    count: 0,
    errors: 0,
    latency_p50: 0,
    latency_p99: 0,
  },
  'message.sent': {
    count: 0,
    errors: 0,
    latency_p50: 0,
    latency_p99: 0,
  },
  // ... all events
};
```

### Logging for Observability

```typescript
// Always include correlation ID
logger.debug({
  correlationId: socket.id,  // Socket ID as unique identifier
  userId: authSocket.userId,
  eventName: 'conversation.updated',
  conversationId: payload.conversationId,
  timestamp: new Date().toISOString(),
}, 'Event processed');
```

---

## Testing Patterns

### Unit Test Pattern

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ConversationController } from '../conversation.controller';
import type { Socket } from 'socket.io';

describe('ConversationController', () => {
  it('should subscribe client to conversation room', async () => {
    // Arrange
    const mockSocket = {
      id: 'socket-123',
      join: vi.fn(),
      emit: vi.fn(),
    } as unknown as Socket;

    const controller = new ConversationController();

    // Act
    await controller.onSubscribeToConversation(mockSocket, 'conv-456');

    // Assert
    expect(mockSocket.join).toHaveBeenCalledWith('conversation:conv-456');
    expect(mockSocket.emit).toHaveBeenCalledWith('conversation.subscribed', {
      conversationId: 'conv-456',
    });
  });
});
```

### Integration Test Pattern

```typescript
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';

describe('WebSocket Integration', () => {
  it('should handle subscription flow', async () => {
    // Setup server
    const httpServer = createServer();
    const io = new Server(httpServer);
    // ... attach socket-controllers

    // Setup client
    const client = ioClient(`http://localhost:3000`, {
      auth: { token: 'test-token' },
    });

    // Test flow
    await client.emit('subscribe.conversation', 'conv-123');
    
    await new Promise((resolve) => {
      client.on('conversation.subscribed', (data) => {
        expect(data.conversationId).toBe('conv-123');
        resolve(true);
      });
    });

    client.close();
    httpServer.close();
  });
});
```

---

## Common Gotchas & Solutions

### Gotcha 1: Mixing `socket.emit` and Broadcasting

```typescript
// ⚠️ These are different!

// Send only to sender
socket.emit('event', data);

// Send to all except sender
socket.broadcast.emit('event', data);

// Send to room except sender
socket.to(room).emit('event', data);

// Send to room including sender
socket.nsp.to(room).emit('event', data);
```

---

### Gotcha 2: Auth Data Not Available Before `@OnConnect`

```typescript
// ❌ WRONG: Auth data not set yet
@OnMessage('any.event')
async onAnyEvent(socket: Socket): Promise<void> {
  const authSocket = socket as AuthenticatedSocket;
  // userId might be undefined if called before onConnect completes
}

// ✅ CORRECT: Auth data is set by middleware before @OnConnect
@OnConnect()
onConnect(socket: Socket): void {
  const authSocket = socket as AuthenticatedSocket;
  // userId is guaranteed to exist (or connection was rejected)
}
```

---

### Gotcha 3: Remote Sockets Have Limited Properties

```typescript
// ❌ WRONG: Remote socket from io.fetchSockets() doesn't have all properties
for (const socket of await io.fetchSockets()) {
  socket.to('room').emit('event', data);  // Won't work
}

// ✅ CORRECT: Use socket.broadcast or io.to(room)
for (const socket of await io.fetchSockets()) {
  // Only read properties (userId, role, etc.)
  const userId = (socket as AuthenticatedSocket).userId;
}

// Or use broadcast APIs
socket.broadcast.emit('event', data);
io.to('room').emit('event', data);
```

---

### Gotcha 4: Error Handling in Async Handlers

```typescript
// ❌ WRONG: Error not caught
@OnMessage('risky.event')
async onRiskyEvent(socket: Socket): Promise<void> {
  const result = await riskyOperation();  // If throws, unhandled
  socket.emit('result', result);
}

// ✅ CORRECT: Catch and handle
@OnMessage('risky.event')
async onRiskyEvent(socket: Socket): Promise<void> {
  try {
    const result = await riskyOperation();
    socket.emit('result', result);
  } catch (error) {
    logger.error({ error }, 'Failed');
    socket.emit('error', { message: 'Operation failed' });
  }
}
```

---

## Deployment & Operations

### Health Check Pattern

```typescript
// Add health check endpoint
@Get('/health/websocket')
async getWebSocketHealth(): Promise<{ status: string; timestamp: string }> {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
  };
}
```

### Graceful Shutdown

```typescript
// In src/index.ts
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Disconnect all WebSocket clients
  io.disconnectSockets();

  // Close server
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
```

### Monitoring

```typescript
// Track active connections
io.on('connection', (socket) => {
  const activeConnections = io.engine.clientsCount;
  logger.info({
    socketId: socket.id,
    activeConnections,
  }, 'Socket connected');
});

io.on('disconnect', (socket) => {
  const activeConnections = io.engine.clientsCount;
  logger.info({
    socketId: socket.id,
    activeConnections,
  }, 'Socket disconnected');
});
```

---

## Adding New Event Handlers

### Step-by-Step Guide

1. **Define Type** in `.docs/02-api-and-data-model.md`:
   ```typescript
   interface NewEventPayload {
     field1: string;
     field2: number;
   }
   ```

2. **Create Controller** in `src/socket-controllers/new-feature.controller.ts`:
   ```typescript
   @SocketController()
   export class NewFeatureController {
     @OnMessage('feature.event')
     async onFeatureEvent(socket: Socket, payload: NewEventPayload): Promise<void> { }
   }
   ```

3. **Register in Index** in `src/socket-controllers/index.ts`:
   ```typescript
   export const socketControllers = [
     // ... existing
     NewFeatureController,  // Add here
   ];
   ```

4. **Write Tests** in `src/socket-controllers/__tests__/new-feature.spec.ts`

5. **Update Docs** in `.docs/03-implementation-guide.md`

---

## Troubleshooting

### Issue: Events Not Received

**Check**:
1. Client sending with correct event name?
2. Event handler has correct `@OnMessage` decorator?
3. Controller registered in `socket-controllers/index.ts`?
4. Auth middleware allowed connection?

### Issue: Type Errors on AuthenticatedSocket

**Check**:
1. Import: `import type { AuthenticatedSocket } from '../websockets/auth.middleware';`
2. Cast: `const authSocket = socket as AuthenticatedSocket;`
3. Run build: `pnpm build` to verify TypeScript

### Issue: Broadcast Not Reaching Some Clients

**Check**:
1. Are clients in the correct room? (Subscribe first)
2. Using correct broadcast method? (`socket.to(room)` vs `io.to(room)`)
3. Sender excluded? (Use `socket.to(room)` to exclude sender)

---

## Quick Reference

### Common Decorators
| Decorator | Use | Example |
|-----------|-----|---------|
| `@SocketController()` | Class marker | `@SocketController() class MyController` |
| `@OnConnect()` | Connection event | `@OnConnect() onConnect(socket) { }` |
| `@OnDisconnect()` | Disconnection event | `@OnDisconnect() onDisconnect(socket) { }` |
| `@OnMessage('name')` | Named event | `@OnMessage('event.name') onEvent(socket, data) { }` |

### Common Methods
| Method | Purpose | Example |
|--------|---------|---------|
| `socket.emit(event, data)` | Send to sender | `socket.emit('response', data)` |
| `socket.broadcast.emit(event, data)` | Send to all except sender | `socket.broadcast.emit('event', data)` |
| `socket.to(room).emit(event, data)` | Send to room except sender | `socket.to('room:1').emit('event', data)` |
| `io.to(room).emit(event, data)` | Send to room including sender | `io.to('room:1').emit('event', data)` |
| `socket.join(room)` | Add to room | `socket.join('room:1')` |
| `socket.leave(room)` | Remove from room | `socket.leave('room:1')` |

---

## References

**Related Documents**:
- ADR-012: Socket-Controllers Adoption (Technology Decision)
- `.docs/02-api-and-data-model.md`: WebSocket Event Contracts
- `.docs/03-implementation-guide.md`: Architecture Overview
- AGENTS.md: Architecture Standards

**External**:
- socket-controllers: https://github.com/typestack/socket-controllers
- Socket.io: https://socket.io/docs/

---

## Document History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-06 | Architect | Initial governance document for BE-206 |

---

**Status**: ✅ **APPROVED FOR USE**

This document provides comprehensive guidance for implementing WebSocket features using socket-controllers. Follow these patterns for consistency and maintainability.

---

**Next Steps**:
1. Review patterns with team
2. Use as reference during BE-206 PR review
3. Update with learnings during Phase 4 testing
