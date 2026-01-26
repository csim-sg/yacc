# FE-005 & FE-006: Production-Grade Developer Todo Lists

**Status:** 🎯 READY FOR IMMEDIATE IMPLEMENTATION  
**Created:** 2026-01-26  
**Version:** 1.0  
**Total Tasks:** 42 (20 FE-005 + 22 FE-006)  
**Total Hours:** 384-474 (64-79 days with 1 developer)  
**Timeline:** 6-8 weeks (with parallelization)

---

## 📋 Table of Contents

1. [FE-005: WebSocket & Real-Time Updates (20 Tasks)](#fe-005-websocket--real-time-updates-20-tasks)
2. [FE-006: Conversation Timeline & Advanced Features (22 Tasks)](#fe-006-conversation-timeline--advanced-features-22-tasks)
3. [Dependency Map & Critical Path](#dependency-map--critical-path)
4. [Summary & Quick Reference](#summary--quick-reference)

---

# FE-005: WebSocket & Real-Time Updates (20 Tasks)

## Phase 1: Foundation & WebSocket Setup

### FE-005-T01: Socket.io Client Integration

**Complexity:** Medium (M)  
**Dependency:** None (can start immediately)  
**Files:**
- Create: `src/lib/socket.ts`
- Create: `src/hooks/useWebSocket.ts`
- Modify: `src/App.tsx` or `src/_app.tsx`

**Key Acceptance Criteria:**
- [ ] Socket.io client initialized in app root (before auth check)
- [ ] JWT token passed in WebSocket handshake (`auth` parameter)
- [ ] Connection auto-connects only AFTER auth token obtained
- [ ] Error handlers registered: `connect_error`, `disconnect`, `reconnect_failed`
- [ ] Heartbeat/ping-pong working (server 60s interval)
- [ ] Reconnection logic with exponential backoff configured
- [ ] Connection state persisted in Zustand store (`connected`, `connecting`, `disconnected`)
- [ ] TypeScript strict types for all WebSocket event types (no `any`)
- [ ] Unit tests cover: initialization, connect, disconnect, reconnect scenarios
- [ ] E2E test verifies connection established within 3 seconds of page load
- [ ] No console errors for normal connection lifecycle
- [ ] Socket.io event logging available in dev mode

**Implementation Notes:**
- Socket.io client version: v4+ with `autoConnect: false` initially
- Use custom hook `useWebSocket()` to manage connection lifecycle
- Store connection state: `connected: boolean`, `lastConnectTime: ISO8601`, `reconnectAttempts: number`
- Exponential backoff config: base 1s, multiplier 2, max 60s, jitter ±25%
- Test with mock server using socket.io-client-mock
- Implement event ID tracking for deduplication (TTL: 1 minute)

**Testing Strategy:**
- Unit test: Connection lifecycle (connect → disconnect → reconnect)
- Unit test: Error handling (401, 500, network errors)
- Unit test: Backoff timing (verify exponential sequence)
- E2E test: Real Socket.io server connection
- E2E test: Latency measurement (<100ms to server)

**Estimated Hours:** 6-8

---

### FE-005-T02: Zustand WebSocket Store

**Complexity:** Medium (M)  
**Dependency:** FE-005-T01  
**Files:**
- Create: `src/stores/websocket.store.ts`
- Create: `src/stores/conversation-cache.store.ts`
- Create: `src/types/websocket.types.ts`

**Key Acceptance Criteria:**
- [ ] Export `useWebSocketStore()` hook with proper typing
- [ ] Store state shape: `{ connected: boolean; connecting: boolean; disconnected: boolean; lastConnectTime: ISO8601; reconnectAttempts: number }`
- [ ] Track subscribed conversation IDs in `Set<string>` for efficient lookups
- [ ] Store typing state per conversation: `{ conversationId: Set<userId> }`
- [ ] Store presence per user: `{ userId: { status: 'online'|'offline'|'away'; lastSeen: ISO8601 } }`
- [ ] Implement actions: `subscribe()`, `unsubscribe()`, `updateConnectionStatus()`, `addTypingUser()`, `removeTypingUser()`
- [ ] Persist to localStorage with `persist` middleware (recovery on page refresh)
- [ ] Zustand DevTools integration enabled (debug in React DevTools)
- [ ] All state mutations are atomic (no partial updates)
- [ ] No memory leaks: cleanup subscriptions on unmount
- [ ] Unit tests cover: all state mutations, action combinations, edge cases
- [ ] E2E test verifies store state recovery after page refresh

**Implementation Notes:**
- Use Zustand `persist` middleware: `storage: localStorage, key: 'yacc:websocket-store'`
- Separate cache store for message data (TanStack Query manages this)
- Export typed hooks: `useWebSocketStatus()`, `useTypingUsers(conversationId)`, `useUserPresence(userId)`
- Implement cleanup in effects: `return () => { store.unsubscribe(id) }`
- Use Set/Map for O(1) lookups instead of arrays

**Testing Strategy:**
- Unit test: State mutations (set/add/remove actions)
- Unit test: Subscription management (subscribe/unsubscribe)
- Unit test: localStorage persistence (mock storage, verify serialization)
- Unit test: Derived selectors (useTypingUsers, useUserPresence)
- E2E test: Store state survives page refresh

**Estimated Hours:** 6-8

---

### FE-005-T03: WebSocket Event Listeners & Handlers

**Complexity:** Large (L)  
**Dependency:** FE-005-T02  
**Files:**
- Create: `src/lib/socket-listeners.ts`
- Create: `src/lib/event-dedup.ts`
- Create: `src/services/event-handlers/`
  - `conversation.handler.ts`
  - `message.handler.ts`
  - `typing.handler.ts`
  - `presence.handler.ts`
  - `notification.handler.ts`

**Key Acceptance Criteria:**
- [ ] Listener for `conversation.updated` event → updates store + invalidates TanStack Query
- [ ] Listener for `message.sent` / `message.failed` → updates message status in timeline
- [ ] Listener for `typing.started` / `typing.stopped` → updates typing store with timeout
- [ ] Listener for `presence.updated` → updates presence store with status
- [ ] Listener for `notification.received` → creates notification + increments badge
- [ ] Listener for `conversation.reopened` → updates conversation status + triggers refresh
- [ ] All listeners update Zustand store atomically (no race conditions)
- [ ] TanStack Query cache invalidated after each store update
- [ ] Error handling for malformed/unexpected events (log warning, skip silently)
- [ ] Event deduplication by event ID + timestamp (prevent duplicates on reconnect)
- [ ] No duplicate event processing within 60-second window
- [ ] All event handlers are pure functions (no side effects outside store)
- [ ] Unit tests verify each listener with mock events
- [ ] E2E test verifies real-time update latency <500ms

**Implementation Notes:**
- Create event handler factory to avoid closure issues
- Implement deduplication with `Set<eventId>` with auto-cleanup (TTL 1 minute)
- Use TanStack Query `queryClient.invalidateQueries()` after updates
- Handle WebSocket event schemas: validate structure before processing
- Test with socket.io mock server: emit events programmatically
- Consider event ordering: apply events in server-supplied order (timestamp + sequence)

**Testing Strategy:**
- Unit test: Each listener with mock event data
- Unit test: Event deduplication (verify second duplicate is ignored)
- Unit test: Cache invalidation (verify correct query keys)
- Unit test: Error handling (malformed event, missing fields)
- E2E test: Multiple concurrent events processed in order
- E2E test: Real-time latency measurement

**Estimated Hours:** 10-12

---

### FE-005-T04: Real-Time Conversation Cache Updates

**Complexity:** Large (L)  
**Dependency:** FE-005-T03  
**Files:**
- Modify: `src/stores/conversation-cache.store.ts`
- Create: `src/hooks/useCacheSync.ts`

**Key Acceptance Criteria:**
- [ ] Conversation list updates when `conversation.updated` event received
- [ ] Conversation detail view updates in real-time when opened
- [ ] Message timeline appends new messages without page reload
- [ ] Conversation sort order preserved (latest activity first) after updates
- [ ] Unread count incremented/decremented correctly
- [ ] Filter state (status, tags, assignee) persisted during cache updates
- [ ] Search results auto-update if conversation matches query
- [ ] Bulk action state cleared on cache invalidation
- [ ] No race conditions when user manually refreshes + WebSocket event arrives
- [ ] Optimistic updates for user actions (send message): show immediately, then sync
- [ ] Rollback to previous state on API error
- [ ] Message deduplication: prevent duplicates if WebSocket + REST both process
- [ ] Unit tests cover: cache update scenarios, race conditions, rollback
- [ ] E2E test verifies multiple concurrent updates to same conversation

**Implementation Notes:**
- Use TanStack Query `setQueryData()` for optimistic updates
- Implement rollback via `cancelMutations()` on error
- Cache key structure: `['conversations']` (list), `['conversation', id]` (detail), `['conversation', id, 'messages']` (timeline)
- Handle message ID mapping: tempId (optimistic) → serverId (confirmed)
- Implement message reconciliation on sync
- Test with multiple client instances (simulate multi-tab scenario)

**Testing Strategy:**
- Unit test: Cache update with new data
- Unit test: Optimistic updates + rollback on error
- Unit test: Message deduplication
- Unit test: Race condition handling (refresh + WebSocket)
- Integration test: Full flow from send → status update
- E2E test: Multiple users updating same conversation

**Estimated Hours:** 12-14

---

### FE-005-T05: Typing Indicators UI Component

**Complexity:** Medium (M)  
**Dependency:** FE-005-T04  
**Files:**
- Create: `src/components/TypingIndicator.tsx`
- Create: `src/hooks/useTyping.ts`

**Key Acceptance Criteria:**
- [ ] Component `<TypingIndicator />` renders in conversation header
- [ ] Single user: "Alice is typing..."
- [ ] Two users: "Alice and Bob are typing..."
- [ ] Three+ users: "Alice, Bob and 2 others are typing..."
- [ ] Animated dots or pulse effect (CSS or Framer Motion)
- [ ] Indicator disappears automatically after 5 seconds of inactivity
- [ ] Max 3 users shown explicitly (overflow handled)
- [ ] Accessible: ARIA labels for animation, screen reader support
- [ ] No layout shift: fixed height container reserves space
- [ ] Styled with DaisyUI/Tailwind CSS
- [ ] Works with real-time message arrivals (doesn't interfere)
- [ ] Unit tests cover: all user count scenarios, timeout behavior
- [ ] E2E test verifies: appearance on keystroke, disappearance after 5s

**Implementation Notes:**
- Use `useTyping(conversationId)` hook from WebSocket store
- Implement timeout cleanup with `useEffect` + `useRef` for timer
- Animation: CSS animation or Framer Motion (smooth 60 FPS)
- User display logic: sort by typing start time, show top 3 + count
- Test with fake timers (jest.useFakeTimers)

**Testing Strategy:**
- Unit test: Component renders with different user counts
- Unit test: Timeout behavior (5 second cleanup)
- Unit test: Multiple users typing simultaneously
- E2E test: Typing indicator appears/disappears in real-time
- Performance test: No jank during animation

**Estimated Hours:** 8-10

---

## Phase 2: Offline Mode & Message Status

### FE-005-T06: Offline Queue Store

**Complexity:** Large (L)  
**Dependency:** FE-005-T02  
**Files:**
- Create: `src/stores/offline-queue.store.ts`
- Create: `src/hooks/useOfflineQueue.ts`

**Key Acceptance Criteria:**
- [ ] Export `useOfflineQueue()` hook
- [ ] Store state shape: `{ messages: OfflineMessage[]; syncing: boolean; syncError?: string }`
- [ ] Messages persist to localStorage (survive page refresh)
- [ ] Action: `addMessage(message)` - add to queue
- [ ] Action: `removeMessage(tempId)` - remove from queue
- [ ] Action: `clearQueue()` - clear all messages
- [ ] Action: `setSyncing(boolean)` - sync status
- [ ] Action: `setSyncError(error)` - error message
- [ ] Max queue size enforced: 50 messages (reject if exceeded)
- [ ] Messages ordered by timestamp (FIFO)
- [ ] localStorage key: `yacc:offline-queue`
- [ ] Queue restored on app startup
- [ ] Memory-efficient: no memory leaks, no circular references
- [ ] Unit tests cover: all actions, persistence, max size limit
- [ ] E2E test verifies: queue survives page refresh

**Implementation Notes:**
- Use Zustand `persist` middleware for localStorage
- Message structure: `{ tempId: string; conversationId: string; body: string; timestamp: ISO8601; status: 'pending'|'syncing'|'failed' }`
- tempId: UUID generated on creation
- Validation: check max size before adding
- Handle localStorage quota exceeded error gracefully

**Testing Strategy:**
- Unit test: Add/remove messages
- Unit test: Max queue size enforcement
- Unit test: localStorage persistence
- Unit test: Queue restoration on startup
- E2E test: Queue survives page refresh
- E2E test: localStorage recovery with corrupted data

**Estimated Hours:** 10-12

---

### FE-005-T07: Offline Detection & Queue Management

**Complexity:** Medium (M)  
**Dependency:** FE-005-T06  
**Files:**
- Create: `src/hooks/useOfflineDetection.ts`
- Create: `src/services/offline-queue.service.ts`

**Key Acceptance Criteria:**
- [ ] `window.addEventListener('offline')` captures disconnection
- [ ] `window.addEventListener('online')` captures reconnection
- [ ] Compose box remains enabled during offline (messages queueable)
- [ ] Offline indicator visible in UI: "Offline mode"
- [ ] Messages added to offline queue when sent during disconnection
- [ ] Queue synced automatically on reconnect (via POST `/api/conversations/messages/batch`)
- [ ] Retry button available for failed sync
- [ ] Queue sync updates message status: pending → sent/failed
- [ ] UI shows queue progress: "2 messages waiting..."
- [ ] Sync error message displayed with context
- [ ] Unit tests cover: online/offline transitions
- [ ] E2E test verifies: offline mode + sync on reconnect

**Implementation Notes:**
- Hook into existing WebSocket connection state (redundant: offline if not connected)
- Integrate with offline queue store
- Batch sync endpoint: `POST /api/conversations/messages/batch`
- Batch sync limit: 50 messages per request
- Sync with exponential backoff on failure
- Test with network throttling: use DevTools offline mode

**Testing Strategy:**
- Unit test: Online/offline event listeners
- Unit test: Queue addition during offline
- Unit test: Batch sync API call
- Integration test: Queue add + sync + status update
- E2E test: Offline mode UI appears/disappears
- E2E test: Messages sync when reconnected

**Estimated Hours:** 8-10

---

### FE-005-T08: Message Status Indicator Component

**Complexity:** Medium (M)  
**Dependency:** FE-005-T04  
**Files:**
- Create: `src/components/MessageStatus.tsx`

**Key Acceptance Criteria:**
- [ ] Component `<MessageStatus status="pending|sent|failed" />` renders per message
- [ ] "Sending..." state with loader animation (spinner)
- [ ] "Sent" state with checkmark icon
- [ ] "Failed" state with error icon + red color
- [ ] Hover tooltip shows full error message
- [ ] Retry button visible for failed messages
- [ ] Click retry button resends message (calls API)
- [ ] Status persists across page refresh
- [ ] No jank or layout shift during status updates
- [ ] Accessible: ARIA labels, keyboard navigation (Tab to retry)
- [ ] Styled with DaisyUI (consistent design system)
- [ ] Unit tests cover: all status states + retry action
- [ ] E2E test verifies: status updates in real-time

**Implementation Notes:**
- Status from TanStack Query cache
- Retry action: calls existing message send API
- Error message: user-friendly (from server response)
- Test with simulated network failures (mock 500 error)
- Icon set: heroicons or Lucide

**Testing Strategy:**
- Unit test: Component rendering for each status
- Unit test: Retry button click
- Unit test: Tooltip display
- E2E test: Status updates in real-time
- E2E test: Retry button functionality

**Estimated Hours:** 8-10

---

### FE-005-T09: Optimistic Message Updates

**Complexity:** Large (L)  
**Dependency:** FE-005-T04, FE-005-T08  
**Files:**
- Create: `src/hooks/useOptimisticMessage.ts`
- Modify: `src/services/message.service.ts`

**Key Acceptance Criteria:**
- [ ] Message appears in timeline immediately after send click
- [ ] Message shows "sending" status (not grey, not disabled)
- [ ] Message includes user avatar + timestamp + content
- [ ] Rollback on error: remove message from timeline, show error UI
- [ ] Retry restores message to timeline (not duplicate)
- [ ] Conversation last message updated optimistically
- [ ] Conversation `updated_at` timestamp updated
- [ ] Unread count updated optimistically
- [ ] Race condition handling: multiple concurrent sends ordered correctly
- [ ] No duplicate messages on network retry
- [ ] Unit tests cover: optimistic update + rollback flows
- [ ] E2E test verifies: message appears before server confirms

**Implementation Notes:**
- Use TanStack Query mutation hooks
- Generate temporary messageId (UUID v4) for optimistic update
- Track mapping: tempId → serverId for reconciliation
- Test with network delays: simulate 2s latency

**Testing Strategy:**
- Unit test: Optimistic update
- Unit test: Rollback on error
- Unit test: Duplicate prevention
- Integration test: Full send flow (optimistic → confirmation)
- E2E test: Message appears immediately
- E2E test: Error handling + retry

**Estimated Hours:** 10-12

---

### FE-005-T10: Offline Compose Box Indicator

**Complexity:** Small (S)  
**Dependency:** FE-005-T07  
**Files:**
- Create: `src/components/OfflineIndicator.tsx`

**Key Acceptance Criteria:**
- [ ] Compose box remains enabled during offline
- [ ] "Offline mode" banner visible above composer
- [ ] Queue status displayed: "2 messages waiting to send..."
- [ ] Sync progress shown during reconnection: "Syncing... 1/2"
- [ ] Visual distinction from online state (color, icon, animation)
- [ ] Accessible: ARIA live region updates for queue status
- [ ] Styled consistently with DaisyUI
- [ ] No performance impact (lightweight)
- [ ] Unit tests cover: UI states (online/offline)
- [ ] E2E test verifies: indicator during offline → online transition

**Implementation Notes:**
- Use `useWebSocketStatus()` + `useOfflineQueue()` hooks
- Live region: `<div aria-live="polite" aria-atomic="true">`
- Tailwind classes: `bg-warning`, `text-warning`, `animate-pulse`

**Testing Strategy:**
- Unit test: Offline state rendering
- Unit test: Queue status display
- E2E test: Indicator appears/disappears
- E2E test: Queue progress updates

**Estimated Hours:** 4-6

---

## Phase 3: Presence & Notifications

### FE-005-T11: User Presence Store & Tracking

**Complexity:** Medium (M)  
**Dependency:** FE-005-T02  
**Files:**
- Create: `src/stores/presence.store.ts`
- Create: `src/hooks/usePresence.ts`
- Create: `src/hooks/useActivityTracking.ts`

**Key Acceptance Criteria:**
- [ ] Export `useUserPresence(userId)` hook with proper typing
- [ ] Presence states: `'online' | 'offline' | 'away' | 'unknown'`
- [ ] Presence updates within 1 second of status change
- [ ] Away status set after 15 minutes of inactivity
- [ ] Mouse/keyboard event triggers "online" status (from away)
- [ ] Presence tracked per user: `{ userId: { status: 'online'; lastSeen: ISO8601 } }`
- [ ] Presence cleared on logout (delete user entry)
- [ ] Activity tracking via listeners: `mousemove`, `keypress`, `click`
- [ ] Activity debounced (only update store every 5 minutes)
- [ ] Memory-efficient: no memory leaks, cleanup on unmount
- [ ] Unit tests cover: state transitions, activity tracking
- [ ] E2E test verifies: presence updates in real-time

**Implementation Notes:**
- Use `useWebSocketStore()` for presence map
- Activity tracking: debounce with `lodash/debounce` or custom utility
- Broadcast presence via `presence.ping` event (heartbeat)
- Test with fake timers: `jest.useFakeTimers()`

**Testing Strategy:**
- Unit test: Presence state transitions
- Unit test: Activity tracking + debouncing
- Unit test: Away status after 15 min
- Integration test: Activity clears away status
- E2E test: Presence updates in real-time

**Estimated Hours:** 8-10

---

### FE-005-T12: Presence Indicator Component

**Complexity:** Small (S)  
**Dependency:** FE-005-T11  
**Files:**
- Create: `src/components/PresenceIndicator.tsx`

**Key Acceptance Criteria:**
- [ ] Component `<PresenceIndicator userId={userId} />` renders inline
- [ ] Green dot for "online" status
- [ ] Gray dot for "offline" status
- [ ] Yellow dot for "away" status
- [ ] Hover tooltip shows: "Alice is online" or "Offline · Last seen 2 hours ago"
- [ ] Updates in real-time when status changes
- [ ] No layout shift (fixed size, e.g., 8x8px)
- [ ] Accessible: ARIA label with status text
- [ ] Styled with DaisyUI (consistent design)
- [ ] Unit tests cover: all status states
- [ ] E2E test verifies: real-time status updates

**Implementation Notes:**
- Reusable component with userId prop
- Tooltip library: DaisyUI tooltip or Radix UI
- Use `useUserPresence(userId)` hook
- Optional subtle pulse animation for online status

**Testing Strategy:**
- Unit test: Rendering for each status
- Unit test: Tooltip display
- E2E test: Status updates in real-time

**Estimated Hours:** 4-6

---

### FE-005-T13: Notification Center Component

**Complexity:** Medium (M)  
**Dependency:** FE-005-T03  
**Files:**
- Create: `src/components/NotificationCenter.tsx`
- Create: `src/components/NotificationBell.tsx`

**Key Acceptance Criteria:**
- [ ] Bell icon in header with unread badge count
- [ ] Click bell opens notification panel (slide-out or dropdown)
- [ ] Notifications listed in reverse chronological order (newest first)
- [ ] Notification types supported: `'assignment'`, `'mention'`, `'unread'`
- [ ] Display per notification: type icon, actor name, action text, timestamp
- [ ] Dismiss button removes notification from panel
- [ ] "Clear all" button clears all notifications
- [ ] Click notification navigates to conversation
- [ ] Relative timestamps: "2 minutes ago", "1 hour ago"
- [ ] Real-time badge count updates (WebSocket driven)
- [ ] Panel closes on outside click
- [ ] Keyboard navigation: Escape to close, Tab through items
- [ ] Accessible: ARIA roles (`role="dialog"`), keyboard support
- [ ] Styled with DaisyUI
- [ ] Unit tests cover: all notification types, interactions
- [ ] E2E test verifies: real-time updates, navigation

**Implementation Notes:**
- API: GET `/api/notifications` (paginated)
- Dismiss: PUT `/api/notifications/:id` (mark read or delete)
- Real-time updates via WebSocket listener
- Panel: DaisyUI drawer or dropdown
- Use TanStack Query for notification list

**Testing Strategy:**
- Unit test: Component rendering
- Unit test: Dismiss + clear interactions
- Integration test: Navigation to conversation
- E2E test: Real-time badge updates
- E2E test: Panel interactions (open/close)

**Estimated Hours:** 10-12

---

### FE-005-T14: Notification Store & Unread Badges

**Complexity:** Medium (M)  
**Dependency:** FE-005-T13  
**Files:**
- Create: `src/stores/notifications.store.ts`

**Key Acceptance Criteria:**
- [ ] Export `useNotifications()` hook
- [ ] Store state shape: `{ notifications: Notification[]; unreadCount: number }`
- [ ] Action: `addNotification(notification)` - add to list
- [ ] Action: `removeNotification(id)` - remove from list
- [ ] Action: `markAsRead(id)` - decrement unread count
- [ ] Action: `clearAll()` - clear all notifications
- [ ] Unread count increments on new notification
- [ ] Unread count decrements on mark as read
- [ ] Notifications fetched on app load via GET `/api/notifications`
- [ ] Real-time updates via WebSocket listener
- [ ] Optional: localStorage persistence (cache notifications)
- [ ] Memory-efficient: max 100 notifications cached (older ones discarded)
- [ ] Deduplication: no duplicate notification objects
- [ ] Unit tests cover: all actions, deduplication
- [ ] E2E test verifies: badge updates in real-time

**Implementation Notes:**
- TanStack Query for notification list fetch
- Zustand for unread count (separate state)
- Keep notifications in reverse chronological order
- Expire old notifications (>24 hours) on each refresh

**Testing Strategy:**
- Unit test: State mutations
- Unit test: Deduplication logic
- Integration test: Notification fetch + add
- E2E test: Badge count updates

**Estimated Hours:** 8-10

---

### FE-005-T15: Unread Badge Updates

**Complexity:** Small (S)  
**Dependency:** FE-005-T14  
**Files:**
- Modify: `src/components/InboxList/ConversationItem.tsx`

**Key Acceptance Criteria:**
- [ ] Unread badge visible on conversation item
- [ ] Badge shows count: "3"
- [ ] Updates in real-time when new messages arrive
- [ ] Badge disappears when conversation opened (count = 0)
- [ ] Badge updates on new inbound message (WebSocket driven)
- [ ] Red/warning color for visual prominence
- [ ] No layout shift (fixed badge size)
- [ ] Accessible: ARIA label with count
- [ ] Unit tests cover: badge updates
- [ ] E2E test verifies: real-time badge updates

**Implementation Notes:**
- Use conversation cache from TanStack Query
- Badge: DaisyUI badge component
- Click conversation: calls GET `/api/conversations/:id/markAsRead` (or handled on open)
- Update cache after marking as read

**Testing Strategy:**
- Unit test: Badge rendering
- Unit test: Count updates
- E2E test: Real-time badge update
- E2E test: Badge disappears when read

**Estimated Hours:** 4-6

---

## Phase 4: Reconnection & Backlog Sync

### FE-005-T16: Reconnection Logic with Exponential Backoff

**Complexity:** Large (L)  
**Dependency:** FE-005-T01  
**Files:**
- Create: `src/lib/backoff.ts` (utility)
- Modify: `src/lib/socket.ts`

**Key Acceptance Criteria:**
- [ ] Backoff sequence: 1s, 2s, 4s, 8s, 16s, 32s, 60s (correct exponential)
- [ ] Max 5 reconnection attempts (give up after 5)
- [ ] Exponential backoff implemented correctly (not linear)
- [ ] Jitter added to prevent thundering herd (±25%)
- [ ] Reconnect attempt number tracked in Zustand store
- [ ] Manual retry button available after 5 failures
- [ ] User notified of reconnection status (UI banner)
- [ ] No duplicate reconnection attempts (prevent race)
- [ ] Socket.io configured correctly: `{ reconnection: true, reconnectionDelay: ..., ... }`
- [ ] Unit tests verify: backoff timing calculations
- [ ] E2E test verifies: reconnection behavior with simulated network failure

**Implementation Notes:**
- Use Socket.io built-in reconnection (configure in client init)
- Backoff formula: `Math.min(baseDelay * Math.pow(2, attempts), maxDelay)`
- Jitter: `delay * (0.75 + 0.5 * Math.random())`
- Test with fake timers or network simulation

**Testing Strategy:**
- Unit test: Backoff timing calculation
- Unit test: Jitter randomness
- Unit test: Max attempts enforcement
- E2E test: Reconnection attempts
- E2E test: Manual retry functionality

**Estimated Hours:** 10-12

---

### FE-005-T17: Backlog Fetching & Event Sync

**Complexity:** Large (L)  
**Dependency:** FE-005-T16  
**Files:**
- Create: `src/services/backlog.service.ts`
- Create: `src/hooks/useBacklogSync.ts`

**Key Acceptance Criteria:**
- [ ] Backlog request triggered on successful reconnect
- [ ] API endpoint: GET `/api/conversations/events?since=timestamp&limit=50`
- [ ] Pagination support: cursor-based pagination
- [ ] Events returned in chronological order
- [ ] Backlog merged into cache atomically
- [ ] Event deduplication: skip if already processed
- [ ] No UI freeze during large backlog (>1000 events)
- [ ] Sync progress shown: "Syncing... 23/100"
- [ ] Sync error handled gracefully: retry or alert user
- [ ] Backlog truncated after 1 hour (configurable)
- [ ] Memory efficient: paginate large backlogs (20 events per page)
- [ ] Unit tests cover: merge logic, deduplication
- [ ] E2E test verifies: backlog sync after network loss

**Implementation Notes:**
- Track `lastSuccessfulSyncTime` in store
- Paginate if events > 100 (fetch in batches of 20)
- Deduplication: track event IDs received
- Test with large backlog: simulate 1-hour offline period

**Testing Strategy:**
- Unit test: Backlog merge logic
- Unit test: Deduplication
- Unit test: Pagination
- Integration test: Backlog fetch + merge
- E2E test: Large backlog sync
- E2E test: Long offline period recovery

**Estimated Hours:** 12-14

---

### FE-005-T18: Reconnect UI Indicator

**Complexity:** Small (S)  
**Dependency:** FE-005-T16, FE-005-T17  
**Files:**
- Create: `src/components/ReconnectingUI.tsx`

**Key Acceptance Criteria:**
- [ ] "Reconnecting..." banner visible on disconnect
- [ ] Banner disappears on successful reconnect
- [ ] Attempt number shown: "Attempt 2 of 5"
- [ ] Manual retry button available after final failure
- [ ] "Connection lost" error message after 5 attempts
- [ ] Color indicates status: warning (yellow/orange) → error (red)
- [ ] No blocking of user interactions (informational only)
- [ ] Keyboard accessible (Tab focus, Escape to close)
- [ ] Styled with DaisyUI
- [ ] Unit tests cover: UI state rendering
- [ ] E2E test verifies: banner appearance/disappearance

**Implementation Notes:**
- Use `useWebSocketStatus()` hook
- Banner: DaisyUI alert component
- Manual retry: `socket.disconnect()` + `socket.connect()`

**Testing Strategy:**
- Unit test: Component rendering states
- E2E test: Banner appearance on disconnect
- E2E test: Manual retry functionality

**Estimated Hours:** 4-6

---

## Phase 5: Testing & Polish

### FE-005-T19: Comprehensive Unit Tests

**Complexity:** Large (L)  
**Dependency:** All T01-T18  
**Files:**
- Create: `src/**/__tests__/` (co-located with source)

**Key Acceptance Criteria:**
- [ ] Tests for `useWebSocket()` hook: connect, disconnect, reconnect
- [ ] Tests for `useWebSocketStore()`: all state mutations
- [ ] Tests for `useOfflineQueue()`: add, remove, sync
- [ ] Tests for `useNotifications()`: add, dismiss, clear
- [ ] Tests for `useUserPresence()`: state transitions
- [ ] Tests for event handlers: dedup, cache update, error handling
- [ ] Tests for components: TypingIndicator, PresenceIndicator, NotificationCenter, ReconnectingUI, MessageStatus, OfflineIndicator
- [ ] Tests for utilities: backoff calc, event serialization, dedup logic
- [ ] Mock Socket.io server: socket.io-client-mock
- [ ] Mock TanStack Query: MSW or vitest mocking
- [ ] Mock localStorage: vitest mock
- [ ] Test async flows: fake timers
- [ ] Coverage ≥85% overall, ≥90% for critical paths
- [ ] All tests passing
- [ ] No snapshot tests (explicit assertions only)

**Implementation Notes:**
- Test framework: Vitest
- Mock library: socket.io-client-mock
- Mock TanStack Query: use `queryClient` in test setup
- Test database: optional (in-memory for integration)
- Organize: `__tests__/` co-located with source

**Testing Strategy:**
- Unit test coverage matrix
- Integration test scenarios
- Edge case coverage
- Performance test stubs

**Estimated Hours:** 16-20

---

### FE-005-T20: E2E Tests & Performance Benchmarks

**Complexity:** Large (L)  
**Dependency:** All T01-T18  
**Files:**
- Create: `e2e/features/websocket/` (Playwright)
- Create: `e2e/features/offline-queue/`
- Create: `e2e/features/presence/`
- Create: `e2e/features/notifications/`

**Key Acceptance Criteria:**
- [ ] E2E test: real-time conversation update (<500ms)
- [ ] E2E test: message send + status update (pending → sent)
- [ ] E2E test: typing indicator appears/disappears
- [ ] E2E test: offline → online reconnection
- [ ] E2E test: offline queue sync on reconnect
- [ ] E2E test: presence update on login/logout
- [ ] E2E test: notification appears + dismiss works
- [ ] E2E test: multiple concurrent messages handled
- [ ] E2E test: network failure handling + retry
- [ ] E2E test: tab switching (SharedWorker or localStorage sync)
- [ ] Performance test: real-time update latency <500ms
- [ ] Performance test: UI frame rate ≥60 FPS
- [ ] Performance test: memory <100MB with 1000+ events
- [ ] Performance test: offline queue sync <10s
- [ ] Load test: 10+ concurrent users (Lighthouse)
- [ ] All tests passing with >95% reliability
- [ ] Documentation of test scenarios (README)

**Implementation Notes:**
- Test framework: Playwright
- Mock backend: Playwright fixtures + custom server
- Benchmark: Lighthouse or custom timers
- Network throttling: DevTools API
- Stress test: fake high-latency network

**Testing Strategy:**
- E2E test scenarios
- Performance benchmarks
- Load testing
- Stress testing

**Estimated Hours:** 16-20

---

# FE-006: Conversation Timeline & Advanced Features (22 Tasks)

## Phase 1: Timeline Display & Message Management

### FE-006-T01: Timeline Message Display

**Complexity:** Large (L)  
**Dependency:** FE-004, FE-005-T04  
**Files:**
- Create: `src/components/Timeline/Timeline.tsx`
- Create: `src/components/Timeline/MessageItem.tsx`
- Create: `src/components/Timeline/MessageGroup.tsx`
- Create: `src/hooks/useTimeline.ts`

**Key Acceptance Criteria:**
- [ ] Messages displayed in chronological order (oldest first, newest last)
- [ ] Message grouping: messages from same sender within 5-minute window grouped together
- [ ] Sender info visible: avatar (32x32px), name, timestamp (e.g., "2:30 PM")
- [ ] Message status visible: icon for pending/sent/failed
- [ ] Unread marker visible (divider line with text)
- [ ] Auto-scroll to newest message on conversation open
- [ ] Pagination or infinite scroll: load 50 messages at a time
- [ ] No duplicate messages displayed
- [ ] Performance: 100+ messages render without jank (60 FPS minimum)
- [ ] Mobile-responsive: messages wrap correctly on small screens
- [ ] Accessible: ARIA labels for messages, semantic HTML
- [ ] Unit tests cover: grouping logic, ordering, deduplication
- [ ] E2E test verifies: render performance (Lighthouse CLS/LCP)

**Implementation Notes:**
- Use react-window for virtual scrolling (1000+ messages)
- Message grouping: group by (senderId, createdAt - 5min window)
- Pagination: cursor-based (createdAt), load older on scroll up
- Status icon: pending (spinner), sent (checkmark), failed (X)
- Test with 100+ messages: measure frame rate

**Testing Strategy:**
- Unit test: Grouping logic with various timestamps
- Unit test: Ordering/sorting correctness
- Unit test: Deduplication
- Integration test: Message pagination
- E2E test: Render performance with 100 messages
- E2E test: Mobile responsiveness

**Estimated Hours:** 12-14

---

### FE-006-T02: Message Edit & Delete

**Complexity:** Large (L)  
**Dependency:** FE-006-T01  
**Files:**
- Create: `src/components/Timeline/MessageActions.tsx`
- Create: `src/components/Timeline/MessageEditor.tsx`
- Modify: `src/components/Timeline/MessageItem.tsx`

**Key Acceptance Criteria:**
- [ ] Edit button visible on own messages only (check `userId === currentUserId` or admin)
- [ ] Delete button visible on own messages + admin role
- [ ] Edit button opens inline editor with original text
- [ ] Editor shows full message text (pre-filled)
- [ ] Save button sends PUT request with new text
- [ ] Cancel button closes editor without saving (no changes)
- [ ] "Edited" label appears with timestamp (e.g., "Edited 2:35 PM")
- [ ] Delete button shows confirmation modal (prevent accidents)
- [ ] Deleted message shows placeholder: "This message was deleted"
- [ ] Actions logged in audit trail (backend requirement)
- [ ] Changes broadcast via WebSocket to other users
- [ ] Keyboard shortcut: Ctrl+Enter to save edit
- [ ] Undo button (Phase 2 feature - can defer)
- [ ] Unit tests cover: edit/delete flows
- [ ] E2E test verifies: edit persistence, WebSocket broadcast

**Implementation Notes:**
- Edit mode: TanStack Query mutation
- Optimistic update: show edited text immediately, rollback on error
- Confirmation modal: DaisyUI modal component
- API endpoints: PUT `/api/conversations/:id/messages/:messageId`, DELETE `/api/conversations/:id/messages/:messageId`

**Testing Strategy:**
- Unit test: Edit UI rendering
- Unit test: Delete confirmation
- Unit test: API calls
- Integration test: Edit flow (call → cache update)
- E2E test: Edit persistence
- E2E test: WebSocket broadcast to other clients

**Estimated Hours:** 10-12

---

### FE-006-T03: System Events in Timeline

**Complexity:** Medium (M)  
**Dependency:** FE-006-T01  
**Files:**
- Create: `src/components/Timeline/SystemEvent.tsx`

**Key Acceptance Criteria:**
- [ ] Assignment event: "John assigned Alice to this conversation"
- [ ] Tag event: "Alice added tag 'Urgent'"
- [ ] Status event: "Status changed from Open to Pending"
- [ ] Note event: "Alice added a note" + note preview (first 100 chars)
- [ ] All events styled consistently: lighter background, gray text, icon
- [ ] Timestamp visible for each event
- [ ] User info visible: avatar, name
- [ ] No events missing or duplicated
- [ ] Events persist across refresh (from API)
- [ ] Real-time updates via WebSocket listener
- [ ] Unit tests cover: event display for all types
- [ ] E2E test verifies: event visibility in timeline

**Implementation Notes:**
- System events fetched with message timeline (same API call)
- Event types: from API enum (conversation.assigned, conversation.tagged, etc.)
- Style: DaisyUI alert component or custom box
- Event preview: truncated (click for full view)

**Testing Strategy:**
- Unit test: Component rendering for each event type
- Unit test: Event data display
- Integration test: Timeline with mixed messages + events
- E2E test: Event visibility

**Estimated Hours:** 8-10

---

### FE-006-T04: Attachment Preview & Download

**Complexity:** Large (L)  
**Dependency:** FE-006-T01  
**Files:**
- Create: `src/components/Timeline/AttachmentPreview.tsx`
- Create: `src/components/Timeline/ImageLightbox.tsx`

**Key Acceptance Criteria:**
- [ ] Images display as thumbnails (150x150px, aspect ratio maintained)
- [ ] Click thumbnail opens lightbox (full-size, zoomable)
- [ ] PDF files show embed (iframe) OR download link
- [ ] Document files (Word, Excel) show icon + name + size
- [ ] Video files show play button + metadata (duration, size)
- [ ] Unsupported file types show generic file icon
- [ ] File info visible: name, size (e.g., "2.5 MB"), upload time
- [ ] Download link opens file in new tab OR triggers download
- [ ] No loading delay (files cached on R2)
- [ ] Mobile-friendly: responsive lightbox, swipe to close
- [ ] Lightbox works on mobile: pinch to zoom, swipe navigation
- [ ] Accessibility: alt text for images, keyboard navigation (arrow keys)
- [ ] Unit tests cover: image/file handling
- [ ] E2E test verifies: download functionality, lightbox UI

**Implementation Notes:**
- Lightbox library: PhotoSwipe or react-medium-image-zoom
- Image URLs from R2 CDN (already cached)
- MIME type detection: use file extension or Content-Type header
- Download: `<a href={url} download>` or fetch + blob
- Alt text: from attachment metadata or filename

**Testing Strategy:**
- Unit test: Thumbnail rendering
- Unit test: MIME type detection
- Integration test: Lightbox opening
- E2E test: Download functionality
- E2E test: Lightbox interaction (zoom, navigation)

**Estimated Hours:** 10-12

---

### FE-006-T05: Unread Marker & Status

**Complexity:** Small (S)  
**Dependency:** FE-006-T01  
**Files:**
- Create: `src/components/Timeline/UnreadMarker.tsx`

**Key Acceptance Criteria:**
- [ ] Unread marker visible between read/unread messages
- [ ] Marker shows "X unread messages below" or similar text
- [ ] Marker updates when conversation opened (marks as read)
- [ ] First unread message highlighted with subtle background color
- [ ] Auto-scroll to unread marker on conversation open
- [ ] Marker disappears when all messages marked as read
- [ ] Unit tests cover: marker positioning
- [ ] E2E test verifies: marker placement correctness

**Implementation Notes:**
- Track `lastReadAt` in conversation cache
- Filter: messages before lastReadAt = read, after = unread
- Marker component: divider with text + icon
- Position: between last read message and first unread

**Testing Strategy:**
- Unit test: Marker visibility logic
- Unit test: Text content
- E2E test: Marker positioning
- E2E test: Auto-scroll to marker

**Estimated Hours:** 4-6

---

### FE-006-T06: Message Search Within Conversation

**Complexity:** Medium (M)  
**Dependency:** FE-006-T01, FE-004  
**Files:**
- Create: `src/components/Timeline/SearchBar.tsx`
- Create: `src/hooks/useConversationSearch.ts`

**Key Acceptance Criteria:**
- [ ] Search box visible in conversation header
- [ ] Search queries message body + sender name (server-side)
- [ ] Results highlighted in timeline: `<mark>` tag with yellow background
- [ ] Result count shown: "3 results found"
- [ ] Previous/next buttons to navigate between results
- [ ] Clear button resets search (shows full timeline)
- [ ] Response time <500ms
- [ ] Empty search returns full timeline
- [ ] Mobile-friendly: hidden on small screens or search icon style
- [ ] Case-insensitive search
- [ ] Unit tests cover: search flow
- [ ] E2E test verifies: highlighting accuracy

**Implementation Notes:**
- Search endpoint: GET `/api/conversations/:id/messages/search?q=query`
- Highlight: `<mark>` tag (Tailwind: `bg-yellow-200`)
- Navigation: scroll to result + focus
- Debounce search input: 300ms

**Testing Strategy:**
- Unit test: Search component
- Unit test: Search API call
- Integration test: Full search flow
- E2E test: Highlighting accuracy
- E2E test: Navigation between results

**Estimated Hours:** 8-10

---

## Phase 2: Interactions & Rich Text

### FE-006-T07: Inline Emoji Reactions

**Complexity:** Large (L)  
**Dependency:** FE-006-T01, FE-005-T03  
**Files:**
- Create: `src/components/Timeline/EmojiReactions.tsx`
- Create: `src/components/EmojiPicker.tsx`

**Key Acceptance Criteria:**
- [ ] Hover message reveals reaction picker button (+ icon)
- [ ] Click picker opens emoji picker (native or custom)
- [ ] Select emoji adds reaction to message
- [ ] Reaction displayed as pill: emoji + count (e.g., "👍 3")
- [ ] Hover/click reaction pill shows who reacted ("Alice, Bob, +1 more")
- [ ] Click own reaction pill again removes it
- [ ] Max 10 different reactions per message (enforced)
- [ ] Real-time updates via WebSocket (reaction.added/removed events)
- [ ] Reactions sync across tabs/windows
- [ ] Mobile: long-press message → reaction picker
- [ ] Accessibility: ARIA labels, keyboard navigation
- [ ] Unit tests cover: reaction flows
- [ ] E2E test verifies: add/remove reactions

**Implementation Notes:**
- Reaction data: `Record<emoji, userId[]>` in message object
- Picker library: emoji-picker-element or native input
- Max reactions: enforce on client + server
- WebSocket events: `reaction.added`, `reaction.removed`
- API: POST `/api/conversations/:id/messages/:messageId/reactions`

**Testing Strategy:**
- Unit test: Add/remove reactions
- Unit test: Max reaction enforcement
- Integration test: Reaction API call
- E2E test: Real-time reaction updates
- E2E test: Multiple users reacting

**Estimated Hours:** 10-12

---

### FE-006-T08: @Mention Autocomplete

**Complexity:** Large (L)  
**Dependency:** FE-006-T09 (Rich Text Editor)  
**Files:**
- Create: `src/components/MentionAutocomplete.tsx`
- Create: `src/hooks/useMentionAutocomplete.ts`

**Key Acceptance Criteria:**
- [ ] Type @ in editor triggers autocomplete dropdown
- [ ] Dropdown shows matching users (filtered by name/email)
- [ ] Search users: filter as you type
- [ ] Click user inserts @username mention at cursor position
- [ ] Multiple @mentions in single message supported
- [ ] @mention formatted as highlighted link (blue, clickable)
- [ ] Mentioned users notified via WebSocket
- [ ] Mentions persist in message body
- [ ] Autocomplete escapes HTML (no XSS)
- [ ] Arrow keys navigate suggestions, Enter to select
- [ ] Escape closes dropdown
- [ ] Keyboard shortcut: Ctrl+K to open mention list (optional)
- [ ] Mobile-friendly: scrollable dropdown
- [ ] Unit tests cover: autocomplete + insertion
- [ ] E2E test verifies: mention notification delivery

**Implementation Notes:**
- Autocomplete library: Downshift or react-autocomplete
- Trigger: detect @ character + run regex
- User list: GET `/api/users` (cached, debounced search)
- Mention format: `@username` (serialized in message body)
- Notification: parse message body for @mentions, create notification

**Testing Strategy:**
- Unit test: Autocomplete filtering
- Unit test: Mention insertion
- Integration test: User list fetch
- E2E test: Mention notification
- E2E test: Multiple mentions in one message

**Estimated Hours:** 12-14

---

### FE-006-T09: Rich Text Editor with Markdown

**Complexity:** Large (L)  
**Dependency:** FE-005  
**Files:**
- Create: `src/components/RichTextEditor/RichTextEditor.tsx`
- Create: `src/components/RichTextEditor/EditorToolbar.tsx`
- Create: `src/hooks/useMarkdownPreview.ts`

**Key Acceptance Criteria:**
- [ ] Editor accepts plain text + markdown syntax
- [ ] Toolbar buttons: bold, italic, code, link, list, blockquote, heading
- [ ] Preview mode shows rendered markdown (side-by-side or toggle)
- [ ] **bold** syntax works: Ctrl+B or `**text**`
- [ ] _italic_ syntax works: Ctrl+I or `_text_`
- [ ] `code` syntax works: backticks or Ctrl+`
- [ ] ```code block``` syntax works: triple backticks
- [ ] [link](url) syntax works
- [ ] - lists work: dash or asterisk
- [ ] Emoji picker integrated (button in toolbar)
- [ ] Paste image uploads + embeds in message body
- [ ] Character count visible (limit 4000 chars)
- [ ] Draft auto-saved to localStorage
- [ ] Restore draft on page reload
- [ ] Mobile-friendly: touch-friendly toolbar
- [ ] Accessibility: ARIA labels, keyboard shortcuts
- [ ] Unit tests cover: markdown parsing
- [ ] E2E test verifies: draft save/restore

**Implementation Notes:**
- Editor library: Slate, ProseMirror, or TipTap (or simple textarea + regex)
- Markdown parser: remark + rehype
- HTML sanitizer: DOMPurify (prevent XSS)
- Draft storage: localStorage key `yacc:draft-{conversationId}`
- Auto-save: debounce after 1s inactivity

**Testing Strategy:**
- Unit test: Markdown parsing
- Unit test: HTML output safety
- Integration test: Draft save/restore
- E2E test: Draft persistence across reload
- E2E test: All markdown features

**Estimated Hours:** 14-16

---

### FE-006-T10: Editor Toolbar & Formatting

**Complexity:** Medium (M)  
**Dependency:** FE-006-T09  
**Files:**
- Modify: `src/components/RichTextEditor/EditorToolbar.tsx`

**Key Acceptance Criteria:**
- [ ] Toolbar visible above editor
- [ ] Bold button (Ctrl+B): wraps with `**`
- [ ] Italic button (Ctrl+I): wraps with `_`
- [ ] Code button (Ctrl+`): wraps with backticks
- [ ] Link button: opens modal for URL input
- [ ] List button: converts to bullet list
- [ ] Blockquote button: adds `> `
- [ ] Heading button: adds `# `
- [ ] Emoji picker button (integrates with T12)
- [ ] Preview toggle button
- [ ] Undo/redo buttons (if editor supports)
- [ ] Clear formatting button
- [ ] Character counter: "123/4000"
- [ ] All keyboard shortcuts documented
- [ ] Mobile-friendly: icon buttons, no hover
- [ ] Accessibility: ARIA labels, keyboard nav
- [ ] Unit tests cover: all buttons
- [ ] E2E test verifies: formatting works

**Implementation Notes:**
- Toolbar: DaisyUI button group
- Button icons: heroicons or Lucide
- Shortcuts: keyboard event listeners
- Link modal: simple input with validation

**Testing Strategy:**
- Unit test: Button functionality
- Unit test: Keyboard shortcuts
- E2E test: Formatting output
- E2E test: All toolbar features

**Estimated Hours:** 8-10

---

### FE-006-T11: Markdown Preview Mode

**Complexity:** Medium (M)  
**Dependency:** FE-006-T09  
**Files:**
- Create: `src/components/RichTextEditor/MarkdownPreview.tsx`

**Key Acceptance Criteria:**
- [ ] Toggle button to show/hide preview
- [ ] Preview shows rendered markdown
- [ ] Side-by-side layout: edit left, preview right
- [ ] Preview updates in real-time (debounced 300ms)
- [ ] HTML sanitized with DOMPurify (no XSS)
- [ ] Code blocks formatted with syntax highlighting (optional: highlight.js)
- [ ] Links clickable in preview
- [ ] Images render in preview (if markdown includes image links)
- [ ] Responsive: stacked layout on mobile
- [ ] No performance impact (debouncing prevents lag)
- [ ] Unit tests cover: rendering
- [ ] E2E test verifies: preview accuracy

**Implementation Notes:**
- Render library: remark + rehype
- Sanitizer: DOMPurify
- Debounce preview updates: 300ms
- Syntax highlighting: highlight.js (optional)
- CSS: Tailwind prose styles

**Testing Strategy:**
- Unit test: Markdown rendering
- Unit test: HTML sanitization
- Integration test: Preview updates
- E2E test: Preview accuracy

**Estimated Hours:** 8-10

---

### FE-006-T12: Emoji Picker Integration

**Complexity:** Small (S)  
**Dependency:** FE-006-T09, FE-006-T07  
**Files:**
- Modify: `src/components/EmojiPicker.tsx`

**Key Acceptance Criteria:**
- [ ] Emoji picker button in toolbar (FE-006-T10)
- [ ] Click opens emoji picker (native or custom)
- [ ] Select emoji inserts at cursor position
- [ ] Emoji picker also used for reactions (FE-006-T07)
- [ ] Recent emojis tracked in localStorage
- [ ] Search emoji by name (optional, Phase 2)
- [ ] Mobile-friendly: large touch targets
- [ ] Accessible: keyboard navigation (arrows, Enter)
- [ ] No performance impact
- [ ] Unit tests cover: insertion
- [ ] E2E test verifies: emoji insertion

**Implementation Notes:**
- Library: emoji-picker-element or native input
- Insertion: at cursor position in editor
- Recent emojis: store in Zustand store
- Keyboard: type search, arrows to select

**Testing Strategy:**
- Unit test: Emoji insertion
- Unit test: Recent emojis tracking
- E2E test: Picker functionality

**Estimated Hours:** 6-8

---

## Phase 3: Collaboration & Advanced

### FE-006-T13: Tags Panel

**Complexity:** Medium (M)  
**Dependency:** FE-004  
**Files:**
- Create: `src/components/ConversationRightPanel/TagsPanel.tsx`

**Key Acceptance Criteria:**
- [ ] Tags panel visible in right sidebar
- [ ] Show all tags applied to conversation
- [ ] Add tag: click + search existing tags
- [ ] Create new tag inline (if not found in search)
- [ ] Remove tag with X button
- [ ] Tag colors visible (color picker on creation)
- [ ] Max 10 tags per conversation
- [ ] Tags filterable in inbox (from FE-004)
- [ ] Changes persist (API call)
- [ ] Real-time updates via WebSocket
- [ ] Accessible: ARIA labels, keyboard nav
- [ ] Unit tests cover: tag operations
- [ ] E2E test verifies: add/remove

**Implementation Notes:**
- Tag list: GET `/api/tags` (cached in TanStack Query)
- Add tag: POST `/api/conversations/:id/tags`
- Remove tag: DELETE `/api/conversations/:id/tags/:tagId`
- Create tag: POST `/api/tags` (inline in dropdown)

**Testing Strategy:**
- Unit test: Tag UI rendering
- Unit test: API calls
- Integration test: Tag add/remove flow
- E2E test: Tag persistence

**Estimated Hours:** 8-10

---

### FE-006-T14: Notes Panel & Persistence

**Complexity:** Medium (M)  
**Dependency:** FE-004  
**Files:**
- Create: `src/components/ConversationRightPanel/NotesPanel.tsx`

**Key Acceptance Criteria:**
- [ ] Notes panel visible in right sidebar
- [ ] Show all notes for conversation
- [ ] Add note button opens editor (text area)
- [ ] Display per note: author, timestamp, content
- [ ] Edit own notes (click note to edit)
- [ ] Delete own notes (confirmation modal)
- [ ] @mention support in notes (like editor)
- [ ] Mentioned users notified via WebSocket
- [ ] Notes styled like comments (card format)
- [ ] Notes persist via API
- [ ] Real-time updates via WebSocket
- [ ] Notes visible in timeline as system events
- [ ] Max note length: 2000 characters
- [ ] Accessible: ARIA labels, keyboard nav
- [ ] Unit tests cover: note operations
- [ ] E2E test verifies: add/delete

**Implementation Notes:**
- Note storage: DB table `notes`
- Add note: POST `/api/conversations/:id/notes`
- Edit note: PUT `/api/conversations/:id/notes/:noteId`
- Delete note: DELETE `/api/conversations/:id/notes/:noteId`
- Timeline event: note.created (shows note preview)

**Testing Strategy:**
- Unit test: Note rendering
- Unit test: API calls
- Integration test: Add/edit/delete flow
- E2E test: Note persistence
- E2E test: @mention in note

**Estimated Hours:** 10-12

---

### FE-006-T15: Conversation Status Controls

**Complexity:** Small (S)  
**Dependency:** FE-004  
**Files:**
- Create: `src/components/ConversationRightPanel/StatusControl.tsx`

**Key Acceptance Criteria:**
- [ ] Status dropdown in right panel: open, pending, resolved
- [ ] Priority dropdown in right panel: low, normal, high, urgent
- [ ] Current status/priority visible + highlighted
- [ ] Change triggers API call + cache update
- [ ] Real-time updates via WebSocket
- [ ] Status change logged in audit trail (backend)
- [ ] Changes reflected in inbox (sorting, filtering)
- [ ] Accessible: ARIA labels, keyboard nav
- [ ] Unit tests cover: state changes
- [ ] E2E test verifies: status update

**Implementation Notes:**
- Status enum: open, pending, resolved
- Priority enum: low, normal, high, urgent
- Update: PATCH `/api/conversations/:id` (status, priority fields)
- Styling: DaisyUI dropdown

**Testing Strategy:**
- Unit test: Dropdown rendering
- Unit test: API calls
- Integration test: Status change flow
- E2E test: Inbox update after status change

**Estimated Hours:** 4-6

---

### FE-006-T16: Assignment Panel

**Complexity:** Small (S)  
**Dependency:** FE-004  
**Files:**
- Create: `src/components/ConversationRightPanel/AssignmentPanel.tsx`

**Key Acceptance Criteria:**
- [ ] Current assignee visible with avatar
- [ ] Click to open assignee selector
- [ ] User list shows all active users
- [ ] Search users by name/email
- [ ] Assign/reassign user
- [ ] Unassign (clear assignee)
- [ ] Notification sent to new assignee
- [ ] Real-time updates via WebSocket
- [ ] Assignment logged in audit trail
- [ ] Accessible: ARIA labels, keyboard nav
- [ ] Unit tests cover: assignment
- [ ] E2E test verifies: reassignment

**Implementation Notes:**
- User list: GET `/api/users` (cached)
- Assign: PATCH `/api/conversations/:id` (assignedUserId)
- Notification: system event + notification entry

**Testing Strategy:**
- Unit test: Component rendering
- Unit test: User selection
- Integration test: Assignment flow
- E2E test: Notification delivery

**Estimated Hours:** 4-6

---

### FE-006-T17: Conversation Export (PDF/CSV/JSON)

**Complexity:** Large (L)  
**Dependency:** FE-006-T01  
**Files:**
- Create: `src/services/export.service.ts`

**Key Acceptance Criteria:**
- [ ] Export button in conversation header
- [ ] Export options: PDF, CSV, JSON
- [ ] PDF: formatted timeline (messages, timestamps, sender)
- [ ] CSV: structured table (Date, Sender, Message, Type)
- [ ] JSON: raw message objects + conversation metadata
- [ ] File naming: `conversation-{id}-{date}.{ext}` (e.g., conversation-123-2026-01-26.pdf)
- [ ] Large exports (1000+) handled async (background job)
- [ ] Progress bar shown during generation
- [ ] Download link generated after completion
- [ ] Error handling (retry on failure)
- [ ] No PII exported (or option to redact)
- [ ] File size reasonable (<10MB for 1000 messages)
- [ ] Unit tests cover: export formatting
- [ ] E2E test verifies: export generation

**Implementation Notes:**
- Export endpoint: POST `/api/conversations/:id/export?format=pdf|csv|json`
- PDF: html2pdf or similar (client-side for speed)
- CSV: papaparse or similar
- JSON: JSON.stringify(messages)
- Async: server job, poll status endpoint
- Store exports on R2 temporarily (30-minute expiry)

**Testing Strategy:**
- Unit test: Export formatting
- Unit test: File generation
- Integration test: Export API call
- E2E test: Export flow
- E2E test: Download link

**Estimated Hours:** 12-14

---

### FE-006-T18: Export Modal & Download

**Complexity:** Medium (M)  
**Dependency:** FE-006-T17  
**Files:**
- Create: `src/components/ExportModal.tsx`

**Key Acceptance Criteria:**
- [ ] Export button opens modal dialog
- [ ] Format selector: radio buttons (PDF, CSV, JSON)
- [ ] Download button triggers export
- [ ] Progress bar shows during generation (0-100%)
- [ ] "Generating..." message
- [ ] Error message if export fails (with details)
- [ ] Retry button on failure
- [ ] Download link appears on completion (or auto-download)
- [ ] Close button dismisses modal
- [ ] Keyboard accessible: Escape to close
- [ ] Mobile-friendly: stacked layout
- [ ] Unit tests cover: modal states
- [ ] E2E test verifies: export flow

**Implementation Notes:**
- Modal: DaisyUI modal component
- Radio buttons: HTML input[type=radio]
- Progress: simple percentage (0-100%)
- Download: window.open(url) or fetch + blob

**Testing Strategy:**
- Unit test: Modal rendering
- Unit test: Format selection
- Integration test: Export flow
- E2E test: Modal interactions
- E2E test: Download functionality

**Estimated Hours:** 8-10

---

## Phase 4: Advanced Features & Testing

### FE-006-T19: Virtual Scrolling for Performance

**Complexity:** Large (L)  
**Dependency:** FE-006-T01  
**Files:**
- Modify: `src/components/Timeline/Timeline.tsx`

**Key Acceptance Criteria:**
- [ ] Virtual scrolling implemented with react-window
- [ ] Timeline renders 100+ messages smoothly (60 FPS minimum)
- [ ] Scroll performance: no frame drops
- [ ] Memory usage reasonable (<150MB)
- [ ] Dynamic row height calculation (messages vary in height)
- [ ] Scroll to bottom on new message (auto-scroll)
- [ ] Scroll to unread marker on conversation open
- [ ] Bidirectional scroll: load older messages on scroll up, newer on scroll down
- [ ] No layout shift during scroll or message loading
- [ ] Keyboard navigation: PageUp/PageDown, Home/End
- [ ] No memory leaks on component unmount
- [ ] Unit tests cover: virtualization logic
- [ ] Performance test: render 1000 messages <2s

**Implementation Notes:**
- Library: react-window (FixedSizeList or VariableSizeList)
- Row height: estimate or measure dynamically
- Buffer size: render 20 extra rows above/below viewport
- Scroll-to: use scrollToItem() method
- Test: Profiler API to measure renders

**Testing Strategy:**
- Unit test: Virtual scrolling logic
- Unit test: Scroll handling
- Integration test: Message loading on scroll
- Performance test: 1000 messages render time
- Performance test: Memory usage

**Estimated Hours:** 10-12

---

### FE-006-T20: Markdown & HTML Sanitization

**Complexity:** Medium (M)  
**Dependency:** FE-006-T09  
**Files:**
- Create: `src/lib/sanitize.ts`

**Key Acceptance Criteria:**
- [ ] HTML sanitizer integrated (DOMPurify)
- [ ] No script tags in output
- [ ] No onclick/onerror handlers preserved
- [ ] URL validation (prevent javascript: URLs)
- [ ] Markdown links validated
- [ ] Image src validated (no malicious src)
- [ ] All user input escaped
- [ ] No HTML entities unescaped
- [ ] Security test: XSS injection attempts blocked
- [ ] Unit tests cover: sanitization
- [ ] E2E test verifies: XSS protection

**Implementation Notes:**
- Sanitizer: DOMPurify library
- Config: allow safe tags only (p, div, strong, em, code, a, img, etc.)
- URL validation: whitelist protocols (http, https, mailto)
- Testing: OWASP XSS payloads

**Testing Strategy:**
- Unit test: XSS attack prevention
- Unit test: Safe HTML preservation
- Integration test: Markdown + sanitization
- E2E test: XSS protection

**Estimated Hours:** 8-10

---

### FE-006-T21: Accessibility (WCAG 2.1 AA)

**Complexity:** Medium (M)  
**Dependency:** All T01-T20  
**Files:**
- Modify: All component files for a11y compliance

**Key Acceptance Criteria:**
- [ ] ARIA labels on all interactive elements
- [ ] ARIA live regions for dynamic content (messages, reactions)
- [ ] Keyboard navigation for all UI (Tab, Arrow keys, Enter, Escape)
- [ ] Color contrast ≥4.5:1 (AA standard)
- [ ] Focus indicators visible (clear outline)
- [ ] Screen reader tested (NVDA, JAWS, or VoiceOver)
- [ ] No keyboard traps
- [ ] Semantic HTML (proper heading hierarchy, `<button>`, `<label>`, etc.)
- [ ] Form labels associated with inputs (`htmlFor`)
- [ ] Error messages linked to inputs (`aria-describedby`)
- [ ] Skip links for navigation (optional: Phase 2)
- [ ] Lighthouse a11y score ≥95
- [ ] Unit tests cover: a11y (axe-core)
- [ ] E2E tests check: keyboard navigation

**Implementation Notes:**
- Audit with axe DevTools or Lighthouse
- ARIA roles: main, article, button, link, etc.
- Live regions: `aria-live="polite"` for notifications
- Focus management: focus() on modal open
- Keyboard: Tab, Enter, Space, Arrow keys, Escape
- Testing: axe-core Vitest plugin

**Testing Strategy:**
- Unit test: ARIA attributes
- Integration test: Keyboard navigation
- Accessibility audit: Lighthouse
- Manual test: Screen reader

**Estimated Hours:** 10-12

---

### FE-006-T22: Comprehensive Testing & Optimization

**Complexity:** Large (L)  
**Dependency:** All T01-T21  
**Files:**
- Create: `src/**/__tests__/` (co-located)
- Create: `e2e/features/timeline/`

**Key Acceptance Criteria:**
- [ ] Unit tests for all components (≥80% coverage)
- [ ] Unit tests for markdown parsing + sanitization
- [ ] Unit tests for virtual scrolling
- [ ] Integration tests for message edit/delete flow
- [ ] E2E test: view 100+ message timeline
- [ ] E2E test: search conversation
- [ ] E2E test: edit + delete message
- [ ] E2E test: add emoji reaction
- [ ] E2E test: @mention user
- [ ] E2E test: export conversation (PDF/CSV)
- [ ] Performance test: timeline render <2s
- [ ] Performance test: scroll ≥60 FPS
- [ ] Performance test: memory <150MB
- [ ] Bundle size <100KB (gzipped)
- [ ] Lighthouse scores: >85 (all categories)
- [ ] All tests passing
- [ ] No console errors/warnings

**Implementation Notes:**
- Test framework: Vitest + Playwright
- Mock expensive operations (export, large API calls)
- Performance: React DevTools Profiler
- Bundle: webpack-bundle-analyzer

**Testing Strategy:**
- Unit test coverage matrix
- E2E test scenarios
- Performance benchmarks
- Bundle size analysis

**Estimated Hours:** 14-16

---

---

# Dependency Map & Critical Path

## Task Dependency Graph

```
FE-005-T01 (WebSocket Init)
├── FE-005-T02 (Zustand Store) ────────────────────────┐
│   ├── FE-005-T03 (Event Listeners) ─────────────────┐│
│   │   ├── FE-005-T04 (Cache Updates) ──────────────┐││
│   │   │   ├── FE-005-T05 (Typing Indicators) ─────┐│││
│   │   │   └── FE-006-T01 (Timeline) ◄─────────┐  ││││
│   │   │       ├── FE-006-T02 (Edit/Delete) ───┐ ││││
│   │   │       ├── FE-006-T03 (System Events) ──┤ ││││
│   │   │       ├── FE-006-T04 (Attachments) ────┤ ││││
│   │   │       ├── FE-006-T05 (Unread Marker) ──┤ ││││
│   │   │       ├── FE-006-T06 (Search) ────────┐│ ││││
│   │   │       ├── FE-006-T07 (Reactions) ◄───┐││ ││││
│   │   │       ├── FE-006-T13-T16 (Collab) ───┤││ ││││
│   │   │       ├── FE-006-T19 (V. Scrolling) ──┤││ ││││
│   │   │       └── FE-006-T22 (Testing) ───────┼┼┤ ││││
│   │   │                                      │││ ││││
│   │   └── FE-005-T06 (Offline Queue) ────────┘││ ││││
│   │       ├── FE-005-T07 (Offline Detect) ───││ ││││
│   │       ├── FE-005-T10 (Offline Indicator) ││ ││││
│   │       └── FE-006-T06 (Search) ◄────────┘│ ││││
│   │                                         │ ││││
│   ├── FE-005-T08 (Message Status) ◄─────────┴─┼┴┘│││
│   ├── FE-005-T09 (Optimistic Updates) ◄─────────┼──┤││
│   ├── FE-005-T11 (Presence Store) ────────────────┤││
│   │   ├── FE-005-T12 (Presence Indicator) ────────┤││
│   │   └── FE-006-T01 (Timeline) ◄────────────────┘│││
│   │                                                 ││
│   ├── FE-005-T13 (Notification Center) ───────────┐││
│   └── FE-005-T14 (Notification Store) ────────────┤││
│       └── FE-005-T15 (Unread Badges) ────────────┐│││
│                                                  │││
└── FE-005-T16 (Reconnection) ────────────────────┼┤││
    ├── FE-005-T17 (Backlog Sync) ───────────────┐├┤││
    └── FE-005-T18 (Reconnect UI) ──────────────┐││┤││
                                               │││││
FE-005-T19 (Unit Tests) ◄──────────────────────┼┴─┼┴┘│
FE-005-T20 (E2E Tests) ◄───────────────────────┴─┐ │ │
                                                   │ │ │
FE-006-T08 (Mentions) ◄────────────────────────────┤─┘
FE-006-T09-T11 (Rich Text) ◄──────────────────────┤ │
FE-006-T12 (Emoji Picker) ◄──────────────────────┤ │
FE-006-T17-T18 (Export) ◄──────────────────────────┤
FE-006-T20 (HTML Sanitization) ◄────────────────────│
FE-006-T21 (Accessibility) ◄──────────────────────┐ │
FE-006-T22 (Testing) ◄─────────────────────────────┴─┘
```

## Critical Path Analysis

**FE-005 Critical Path (Longest dependency chain):**
```
T01 (6-8h) → T02 (6-8h) → T03 (10-12h) → T04 (12-14h) → T08 (8-10h) → T09 (10-12h)
Total: 52-64 hours (6-8 days)
```

**FE-006 Critical Path (Longest dependency chain):**
```
T01 (12-14h) → T02 (10-12h) → T17 (12-14h) → T22 (14-16h)
Total: 48-56 hours (6-7 days)
```

**Combined Critical Path (with parallelization):**
```
Week 1-2: FE-005 T01-T05 (Foundation)
Week 2-3: FE-005 T06-T10 + FE-006-T01 (parallel, FE-006 can start after FE-005-T05)
Week 3-5: FE-005 T11-T18 + FE-006-T02-T18 (parallel)
Week 5-6: FE-005 T19-T20 + FE-006-T19-T22 (parallel, testing)
Total: 6-8 weeks with 1 FE developer
```

## Parallelizable Task Groups

**Can start in parallel after initial setup:**
- FE-005-T06-T10 (Offline) can run parallel to FE-005-T03-T05 (Foundation)
- FE-005-T11-T15 (Presence/Notifications) can run parallel to FE-005-T06-T10
- FE-005-T16-T18 (Reconnection) can run parallel to FE-005-T11-T15
- FE-006-T02-T06 (Timeline features) can run parallel to FE-005-T06-T10 or later
- FE-006-T07-T12 (Interactions) can run parallel to FE-006-T02-T06
- FE-006-T13-T18 (Collaboration) can run parallel to FE-006-T07-T12
- FE-005-T19-T20 (Testing) can run parallel with implementation starting after T05

---

# Summary & Quick Reference

## Task Count & Hours by Phase

| Phase | FE-005 | Hours | FE-006 | Hours | Total Hours |
|-------|--------|-------|--------|-------|------------|
| Phase 1 | 5 | 38-46 | 6 | 48-60 | 86-106 |
| Phase 2 | 5 | 40-50 | 6 | 60-74 | 100-124 |
| Phase 3 | 5 | 38-46 | 6 | 54-68 | 92-114 |
| Phase 4 | 3 | 32-40 | 4 | 42-50 | 74-90 |
| Phase 5 | 2 | 32-40 | - | - | 32-40 |
| **TOTAL** | **20** | **180-222** | **22** | **204-252** | **384-474** |

## Recommended Task Sequence

### Week 1 (38-46 hours)
- FE-005-T01 through T05 (WebSocket Foundation)
- **Deliverable:** Real-time conversation updates working

### Week 2 (40-50 hours)
- FE-005-T06 through T10 (Offline Mode)
- **Deliverable:** Message send + status visible, offline mode working

### Week 3 (48-60 hours)
- FE-006-T01 through T06 (Timeline Foundation)
- **Deliverable:** Basic timeline with message display

### Week 4 (38-46 hours)
- FE-005-T11 through T15 (Presence & Notifications)
- **Deliverable:** Presence visible, notifications working

### Week 5 (60-74 hours)
- FE-006-T07 through T12 (Interactions & Rich Text)
- **Deliverable:** Full rich text editing with reactions

### Week 6 (54-68 hours)
- FE-005-T16 through T18 (Reconnection)
- FE-006-T13 through T18 (Collaboration & Advanced)
- **Deliverable:** Complete feature set

### Week 7-8 (74-90 hours)
- FE-005-T19 through T20 (Testing)
- FE-006-T19 through T22 (Testing & Optimization)
- **Deliverable:** ≥85% test coverage, all acceptance criteria met

## Approval Checklist

Before implementation starts, verify:

- [ ] **Product Owner:** Requirements approved (all 42 tasks)
- [ ] **Architect:** Architecture + integration approved
- [ ] **QA:** Test strategy approved (85%+ coverage)
- [ ] **Team Lead:** Timeline realistic, resources allocated
- [ ] **All:** No blocking issues on external teams

## Getting Started Checklist

For each developer:

1. [ ] Read FE-005-006-Summary.md
2. [ ] Read relevant detailed todo list
3. [ ] Read integration guide (understand data flows)
4. [ ] Set up mock Socket.io server
5. [ ] Create feature branch
6. [ ] Start with Task 1 of chosen feature
7. [ ] Follow acceptance criteria religiously
8. [ ] Write tests as you code (TDD preferred)
9. [ ] Create PR per task (not per document)
10. [ ] Request code review + approval

---

**Document Version:** 1.0  
**Created:** 2026-01-26  
**Status:** 🎯 READY FOR IMMEDIATE IMPLEMENTATION  
**Next Step:** Architect/PO approval + mock server setup
