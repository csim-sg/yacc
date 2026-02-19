# IRC Integration Tasks Development Plan

**Status**: Starting INT-001 through INT-014  
**Created**: February 15, 2026  
**Target**: Phase 1 MVP completion  
**Focus**: Backend IRC connector implementation with full message lifecycle

---

## 📋 Overview

The IRC Integration Tasks (INT-001 to INT-014) implement complete IRC support for YACC MVP:

- **Backend IRC Connector**: Real IRC server connection, message handling, reconnection
- **API Endpoints**: Configuration, connection management, status
- **Channel Mapping**: One conversation per IRC channel
- **Error Handling**: Connection errors, dead-letter queue (DLQ)
- **Tests**: Unit and integration tests (90%+ coverage)

---

## 🏗️ Architecture Summary

```
IRC Server
    ↓
IRC Connector (INT-001)
    ├─ Connection Management (connect/disconnect)
    ├─ Message Receiving (INT-002)
    └─ Message Sending (INT-003)
         ├─ Auto-reconnect (INT-004)
         ├─ Status Tracking (INT-005)
         └─ Channel → Conversation Mapping (INT-011)

REST API (INT-006 to INT-009)
    ├─ POST /api/integrations/irc/config (INT-006)
    ├─ POST /api/integrations/irc/connect (INT-007)
    ├─ POST /api/integrations/irc/test (INT-008)
    └─ GET /api/integrations/irc/status (INT-009)

Infrastructure
    ├─ Environment Variables (INT-010)
    ├─ Error Handling & DLQ (INT-012)
    ├─ Unit Tests (INT-013)
    └─ Integration Tests (INT-014)
```

---

## 🔗 Dependency Graph

```
INT-001 (IRC Connector)
    ↓
INT-002 (Inbound), INT-003 (Outbound)
    ↓
INT-004 (Auto-reconnect), INT-005 (Status Tracking)
    ↓
INT-006, INT-007, INT-008, INT-009 (API Endpoints)
    ↓
INT-011 (Channel Mapping), INT-012 (Error Handling)
    ↓
INT-013, INT-014 (Tests)
```

---

## ✅ Detailed Task Breakdown

### Phase 1: Core Connector (INT-001 to INT-005)

#### INT-001: Create IRC Connector
- **Description**: Implement real IRC connection using `irc` npm package
- **Deliverables**:
  - Replace mock implementation with actual IRC client
  - Handlers for connection lifecycle states (connected, retrying, disconnected, failed)
  - Status management (connected/retrying/disconnected/failed)
  - Fail-fast on send; BullMQ retry/DLQ handles offline message recovery
- **Dependencies**: BE-001 (PostgreSQL), BE-002 (schema)
- **Acceptance Criteria**:
  - Connects to IRC server
  - Authenticates with nick/password
  - Joins configured channels
  - Emits connection events
  - Status tracked correctly

#### INT-002: Message Ingestion
- **Description**: Receive inbound IRC messages and store in database
- **Deliverables** (Phase 1 MVP):
  - ✅ Hook IRC `message` event handler
  - ✅ Create conversation if channel doesn't exist (atomic upsert)
  - ✅ Create message record in database (via ConversationService.createMessage)
  - ✅ Emit WebSocket `message.received` event with message body
  - ✅ Auto-reopen resolved conversations on new inbound message
  - ✅ Update conversation.lastActivityAt on message receipt
  - ⏳ Apply routing rules (deferred to Phase 2, BE-008)
- **Dependencies**: INT-001, BE-002, BE-008 (deferred)
- **Acceptance Criteria**:
  - ✅ Inbound messages create database records
  - ✅ Conversations created per channel with atomic safety
  - ✅ WebSocket events pushed to frontend
  - ⏳ Search index updated (Phase 2)

#### INT-003: Message Delivery
- **Description**: Send outbound messages to IRC
- **Deliverables**:
  - Take messages from message.service.ts
  - Send to IRC channel
  - Update message status (sent/failed)
  - Handle delivery errors gracefully
- **Dependencies**: INT-001, BE-010, BE-011
- **Acceptance Criteria**:
  - Outbound messages sent to IRC
  - Message status updated correctly
  - Failures logged with correlation ID

#### INT-004: Auto-reconnect
- **Description**: Implement exponential backoff reconnection strategy
- **Deliverables**:
  - Exponential backoff with cap (1s -> 60s max)
  - Max 5 reconnect attempts per disconnect incident
  - After max attempts, mark as failed
  - Manual reconnect trigger capability
- **Dependencies**: INT-001
- **Acceptance Criteria**:
  - Disconnects trigger reconnect attempts with backoff
  - Max 5 attempts enforced
  - Fail-fast on send; BullMQ handles retry/DLQ logic

**Backoff policy (authoritative)**
- Delay before attempt `n` (1-indexed) is `min(60s, 2^(n-1) * 1s)`
- Schedule for 5 attempts: 1s, 2s, 4s, 8s, 16s
- Attempts reset on successful reconnect

#### INT-005: Status Tracking
- **Description**: Track and expose IRC connection status
- **Deliverables**:
  - Store status in database (if needed)
  - Expose via HTTP GET endpoint
  - Expose via WebSocket events
  - Track connection timestamps
- **Dependencies**: INT-004, BE-002
- **Acceptance Criteria**:
  - Status available via API
  - WebSocket pushes status updates
  - Timestamps accurate

### Phase 2: API Endpoints (INT-006 to INT-009)

#### INT-006: IRC Config Endpoint
- **Description**: Save IRC server configuration
- **Deliverables**:
  - `POST /api/integrations/irc/config`
  - Save: server, port, nick, password, channels
  - RBAC: super_admin only
  - Validation before save
  - Return: validation errors or success
- **Dependencies**: BE-005 (RBAC)
- **Acceptance Criteria**:
  - Configuration saved and validated
  - RBAC enforced
  - Errors returned for invalid config

#### INT-007: IRC Connect Endpoint
- **Description**: Initiate IRC connection
- **Deliverables**:
  - `POST /api/integrations/irc/connect`
  - Initiate connection from stored config
  - Return: current connection status
  - RBAC: super_admin only
- **Dependencies**: INT-001, INT-006
- **Acceptance Criteria**:
  - Connection initiated
  - Status returned correctly

#### INT-008: IRC Test Endpoint
- **Description**: Test IRC connection before saving
- **Deliverables**:
  - `POST /api/integrations/irc/test`
  - Accept: server, port, nick, password
  - Test connection (10s timeout)
  - Return: success/failure message
  - RBAC: super_admin only
- **Dependencies**: INT-001
- **Acceptance Criteria**:
  - Connection tested successfully
  - Timeout enforced
  - Error messages clear

#### INT-009: IRC Status Endpoint
- **Description**: Get current IRC connection status
- **Deliverables**:
    - `GET /api/integrations/irc/status`
    - Return: connected/retrying/disconnected/failed status
    - Include: timestamps, error message, reconnect attempts
    - RBAC: admin+ only
- **Dependencies**: INT-005
- **Acceptance Criteria**:
    - Status endpoint returns correct data
    - RBAC enforced

### Phase 3: Mapping & Error Handling (INT-010 to INT-012)

#### INT-010: Environment Variables
- **Description**: Load IRC credentials from environment
- **Deliverables**:
  - Create IRC configuration in `.env` (IRC_SERVER, IRC_PORT, IRC_USERNAME, IRC_PASSWORD, IRC_CHANNELS)
  - Load on application startup
  - Validate required fields
  - Fallback to manual config if not set
- **Acceptance Criteria**:
  - Environment variables read correctly
  - Validation enforced
  - Clear error messages if missing

#### INT-011: Channel Mapping
- **Description**: Map IRC channels to conversations
- **Deliverables**:
  - One conversation per channel
  - external_thread_id = channel name
  - Channel join creates conversation
  - Member list → conversation participants
- **Dependencies**: INT-002, BE-002
- **Acceptance Criteria**:
  - Conversations created per channel
  - Channel names unique
  - No duplicate conversations

#### INT-012: Error Handling
- **Description**: Handle connection errors gracefully
- **Deliverables**:
  - Connection errors logged with correlation ID
  - Failed messages moved to DLQ
  - Exponential backoff for retries
  - Rate limiting enforcement
- **Dependencies**: INT-001, BE-015 (DLQ)
- **Acceptance Criteria**:
  - Errors logged with correlation ID
  - DLQ processing works
  - Rate limiting enforced

### Phase 4: Testing (INT-013 to INT-014)

#### INT-013: Unit Tests for IRC Connector
- **Description**: Comprehensive unit test coverage
- **Deliverables**:
  - 90%+ code coverage for connector
  - Mock IRC client events
  - Test connection states
  - Test message handling
  - Test error scenarios
- **Dependencies**: INT-001 to INT-012
- **Acceptance Criteria**:
  - Coverage >= 90%
  - All code paths tested
  - Edge cases covered

#### INT-014: Integration Tests for IRC Connector
- **Description**: End-to-end integration tests
- **Deliverables**:
  - Mock IRC server setup
  - End-to-end message flow test
  - Connection/disconnection test
  - Error scenario test
  - Reconnection test
- **Dependencies**: INT-001 to INT-012
- **Acceptance Criteria**:
  - E2E flows working
  - All scenarios covered
  - Integration with DB validated

---

## 📂 Code Changes Required

### Files to Create

1. **Connector Implementation**
   - `packages/backend/src/connectors/irc.connector.ts` - Replace mock with real implementation

2. **API Endpoints**
   - `packages/backend/src/controllers/integrations.controller.ts` - NEW
   - `packages/backend/src/services/integrations.service.ts` - NEW

3. **Types & Schemas**
   - `packages/common/src/types/ircConfig.interface.ts` - NEW
   - `packages/common/src/schemas/irc.schema.ts` - NEW

4. **Configuration**
   - `packages/backend/src/config/irc.config.ts` - NEW

5. **Tests**
   - `packages/backend/src/connectors/__tests__/irc.connector.test.ts` - NEW
   - `packages/backend/src/__tests__/irc-integration.test.ts` - NEW

### Files to Modify

1. **Database Schema** (if needed)
   - `packages/common/src/db/schema.ts` - Add IRC connection status table

2. **Infrastructure**
   - `packages/backend/src/infrastructure/` - May need IRC client initialization

3. **Controllers Index**
   - `packages/backend/src/controllers/index.ts` - Add integrations controller

---

## 📦 Dependencies

### npm Packages Required

- `irc` (IRC client library) - for real IRC connection
- `irc-mock` or similar - for testing

### Existing Dependencies

- BetterAuth (authentication)
- Drizzle (database)
- Socket.io (WebSocket)
- BullMQ (message queue)
- Pino (logging)

---

## ✔️ Acceptance Criteria (All Tasks)

- [ ] Code follows KISS principle (simple, direct, no wrappers)
- [ ] 90%+ test coverage for connector logic
- [ ] Error handling with correlation IDs
- [ ] WebSocket events emitted correctly
- [ ] Database consistency (no orphaned records)
- [ ] RBAC enforced on config endpoints
- [ ] No `any` types used
- [ ] Flat folder structure maintained
- [ ] One definition per file
- [ ] No unnecessary abstractions
- [ ] Clear logging for debugging
- [ ] Documentation updated

---

## 🚀 Next Steps

1. **INT-001**: Implement real IRC connector using `irc` npm package
   - Replace mock with actual client
   - Test locally with real IRC server or mock
   - ~4-6 hours of work

2. **INT-002/003**: Message ingestion/delivery handlers
   - ~4-6 hours per task

3. **INT-004/005**: Reconnection and status tracking
   - ~3-4 hours per task

4. **INT-006/009**: API endpoints
   - ~2-3 hours per task

5. **INT-013/014**: Comprehensive tests
   - ~6-8 hours combined

6. **Documentation**: Update `.docs/02-api-and-data-model.md`
   - Add IRC endpoints, types, examples

**Estimated Total**: 8-12 weeks for full implementation with tests

---

## 🔗 Related Documentation

- `.docs/01-product-specification.md` - Product requirements
- `.docs/02-api-and-data-model.md` - API contract (to be updated)
- `.docs/03-implementation-guide.md` - Architecture overview
- `.docs/06-tasks.md` - Task tracking and issue mapping
- `packages/backend/AGENTS.md` - Backend development guide
- `packages/backend/DEVELOPER-AGENT-SYSTEM-PROMPT.md` - Code patterns

---

**Last Updated**: February 15, 2026  
**Status**: Ready for Implementation  
**Owner**: Backend Team
