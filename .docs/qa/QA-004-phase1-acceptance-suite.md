# QA-004: Phase 1 Acceptance Testing Suite

**Document**: Phase 1 Comprehensive Acceptance Test Plan  
**Status**: Active - Ready for Test Implementation  
**Scope**: Authentication, Core Inbox, Messaging, Real-Time Updates, Integrations, Message Retry  
**Test Coverage Target**: 90%+ of Phase 1 acceptance criteria  
**Framework**: Playwright (E2E) + API-driven testing  
**Database**: Docker Compose (PostgreSQL 15, Redis 7, Mailhog)

---

## 1. Test Strategy Overview

### Approach
- **API-Driven Testing**: Minimize UI-heavy tests; leverage REST API for setup
- **Deterministic Fixtures**: Reusable test data with fixed IDs for repeatability
- **Role-Based Testing**: Test each role (user, manager, admin, super_admin) separately
- **Error Path Coverage**: Test both happy paths and edge cases (EDGE prefix)
- **Regression Prevention**: Smoke test suite ensures no breaking changes

### Test Naming Convention
- **HP-** (Happy Path): Normal user flow
- **EDGE-** (Edge Case): Boundary conditions, error handling
- **RBAC-** (Role-Based Access Control): Authorization tests
- **PERF-** (Performance): Performance boundary tests
- **AUD-** (Audit): Audit logging verification

### Test Organization
```
packages/frontend/tests/acceptance/phase1/
├── auth.spec.ts                    # 18 scenarios
├── inbox-list-filters.spec.ts      # 18 scenarios
├── conversation-detail-status.spec.ts # 8 scenarios
├── messaging-send-status.spec.ts   # 24 scenarios
├── retry-queue-dlq.spec.ts         # 20 scenarios
├── realtime-websocket.spec.ts      # 28 scenarios
├── integrations-telegram-irc.spec.ts # 12 scenarios
├── phase1-master.spec.ts           # 15 smoke tests
├── helpers/                        # Reusable test utilities
│   ├── auth.ts
│   ├── api.ts
│   ├── selectors.ts
│   ├── fixtures.ts
│   └── websocket.ts
├── fixtures/                       # Test data
│   ├── seed-test-data.ts
│   └── cleanup-test-data.ts
└── README.md                       # Test guide
```

### Execution Strategy
1. **Sequential Execution**: Run test files in order (auth → inbox → messaging → queue → websocket → integrations)
2. **Parallel Scenarios**: Within each file, tests can run in parallel (different conversations/users)
3. **CI Integration**: Run full suite on `dev` branch for every commit
4. **Local Development**: Developers run smoke suite locally before creating PRs

---

## 2. Phase 1 Feature Matrix

| Feature | Module | HP | EDGE | RBAC | Total | Status |
|---------|--------|----|----|------|-------|--------|
| **Auth** | Login, Session, RBAC | 6 | 6 | 6 | 18 | ✅ Ready |
| **Inbox** | List, Filters, Sort, Search | 6 | 6 | 6 | 18 | ✅ Ready |
| **Conversation** | Status, Timeline, Detail | 3 | 3 | 2 | 8 | ✅ Ready |
| **Messaging** | Send, Receive, Delivery Status | 8 | 10 | 6 | 24 | ✅ Ready |
| **Retry Queue** | Backoff, DLQ, Ops Access | 6 | 8 | 6 | 20 | ✅ Ready |
| **WebSocket** | Real-Time, Backlog, Reconnect | 10 | 10 | 8 | 28 | ✅ Ready |
| **Integrations** | Telegram, IRC (Stub) | 6 | 4 | 2 | 12 | ✅ Ready |
| **Smoke** | Critical Paths | 15 | - | - | 15 | ✅ Ready |
| **TOTAL** | | 60 | 47 | 36 | **143** | |

---

## 3. Test Suite Specifications

### 3.1 Authentication (18 scenarios)

#### File: `auth.spec.ts`

**Test Users**:
- `admin@yacc.local` / password `admin123` (super_admin)
- `admin2@yacc.local` / password `admin123` (admin)
- `manager@yacc.local` / password `admin123` (manager)
- `user@yacc.local` / password `admin123` (user)

**Happy Path Tests (6)**:
1. HP-AUTH-001: User can login with valid credentials
   - POST `/api/auth/login` with email/password
   - Expect: 200, JWT token returned, session created

2. HP-AUTH-002: User receives refresh token (HttpOnly cookie)
   - Login successful
   - Expect: `Set-Cookie` header with refresh token

3. HP-AUTH-003: Access token is valid for 48 hours (TTL verification)
   - Login, decode JWT
   - Expect: `exp` claim = now + 48h

4. HP-AUTH-004: User can access protected endpoints with valid token
   - POST `/api/auth/login`
   - GET `/api/conversations` with Authorization header
   - Expect: 200, conversations returned

5. HP-AUTH-005: User can logout (session terminated)
   - POST `/api/auth/logout`
   - Expect: 200, token invalidated

6. HP-AUTH-006: Forgot password flow initiates email reset
   - POST `/api/auth/forgot-password` with email
   - Expect: 200, email sent (verify via Mailhog)

**Edge Case Tests (6)**:
7. EDGE-AUTH-001: Login fails with incorrect password
   - Expect: 401, "Email or password is incorrect"

8. EDGE-AUTH-002: Login fails with non-existent email
   - Expect: 401, "Email or password is incorrect"

9. EDGE-AUTH-003: Login fails with empty email
   - Expect: 400, "Email is required"

10. EDGE-AUTH-004: Access denied without token (401)
    - GET `/api/conversations` without Authorization header
    - Expect: 401, "Authorization required"

11. EDGE-AUTH-005: Access denied with invalid token (401)
    - GET `/api/conversations` with malformed JWT
    - Expect: 401, "Invalid token"

12. EDGE-AUTH-006: Refresh token rotation (single-use)
    - Use refresh token twice
    - Expect: First refresh succeeds, second fails (401)

**RBAC Tests (6)**:
13. RBAC-AUTH-001: super_admin can perform all actions
    - Login as super_admin
    - Access: conversations, users, integrations, rules
    - Expect: All 200

14. RBAC-AUTH-002: admin can perform ops actions
    - Login as admin
    - Access: conversations, audit logs
    - Cannot access: users list, integrations create
    - Expect: 200/403 respectively

15. RBAC-AUTH-003: manager can access audit logs
    - Login as manager
    - GET `/api/conversations/{id}/audit-logs`
    - Expect: 200

16. RBAC-AUTH-004: user cannot access admin endpoints
    - Login as user
    - GET `/api/audit-logs`
    - Expect: 403, "Insufficient permissions"

17. RBAC-AUTH-005: disabled user cannot login
    - Disable user in DB
    - POST `/api/auth/login`
    - Expect: 401, "Account disabled"

18. RBAC-AUTH-006: role change takes effect on next login
    - User is admin, change role to user
    - Login with new session
    - Try to access admin endpoint
    - Expect: 403

---

### 3.2 Inbox List & Filters (18 scenarios)

#### File: `inbox-list-filters.spec.ts`

**Test Setup**:
- 100 conversations with varied channels (60 Telegram, 40 IRC)
- Statuses: 40 open, 35 pending, 25 resolved
- Priorities: 25 low, 50 normal, 20 high, 5 urgent
- Assignments: 50% assigned to manager, 50% unassigned

**Happy Path Tests (6)**:
1. HP-INBOX-001: List conversations with default pagination
   - GET `/api/conversations` (no params)
   - Expect: 200, 20 results (default limit), sorted by lastActivity DESC

2. HP-INBOX-002: Filter by channel (Telegram only)
   - GET `/api/conversations?channel=telegram`
   - Expect: 200, all results have channel=telegram

3. HP-INBOX-003: Filter by status (open)
   - GET `/api/conversations?status=open`
   - Expect: 200, all results have status=open

4. HP-INBOX-004: Filter by priority (normal)
   - GET `/api/conversations?priority=normal`
   - Expect: 200, all results have priority=normal

5. HP-INBOX-005: Filter by assigned user
   - GET `/api/conversations?assignedUserId={managerId}`
   - Expect: 200, all results assigned to manager

6. HP-INBOX-006: Combine multiple filters (channel + status + priority)
   - GET `/api/conversations?channel=irc&status=pending&priority=high`
   - Expect: 200, results match all criteria

**Edge Case Tests (6)**:
7. EDGE-INBOX-001: Empty result set (no matches)
   - GET `/api/conversations?channel=telegram&status=resolved&priority=urgent`
   - Expect: 200, empty data array, total=0

8. EDGE-INBOX-002: Pagination boundary (page > max)
   - GET `/api/conversations?page=100`
   - Expect: 200, empty data array

9. EDGE-INBOX-003: Invalid limit (> 100)
   - GET `/api/conversations?limit=150`
   - Expect: 400, "limit must be between 1 and 100"

10. EDGE-INBOX-004: Invalid status value
    - GET `/api/conversations?status=invalid`
    - Expect: 400, "status must be one of open, pending, resolved"

11. EDGE-INBOX-005: Invalid priority value
    - GET `/api/conversations?priority=medium` (old value)
    - Expect: 400, "priority must be one of low, normal, high, urgent"

12. EDGE-INBOX-006: Invalid UUID for assignedUserId
    - GET `/api/conversations?assignedUserId=invalid-uuid`
    - Expect: 400, "assignedUserId must be a valid UUID"

**RBAC Tests (6)**:
13. RBAC-INBOX-001: user sees only assigned conversations
    - Login as user
    - Conversations should be filtered to assignedUserId=user.id
    - Expect: All returned conversations assigned to user

14. RBAC-INBOX-002: manager sees all conversations
    - Login as manager
    - GET `/api/conversations`
    - Expect: All 100 conversations accessible

15. RBAC-INBOX-003: admin sees all conversations
    - Login as admin
    - GET `/api/conversations`
    - Expect: All 100 conversations accessible

16. RBAC-INBOX-004: super_admin sees all conversations
    - Login as super_admin
    - GET `/api/conversations`
    - Expect: All 100 conversations accessible

17. RBAC-INBOX-005: unauthorized user (not logged in) cannot list
    - GET `/api/conversations` without token
    - Expect: 401

18. RBAC-INBOX-006: user with suspended status cannot list
    - Suspend user in DB
    - Login with same credentials
    - Expect: 401 (session validation fails)

---

### 3.3 Conversation Detail & Status (8 scenarios)

#### File: `conversation-detail-status.spec.ts`

**Happy Path Tests (3)**:
1. HP-CONV-001: Get conversation detail with messages
   - GET `/api/conversations/{id}`
   - Expect: 200, conversation data + message count + timeline

2. HP-CONV-002: Change status from open → pending
   - PATCH `/api/conversations/{id}/status` with `status=pending`
   - Expect: 200, status updated, audit logged

3. HP-CONV-003: Auto-reopen resolved conversation on inbound message
   - Conversation status=resolved
   - Simulate inbound message (via mock connector)
   - GET `/api/conversations/{id}`
   - Expect: status=open (auto-reopened)

**Edge Case Tests (3)**:
4. EDGE-CONV-001: Invalid status transition
   - PATCH `/api/conversations/{id}/status` with `status=invalid`
   - Expect: 400, "status must be one of open, pending, resolved"

5. EDGE-CONV-002: Cannot transition same status
   - Conversation already open
   - PATCH `/api/conversations/{id}/status` with `status=open`
   - Expect: 200 (idempotent - no error, but no change)

6. EDGE-CONV-003: Non-existent conversation
   - GET `/api/conversations/{non-existent-id}`
   - Expect: 404, "Conversation not found"

**RBAC Tests (2)**:
7. RBAC-CONV-001: manager+ can change status
   - Login as manager, PATCH status
   - Expect: 200

8. RBAC-CONV-002: user cannot change status
   - Login as user, PATCH status
   - Expect: 403, "Insufficient permissions"

---

### 3.4 Messaging & Delivery Status (24 scenarios)

#### File: `messaging-send-status.spec.ts`

**Test Setup**:
- Pre-created conversations for Telegram and IRC
- Messages with varied statuses: pending, sent, failed

**Happy Path Tests (8)**:
1. HP-MSG-001: Send message to Telegram conversation
   - POST `/api/messages` with conversationId, body
   - Expect: 201, messageId returned, status=pending

2. HP-MSG-002: Message transitions from pending → sent
   - Send message (status=pending)
   - Simulate connector delivery success
   - GET `/api/messages/{id}`
   - Expect: status=sent, sentAt timestamp populated

3. HP-MSG-003: Message with attachment (single file)
   - Upload file to R2 (get attachmentId)
   - POST `/api/messages` with attachmentIds array
   - Expect: 201, message created with attachment

4. HP-MSG-004: Send message to IRC conversation
   - POST `/api/messages` to IRC conversation
   - Expect: 201, message status=pending; if IRC disconnected, message queued in BullMQ (1m/5m/30m retries), not connector-local queue

5. HP-MSG-005: Receive inbound message from Telegram
   - Webhook from Telegram (simulated)
   - POST `/api/webhook/telegram` with message payload
   - Expect: 200, message stored, conversation updated

6. HP-MSG-006: Receive inbound message from IRC
   - IRC connector sends message (simulated)
   - Message stored as inbound
   - Expect: Message appears in conversation timeline

7. HP-MSG-007: Message status visible in conversation
   - GET `/api/conversations/{id}/messages`
   - Expect: 200, messages with status field populated

8. HP-MSG-008: Delete unsent message
   - Send message (status=pending)
   - DELETE `/api/messages/{id}`
   - Expect: 200, message deleted before sending

**Edge Case Tests (10)**:
9. EDGE-MSG-001: Message too long (> 5000 chars)
   - POST `/api/messages` with body length > 5000
   - Expect: 400, "Message body must be ≤ 5000 characters"

10. EDGE-MSG-002: Empty message body
    - POST `/api/messages` with empty body
    - Expect: 400, "Message body is required"

11. EDGE-MSG-003: Message to non-existent conversation
    - POST `/api/messages` with invalid conversationId
    - Expect: 404, "Conversation not found"

12. EDGE-MSG-004: Attachment too large (> 5 MB)
    - Upload file > 5 MB
    - Expect: 413, "File too large (max 5 MB)"

13. EDGE-MSG-005: Send to conversation assigned to other user
    - User tries to send to conversation assigned to another user
    - POST `/api/messages`
    - Expect: 403 (user role check)

14. EDGE-MSG-006: Failed message retry exhausted (3 attempts)
    - Message fails 3 times
    - GET `/api/messages/{id}`
    - Expect: status=failed, retryCount=3

15. EDGE-MSG-007: Failed message moved to DLQ
    - Message fails 3 times
    - GET `/api/dlq/messages/{id}`
    - Expect: 200, message in DLQ

16. EDGE-MSG-008: Cannot send to resolved conversation (non-broadcast)
    - Conversation status=resolved, channel=telegram
    - POST `/api/messages`
    - Expect: 400 or allow with auto-reopen (per spec)

17. EDGE-MSG-009: Message with invalid attachment ID
    - POST `/api/messages` with non-existent attachmentId
    - Expect: 404, "Attachment not found"

18. EDGE-MSG-010: Sender appears as system account for outbound
    - Send message from UI
    - GET `/api/messages/{id}`
    - Expect: sender is system account or user.id (per spec)

**RBAC Tests (6)**:
19. RBAC-MSG-001: user can send to assigned conversation
    - Login as user
    - Conversation assigned to user
    - POST `/api/messages`
    - Expect: 201

20. RBAC-MSG-002: user cannot send to unassigned conversation
    - Login as user
    - Conversation assigned to someone else
    - POST `/api/messages`
    - Expect: 403

21. RBAC-MSG-003: manager can send to any conversation
    - Login as manager
    - POST `/api/messages` to any conversation
    - Expect: 201

22. RBAC-MSG-004: admin can send to any conversation
    - Login as admin
    - POST `/api/messages`
    - Expect: 201

23. RBAC-MSG-005: super_admin can send to any conversation
    - Login as super_admin
    - POST `/api/messages`
    - Expect: 201

24. RBAC-MSG-006: unauthorized user cannot send
    - POST `/api/messages` without token
    - Expect: 401

---

### 3.5 Retry Queue & Dead-Letter Queue (20 scenarios)

#### File: `retry-queue-dlq.spec.ts`

**Test Setup**:
- Redis + BullMQ running
- Pre-created failed messages with retry counts

**Happy Path Tests (6)**:
1. HP-QUEUE-001: Message sent successfully (no retry)
   - Send message, connector succeeds on first attempt
   - GET `/api/messages/{id}`
   - Expect: status=sent, retryCount=0

2. HP-QUEUE-002: Message retried once (first attempt failed)
   - Send message, first attempt fails, second attempt succeeds
   - GET `/api/messages/{id}`
   - Expect: status=sent, retryCount=1

3. HP-QUEUE-003: Retry backoff schedule (1m, 5m, 30m)
   - Send message, let it fail and be queued
   - Check job in Redis
   - Expect: Next retry scheduled at now + 1 minute

4. HP-QUEUE-004: Manager can view queue stats
   - GET `/api/queue/stats`
   - Expect: 200, pending count, failed count, etc.

5. HP-QUEUE-005: Manager can retry failed message manually
   - Message in failed state
   - POST `/api/queue/retry/{messageId}`
   - Expect: 200, message re-queued

6. HP-QUEUE-006: Dead-letter queue stores final failures
   - Message fails 3 times, moves to DLQ
   - GET `/api/dlq/messages`
   - Expect: 200, failed message in DLQ with error details

**Edge Case Tests (8)**:
7. EDGE-QUEUE-001: Retry exhausted (3 attempts)
   - Message fails 3 times
   - GET `/api/messages/{id}`
   - Expect: status=failed, retryCount=3, in DLQ

8. EDGE-QUEUE-002: Retry count increments correctly
   - Message queued multiple times
   - Check retryCount after each failure
   - Expect: Increments by 1 each retry

9. EDGE-QUEUE-003: DLQ message includes error details
   - GET `/api/dlq/messages/{id}`
   - Expect: 200, error message, status code, timestamp

10. EDGE-QUEUE-004: Cannot retry message already sent
    - Message status=sent
    - POST `/api/queue/retry/{messageId}`
    - Expect: 400, "Message already sent"

11. EDGE-QUEUE-005: Cannot retry non-existent message
    - POST `/api/queue/retry/{non-existent-id}`
    - Expect: 404, "Message not found"

12. EDGE-QUEUE-006: Queue stats show accurate counts
    - 5 pending, 3 failed, 2 in DLQ
    - GET `/api/queue/stats`
    - Expect: pending=5, failed=3, dlq=2

13. EDGE-QUEUE-007: DLQ message can be cleared (manager+)
    - DELETE `/api/dlq/messages/{id}`
    - Expect: 200, message removed

14. EDGE-QUEUE-008: Retry backoff increments (1m → 5m → 30m)
    - Message with 1 retry scheduled for 1m
    - Simulate failure, reschedule
    - Expect: Next retry at 5m
    - Simulate failure again, reschedule
    - Expect: Next retry at 30m

**RBAC Tests (6)**:
15. RBAC-QUEUE-001: manager can access queue stats
    - Login as manager
    - GET `/api/queue/stats`
    - Expect: 200

16. RBAC-QUEUE-002: admin can access queue stats
    - Login as admin
    - GET `/api/queue/stats`
    - Expect: 200

17. RBAC-QUEUE-003: super_admin can access queue stats
    - Login as super_admin
    - GET `/api/queue/stats`
    - Expect: 200

18. RBAC-QUEUE-004: user cannot access queue stats
    - Login as user
    - GET `/api/queue/stats`
    - Expect: 403

19. RBAC-QUEUE-005: user cannot retry messages
    - Login as user
    - POST `/api/queue/retry/{messageId}`
    - Expect: 403

20. RBAC-QUEUE-006: manager can clear DLQ
    - Login as manager
    - DELETE `/api/dlq/messages/{id}`
    - Expect: 200

---

### 3.6 WebSocket & Real-Time Updates (28 scenarios)

#### File: `realtime-websocket.spec.ts`

**Test Setup**:
- WebSocket server running on Socket.io
- 60-second heartbeat configured
- 1-hour message backlog retention

**Happy Path Tests (10)**:
1. HP-WS-001: Client connects and receives hello message
   - Connect to WebSocket
   - Expect: Connection established, heartbeat configured

2. HP-WS-002: Receive conversation_updated event (new message)
   - Send message via API
   - WebSocket client receives notification
   - Expect: Event contains conversationId, lastMessageAt, etc.

3. HP-WS-003: Receive message.sent event (delivery success)
   - Message sent, connector confirms delivery
   - WebSocket client receives status change
   - Expect: messageId, status=sent

4. HP-WS-004: Receive message.failed event (delivery failure)
   - Message delivery fails
   - WebSocket client notified
   - Expect: messageId, status=failed, retryCount

5. HP-WS-005: Receive notification.received event (assignment)
   - Conversation assigned to user
   - User's WebSocket receives notification
   - Expect: notificationType=assignment, conversationId

6. HP-WS-006: Receive presence.updated event (online/offline)
   - User logs in/out
   - Other users' WebSocket receives status
   - Expect: userId, status=online/offline

7. HP-WS-007: Receive typing.started event (typing indicator)
   - User types message in UI
   - Other users in conversation see typing
   - Expect: userId, conversationId, typingAt

8. HP-WS-008: Receive typing.stopped event (5s timeout)
   - User typing stops or 5s elapses
   - Expect: typing indicator cleared

9. HP-WS-009: Receive conversation.reopened event
   - Resolved conversation receives inbound message
   - Other users notified of reopen
   - Expect: conversationId, status=open

10. HP-WS-010: Client handles heartbeat (60s interval)
    - Connect to WebSocket
    - Wait 60+ seconds
    - Expect: Heartbeat received, connection maintained

**Edge Case Tests (10)**:
11. EDGE-WS-001: Client reconnects with backlog replay
    - Connect, receive 5 messages
    - Simulate disconnect
    - Reconnect within 1 hour
    - Expect: All 5 messages replayed on reconnect

12. EDGE-WS-002: Backlog expires after 1 hour
    - Messages stored for 1 hour
    - Connect after 1 hour + 1 minute
    - Expect: No backlog replay (expired)

13. EDGE-WS-003: Reconnection backoff (1s → 60s)
    - First reconnect attempt: 1s delay
    - Second reconnect attempt: 2s delay
    - Subsequent attempts cap at 60s
    - Expect: Backoff follows exponential curve

14. EDGE-WS-004: Max reconnection attempts (5)
    - Server down, client attempts 5 times
    - Expect: Connection fails gracefully after 5 attempts

15. EDGE-WS-005: Broadcast event to multiple clients
    - 3 clients connected to same conversation
    - User A sends message
    - Expect: All 3 clients receive notification

16. EDGE-WS-006: Typing indicator timeout (5 seconds)
    - User starts typing (emit typing.started)
    - Wait 5+ seconds without update
    - Expect: typing indicator cleared automatically

17. EDGE-WS-007: Duplicate events filtered (idempotency)
    - Same event sent twice (simulated duplicate)
    - Expect: Client processes only once (or app handles gracefully)

18. EDGE-WS-008: Events buffered during disconnect
    - Client disconnects
    - 3 events happen on server
    - Client reconnects
    - Expect: All 3 events replayed

19. EDGE-WS-009: Connection lost mid-event
    - Large event payload starts transmitting
    - Connection drops
    - Expect: Graceful reconnect, no data corruption

20. EDGE-WS-010: Invalid event type ignored
    - Client receives unknown event type
    - Expect: Error logged, connection maintained

**RBAC Tests (8)**:
21. RBAC-WS-001: user only receives events for assigned conversations
    - User subscribed to conversation assigned to them
    - Unassigned conversation updates
    - Expect: User does NOT receive event

22. RBAC-WS-002: manager receives all conversation events
    - Manager subscribed to all conversations
    - Any conversation update
    - Expect: Manager receives ALL events

23. RBAC-WS-003: admin receives all events
    - Admin subscribed
    - Any conversation/user/system event
    - Expect: Admin receives ALL events

24. RBAC-WS-004: super_admin receives all events
    - Super_admin subscribed
    - Expect: ALL system events delivered

25. RBAC-WS-005: notifications only to assigned user
    - Conversation assigned to user A
    - User B connected
    - Event sent to user A
    - Expect: Only user A receives notification

26. RBAC-WS-006: presence only visible to same organization
    - User A and B in same org
    - User C in different org (future multi-tenant)
    - User A goes online
    - Expect: User B sees, User C doesn't

27. RBAC-WS-007: unauthorized client rejected
    - Connect without token
    - Expect: 401, connection rejected

28. RBAC-WS-008: invalid token disconnects client
    - Connect with valid token
    - Token invalidated (user logged out)
    - Server pushes disconnect event
    - Expect: Client receives disconnect, reconnect requires new auth

---

### 3.7 Integrations: Telegram & IRC (12 scenarios)

#### File: `integrations-telegram-irc.spec.ts`

**Test Setup**:
- Telegram connector stubbed (mock API responses)
- IRC connector stubbed (mock network connection)
- Pre-configured credentials in env vars

**Happy Path Tests (6)**:
1. HP-INT-001: Telegram message received and stored
   - Webhook from Telegram (simulated)
   - Message stored in conversation
   - Expect: 200, message appears in inbox

2. HP-INT-002: Telegram message sent successfully
   - Send message from UI
   - Telegram API called (simulated)
   - Expect: Message status=sent

3. HP-INT-003: IRC message received
   - IRC connector receives message (simulated)
   - Message stored in conversation
   - Expect: Message appears in inbox

4. HP-INT-004: IRC message sent successfully
   - Send message from UI
   - IRC connector transmits (simulated)
   - Expect: Message status=sent

5. HP-INT-005: New Telegram group creates conversation
   - Telegram webhook for new group
   - Expect: Conversation created, channel=telegram

6. HP-INT-006: New IRC channel creates conversation
   - IRC connector joins new channel
   - Expect: Conversation created, channel=irc

**Edge Case Tests (4)**:
7. EDGE-INT-001: Telegram API timeout → message queued for retry
   - Send message, Telegram API times out
   - Expect: Message status=pending, queued for retry

8. EDGE-INT-002: IRC connection lost → auto-reconnect
   - IRC connection drops
   - Expect: Connector auto-reconnects; pending messages managed by BullMQ retry queue (fail-fast if disconnected, no connector-local queuing)

9. EDGE-INT-003: Duplicate Telegram message (idempotency)
   - Same Telegram message received twice (webhook duplication)
   - Expect: Only one message stored (deduped by external_message_id)

10. EDGE-INT-004: Malformed webhook payload rejected
    - Telegram sends invalid payload
    - Expect: 400, payload validation error

**RBAC Tests (2)**:
11. RBAC-INT-001: super_admin only can manage integrations
    - Login as super_admin
    - GET `/api/integrations` (view creds)
    - Expect: 200

12. RBAC-INT-002: admin/manager/user cannot view integration credentials
    - Login as admin
    - GET `/api/integrations`
    - Expect: 403

---

### 3.8 Smoke Test Suite (15 scenarios)

#### File: `phase1-master.spec.ts`

**Critical Paths** (Each ~5 min, total ~15 min):
1. SMOKE-001: Full auth → inbox → message cycle
   - Login → View inbox → Send message → Verify delivery
   - Expect: All 200s, happy path

2. SMOKE-002: Telegram integration end-to-end
   - Receive webhook → Store message → List in inbox → Send reply
   - Expect: Round trip success

3. SMOKE-003: IRC integration end-to-end
   - Send message → IRC connector delivers → Receive status
   - Expect: Round trip success

4. SMOKE-004: WebSocket real-time notification
   - Connect → Send message → Receive real-time event
   - Expect: Event received within 1s

5. SMOKE-005: Failed message retry → success
   - Send message, first attempt fails
   - Wait for retry (1 minute or simulated)
   - Verify status changes to sent
   - Expect: Retry successful

6. SMOKE-006: Role-based access control
   - Test 4 roles access to protected endpoints
   - Expect: Correct 200/403 responses

7. SMOKE-007: Pagination works across all list endpoints
   - Test page=1, limit=10; page=2, limit=10
   - Expect: Different results, correct total

8. SMOKE-008: Filters work correctly
   - Inbox filter by channel, status, priority
   - Expect: Correct result sets

9. SMOKE-009: Error handling (404, 400, 403, 401)
   - Access non-existent conversation (404)
   - Send invalid data (400)
   - Access without permission (403)
   - Access without token (401)
   - Expect: Correct status codes + error messages

10. SMOKE-010: Database rollback on failure
    - Start transaction, send message, simulate error
    - Expect: Transaction rolled back, message not stored

11. SMOKE-011: Concurrent message sends (race condition)
    - Send 5 messages concurrently
    - Expect: All succeed, no deadlock

12. SMOKE-012: WebSocket + API consistency
    - Send message via API
    - WebSocket shows same message
    - Both have same status/timestamp
    - Expect: Consistent state

13. SMOKE-013: Audit logging works
    - Perform action (send message, assign, etc.)
    - GET `/api/conversations/{id}/audit-logs`
    - Expect: Action logged with actor, timestamp, details

14. SMOKE-014: Search works (if Phase 1 includes FTS)
    - Index conversation messages
    - Search for keyword
    - Expect: Correct conversations returned

15. SMOKE-015: System remains healthy under load
    - Send 50 messages in 1 minute
    - Expect: All succeed, no 500 errors, no connection drops

---

## 4. Test Fixture Strategy

### Fixture IDs (Deterministic)
```typescript
export const FIXTURE_IDS = {
  // Users
  SUPER_ADMIN: '00000000-0000-0000-0000-000000000001',
  ADMIN: '00000000-0000-0000-0000-000000000002',
  MANAGER: '00000000-0000-0000-0000-000000000003',
  USER: '00000000-0000-0000-0000-000000000004',

  // Conversations (Telegram)
  TELEGRAM_CONV_1: '10000000-0000-0000-0000-000000000001',
  TELEGRAM_CONV_2: '10000000-0000-0000-0000-000000000002',

  // Conversations (IRC)
  IRC_CONV_1: '20000000-0000-0000-0000-000000000001',
  IRC_CONV_2: '20000000-0000-0000-0000-000000000002',

  // Messages
  MESSAGE_1: '30000000-0000-0000-0000-000000000001',
};
```

### Seeding Strategy
1. **Before All**: Run DB migration, seed test users + conversations
2. **Before Each**: Optionally reset state for isolation
3. **After All**: Clean up test data (optional, preserve for debugging)

### Test Data Volume
- **Users**: 4 (one per role)
- **Conversations**: 100 (60 Telegram, 40 IRC)
- **Messages**: 500 (varied statuses)
- **Attachments**: 50 (various sizes)

---

## 5. Execution Plan

### Local Development
```bash
# Run specific test file
pnpm --filter @yacc/frontend test tests/acceptance/phase1/auth.spec.ts

# Run all Phase 1 tests
pnpm --filter @yacc/frontend test tests/acceptance/phase1/

# Run smoke suite only
pnpm --filter @yacc/frontend test tests/acceptance/phase1/phase1-master.spec.ts

# Debug mode (UI)
pnpm --filter @yacc/frontend test:ui tests/acceptance/phase1/auth.spec.ts
```

### CI/CD Pipeline
```
On push to dev:
  1. Run lint checks
  2. Run unit tests
  3. Run Phase 1 acceptance suite (15-30 min)
  4. Generate coverage report
  5. Block merge if any tests fail or coverage < 85%
```

### Regression Testing
```
On every release (weekly):
  1. Run full suite: Phase 1 + Phase 2 (45-60 min)
  2. Generate test report
  3. Manual verification of critical flows
```

---

## 6. Success Criteria

✅ **Phase 1 Test Suite Complete**:
- [ ] 143 test scenarios implemented
- [ ] 90%+ of Phase 1 acceptance criteria covered
- [ ] All tests passing locally
- [ ] All tests passing in CI
- [ ] Code coverage ≥ 85%
- [ ] No flaky tests (all deterministic)
- [ ] Test execution time < 30 minutes
- [ ] Documentation complete

✅ **Ready for Phase 2 Testing**:
- [ ] Phase 1 tests stable and reusable
- [ ] Test helpers and fixtures ready for Phase 2 extension
- [ ] CI/CD pipeline configured

---

## 7. Implementation Priority

### Wave 1 (Week 1-2):
1. `auth.spec.ts` (18 scenarios) ← Start here
2. `inbox-list-filters.spec.ts` (18 scenarios)

### Wave 2 (Week 2-3):
3. `conversation-detail-status.spec.ts` (8 scenarios)
4. `messaging-send-status.spec.ts` (24 scenarios)

### Wave 3 (Week 3-4):
5. `retry-queue-dlq.spec.ts` (20 scenarios)
6. `realtime-websocket.spec.ts` (28 scenarios)

### Wave 4 (Week 4-5):
7. `integrations-telegram-irc.spec.ts` (12 scenarios)
8. `phase1-master.spec.ts` (15 scenarios)

---

## 8. Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| WebSocket timing/reliability | High | Mock WebSocket in unit tests, use deterministic timing in e2e |
| Retry queue timing (1m, 5m, 30m) | Medium | Mock time/scheduler for testing, use test mode |
| Connector stubs incomplete | Medium | Define strict interface, mock all external calls |
| Test data cleanup | Medium | Use fixture IDs, run cleanup after tests |
| Flaky tests (timing) | Medium | Add generous waits, use polling instead of fixed delays |
| API response format changes | High | Audit all controllers early, lock in spec |

---

## 9. Related Documents

- `.docs/01-product-specification.md` - Phase 1 user stories & acceptance criteria
- `.docs/02-api-and-data-model.md` - API endpoints, response formats, WebSocket events
- `.docs/04-qa-and-testing.md` - General testing strategy
- `packages/frontend/tests/acceptance/phase2/IMPLEMENTATION-GUIDE.md` - Phase 2 test framework (reusable patterns)

---

**Last Updated**: 2026-02-13  
**Status**: Ready for Implementation  
**Next Step**: Start Wave 1 - Implement auth.spec.ts + inbox-list-filters.spec.ts

