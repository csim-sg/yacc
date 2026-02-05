# FE-005: WebSocket/Real-Time Updates - Comprehensive Todo List

**Status:** 🎯 READY FOR IMPLEMENTATION  
**Created:** 2026-01-26  
**Dependencies:** FE-004 (✅ Complete), BE-006 (Pending)  
**Estimated Duration:** 3-4 weeks (100-140 hours)  
**Team:** Frontend Developer (Primary) + QA (Parallel)

---

## Table of Contents

1. [Product Requirements Breakdown](#1-product-requirements-breakdown)
2. [Technical Specifications](#2-technical-specifications)
3. [Architecture & Design](#3-architecture--design)
4. [Implementation Tasks (20 Items)](#4-implementation-tasks-20-items)
5. [Testing Requirements](#5-testing-requirements)
6. [Documentation Needs](#6-documentation-needs)
7. [Success Criteria](#7-success-criteria)
8. [Timeline & Milestones](#8-timeline--milestones)

---

## 1. Product Requirements Breakdown

### 1.1 User-Facing Features

**Feature: Real-Time Conversation Updates**
- Conversations update in inbox list without page refresh
- Message count updates in real-time
- Status changes (open → pending → resolved) appear instantly
- Assignment changes reflect immediately for all users viewing conversation
- New inbound messages appear at bottom of conversation timeline

**Feature: Message Delivery Status**
- Message shows "sending" state while pending
- Updates to "sent" when platform confirms delivery
- Shows "failed" if delivery fails (with error message)
- Retry button appears for failed messages
- Status updates happen within 100ms of server confirmation

**Feature: Typing Indicators**
- "User is typing..." appears in conversation when another user is composing
- Indicator disappears after 5 seconds of inactivity or when message sent
- Multiple users typing shows "Alice and Bob are typing..."
- Typing indicator visible only to other users, not the typist

**Feature: User Presence**
- Online/offline status visible in conversation header
- Presence updates within 1 second of login/logout
- "Away" status if user inactive for 15+ minutes
- Presence indicator updated in team member list
- WebSocket connection status reflected in UI (connected/disconnected)

**Feature: Conversation Activity Notifications**
- New message from team member highlights conversation
- System events (assignment, tag, note) show as notifications
- Unread message badge updates in real-time
- Notification center shows real-time updates

**Feature: Auto-Reconnect**
- Detects disconnection automatically
- Attempts reconnection with exponential backoff (1s → 60s max, 5 attempts)
- Shows "Reconnecting..." UI during retry
- Syncs missed events on successful reconnect
- User can manually retry connection

**Feature: Offline Queue (Optimistic Updates)**
- Compose box remains enabled during disconnection
- User can type messages while offline
- Messages queue locally (persist to localStorage)
- Queue syncs when connection restored
- Queue shows pending count ("2 messages waiting...")

**Feature: Real-Time Notification Delivery**
- Assignment notifications deliver within 500ms
- @mention notifications in notes trigger within 500ms
- Unread badge updates in real-time
- Notification center shows new items without refresh

### 1.2 Business Acceptance Criteria

**Acceptance Criteria for Real-Time Updates:**
- [ ] Conversation updates appear in inbox <500ms after server emit
- [ ] No polling used (pure event-driven WebSocket)
- [ ] Conversation list maintains sort order after updates
- [ ] Unread count accuracy maintained (no duplicates)
- [ ] Status changes reflected correctly in all open tabs
- [ ] Filter persistence maintained during real-time updates
- [ ] Search results auto-update if matching conversation changes

**Acceptance Criteria for Message Status:**
- [ ] Pending state shows within 100ms of send click
- [ ] Sent state shows within 500ms of platform confirmation
- [ ] Failed state shows within 2 seconds if delivery fails
- [ ] Error message displays specific failure reason
- [ ] Retry button visible and functional for failed messages
- [ ] Status persists across page refresh
- [ ] Failed messages don't block other operations

**Acceptance Criteria for Typing Indicators:**
- [ ] Indicator appears within 500ms of typing start
- [ ] Disappears within 5 seconds of last keystroke
- [ ] Multiple users indicated correctly ("X and Y are typing...")
- [ ] Limit to 3 typing users visible (overflow: "and 2 others typing")
- [ ] Typing event not sent while composing (sent on message send only)
- [ ] No performance impact with 10+ concurrent users typing

**Acceptance Criteria for Presence:**
- [ ] Status updates within 1 second of login/logout
- [ ] "Away" set after 15 minutes inactivity
- [ ] Away status clears on mouse/keyboard event
- [ ] Presence visible in conversation header and team list
- [ ] Presence persists across page navigation
- [ ] No badge/notification spam for presence changes

**Acceptance Criteria for Auto-Reconnect:**
- [ ] Reconnection attempted within 1 second of disconnect
- [ ] Exponential backoff respected (1s, 2s, 4s, 8s, 16s, 32s, 60s)
- [ ] Max 5 reconnection attempts before giving up
- [ ] "Reconnecting..." UI appears within 500ms
- [ ] Manual reconnect button available after 5 failures
- [ ] No data loss during reconnection process
- [ ] User activity resumes immediately on reconnect

**Acceptance Criteria for Offline Queue:**
- [ ] Compose box enabled during disconnection
- [ ] Messages stored in localStorage (survives page refresh)
- [ ] Queue visible to user ("2 messages waiting...")
- [ ] Queue syncs automatically on reconnect
- [ ] Queue ordered by timestamp when synced
- [ ] Failed queue items show retry UI
- [ ] Max queue size: 50 messages (enforced)

**Acceptance Criteria for Notifications:**
- [ ] Notifications push within 500ms via WebSocket
- [ ] Notification count badge updates in real-time
- [ ] Dismissing notification removes from center
- [ ] Notification actions (mark as read) work without refresh
- [ ] Notifications persist across tab switch
- [ ] Old notifications expire after 24 hours (optional UI refresh)

### 1.3 Edge Cases to Handle

1. **Rapid Reconnections**: User toggles network on/off repeatedly
   - Expected: Queue deduplicated, no duplicate events processed
   - Mitigation: Track event IDs, reject duplicates

2. **Large Message Backlog**: User offline for 1 hour, 50+ events to sync
   - Expected: Backlog synced without UI freeze
   - Mitigation: Paginate backlog (20 per request), show sync progress

3. **Concurrent Tab Changes**: Multiple tabs open, switching between tabs during update
   - Expected: All tabs sync correctly, no race conditions
   - Mitigation: Use SharedWorker or localStorage sync events

4. **Typing + Message Received**: User typing while new message arrives
   - Expected: Message appears above compose box, typing continues
   - Mitigation: Message timeline scrolls, compose stays in place

5. **Presence Race Condition**: User logs out in one tab, logs in another simultaneously
   - Expected: Presence consistent, no conflicting states
   - Mitigation: Server enforces presence per session, client deduplicates

6. **Attachment Download During Disconnect**: User clicks download, connection drops
   - Expected: Download fails gracefully, retry available
   - Mitigation: HTTP error handling, show error message

7. **Typing Timeout Sync**: Server timeout != client 5-second timeout
   - Expected: Client timeout respected, server timeout is fallback
   - Mitigation: Client handles timeout, clears indicator

8. **Event Ordering After Reconnect**: Message arrives before status update processed
   - Expected: Events applied in server-supplied order
   - Mitigation: Server includes timestamp + sequence number

### 1.4 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Real-Time Update Latency** | <500ms | Time from server emit to UI update |
| **Typing Indicator Latency** | <500ms | Time from keystroke to UI appearance |
| **Presence Update Latency** | <1000ms | Time from login/logout to UI update |
| **Reconnect Success Rate** | >95% | Failed reconnections / total attempts |
| **Offline Queue Sync Rate** | 100% | Messages synced / messages queued |
| **WebSocket Uptime** | >99% | Stable connection duration |
| **UI Responsiveness** | >60 FPS | Frame rate during real-time updates |
| **Memory Usage** | <100MB | Heap size with 1000+ events cached |
| **Test Coverage** | ≥85% | Lines covered by automated tests |
| **Error Recovery** | 100% | System recovers from all error scenarios |

---

## 2. Technical Specifications

### 2.1 Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **WebSocket Library** | Socket.io | Auto-reconnect, fallback to polling, rooms support |
| **State Management** | Zustand (existing) | Persist WebSocket state, manage subscriptions |
| **Data Fetching** | TanStack Query (existing) | Cache invalidation, retry logic |
| **Event Bus** | Zustand store | Single source of truth for real-time events |
| **Offline Detection** | browser `online`/`offline` events | Native browser API |
| **Storage** | localStorage | Persist offline queue, backlog tracking |
| **Performance** | React.memo, useMemo | Prevent unnecessary re-renders |
| **Testing** | Vitest + Playwright | Unit + E2E coverage |
| **Type Safety** | TypeScript strict mode | Full type checking |

### 2.2 Integration Points

**Frontend ↔ Backend APIs:**
- WebSocket handshake: `/socket.io/?token=JWT`
- REST fallback: POST `/api/conversations/sync` (if WebSocket unavailable)
- Backlog fetch: GET `/api/conversations/events?since=timestamp` (paginated)
- Offline queue sync: POST `/api/conversations/messages/batch` (bulk)

**Frontend ↔ State Management:**
- Zustand store receives WebSocket events
- TanStack Query cache invalidated on certain events
- Optimistic updates for user actions
- Rollback on error

**Frontend ↔ Storage:**
- localStorage: `yacc:offline-queue` (persists offline messages)
- localStorage: `yacc:ws-backlog` (tracks synced events)
- sessionStorage: `yacc:ws-connection-status` (temp state)

**Frontend ↔ UI:**
- useWebSocket hook provides connection state
- useNotifications hook provides notification stream
- usePresence hook provides user status
- useTyping hook provides typing indicators

### 2.3 Data Flow Diagrams

**Inbound Message Flow (Server → Client):**
```
Server: new inbound message arrives
  ↓
Server: emit WebSocket event "conversation.updated"
  ↓
Client Socket.io: receives event in listener
  ↓
Client: validate event structure & auth
  ↓
Client: Zustand store updates conversation cache
  ↓
Client: TanStack Query invalidates conversation query
  ↓
Client: React re-renders conversation list + detail
  ↓
UI: conversation appears/updates in real-time
```

**Outbound Message Flow (Client → Server):**
```
User: clicks "Send"
  ↓
Client: show "sending" state immediately (optimistic)
  ↓
Client: POST /api/conversations/:id/messages
  ↓
Server: validates, saves, dispatches to platform
  ↓
Server: emit WebSocket "message.pending" or "message.sent"
  ↓
Client: update message status in timeline
  ↓
UI: status reflects "sent" or "failed"
```

**Offline Queue Flow (Client-Only):**
```
User: composes message while disconnected
  ↓
Client: message added to Zustand offline queue
  ↓
Client: also persisted to localStorage (survive refresh)
  ↓
User: types message, hits send
  ↓
Client: message added to queue (not sent)
  ↓
UI: shows "pending sync" indicator
  ↓
User: connection restored
  ↓
Client: POST /api/conversations/messages/batch with all queued messages
  ↓
Server: processes batch, returns status for each
  ↓
Client: update UI, clear localStorage queue
```

**Reconnection Flow (WebSocket):**
```
Client: network lost or WebSocket timeout
  ↓
Socket.io: detects disconnect, starts reconnection
  ↓
Client: store retry attempt number (1-5)
  ↓
Client: wait exponential backoff (1s, 2s, 4s, 8s, 16s, 32s, 60s)
  ↓
Socket.io: attempt reconnect
  ↓
Success: fetch backlog since last successful sync
  ↓
Success: merge backlog into cache
  ↓
Success: clear "Reconnecting" UI
  ↓
Failure (attempt 5): show "Connection lost" error, offer manual retry
```

---

## 3. Architecture & Design

### 3.1 Client Architecture

```
Frontend/
├── hooks/
│   ├── useWebSocket.ts          # Connection state, listeners
│   ├── useNotifications.ts      # Notification stream
│   ├── usePresence.ts           # User presence state
│   ├── useTyping.ts             # Typing indicator state
│   └── useOfflineQueue.ts       # Offline message queue
├── store/
│   ├── websocket.store.ts       # WebSocket connection state
│   ├── notifications.store.ts   # Notifications + unread count
│   ├── presence.store.ts        # Online/offline status
│   ├── offlineQueue.store.ts    # Queued messages during disconnect
│   └── conversationCache.ts     # Real-time conversation updates
├── api/
│   ├── websocket.client.ts      # Socket.io initialization + listeners
│   ├── events.service.ts        # Backlog + batch sync API
│   └── notifications.api.ts     # Notification endpoints
├── components/
│   ├── InboxList/
│   │   ├── ConversationItem.tsx # Real-time updates
│   │   └── UnreadBadge.tsx      # Unread count (real-time)
│   ├── ConversationView/
│   │   ├── Timeline.tsx         # Message timeline (real-time)
│   │   ├── MessageStatus.tsx    # Send status indicator
│   │   ├── TypingIndicator.tsx  # Typing state
│   │   └── ComposerOffline.tsx  # Offline queue indicator
│   ├── PresenceIndicator.tsx    # User online/offline status
│   ├── NotificationCenter.tsx   # Real-time notifications
│   └── ReconnectingUI.tsx       # Reconnection status
├── utils/
│   ├── websocket.utils.ts       # Event serialization, backoff calc
│   ├── offline-queue.utils.ts   # localStorage persistence
│   └── event-dedup.ts           # Deduplication logic
└── types/
    ├── websocket.types.ts       # WebSocket event types
    ├── notifications.types.ts   # Notification types
    └── presence.types.ts        # Presence types
```

### 3.2 WebSocket Event Types

**Events from Server → Client:**

```typescript
type ServerEvents = {
  // Conversation updates
  'conversation.updated': {
    conversation: ConversationDetail;
    changedFields: string[];  // which fields changed
    timestamp: ISO8601;
  };
  
  // Message events
  'message.sent': {
    conversationId: string;
    messageId: string;
    status: 'sent';
    timestamp: ISO8601;
  };
  'message.failed': {
    conversationId: string;
    messageId: string;
    status: 'failed';
    error: string;
    canRetry: boolean;
    timestamp: ISO8601;
  };
  
  // Typing indicators
  'typing.started': {
    conversationId: string;
    userId: string;
    userName: string;
    timestamp: ISO8601;
  };
  'typing.stopped': {
    conversationId: string;
    userId: string;
    timestamp: ISO8601;
  };
  
  // Presence
  'presence.updated': {
    userId: string;
    userName: string;
    status: 'online' | 'offline' | 'away';
    timestamp: ISO8601;
  };
  
  // Notifications
  'notification.received': {
    notification: Notification;
    timestamp: ISO8601;
  };
  
  // Reconnection backlog
  'backlog.sync': {
    events: Event[];
    hasMore: boolean;
    nextPage?: string;
  };
};
```

**Events from Client → Server:**

```typescript
type ClientEvents = {
  // Typing indicator
  'typing.start': {
    conversationId: string;
  };
  'typing.stop': {
    conversationId: string;
  };
  
  // Presence heartbeat
  'presence.ping': {
    timestamp: ISO8601;
  };
  
  // Backlog request
  'backlog.request': {
    since: ISO8601;
    limit?: number;
  };
};
```

### 3.3 Error Handling Strategy

| Error Scenario | Client Behavior | UI Feedback | Recovery |
|---|---|---|---|
| **WebSocket Connection Failed** | Retry with backoff | "Reconnecting..." | Auto-retry 5x, then manual button |
| **Message Send Failed** | Keep in draft, mark failed | "Failed to send" + retry btn | User clicks retry, resend message |
| **Backlog Fetch Failed** | Retry in background | None (silent) | Retry every 10s until success |
| **Offline Queue Sync Failed** | Keep in queue | "Waiting to sync" | Retry when connection restored |
| **Typing Timeout Mismatch** | Client timeout wins | Clear after 5s client-side | Server timeout (15s) is fallback |
| **Duplicate Event Receipt** | Deduplicate by event ID | None (silent dedup) | Skip second occurrence |
| **Invalid Event Format** | Log & ignore | None (silent ignore) | Continue processing other events |
| **Auth Token Expired** | Refresh token, reconnect | None (seamless) | Auto-refresh via existing auth |

---

## 4. Implementation Tasks (20 Items)

### Phase 1: Foundation & WebSocket Setup (Tasks 1-5)

#### Task FE-005-T01: WebSocket Client Initialization
**Complexity:** Medium (6-8 hours)  
**Dependency:** FE-004  
**Description:**  
Set up Socket.io client with authentication, event listeners, and error handling. Initialize connection lifecycle (connect, disconnect, reconnect).

**Acceptance Criteria:**
- [ ] Socket.io client imported and configured with backend URL
- [ ] JWT token passed in WebSocket handshake (`auth` param)
- [ ] Error handlers registered (connect_error, disconnect, etc.)
- [ ] Heartbeat/ping-pong working (server heartbeat 60s)
- [ ] Reconnection logic with exponential backoff implemented
- [ ] Connection state persisted in Zustand store
- [ ] TypeScript types defined for all WebSocket events
- [ ] Unit tests cover initialization, connect, disconnect, reconnect
- [ ] E2E test verifies connection established on page load
- [ ] No console errors for normal connection lifecycle

**Implementation Notes:**
- Socket.io should be initialized once in app root (e.g., `_app.tsx`)
- Use custom hook `useWebSocket()` to lazy-load connection
- Store connection state in Zustand (connected: boolean, lastConnectTime: ISO8601)
- Test with server mock using `Socket.io-client-mock`

---

#### Task FE-005-T02: Zustand WebSocket Store
**Complexity:** Medium (6-8 hours)  
**Dependency:** FE-005-T01  
**Description:**  
Create Zustand store to manage WebSocket state, subscriptions, and event handlers. Store tracks connection status, subscribed conversations, typing state, presence.

**Acceptance Criteria:**
- [ ] Store exports `useWebSocketStore()` hook
- [ ] State includes: connected, connecting, disconnected, lastConnectTime
- [ ] Store tracks subscribed conversation IDs (Set<string>)
- [ ] Store tracks typing state per conversation
- [ ] Store tracks presence per user (online/offline/away)
- [ ] Actions: subscribe, unsubscribe, updateConnectionStatus
- [ ] Actions: addTypingUser, removeTypingUser, clearTyping
- [ ] Actions: setUserPresence, clearPresence
- [ ] Store persists to localStorage (connection state recovery)
- [ ] Zustand DevTools integration (debug in browser)
- [ ] Unit tests cover all state mutations
- [ ] No memory leaks (cleanup on unmount)

**Implementation Notes:**
- Use Zustand `persist` middleware for localStorage
- Keep store lean (only connection + subscription state, not message data)
- Conversions data managed separately in TanStack Query cache
- Export typed hooks: `useWebSocketStatus()`, `useTypingUsers()`, `useUserPresence()`

---

#### Task FE-005-T03: WebSocket Event Listeners & Handlers
**Complexity:** Large (10-12 hours)  
**Dependency:** FE-005-T02  
**Description:**  
Implement Socket.io event listeners for all server-emitted events. Route events to appropriate handlers (cache update, store update, UI update).

**Acceptance Criteria:**
- [ ] Listener for `conversation.updated` (update cache + UI)
- [ ] Listener for `message.sent` / `message.failed` (update message status)
- [ ] Listener for `typing.started` / `typing.stopped` (update typing store)
- [ ] Listener for `presence.updated` (update presence store)
- [ ] Listener for `notification.received` (create notification + badge)
- [ ] Listener for `conversation.reopened` (auto-reopen resolved conversations)
- [ ] All listeners update Zustand store atomically
- [ ] TanStack Query cache invalidated after store update
- [ ] Error handling for malformed events (log + ignore)
- [ ] Event deduplication (by event ID + timestamp)
- [ ] No duplicate event processing
- [ ] Unit tests verify each listener + event flow
- [ ] E2E test verifies real-time update latency <500ms

**Implementation Notes:**
- Use factory function to create listeners (avoid closure issues)
- Implement event deduplication with Set<eventId> (TTL 1 minute)
- Update cache optimistically + rollback on error
- Test with mock server events

---

#### Task FE-005-T04: Real-Time Conversation Cache Updates
**Complexity:** Large (12-14 hours)  
**Dependency:** FE-005-T03  
**Description:**  
Integrate WebSocket events with TanStack Query cache. Update conversation list, conversation details, message timeline in real-time.

**Acceptance Criteria:**
- [ ] Conversation list updates when conversation.updated received
- [ ] Conversation detail updates when opened
- [ ] Message timeline appends new messages without page reload
- [ ] Conversation sort order preserved (latest activity first)
- [ ] Unread count updates correctly
- [ ] Filter state persisted during cache updates
- [ ] Search results auto-update if conversation matches
- [ ] Bulk action state cleared on cache invalidation
- [ ] No race conditions with manual refresh
- [ ] Optimistic updates for user actions (send message)
- [ ] Rollback on error (restore previous state)
- [ ] Unit tests cover cache update scenarios
- [ ] E2E test verifies multiple concurrent updates

**Implementation Notes:**
- Use TanStack Query's `setQueryData()` for optimistic updates
- Implement rollback via `cancelMutations()` on error
- Cache key: `['conversations']` (list), `['conversation', id]` (detail)
- Test with multiple client instances

---

#### Task FE-005-T05: Typing Indicators UI Component
**Complexity:** Medium (8-10 hours)  
**Dependency:** FE-005-T04, FE-004  
**Description:**  
Build typing indicator component visible in conversation view. Show "User is typing..." for single user, "X and Y are typing..." for multiple, "and 2 others..." if >3 users.

**Acceptance Criteria:**
- [ ] Component `<TypingIndicator />` renders in conversation header
- [ ] Single user: "Alice is typing..."
- [ ] Two users: "Alice and Bob are typing..."
- [ ] Three+ users: "Alice, Bob and 2 others are typing..."
- [ ] Animated dots or pulse effect
- [ ] Disappears after 5 seconds of inactivity
- [ ] Max 3 users shown explicitly
- [ ] Accessible (ARIA labels for animation)
- [ ] No layout shift (fixed height)
- [ ] Styled with DaisyUI/Tailwind
- [ ] Unit tests cover all user count scenarios
- [ ] E2E test verifies appearance/disappearance timing

**Implementation Notes:**
- Use `useTypingUsers()` hook from WebSocket store
- Implement timeout cleanup with useEffect
- Animated indicator: CSS animation or Framer Motion
- Test with mock typing events

---

### Phase 2: Offline Mode & Message Status (Tasks 6-10)

#### Task FE-005-T06: Offline Queue Store
**Complexity:** Large (10-12 hours)  
**Dependency:** FE-005-T02  
**Description:**  
Create Zustand store for offline message queue. Persist to localStorage, track queue state, provide actions to add/remove messages.

**Acceptance Criteria:**
- [ ] Store exports `useOfflineQueue()` hook
- [ ] Queue state: messages: Message[], syncing: boolean, syncError?: string
- [ ] Messages persist to localStorage (survive page refresh)
- [ ] Actions: addMessage, removeMessage, clearQueue, setSyncing, setSyncError
- [ ] Max queue size enforced (50 messages)
- [ ] Messages ordered by timestamp (FIFO)
- [ ] localStorage key: `yacc:offline-queue`
- [ ] Queue restored on app startup
- [ ] Memory-efficient (no memory leaks)
- [ ] Unit tests cover all actions + persistence
- [ ] E2E test verifies queue survives page refresh

**Implementation Notes:**
- Use Zustand `persist` middleware for localStorage
- Include message metadata: conversationId, tempId, timestamp, status
- tempId: generated UUID for optimistic updates
- Test with localStorage mocked in Vitest

---

#### Task FE-005-T07: Offline Detection & Queue Management
**Complexity:** Medium (8-10 hours)  
**Dependency:** FE-005-T06  
**Description:**  
Implement offline detection using browser `online`/`offline` events. Manage queue during disconnection, sync when reconnected.

**Acceptance Criteria:**
- [ ] `window.addEventListener('offline')` captures disconnection
- [ ] `window.addEventListener('online')` captures reconnection
- [ ] Compose box enabled during offline (messages queueable)
- [ ] Offline indicator visible in UI ("Offline mode")
- [ ] Messages added to queue during offline
- [ ] Queue synced automatically on reconnect
- [ ] Retry button available for failed sync
- [ ] Queue sync updates message status (pending → sent/failed)
- [ ] UI shows queue progress ("2 messages waiting...")
- [ ] Sync error handling with user feedback
- [ ] Unit tests cover online/offline transitions
- [ ] E2E test verifies offline → online sync

**Implementation Notes:**
- Hook into existing WebSocket connection state
- Integrate with offline queue store
- Sync endpoint: POST `/api/conversations/messages/batch`
- Batch sync limit: 50 messages per request
- Test with network throttling in E2E

---

#### Task FE-005-T08: Message Status Indicator Component
**Complexity:** Medium (8-10 hours)  
**Dependency:** FE-005-T04  
**Description:**  
Build message status indicator (pending/sent/failed) visible in timeline. Show retry button for failed messages with error tooltip.

**Acceptance Criteria:**
- [ ] Component `<MessageStatus />` rendered per message
- [ ] "Sending..." state with loader animation
- [ ] "Sent" state with checkmark icon
- [ ] "Failed" state with error icon + red color
- [ ] Hover tooltip shows error message
- [ ] Retry button visible for failed messages
- [ ] Click retry button resends message
- [ ] Status persists across page refresh
- [ ] No jank during status updates
- [ ] Accessible (ARIA labels, keyboard navigation)
- [ ] Styled with DaisyUI (consistent with design)
- [ ] Unit tests cover all status states + retry
- [ ] E2E test verifies status updates in real-time

**Implementation Notes:**
- Use message status from TanStack Query cache
- Retry action calls existing message send API
- Error message from server should be user-friendly
- Test with network failures (mock 500 error)

---

#### Task FE-005-T09: Optimistic Message Updates
**Complexity:** Large (10-12 hours)  
**Dependency:** FE-005-T04, FE-005-T08  
**Description:**  
Implement optimistic updates for message send. Show message immediately in timeline, rollback on failure.

**Acceptance Criteria:**
- [ ] Message appears in timeline immediately after send click
- [ ] Message shows "sending" status
- [ ] Message includes user avatar + timestamp
- [ ] Rollback on error (remove from timeline, show error)
- [ ] Retry restores message to timeline
- [ ] Conversation last message updated optimistically
- [ ] Conversation updated_at timestamp updated
- [ ] Unread count updated optimistically
- [ ] Race condition handling (multiple concurrent sends)
- [ ] No duplicate messages on network retry
- [ ] Unit tests cover optimistic + rollback flows
- [ ] E2E test verifies message appears before server confirms

**Implementation Notes:**
- Use TanStack Query mutation hooks
- Generate temporary messageId (UUID) for optimistic update
- Track tempId → serverId mapping for reconciliation
- Test with network delays (simulate 2s latency)

---

#### Task FE-005-T10: Offline Compose Box Indicator
**Complexity:** Small (4-6 hours)  
**Dependency:** FE-005-T07  
**Description:**  
Add visual indicator in compose box during offline mode. Show queue status ("2 messages waiting to send").

**Acceptance Criteria:**
- [ ] Compose box remains enabled during offline
- [ ] "Offline mode" banner visible above composer
- [ ] Queue status displayed ("2 messages waiting...")
- [ ] Sync progress shown during reconnection
- [ ] Visual distinction from online state
- [ ] Accessible (ARIA live region for updates)
- [ ] Styled consistently with DaisyUI
- [ ] No performance impact
- [ ] Unit tests cover UI states
- [ ] E2E test verifies indicator during offline → online

**Implementation Notes:**
- Use `useWebSocketStatus()` + `useOfflineQueue()` hooks
- Live region for queue status updates
- Tailwind classes for styling (bg-warning, text-warning, etc.)

---

### Phase 3: Presence & Notifications (Tasks 11-15)

#### Task FE-005-T11: User Presence Store & Tracking
**Complexity:** Medium (8-10 hours)  
**Dependency:** FE-005-T02  
**Description:**  
Track user presence (online/offline/away). Update on login/logout events. Track inactivity for away status.

**Acceptance Criteria:**
- [ ] Store exports `useUserPresence(userId)` hook
- [ ] Presence states: online, offline, away, unknown
- [ ] Presence updates within 1 second of status change
- [ ] Away status set after 15 minutes inactivity
- [ ] Mouse/keyboard event triggers "online" from away
- [ ] Presence tracked per user (store user → status map)
- [ ] Presence cleared on logout
- [ ] Activity tracking via event listeners (mousemove, keypress)
- [ ] Activity debounced (only update every 5 minutes)
- [ ] Memory-efficient (no memory leaks)
- [ ] Unit tests cover state transitions
- [ ] E2E test verifies presence updates

**Implementation Notes:**
- Use `useWebSocketStore()` for presence map
- Activity tracking: debounce with lodash or custom utility
- Broadcast presence via `presence.ping` event (heartbeat)
- Test with fake timers (jest.useFakeTimers)

---

#### Task FE-005-T12: Presence Indicator Component
**Complexity:** Small (4-6 hours)  
**Dependency:** FE-005-T11  
**Description:**  
Build presence indicator component showing user online/offline/away status. Visible in conversation header + team member list.

**Acceptance Criteria:**
- [ ] Component `<PresenceIndicator userId={} />` renders inline
- [ ] Green dot for online
- [ ] Gray dot for offline
- [ ] Yellow dot for away
- [ ] Tooltip shows status + last active time
- [ ] Updates in real-time
- [ ] No layout shift
- [ ] Accessible (ARIA label)
- [ ] Styled with DaisyUI
- [ ] Unit tests cover all states
- [ ] E2E test verifies real-time updates

**Implementation Notes:**
- Reusable component with userId prop
- Tooltip: "Alice is online" or "Offline · Last seen 2 hours ago"
- Animation: subtle pulse for online status (optional)

---

#### Task FE-005-T13: Notification Center Component
**Complexity:** Medium (10-12 hours)  
**Dependency:** FE-005-T03  
**Description:**  
Build notification center panel. Display notifications for assignments, @mentions, unread messages. Allow dismiss/clear operations.

**Acceptance Criteria:**
- [ ] Component `<NotificationCenter />` in header
- [ ] Bell icon with unread badge count
- [ ] Click bell opens notification panel
- [ ] Notifications listed (newest first)
- [ ] Notification types: assignment, mention, unread
- [ ] Dismiss individual notifications
- [ ] Clear all notifications button
- [ ] Click notification navigates to conversation
- [ ] Notification timestamps (e.g., "2 minutes ago")
- [ ] Real-time badge count updates
- [ ] Panel closes on outside click
- [ ] Keyboard navigation (Escape to close)
- [ ] Accessible (ARIA roles + keyboard support)
- [ ] Styled with DaisyUI
- [ ] Unit tests cover interactions
- [ ] E2E test verifies real-time updates

**Implementation Notes:**
- Use notification API from backend
- GET /api/notifications (paginated)
- Dismiss: PUT /api/notifications/:id (mark read or delete)
- Real-time updates via WebSocket listener
- Panel: slide-out or dropdown UI

---

#### Task FE-005-T14: Notification Store & Unread Badges
**Complexity:** Medium (8-10 hours)  
**Dependency:** FE-005-T13  
**Description:**  
Create Zustand store for notifications. Manage unread count, notification list, mark as read.

**Acceptance Criteria:**
- [ ] Store exports `useNotifications()` hook
- [ ] State: notifications[], unreadCount: number
- [ ] Actions: addNotification, removeNotification, markAsRead, clearAll
- [ ] Unread count increments on new notification
- [ ] Unread count decrements on mark as read
- [ ] Notifications fetched on app load (GET /api/notifications)
- [ ] Real-time updates via WebSocket listener
- [ ] localStorage persistence (optional)
- [ ] Memory-efficient (max 100 notifications cached)
- [ ] Deduplication (no duplicate notification objects)
- [ ] Unit tests cover all actions
- [ ] E2E test verifies badge updates

**Implementation Notes:**
- TanStack Query for notification list fetch
- Zustand for unread count (separate state)
- Keep notifications in reverse chronological order
- Expire old notifications (>24 hours)

---

#### Task FE-005-T15: Unread Badge Updates
**Complexity:** Small (4-6 hours)  
**Dependency:** FE-005-T14  
**Description:**  
Add unread badge to conversation items in inbox. Update in real-time when new messages arrive.

**Acceptance Criteria:**
- [ ] Unread badge visible on conversation item
- [ ] Badge shows count (e.g., "3")
- [ ] Updates in real-time
- [ ] Badge disappears when conversation opened
- [ ] Badge updates on new inbound message
- [ ] Red/warning color for unread
- [ ] No layout shift
- [ ] Accessible (ARIA label)
- [ ] Unit tests cover updates
- [ ] E2E test verifies real-time badge

**Implementation Notes:**
- Use conversation cache from TanStack Query
- Badge: DaisyUI badge component
- Click conversation marks all as read (update cache)
- GET /api/conversations/:id/markAsRead on open

---

### Phase 4: Reconnection & Backlog Sync (Tasks 16-18)

#### Task FE-005-T16: Reconnection Logic with Exponential Backoff
**Complexity:** Large (10-12 hours)  
**Dependency:** FE-005-T01  
**Description:**  
Implement Socket.io reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s, 32s, 60s). Max 5 attempts before giving up.

**Acceptance Criteria:**
- [ ] Backoff sequence: 1s, 2s, 4s, 8s, 16s, 32s, 60s
- [ ] Max 5 reconnection attempts
- [ ] Exponential backoff implemented correctly (not linear)
- [ ] Jitter added to prevent thundering herd (±25%)
- [ ] Reconnect attempt number tracked in store
- [ ] Manual retry button available after 5 failures
- [ ] User notified of reconnection status
- [ ] No duplicate reconnection attempts
- [ ] Socket.io configured correctly (reconnection: true, etc.)
- [ ] Unit tests verify backoff timing
- [ ] E2E test verifies reconnection behavior

**Implementation Notes:**
- Use Socket.io built-in reconnection (configure in client init)
- Exponential backoff formula: `Math.min(baseDelay * Math.pow(2, attempts), maxDelay)`
- Jitter: `delay * (0.75 + 0.5 * Math.random())`
- Test with fake timers or network simulation

---

#### Task FE-005-T17: Backlog Fetching & Event Sync
**Complexity:** Large (12-14 hours)  
**Dependency:** FE-005-T16  
**Description:**  
On reconnection, fetch missed events (backlog) from server. Merge into cache without duplication.

**Acceptance Criteria:**
- [ ] Backlog request triggered on successful reconnect
- [ ] Endpoint: GET /api/conversations/events?since=timestamp
- [ ] Pagination support (limit=50, cursor-based)
- [ ] Events returned in chronological order
- [ ] Backlog merged into cache atomically
- [ ] Event deduplication (skip if already processed)
- [ ] No UI freeze during large backlog (>1000 events)
- [ ] Sync progress shown ("Syncing... 23/100")
- [ ] Sync error handled gracefully (retry or alert user)
- [ ] Backlog truncated after 1 hour (user-configurable)
- [ ] Memory efficient (paginate large backlogs)
- [ ] Unit tests cover merge + dedup logic
- [ ] E2E test verifies backlog sync after network loss

**Implementation Notes:**
- Track last successful sync timestamp in store
- Paginate if events > 100 (fetch in batches)
- Deduplication: track event IDs received
- Test with large backlog (simulate 1-hour offline period)

---

#### Task FE-005-T18: Reconnect UI Indicator
**Complexity:** Small (4-6 hours)  
**Dependency:** FE-005-T16, FE-005-T17  
**Description:**  
Add "Reconnecting..." UI during reconnection attempts. Show progress/status to user.

**Acceptance Criteria:**
- [ ] "Reconnecting..." banner visible on disconnect
- [ ] Banner disappears on successful reconnect
- [ ] Attempt number shown ("Attempt 2 of 5")
- [ ] Manual retry button after final failure
- [ ] "Connection lost" error message after 5 attempts
- [ ] Color indicates status (warning → error)
- [ ] No blocking of user interactions
- [ ] Keyboard accessible
- [ ] Styled with DaisyUI
- [ ] Unit tests cover UI states
- [ ] E2E test verifies banner appearance/disappearance

**Implementation Notes:**
- Use `useWebSocketStatus()` hook
- Banner: DaisyUI alert component
- Manual retry: triggers `socket.disconnect()` + `socket.connect()`

---

### Phase 5: Testing & Polish (Tasks 19-20)

#### Task FE-005-T19: Comprehensive Unit Tests
**Complexity:** Large (16-20 hours)  
**Dependency:** All T01-T18  
**Description:**  
Write unit tests for all WebSocket hooks, stores, components, and utilities. Target ≥85% code coverage.

**Acceptance Criteria:**
- [ ] useWebSocket hook tests (connect, disconnect, reconnect)
- [ ] useWebSocketStore tests (all state mutations)
- [ ] useOfflineQueue tests (add, remove, sync)
- [ ] useNotifications tests (add, dismiss, clear)
- [ ] useUserPresence tests (state transitions)
- [ ] Event handler tests (dedup, cache update, error handling)
- [ ] Component tests (TypingIndicator, PresenceIndicator, NotificationCenter, etc.)
- [ ] Utility function tests (backoff calc, event serialization, dedup)
- [ ] Mock Socket.io server (socket.io-client-mock)
- [ ] Mock TanStack Query (MSW + vitest)
- [ ] Test localStorage operations (mock storage)
- [ ] Test async flows (fake timers)
- [ ] Coverage ≥85% overall, ≥90% for critical paths
- [ ] All tests passing
- [ ] No snapshot tests (prefer explicit assertions)

**Implementation Notes:**
- Use Vitest as test runner
- Mock Socket.io with dedicated library
- Mock TanStack Query with MSW (Mock Service Worker)
- Test database optional (use in-memory for integration tests)
- Organize tests: `__tests__/` co-located with source

---

#### Task FE-005-T20: E2E Tests & Performance Benchmarks
**Complexity:** Large (16-20 hours)  
**Dependency:** All T01-T18  
**Description:**  
Write E2E tests covering real-time scenarios. Benchmark latency, memory, and UI performance.

**Acceptance Criteria:**
- [ ] E2E test: real-time conversation update (<500ms)
- [ ] E2E test: message send + status update (pending → sent)
- [ ] E2E test: typing indicator appears/disappears
- [ ] E2E test: offline → online reconnection
- [ ] E2E test: offline queue sync on reconnect
- [ ] E2E test: presence update on login/logout
- [ ] E2E test: notification appears + dismiss works
- [ ] E2E test: multiple concurrent messages
- [ ] E2E test: network failure handling (retry)
- [ ] E2E test: tab switching (SharedWorker sync)
- [ ] Performance test: real-time update latency <500ms
- [ ] Performance test: UI frame rate ≥60 FPS during updates
- [ ] Performance test: memory usage <100MB with 1000+ events
- [ ] Performance test: offline queue sync completes <10s
- [ ] Load test: 10+ concurrent users (Lighthouse)
- [ ] All tests passing with >95% reliability
- [ ] Documentation of test scenarios

**Implementation Notes:**
- Use Playwright for E2E
- Mock backend with Playwright fixtures (custom server)
- Benchmark with Lighthouse or custom timers
- Test with network throttling (DevTools)
- Stress test with fake high-latency network

---

## 5. Testing Requirements

### 5.1 Test Strategy

**Test Pyramid:**
- **Unit Tests:** 60% coverage (stores, hooks, utilities)
- **Integration Tests:** 25% coverage (component interactions, cache updates)
- **E2E Tests:** 15% coverage (real-time scenarios, user workflows)

**Test Coverage Targets:**
- WebSocket hooks: ≥90%
- Stores: ≥90%
- Components: ≥80%
- Utilities: ≥85%
- Overall: ≥85%

### 5.2 Test Scenarios

**Real-Time Conversation Updates:**
- Server sends `conversation.updated` event
- Client cache updated within 100ms
- UI reflects update without page refresh
- Filter state preserved after update
- Multiple concurrent updates handled correctly

**Message Status Updates:**
- Message send shows "sending" state
- Server sends `message.sent` event
- Client updates status to "sent"
- Status reflected in timeline
- Failed message shows retry button

**Typing Indicators:**
- User starts typing, `typing.started` event sent
- Indicator appears in conversation header
- Multiple users typing shows correct format
- Indicator disappears after 5 seconds
- Timeout cleanup prevents memory leak

**Offline Mode:**
- Network disconnected, offline mode activated
- Messages queued locally
- Queue persists to localStorage
- Network reconnected, queue synced
- All messages in queue sent successfully

**Presence Updates:**
- User logs in, presence set to online
- WebSocket event `presence.updated` sent
- UI updates within 1 second
- Away status set after 15 minutes inactivity
- Mouse/keyboard activity clears away status

**Reconnection:**
- Network fails, reconnection attempts start
- Exponential backoff timing correct (1s, 2s, 4s, etc.)
- Backlog fetched on successful reconnect
- Backlog merged into cache without duplication
- UI updates with synced events

**Notifications:**
- Assignment notification created, WebSocket event sent
- Notification appears in notification center
- Badge count increments
- Dismiss removes notification
- Click navigates to conversation

### 5.3 Edge Cases to Test

1. **Network Flapping**: Rapid on/off cycles
2. **Concurrent Updates**: Multiple events in same millisecond
3. **Tab Synchronization**: Changes in one tab sync to others
4. **Large Backlog**: 1000+ missed events on reconnect
5. **Memory Leaks**: Event listeners properly cleaned up
6. **Token Expiry**: Auth token expires during session
7. **Server Errors**: Backlog fetch returns 500 error
8. **Message Collision**: Same message ID from different sources

### 5.4 Performance Benchmarks

| Benchmark | Target | Measurement |
|-----------|--------|-------------|
| **Real-Time Latency** | <500ms | Time from server emit to UI update |
| **Typing Indicator Latency** | <500ms | Time from keystroke to indicator |
| **Presence Update Latency** | <1000ms | Time from server event to UI |
| **Reconnect Success Time** | <2s | Time from disconnect to reconnected |
| **Backlog Sync Time** | <5s | Time to sync 100 events |
| **UI Frame Rate** | ≥60 FPS | Frame rate during real-time updates |
| **Memory Usage** | <100MB | Heap size with 1000+ cached events |
| **Bundle Size** | <50KB | Socket.io + custom code gzipped |

---

## 6. Documentation Needs

### 6.1 Architecture ADR

**ADR-009: Real-Time WebSocket Architecture**

Content to include:
- Decision: Use Socket.io for WebSocket + auto-reconnect
- Alternatives considered: Native WebSocket, other libraries
- Trade-offs: Socket.io overhead vs. auto-reconnect reliability
- Event model: Server-emitted vs. request-response
- Offline mode: localStorage queue vs. in-memory queue
- Backlog strategy: Last N hours vs. cursor-based pagination

### 6.2 API Changes Documentation

**New Endpoints:**
- GET `/api/conversations/events?since=timestamp&limit=50` (backlog fetch)
- POST `/api/conversations/messages/batch` (offline queue sync)
- GET `/api/notifications` (notification list)
- PUT `/api/notifications/:id` (mark as read)

**WebSocket Events (documented in API spec):**
- All events listed in Section 2.2 (ServerEvents, ClientEvents)

### 6.3 User-Facing Guides

**Guide: Real-Time Inbox**
- How real-time updates work
- Why conversations appear instantly
- Connection status indicator
- Offline mode explanation

**Guide: Offline Mode**
- How to use offline mode
- Message queuing explanation
- Sync on reconnect
- Failed message retry

**Guide: Presence & Typing**
- What presence indicators mean
- Typing indicator behavior
- Activity timeout (15 minutes away)

### 6.4 Developer Guides

**Guide: WebSocket Integration**
- How to add new WebSocket event (4-step process)
- Testing real-time updates (mock server setup)
- Debugging connection issues (DevTools)
- Performance optimization tips

**Guide: Offline Queue**
- How to extend offline queue (custom message types)
- localStorage persistence details
- Queue size limits and cleanup

**Guide: Real-Time Testing**
- Setting up test environment
- Mocking Socket.io events
- Testing asynchronous flows
- Debugging real-time race conditions

---

## 7. Success Criteria

### 7.1 Functional Success

- ✅ Real-time conversation updates working (<500ms latency)
- ✅ Message status reflects delivery state (pending → sent/failed)
- ✅ Typing indicators appear/disappear correctly
- ✅ Presence updates visible in real-time
- ✅ Offline mode queues messages correctly
- ✅ Auto-reconnect succeeds with exponential backoff
- ✅ Backlog sync merges events without duplication
- ✅ Notifications delivered in real-time
- ✅ All edge cases handled gracefully

### 7.2 Non-Functional Success

- ✅ Code coverage ≥85%
- ✅ No TypeScript `any` types
- ✅ No console errors during normal operation
- ✅ UI responsiveness ≥60 FPS
- ✅ Memory usage <100MB
- ✅ Bundle size <50KB (gzipped)
- ✅ All tests passing (unit + E2E)
- ✅ Zero security vulnerabilities
- ✅ Full accessibility (WCAG 2.1 AA)

### 7.3 Quality Gates

**Before Merge to Dev:**
- [ ] All unit tests passing
- [ ] Code coverage ≥85%
- [ ] No TypeScript errors
- [ ] Linting passes (ESLint)
- [ ] No console errors/warnings

**Before Merge to Main:**
- [ ] All E2E tests passing
- [ ] Performance benchmarks met
- [ ] Manual QA sign-off
- [ ] Architecture review approved
- [ ] Documentation complete + reviewed

---

## 8. Timeline & Milestones

### 8.1 Estimated Duration

| Phase | Tasks | Hours | Days |
|-------|-------|-------|------|
| **Phase 1: Foundation** | T01-T05 | 38-46 | 5-6 |
| **Phase 2: Offline & Status** | T06-T10 | 40-50 | 5-7 |
| **Phase 3: Presence & Notifications** | T11-T15 | 38-46 | 5-6 |
| **Phase 4: Reconnection & Backlog** | T16-T18 | 32-40 | 4-5 |
| **Phase 5: Testing & Polish** | T19-T20 | 32-40 | 4-5 |
| **Total** | 20 tasks | 180-222 | 23-29 |

**Parallel Opportunities:**
- T02-T03 (can start once T01 complete)
- T06-T07 (can start once T02 complete)
- T11-T12 (can start once T02 complete)
- T19 (can start after T05, run parallel to T06-T18)

**Critical Path:** T01 → T02 → T03 → T04 → T08 → T09 (12-14 weeks minimum)

### 8.2 Weekly Milestones

**Week 1: Foundation**
- Complete T01-T05 (WebSocket init, stores, event listeners, cache, typing)
- Target: Real-time conversation updates working

**Week 2: Offline & Status**
- Complete T06-T10 (offline queue, detection, message status, optimistic, indicator)
- Target: Message send + status visible, offline mode working

**Week 3: Presence & Notifications**
- Complete T11-T15 (presence tracking, indicator, notification center, badges)
- Target: Presence visible, notifications working

**Week 4: Reconnection**
- Complete T16-T18 (backoff, backlog sync, reconnect UI)
- Target: Reconnection + sync working

**Week 5: Testing & Polish**
- Complete T19-T20 (unit tests, E2E tests, performance benchmarks)
- Target: ≥85% coverage, all tests passing

### 8.3 Blocking Dependencies

- ✅ FE-004 (API Integration) - COMPLETE
- ⏳ BE-006 (WebSocket Infrastructure) - Pending backend implementation
  - Needed before T01 can fully test
  - Can mock Socket.io server in the meantime

### 8.4 Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **BE-006 Delayed** | Medium | High | Mock Socket.io server for testing; integrate later |
| **Real-Time Latency >500ms** | Low | High | Profile with Performance API; optimize cache updates |
| **Memory Leaks** | Medium | High | Use React DevTools Profiler; cleanup effect dependencies |
| **Race Conditions** | High | High | Use locks/debouncing; test with fake timers |
| **Offline Queue Data Loss** | Low | High | Use localStorage; encrypt sensitive data |
| **Reconnection Spam** | Low | Medium | Implement max attempts + exponential backoff |

---

## 9. Acceptance Sign-Off

**Product Owner Review:** ⏳ Pending  
**Architect Review:** ⏳ Pending  
**Team Lead Approval:** ⏳ Pending  

**Ready to Start:** Once FE-004 merges to dev and this todo list is approved.

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-26  
**Created By:** Product Owner  
**Status:** READY FOR IMPLEMENTATION
