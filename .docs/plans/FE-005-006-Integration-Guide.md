# FE-005 & FE-006 Integration Guide

**Purpose:** Define integration points, shared components, data flow, and dependencies between WebSocket/Real-Time (FE-005) and Conversation Timeline (FE-006).

**Date:** 2026-01-26  
**Status:** READY FOR IMPLEMENTATION

---

## Table of Contents

1. [Integration Overview](#1-integration-overview)
2. [Shared Components & Hooks](#2-shared-components--hooks)
3. [Data Flow Between Features](#3-data-flow-between-features)
4. [WebSocket Event Routing](#4-websocket-event-routing)
5. [State Management Integration](#5-state-management-integration)
6. [API Contract Alignment](#6-api-contract-alignment)
7. [Testing Across Features](#7-testing-across-features)
8. [Implementation Sequence](#8-implementation-sequence)

---

## 1. Integration Overview

### 1.1 Feature Dependencies

```
FE-004 (API Integration)
├── Provides: API client, auth, TanStack Query setup
├── Used by: FE-005, FE-006 (both depend on this)
└── Status: ✅ Complete

FE-005 (WebSocket/Real-Time)
├── Provides: Real-time event system, offline queue, reconnection
├── Used by: FE-006 (subscribes to WebSocket events)
├── Status: 🔄 In Progress
├── Blocks: FE-006 full real-time features
└── Fallback: FE-006 can work with polling until FE-005 ready

FE-006 (Timeline & Advanced)
├── Provides: Rich message display, editing, reactions, @mentions
├── Depends on: FE-004 (API), FE-005 (real-time updates)
├── Status: 🎯 Ready to Start (after FE-005-T05)
└── Can start: FE-006-T01 to T06 without FE-005
```

### 1.2 Integration Points

| Point | FE-005 | FE-006 | Description |
|-------|--------|--------|-------------|
| **Real-Time Message Updates** | Emits `message.sent`, `message.failed` | Consumes in Timeline | Message status updates via WebSocket |
| **Conversation Updates** | Emits `conversation.updated` | Consumes in Inbox List | Conversation info changes |
| **Typing Indicators** | Emits `typing.started/stopped` | Displays in Timeline Header | Real-time typing state |
| **Presence Updates** | Emits `presence.updated` | Displays in Timeline | User online/offline state |
| **Reactions** | Emits `reaction.added/removed` | Displays in Timeline | Emoji reactions in real-time |
| **@Mentions** | Emits notification via WebSocket | Mentions in notes create notification | Notification delivery |
| **Offline Queue** | Manages queued messages | Composes messages, shows status | Message send queue during offline |

### 1.3 Data Flow Diagram

```
┌─ Real-Time Events (FE-005) ──────────────────┐
│                                               │
│  Socket.io listeners (all event types)       │
│  └─ conversation.updated                     │
│  └─ message.sent / message.failed            │
│  └─ typing.started / typing.stopped          │
│  └─ presence.updated                         │
│  └─ reaction.added / reaction.removed        │
│  └─ notification.received                    │
│                                               │
└──────────────┬────────────────────────────────┘
               │ Event listeners route to
               ▼
        Zustand Stores (FE-005)
        ├─ websocket.store
        ├─ notifications.store
        ├─ presence.store
        ├─ offlineQueue.store
        └─ conversationCache.store
               │ Update
               ▼
        TanStack Query Cache
        ├─ conversations (list)
        ├─ conversation/:id (detail)
        ├─ messages (timeline)
        └─ notifications
               │ Invalidate
               ▼
        React Components (FE-006)
        ├─ Timeline (renders messages)
        ├─ MessageStatus (delivery state)
        ├─ TypingIndicator (user typing)
        ├─ PresenceIndicator (online state)
        ├─ EmojiReactions (emoji pills)
        ├─ NotificationCenter (notifications)
        └─ ConversationView (overall view)
```

---

## 2. Shared Components & Hooks

### 2.1 Hooks Created by FE-005 (Used by FE-006)

**useWebSocket()**
- **Location:** `packages/frontend/hooks/useWebSocket.ts`
- **Returns:** `{ connected: boolean; connecting: boolean; disconnected: boolean }`
- **Usage in FE-006:** Check connection status in Timeline header
- **Example:**
```typescript
const { connected } = useWebSocket();
return (
  <div>
    {!connected && <ConnectionWarning />}
    <Timeline />
  </div>
);
```

**useWebSocketStatus()**
- **Location:** `packages/frontend/hooks/useWebSocketStatus.ts`
- **Returns:** `{ connected: boolean; lastConnectTime: ISO8601; reconnecting: boolean }`
- **Usage in FE-006:** Show "Reconnecting..." banner in Timeline header
- **Example:**
```typescript
const { reconnecting } = useWebSocketStatus();
return reconnecting && <ReconnectingBanner />;
```

**useTypingUsers(conversationId)**
- **Location:** `packages/frontend/hooks/useTyping.ts`
- **Returns:** `{ typingUsers: User[] }`
- **Usage in FE-006:** Display typing indicators in Timeline header
- **Example:**
```typescript
const { typingUsers } = useTyping(conversationId);
return <TypingIndicator users={typingUsers} />;
```

**useUserPresence(userId)**
- **Location:** `packages/frontend/hooks/usePresence.ts`
- **Returns:** `{ status: 'online' | 'offline' | 'away'; lastSeen?: ISO8601 }`
- **Usage in FE-006:** Show presence dot in Timeline header, user info
- **Example:**
```typescript
const { status } = useUserPresence(userId);
return <PresenceIndicator status={status} />;
```

**useNotifications()**
- **Location:** `packages/frontend/hooks/useNotifications.ts`
- **Returns:** `{ notifications: Notification[]; unreadCount: number }`
- **Usage in FE-006:** Notification bell in header, notification center panel
- **Example:**
```typescript
const { notifications, unreadCount } = useNotifications();
return (
  <div>
    <NotificationBell count={unreadCount} />
    <NotificationCenter notifications={notifications} />
  </div>
);
```

**useOfflineQueue()**
- **Location:** `packages/frontend/hooks/useOfflineQueue.ts`
- **Returns:** `{ queue: Message[]; syncing: boolean; error?: string }`
- **Usage in FE-006:** Show queue status in Composer ("2 messages waiting...")
- **Example:**
```typescript
const { queue, syncing } = useOfflineQueue();
return syncing && <SyncingIndicator messageCount={queue.length} />;
```

### 2.2 Components Created by FE-005 (Reused by FE-006)

**TypingIndicator Component**
- **Location:** `packages/frontend/components/TypingIndicator.tsx`
- **Props:** `users: User[]`
- **Used in FE-006:** Timeline header (show who's typing)
- **Example:**
```typescript
<TypingIndicator users={[{ id: '1', name: 'Alice' }]} />
// Renders: "Alice is typing..."
```

**PresenceIndicator Component**
- **Location:** `packages/frontend/components/PresenceIndicator.tsx`
- **Props:** `userId: string; showStatus?: boolean`
- **Used in FE-006:** Timeline header (user online/offline)
- **Example:**
```typescript
<PresenceIndicator userId={conversationParticipant.id} showStatus />
// Renders: green dot for online, gray for offline
```

**NotificationCenter Component**
- **Location:** `packages/frontend/components/NotificationCenter.tsx`
- **Props:** None (uses hooks internally)
- **Used in FE-006:** Right panel or modal
- **Example:**
```typescript
<NotificationCenter />
```

**ReconnectingUI Component**
- **Location:** `packages/frontend/components/ReconnectingUI.tsx`
- **Props:** None (uses hooks internally)
- **Used in FE-006:** Header banner
- **Example:**
```typescript
<ReconnectingUI /> // Shows "Reconnecting... Attempt 2 of 5"
```

### 2.3 Zustand Stores (FE-005, Consumed by FE-006)

**websocket.store.ts**
```typescript
type WebSocketStore = {
  // State
  connected: boolean;
  connecting: boolean;
  disconnected: boolean;
  lastConnectTime: ISO8601 | null;
  reconnectAttempts: number;
  
  // Actions
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setReconnectAttempts: (attempts: number) => void;
};

// Usage in FE-006:
const { connected } = useWebSocketStore();
```

**notifications.store.ts**
```typescript
type NotificationsStore = {
  // State
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
};

// Usage in FE-006:
const { notifications, unreadCount } = useNotificationsStore();
```

---

## 3. Data Flow Between Features

### 3.1 Real-Time Message Delivery Flow

```
User sends message in FE-006 Composer
  │
  ├─ Optimistic update (FE-006)
  │  └─ Show message in timeline with "sending" status
  │  └─ Update TanStack Query cache locally
  │
  ├─ API call (FE-004)
  │  └─ POST /api/conversations/:id/messages
  │  └─ Backend validates, dispatches to platform
  │
  ├─ Server response
  │  └─ Backend emits WebSocket "message.sent" or "message.failed"
  │
  ├─ WebSocket event (FE-005)
  │  └─ Socket listener receives "message.sent"
  │  └─ Extracts message data + status
  │  └─ Updates Zustand conversationCache store
  │
  ├─ Cache update (FE-005 → FE-006)
  │  └─ TanStack Query cache invalidated
  │  └─ Message status updated to "sent"
  │  └─ UI re-renders timeline
  │
  └─ UI update (FE-006)
     └─ Message status shows checkmark + timestamp
     └─ Conversation last message updated
     └─ Unread count updated
```

### 3.2 Timeline with Real-Time Reactions

```
User reacts with emoji (FE-006)
  │
  ├─ Optimistic update (FE-006)
  │  └─ Show emoji pill immediately
  │  └─ Increment reaction count
  │
  ├─ API call (FE-004)
  │  └─ POST /api/conversations/:id/messages/:id/reactions
  │  └─ Body: { emoji: "👍" }
  │
  ├─ Server response
  │  └─ Backend stores reaction
  │  └─ Emits WebSocket "reaction.added"
  │
  ├─ WebSocket broadcast (FE-005)
  │  └─ Other users receive "reaction.added"
  │  └─ Update Zustand store
  │
  ├─ Cache update (FE-005 → FE-006)
  │  └─ TanStack Query cache updated
  │  └─ Message.reactions field updated
  │  └─ UI re-renders
  │
  └─ UI update (FE-006)
     └─ Emoji pill shows updated count
     └─ Other users see new reaction
```

### 3.3 @Mention Notification Flow

```
User types @alice in note (FE-006)
  │
  ├─ @mention autocomplete (FE-006)
  │  └─ Type @ triggers dropdown
  │  └─ Select "alice" inserts @alice
  │
  ├─ User saves note
  │  └─ POST /api/conversations/:id/notes
  │  └─ Body: { body: "Please handle this @alice" }
  │
  ├─ Backend processing
  │  └─ Parse note body for @mentions
  │  └─ Find user matching "alice"
  │  └─ Create notification record
  │  └─ Emit WebSocket "notification.received"
  │
  ├─ WebSocket event (FE-005)
  │  └─ Socket listener receives "notification.received"
  │  └─ Update notifications store
  │  └─ Increment unread count
  │
  ├─ Cache update (FE-005 → FE-006)
  │  └─ TanStack Query notifications cache updated
  │  └─ Badge count incremented
  │
  └─ UI update (FE-006)
     └─ Notification bell shows red badge
     └─ Notification center shows new notification
```

### 3.4 Offline Queue → Timeline Sync

```
User offline, composes message (FE-005 + FE-006)
  │
  ├─ Message added to offline queue (FE-005)
  │  └─ Zustand offlineQueue store updated
  │  └─ Message persisted to localStorage
  │
  ├─ Timeline shows queue status (FE-006)
  │  └─ Composer shows "1 message waiting..."
  │  └─ Message visible in timeline with "pending sync" status
  │
  ├─ User reconnects (FE-005)
  │  └─ WebSocket connection restored
  │  └─ Queue sync triggered automatically
  │
  ├─ Batch sync API (FE-004)
  │  └─ POST /api/conversations/messages/batch
  │  └─ Body: { messages: [...] }
  │  └─ Server processes each message
  │
  ├─ Server responses
  │  └─ Returns status for each message
  │  └─ Some succeed, some may fail
  │  └─ Emits WebSocket "message.sent" or "message.failed"
  │
  ├─ WebSocket updates (FE-005)
  │  └─ Receive individual "message.sent/failed" events
  │  └─ Update conversationCache store
  │
  ├─ Cache updates (FE-005 → FE-006)
  │  └─ Message status updated in TanStack Query
  │  └─ Timeline re-renders
  │  └─ Offline queue cleared
  │
  └─ UI update (FE-006)
     └─ Timeline shows updated message status
     └─ Queue status disappears
     └─ Conversation marked as synced
```

---

## 4. WebSocket Event Routing

### 4.1 Event Types & Handlers

| Event Type | Source (FE-005) | Listener | Handler Action | FE-006 Impact |
|---|---|---|---|---|
| `conversation.updated` | Server | FE-005 listener | Update cache | Timeline header refreshes |
| `message.sent` | Server | FE-005 listener | Update message status | Status icon updates |
| `message.failed` | Server | FE-005 listener | Mark message failed | Show error + retry button |
| `typing.started` | Server | FE-005 listener | Add to typing users | "User is typing..." appears |
| `typing.stopped` | Server | FE-005 listener | Remove from typing | Indicator disappears |
| `presence.updated` | Server | FE-005 listener | Update user status | Presence dot updates color |
| `notification.received` | Server | FE-005 listener | Add notification | Bell badge increments |
| `reaction.added` | Server | FE-005 listener | Add emoji to message | Emoji pill appears |
| `reaction.removed` | Server | FE-005 listener | Remove emoji | Emoji pill disappears |

### 4.2 Event Processing Pipeline

```
Socket.io Event Received (FE-005)
  │
  ├─ Validate event structure (TypeScript type check)
  │
  ├─ Deduplication check (event ID + timestamp)
  │
  ├─ Route to appropriate handler
  │  │
  │  ├─ conversation.updated
  │  │  └─ Call handleConversationUpdated()
  │  │  └─ Update conversationCache store
  │  │  └─ Invalidate TanStack Query cache
  │  │
  │  ├─ message.sent / message.failed
  │  │  └─ Call handleMessageStatus()
  │  │  └─ Update conversationCache store
  │  │  └─ Invalidate TanStack Query cache
  │  │
  │  ├─ typing.started / typing.stopped
  │  │  └─ Call handleTypingEvent()
  │  │  └─ Update websocket.store (typing state)
  │  │  └─ Set/clear 5-second timeout
  │  │
  │  ├─ presence.updated
  │  │  └─ Call handlePresenceUpdate()
  │  │  └─ Update presence.store
  │  │  └─ No TanStack Query invalidation (store-based)
  │  │
  │  ├─ notification.received
  │  │  └─ Call handleNotificationReceived()
  │  │  └─ Update notifications.store
  │  │  └─ Increment unreadCount
  │  │
  │  ├─ reaction.added / reaction.removed
  │  │  └─ Call handleReactionEvent()
  │  │  └─ Update conversationCache store
  │  │  └─ Invalidate TanStack Query cache
  │  │
  │  └─ Other events
  │     └─ Log warning, skip
  │
  └─ UI Components Listen
     └─ React re-renders on cache/store change
```

---

## 5. State Management Integration

### 5.1 Data Ownership

| Data Type | Owner | Source | FE-006 Access |
|-----------|-------|--------|---|
| Messages | TanStack Query | API + WebSocket | `useQuery` hook |
| Typing Users | Zustand (websocket.store) | WebSocket | `useTyping()` hook |
| User Presence | Zustand (presence.store) | WebSocket | `useUserPresence()` hook |
| Notifications | Zustand + TanStack Query | WebSocket | `useNotifications()` hook |
| Offline Queue | Zustand (offlineQueue.store) | localStorage + API | `useOfflineQueue()` hook |
| Connection Status | Zustand (websocket.store) | Socket.io | `useWebSocketStatus()` hook |
| Conversation Details | TanStack Query | API + WebSocket | `useQuery` hook |

### 5.2 Cache Invalidation Strategy

**When to Invalidate (FE-005 triggers, FE-006 observes):**

```typescript
// Message sent
queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'messages'] });
queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });

// Reaction added
queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'messages'] });

// Note created (system event)
queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'messages'] });

// Assignment changed
queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
queryClient.invalidateQueries({ queryKey: ['conversations'] }); // Inbox list
```

### 5.3 Optimistic Update Pattern (FE-006)

```typescript
// Example: React to message (FE-006 - Timeline)
const addReactionMutation = useMutation({
  mutationFn: (emoji: string) => 
    api.post(`/conversations/${conversationId}/messages/${messageId}/reactions`, { emoji }),
  onMutate: async (emoji) => {
    // Optimistic update
    await queryClient.cancelQueries({ 
      queryKey: ['conversations', conversationId, 'messages'] 
    });
    
    const previousData = queryClient.getQueryData([...]);
    
    queryClient.setQueryData([...], (old) => ({
      ...old,
      reactions: {
        ...old.reactions,
        [emoji]: [...old.reactions[emoji], currentUserId]
      }
    }));
    
    return { previousData };
  },
  onError: (err, emoji, context) => {
    // Rollback on error
    queryClient.setQueryData([...], context.previousData);
  },
  onSuccess: () => {
    // WebSocket will also update cache (FE-005)
    // Deduplication ensures no double-update
  }
});
```

---

## 6. API Contract Alignment

### 6.1 Message Timeline API

**FE-004 provides (used by FE-006):**

```typescript
// Get message timeline (paginated)
GET /api/conversations/:id/messages
Query: { limit?: 50, cursor?: ISO8601 }
Response: {
  data: [
    { id, senderId, senderName, body, status, attachments, reactions, createdAt, ... },
    { type: 'system', action: 'assignment', actor: {...}, metadata: {...}, createdAt }
  ],
  hasMore: boolean,
  nextCursor?: ISO8601
}

// Edit message
PUT /api/conversations/:id/messages/:messageId
Body: { body: string }
Response: { data: { id, body, editedAt, ... } }

// Delete message
DELETE /api/conversations/:id/messages/:messageId
Response: { success: true }

// Search messages
GET /api/conversations/:id/messages/search
Query: { q: string, limit?: 50 }
Response: { data: [...messages...] }
```

**FE-005 enhances (WebSocket):**

```typescript
// Real-time message events
'message.sent': {
  conversationId: string,
  messageId: string,
  status: 'sent',
  sentAt: ISO8601
}

'message.failed': {
  conversationId: string,
  messageId: string,
  status: 'failed',
  error: string,
  canRetry: boolean
}

'reaction.added': {
  conversationId: string,
  messageId: string,
  emoji: string,
  userId: string,
  userName: string
}

'reaction.removed': {
  conversationId: string,
  messageId: string,
  emoji: string,
  userId: string
}
```

### 6.2 Notification API

**FE-004 provides:**

```typescript
// Get notifications
GET /api/notifications
Query: { limit?: 20, page?: 1 }
Response: { data: [{ id, type, conversationId, body, isRead, ... }], ... }

// Mark as read
PUT /api/notifications/:id
Body: { isRead: true }
Response: { success: true }

// Dismiss
DELETE /api/notifications/:id
Response: { success: true }
```

**FE-005 enhances (WebSocket):**

```typescript
'notification.received': {
  notification: { id, type, conversationId, body, ... }
}
```

---

## 7. Testing Across Features

### 7.1 Integration Test Scenarios

**Scenario 1: Real-Time Message Delivery**
```typescript
// Test FE-005 + FE-006 together
test('Message status updates in real-time', async () => {
  // 1. FE-006: Render timeline
  const { getByText } = render(<Timeline conversationId="123" />);
  
  // 2. FE-006: User sends message
  fireEvent.click(getByText('Send'));
  expect(getByText('sending')).toBeInTheDocument();
  
  // 3. FE-005: Mock WebSocket event
  mockSocket.emit('message.sent', {
    conversationId: '123',
    messageId: 'msg-1',
    status: 'sent'
  });
  
  // 4. Wait for cache update
  await waitFor(() => {
    expect(getByText('sent')).toBeInTheDocument();
  });
});
```

**Scenario 2: Offline Queue + Timeline**
```typescript
test('Offline messages sync on reconnect', async () => {
  // 1. Mock offline
  mockSocket.disconnect();
  
  // 2. FE-006: Compose + send
  fireEvent.change(composer, { target: { value: 'Hello' } });
  fireEvent.click(getByText('Send'));
  
  // 3. FE-005: Message queued
  expect(getByText('1 message waiting')).toBeInTheDocument();
  
  // 4. Reconnect
  mockSocket.connect();
  
  // 5. Wait for batch sync
  await waitFor(() => {
    expect(getByText('sent')).toBeInTheDocument();
  });
});
```

**Scenario 3: @Mention + Notification**
```typescript
test('@mention creates notification', async () => {
  // 1. FE-006: Type @alice in note
  fireEvent.change(noteEditor, { target: { value: '@alice' } });
  fireEvent.click(getByText('Save'));
  
  // 2. Backend sends notification WebSocket
  mockSocket.emit('notification.received', {
    notification: { type: 'mention', body: 'You were mentioned' }
  });
  
  // 3. FE-005: Notification added to store
  // 4. FE-006: Notification bell shows badge
  await waitFor(() => {
    expect(getByTestId('notification-badge')).toHaveTextContent('1');
  });
});
```

### 7.2 Mock Setup

**Mock Socket.io for testing:**
```typescript
// packages/frontend/__mocks__/socket.io-client.ts
import { Socket } from 'socket.io-client';

export const mockSocket: Partial<Socket> = {
  on: jest.fn((event, handler) => {
    mockSocket.listeners = mockSocket.listeners || {};
    mockSocket.listeners[event] = handler;
  }),
  emit: jest.fn((event, data) => {
    const handler = mockSocket.listeners?.[event];
    if (handler) handler(data);
  }),
  connect: jest.fn(),
  disconnect: jest.fn(),
};

export default () => mockSocket;
```

---

## 8. Implementation Sequence

### 8.1 Dependency Order

**Phase 1: WebSocket Foundation (FE-005)**
1. ✅ T01: WebSocket client initialization
2. ✅ T02: Zustand WebSocket store
3. ✅ T03: Event listeners & handlers
4. ⏳ T04: Real-time cache updates
5. ⏳ T05: Typing indicators (FE-006-T01 can start here)

**Phase 2: Timeline (FE-006, can start after FE-005-T05)**
1. FE-006-T01: Timeline message display (uses FE-005 cache)
2. FE-006-T02: Message edit/delete (triggers WebSocket events)
3. FE-006-T03: System events (from WebSocket)
4. FE-006-T04: Attachments (independent)
5. FE-006-T05: Unread marker (independent)
6. FE-006-T06: Search (independent)

**Phase 3: Interactions (FE-006, after T01-T06)**
7. FE-006-T07: Emoji reactions (uses WebSocket for real-time)
8. FE-006-T08: @mentions (uses FE-005 notifications)
9. FE-006-T09-T12: Rich text editor (independent)

**Phase 4: Testing (parallel with implementation)**
- FE-005-T19: Unit tests (as T01-T18 complete)
- FE-006-T21: Integration tests (after T01-T18 complete)
- FE-006-T22: E2E tests (final validation)

### 8.2 Risk Mitigation: Start Early Without BE-006

**If backend WebSocket (BE-006) delayed:**

1. **Mock Socket.io server** for local testing
   - Create mock event emitters for all event types
   - Simulate delays + failures for testing

2. **Implement FE-005 T01-T05** independently
   - Write unit tests against mock server
   - Verify logic + error handling

3. **Start FE-006 with polling fallback**
   - FE-006-T01-T06 can work with REST polling
   - Add `usePolling()` hook as interim solution
   - Swap for WebSocket when BE-006 ready

4. **Parallel development**
   - FE-005 + FE-006 develop in parallel
   - Backend integrates when ready
   - Minimal rework required

---

## 9. Checklists

### 9.1 Integration Readiness Checklist

**Before FE-006-T01 starts:**
- [ ] FE-005-T01 complete (WebSocket client)
- [ ] FE-005-T02 complete (Zustand stores)
- [ ] FE-005-T03 complete (Event listeners)
- [ ] FE-005-T04 in progress (Cache updates)
- [ ] Mock Socket.io available for testing
- [ ] All FE-005 hooks exported + typed
- [ ] All FE-005 components built

**Before FE-006 merges to dev:**
- [ ] FE-005-T05 complete (Typing indicators)
- [ ] Real-time message updates working
- [ ] Offline queue integration tested
- [ ] All WebSocket events flowing to UI

**Before merge to main:**
- [ ] Both FE-005 + FE-006 fully implemented
- [ ] BE-006 WebSocket integrated
- [ ] E2E tests passing (real backend)
- [ ] No mock server required
- [ ] Real-time latency <500ms verified

### 9.2 Validation Checklist (FE-005 → FE-006)

**Real-Time Message Updates:**
- [ ] Message appears in timeline (optimistic)
- [ ] Message status updates to "sent" via WebSocket
- [ ] Multiple users see update simultaneously
- [ ] Timeline sort order preserved
- [ ] Conversation last message updated
- [ ] Unread count accurate

**Typing Indicators:**
- [ ] Indicator appears on keystroke
- [ ] Disappears after 5 seconds inactivity
- [ ] Multiple users shown correctly
- [ ] No performance impact
- [ ] Works with real-time message arrivals

**Presence:**
- [ ] Status updates on login/logout
- [ ] Visible in timeline header
- [ ] Updates within 1 second
- [ ] Away status after 15 min inactivity

**Reactions:**
- [ ] Emoji appears immediately (optimistic)
- [ ] Other users see via WebSocket
- [ ] Reaction counts accurate
- [ ] Can add/remove reactions

**Offline Queue:**
- [ ] Messages queue when offline
- [ ] Queue persists localStorage
- [ ] Auto-syncs on reconnect
- [ ] Timeline shows queue status

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-26  
**Status:** READY FOR IMPLEMENTATION

**Next Steps:**
1. Review + approve FE-005 & FE-006 todo lists
2. Set up mock Socket.io for early testing
3. Start FE-005-T01 implementation
4. Begin FE-006 planning after FE-005-T05
5. Run integration tests as features complete
