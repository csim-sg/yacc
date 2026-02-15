# IRC Integration Tasks Development Plan

**Status**: ✅ INT-001 COMPLETED & EA APPROVED (Feb 15, 2026)  
**Created**: February 15, 2026  
**Target**: Phase 1 MVP completion  
**Focus**: Backend IRC connector implementation with full message lifecycle

### INT-001 Completion Summary (Feb 15)
- ✅ **Real IRC Connector**: Uses `irc-framework` library (not mock)
- ✅ **Proper Handshake**: Synchronous `connect()` wrapped in Promise, waits for `registered` event
- ✅ **Event-Driven Reconnect**: Triggered from `error`/`close`/`socket close` handlers, 30s timeout
- ✅ **Message Queue**: Hard limit 1000, capacity checks, CRLF injection prevention
- ✅ **Type Safety**: 100% type-safe, no `any` types, updated irc-framework type definitions
- ✅ **Security**: Message sanitization (remove CRLF, max 400 chars), uses safe `say()` API
- ✅ **Tests**: 28/28 passing (100%), comprehensive coverage
- ✅ **EA Approved**: Architecturally sound, ready for merge (after PR split per governance)

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
    ├─ POST /integrations/irc/config (INT-006)
    ├─ POST /integrations/irc/connect (INT-007)
    ├─ POST /integrations/irc/test (INT-008)
    └─ GET /integrations/irc/status (INT-009)

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
- **Status**: ✅ **COMPLETED & EA APPROVED** (Feb 15, 2026)
- **Description**: Implement real IRC connection using `irc-framework` npm package
- **Implementation Details**:
  - ✅ Uses `irc-framework` library for real IRC server connection
  - ✅ Proper handshake: synchronous `connect()` wrapped in Promise, waits for `registered` event
  - ✅ 30-second connection timeout with proper cleanup
  - ✅ Event-driven reconnection from `error`/`close`/`socket close` handlers
  - ✅ Exponential backoff (1s, 2s, 4s, 8s, 16s, 30s; max 10 attempts)
  - ✅ Message queue with hard capacity limit (1000 messages)
  - ✅ Status management (disconnected → reconnecting → connected)
  - ✅ CRLF injection prevention via message sanitization
  - ✅ Safe message transmission using `client.say()` instead of `raw()`
- **Deliverables**:
  - Real IRC connector with proper handshake and reconnection
  - Handlers for connection events (registered, error, close, socket close)
  - Status management (connected/reconnecting/disconnected/error)
  - Message queue with capacity enforcement (max 1000)
  - Type-safe implementation (no `any` types)
  - 28 comprehensive tests (100% passing)
- **Dependencies**: BE-001 (PostgreSQL), BE-002 (schema)
- **Acceptance Criteria**: ✅ ALL MET
  - ✅ Connects to IRC server with proper handshake
  - ✅ Authenticates with nick/password/gecos
  - ✅ Joins configured channels on successful connection
  - ✅ Emits proper connection events
  - ✅ Status transitions correctly (disconnected → reconnecting → connected)
  - ✅ Reconnects on connection failure with exponential backoff
  - ✅ Handles mid-connection errors
  - ✅ Message queue bounded and safe
  - ✅ 100% type-safe implementation
  - ✅ 28/28 tests passing
  - ✅ EA Architecture approved

**PR Status**: Branch `task/INT-001-irc-connector` @ `d5be0c2` ready for merge (requires PR split per governance: connector-only vs docs/governance changes)

#### INT-002: Message Ingestion
- **Description**: Receive inbound IRC messages and store in database
- **Deliverables**:
  - Hook IRC `message` event handler
  - Create conversation if channel doesn't exist
  - Create message record in database
  - Emit WebSocket `message.received` event
  - Apply routing rules
- **Dependencies**: INT-001, BE-002, BE-008
- **Acceptance Criteria**:
  - Inbound messages create database records
  - Conversations created per channel
  - WebSocket events pushed to frontend
  - Search index updated

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
  - Exponential backoff (1s, 2s, 4s, 8s, 16s, 30s)
  - Max 10 retry attempts
  - After max attempts, mark as failed
  - Manual reconnect trigger capability
- **Dependencies**: INT-001, BE-013 (queue)
- **Acceptance Criteria**:
  - Reconnection attempts follow backoff schedule
  - Max 10 attempts enforced
  - Queued messages processed on reconnect

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
  - `POST /integrations/irc/config`
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
  - `POST /integrations/irc/connect`
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
  - `POST /integrations/irc/test`
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
  - `GET /integrations/irc/status`
  - Return: connected/disconnected status
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
  - Create IRC configuration in `.env`
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

