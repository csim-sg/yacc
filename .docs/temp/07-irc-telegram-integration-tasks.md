# IRC & Telegram Integration Task Breakdown

**Status**: Draft - Pending Product Owner Review
**Total Effort**: 65 hours (21 tasks)
**Timeline**: 3 weeks
**Priority**: High (Blocker for Phase 2)

---

## Executive Summary

This task breakdown covers end-to-end implementation of Telegram and IRC integrations for YACC. The implementation follows the connector architecture pattern defined in the system design and includes webhook ingestion, message normalization, retry queues, admin UI, and comprehensive testing.

---

## Task List

### Week 1: Foundation + Telegram (24 hours)

| ID | Task | Hours | Owner | Dependencies |
|----|------|-------|-------|--------------|
| INT-001 | Define base connector interface & types | 2h | Backend | - |
| INT-002 | Configure Telegram bot token & webhook setup | 2h | Backend | INT-001 |
| INT-003 | Implement Telegram webhook ingestion endpoint | 4h | Backend | INT-002 |
| INT-004 | Create Telegram message normalizer | 3h | Backend | INT-003 |
| INT-005 | Implement Telegram message sender | 3h | Backend | INT-004 |
| INT-006 | Add Telegram webhook verification middleware | 2h | Backend | INT-003 |
| INT-007 | Define IRC connection configuration | 1h | Backend | INT-001 |
| INT-008 | Implement IRC socket connection manager | 4h | Backend | INT-007 |
| **Week 1 Subtotal** | | **24h** | | |

---

### Week 2: IRC + Admin UI + Retry Queue (30 hours)

| ID | Task | Hours | Owner | Dependencies |
|----|------|-------|-------|--------------|
| INT-009 | Create IRC message parser (PRIVMSG, NOTICE) | 3h | Backend | INT-008 |
| INT-010 | Implement IRC message sender | 3h | Backend | INT-009 |
| INT-011 | Add IRC auto-reconnect logic (exponential backoff) | 3h | Backend | INT-008 |
| INT-012 | Create base integration model & DB schema | 2h | Backend | INT-001 |
| INT-013 | Setup Redis + BullMQ message retry queue | 4h | Backend | INT-012 |
| INT-014 | Implement retry worker with exponential backoff | 3h | Backend | INT-013 |
| INT-015 | Create Telegram integration config UI | 4h | Frontend | INT-012 |
| INT-016 | Create IRC integration config UI | 4h | Frontend | INT-012 |
| INT-017 | Add integration test endpoint (send test message) | 4h | Backend | INT-005, INT-010 |
| **Week 2 Subtotal** | | **30h** | | |

---

### Week 3: Testing + Polish + Deployment (12 hours)

| ID | Task | Hours | Owner | Dependencies |
|----|------|-------|-------|--------------|
| INT-018 | Unit tests for normalizers & parsers | 3h | Backend | INT-004, INT-009 |
| INT-019 | Integration tests for connectors (mock Telegram/IRC) | 4h | QA | INT-005, INT-010 |
| INT-020 | E2E Playwright tests (send/receive flow) | 3h | QA | INT-017 |
| INT-021 | Docker compose + env var documentation | 2h | Backend | All previous |
| **Week 3 Subtotal** | | **12h** | | |

---

## Critical Path Dependencies

```
INT-001 (Base Interface) → INT-013 (Redis/BullMQ) → INT-014 (Retry Worker)
                                   ↓
                            INT-017 (Test Endpoint)

INT-001 → INT-002 (Telegram Config) → INT-003 (Webhook) → INT-004 (Normalizer) → INT-005 (Sender)
                                    ↓
                             INT-006 (Webhook Verification)

INT-001 → INT-007 (IRC Config) → INT-008 (Connection) → INT-009 (Parser) → INT-010 (Sender)
                                  ↓
                           INT-011 (Auto-Reconnect)

INT-012 (DB Schema) → INT-015 (Telegram UI)
                 → INT-016 (IRC UI)

All implementation → INT-018/019/020 (Testing) → INT-021 (Deployment)
```

---

## Detailed Task Descriptions

### INT-001: Define Base Connector Interface & Types (2h)

**Goal**: Create abstract base class/interface for all connectors

**Deliverables**:
- `IConnector` interface in `packages/backend/src/connectors/base.ts`
- Standard types: `InboundMessage`, `OutboundMessage`, `ConnectorConfig`, `MessageStatus`
- Common error types: `ConnectorError`, `RateLimitError`, `TemporaryError`

**Acceptance Criteria**:
- All connector methods typed correctly
- TypeScript compilation passes
- Clear documentation on interface methods

---

### INT-002: Configure Telegram Bot Token & Webhook Setup (2h)

**Goal**: Setup Telegram bot credentials and webhook configuration

**Deliverables**:
- Environment variable: `TELEGRAM_BOT_TOKEN`
- Webhook registration helper function
- Documentation on Telegram bot setup steps

**Acceptance Criteria**:
- Bot token configured in env vars
- Webhook can be registered via helper script
- Documentation includes bot creation steps from BotFather

---

### INT-003: Implement Telegram Webhook Ingestion Endpoint (4h)

**Goal**: Create API endpoint to receive Telegram webhook events

**Deliverables**:
- `POST /api/connectors/telegram/webhook` endpoint
- Webhook body validation
- Convert Telegram updates to internal message format
- Rate limiting middleware (max 100 requests/minute)

**Acceptance Criteria**:
- Webhook receives Telegram updates
- Message data persisted to `messages` table
- Conversation created/updated appropriately
- Raw payload saved to R2

---

### INT-004: Create Telegram Message Normalizer (3h)

**Goal**: Normalize Telegram messages to standard internal format

**Deliverables**:
- `TelegramNormalizer` class implementing `IMessageNormalizer`
- Handle: text, photos, documents, stickers, voice, video
- Extract: sender info, timestamp, message ID, reply-to references
- Handle edited messages, forwarded messages, channels vs. groups

**Acceptance Criteria**:
- All Telegram message types normalized correctly
- Sender display name extracted from user object
- Media attachments extracted (url, type, size)
- Edited messages update existing record (append "edited at" timestamp)

---

### INT-005: Implement Telegram Message Sender (3h)

**Goal**: Send outbound messages to Telegram via bot API

**Deliverables**:
- `TelegramSender` class implementing `IMessageSender`
- Send text messages
- Send attachments (photo, document)
- Handle rate limits (30 messages/second)
- Return success/failure status with retry decision

**Acceptance Criteria**:
- Messages sent successfully to Telegram
- Attachments uploaded via multipart/form-data
- Failed messages enqueued for retry (if temporary)
- Permanent errors (blocked user, etc.) fail immediately (no retry)

---

### INT-006: Add Telegram Webhook Verification Middleware (2h)

**Goal**: Verify Telegram webhook authenticity

**Deliverables**:
- Middleware to validate Telegram webhook secret token
- Environment variable: `TELEGRAM_WEBHOOK_SECRET`
- Reject invalid webhooks with 401 status

**Acceptance Criteria**:
- Valid webhooks processed
- Invalid webhooks rejected before processing
- Security logging for rejected webhooks

---

### INT-007: Define IRC Connection Configuration (1h)

**Goal**: Define configuration structure for IRC connections

**Deliverables**:
- `IRCConfig` interface (server, port, nick, password, channels, realname)
- Environment variables: `IRC_SERVER`, `IRC_PORT`, `IRC_NICK`, `IRC_PASSWORD`, `IRC_CHANNELS`
- Default values documentation

**Acceptance Criteria**:
- Configuration schema defined
- Env vars documented
- Support for multiple channels per connection

---

### INT-008: Implement IRC Socket Connection Manager (4h)

**Goal**: Create persistent IRC connection with socket handling

**Deliverables**:
- `IRCConnection` class
- Socket connection (net or irc library)
- Handle: connect, disconnect, ping/pong, MOTD, join/part
- Emit events: `connected`, `disconnected`, `error`

**Acceptance Criteria**:
- Successfully connects to IRC server
- Authenticates with PASS/NICK commands
- Joins configured channels
- Handles server pings to prevent timeout

---

### INT-009: Create IRC Message Parser (3h)

**Goal**: Parse IRC messages (PRIVMSG, NOTICE) to internal format

**Deliverables**:
- `IRCParser` class implementing `IMessageNormalizer`
- Parse: PRIVMSG, NOTICE, JOIN, PART, KICK, QUIT
- Extract: sender (nick!user@host), timestamp, channel, message body
- Handle: CTCP actions, URL detection, formatting codes

**Acceptance Criteria**:
- PRIVMSG messages normalized correctly
- Sender nick extracted correctly
- Channel mapped to conversation
- CTCP actions (/me) handled appropriately

---

### INT-010: Implement IRC Message Sender (3h)

**Goal**: Send outbound messages to IRC channels

**Deliverables**:
- `IRCSender` class implementing `IMessageSender`
- Send PRIVMSG to channel
- Rate limiting (max 10 messages/second to avoid flood kicks)
- Handle: failed connections, disconnected state

**Acceptance Criteria**:
- Messages sent to IRC channel
- Rate limits enforced
- Disconnected state returns error (triggers retry queue)
- Reconnected messages resent

---

### INT-011: Add IRC Auto-Reconnect Logic (3h)

**Goal**: Automatically reconnect on connection loss

**Deliverables**:
- Auto-reconnect on disconnect
- Exponential backoff: 1s, 5s, 30s, 60s (max)
- Max retry attempts: 10 (give up after 10 failures)
- Rejoin all configured channels after reconnect
- Log reconnection attempts

**Acceptance Criteria**:
- Disconnect triggers reconnection attempt
- Backoff schedule implemented correctly
- Channels rejoined after successful reconnect
- Max attempts enforced

---

### INT-012: Create Base Integration Model & DB Schema (2h)

**Goal**: Database schema for storing integration configurations

**Deliverables**:
- `integrations` table: id, type (telegram/irc), name, config (JSON), status (active/disabled), created_at
- Drizzle schema migration
- Add `raw_payload_ref` column to `messages` table

**Acceptance Criteria**:
- Migration runs successfully
- Schema matches requirements
- Indexes added on `type`, `status`

---

### INT-013: Setup Redis + BullMQ Message Retry Queue (4h)

**Goal**: Configure message retry infrastructure

**Deliverables**:
- Redis connection setup
- BullMQ `messageRetryQueue` defined
- Job schema: { messageId, conversationId, providerId, attempt }
- Configuration: 3 attempts, exponential backoff (1m, 5m, 30m)
- Dead-letter queue for failed jobs

**Acceptance Criteria**:
- Redis connection established
- Queue defined and configured
- DLQ setup
- Configuration documented

---

### INT-014: Implement Retry Worker with Exponential Backoff (3h)

**Goal**: Worker process to retry failed outbound messages

**Deliverables**:
- BullMQ worker process
- Retry logic: fetch message → send via connector → update status
- On success: mark status `sent`, remove from queue
- On failure: if attempts < 3, requeue with delay; else move to DLQ
- Logging: all retry attempts logged

**Acceptance Criteria**:
- Worker processes jobs from queue
- Successful retries update message status
- Failed retries follow backoff schedule
- DLQ receives permanently failed messages

---

### INT-015: Create Telegram Integration Config UI (4h)

**Goal**: Admin UI to configure Telegram integration

**Deliverables**:
- Admin page: `/admin/integrations/telegram`
- Form fields: bot token, webhook secret, enabled/disabled toggle
- Test connection button (send test message)
- Save/validate configuration
- Show integration status (connected/disconnected)

**Acceptance Criteria**:
- Form captures bot token and webhook secret
- Token masked (show first 8 chars only)
- Test button sends test message to configured channel
- Configuration persisted to DB

---

### INT-016: Create IRC Integration Config UI (4h)

**Goal**: Admin UI to configure IRC integration

**Deliverables**:
- Admin page: `/admin/integrations/irc`
- Form fields: server, port, nick, password, channels (comma-separated), enabled/disabled toggle
- Test connection button (connect and list joined channels)
- Save/validate configuration
- Show integration status (connected/disconnected)

**Acceptance Criteria**:
- Form captures all IRC config fields
- Password masked in UI
- Test button connects and shows channel list
- Configuration persisted to DB

---

### INT-017: Add Integration Test Endpoint (4h)

**Goal**: API endpoint to test integration connection

**Deliverables**:
- `POST /api/integrations/:id/test` endpoint
- For Telegram: send test message to configured channel
- For IRC: connect and join configured channels
- Return success/failure with message
- Log test attempt in audit log

**Acceptance Criteria**:
- Test endpoint works for both Telegram and IRC
- Success/failure response clear
- Audit log entry created
- Only admins can access endpoint

---

### INT-018: Unit Tests for Normalizers & Parsers (3h)

**Goal**: Unit tests for message processing logic

**Deliverables**:
- Jest tests for `TelegramNormalizer`
- Jest tests for `IRCParser`
- Test cases: text messages, attachments, edited messages, CTCP actions
- Edge cases: missing fields, null values, malformed messages

**Acceptance Criteria**:
- >80% code coverage for normalizers/parsers
- All test cases pass
- Edge cases handled correctly

---

### INT-019: Integration Tests for Connectors (3h)

**Goal**: Integration tests for connector functionality

**Deliverables**:
- Jest + nock for mocking Telegram API
- Jest + mock IRC server for testing IRC connector
- Test inbound message flow: webhook → normalizer → DB
- Test outbound message flow: sender → API call → success/failure
- Test retry queue integration

**Acceptance Criteria**:
- All integration tests pass
- Mock external dependencies correctly
- Test retry logic (success/failure scenarios)

---

### INT-020: E2E Playwright Tests (3h)

**Goal**: End-to-end tests for integration workflows

**Deliverables**:
- Playwright test: configure Telegram integration
- Playwright test: configure IRC integration
- Playwright test: send test message
- Playwright test: verify message appears in inbox
- Playwright test: reply to message (outbound)

**Acceptance Criteria**:
- All E2E tests pass
- Flows tested end-to-end
- UI interactions validated

---

### INT-021: Docker Compose + Env Var Documentation (2h)

**Goal**: Deployable configuration for integrations

**Deliverables**:
- Update `docker-compose.yml` with Redis service
- Update `.env.example` with integration env vars
- Documentation: integration setup guide
- GitHub Actions: ensure Redis available in CI

**Acceptance Criteria**:
- Docker compose includes Redis
- All env vars documented
- CI workflow passes with integration tests

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Telegram API rate limits | Medium | Medium | Implement rate limiting middleware, respect 30 msg/sec limit |
| IRC flood kicks | Medium | Low | Rate limit outbound messages to 10 msg/sec |
| Webhook delivery issues | Low | High | Use Telegram's webhook retry mechanism, log failures |
| Connection instability | Medium | Medium | Exponential backoff reconnection, monitor health |
| Message ordering issues | Low | Low | Process messages sequentially per conversation |

---

## Success Criteria

- [ ] Telegram receives inbound messages via webhook
- [ ] IRC receives inbound messages via socket
- [ ] Outbound messages sent via both platforms
- [ ] Failed messages retried via Redis/BullMQ
- [ ] Admin UI configures both integrations
- [ ] Test endpoints validate integration health
- [ ] All tests pass (unit, integration, E2E)
- [ ] Deployment documentation complete

---

**Created**: January 21, 2026
**Author**: Solution Architect
**Next Steps**: Product Owner review → Technical validation → Development start
