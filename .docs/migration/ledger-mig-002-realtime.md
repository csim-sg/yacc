---
ledger_id: LEDGER-MIG-002-REALTIME
version: 1.0.0
spec: "https://github.com/Antpolis/documentation/blob/feat/issue-65-archive-communication-memory/02-Architecture-Landscape/projects/yacc/spec/SPEC-002-java-spring-backend-migration.md"
milestone: "https://github.com/csim-sg/yacc/milestone/3"
task: "https://github.com/csim-sg/yacc/issues/336"
baseline_revision: 98db628d78c79578dd11eb0476fab812d81fed32
baseline_branch: dev
captured_at: 2026-09-26
reconciliation_target: MIG-003 (#338)
durable_context:
  spec: "https://github.com/Antpolis/documentation/blob/feat/issue-65-archive-communication-memory/02-Architecture-Landscape/projects/yacc/spec/SPEC-002-java-spring-backend-migration.md"
  adrs:
    - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-023-contract-source-openapi-asyncapi.md"
    - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-024-java-spring-backend-replacement-architecture.md"
    - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-025-auth-spring-security-dual-role-oidc-bootstrap-recovery.md"
    - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-026-raw-spring-websocket-resilience.md"
    - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-027-data-access-flyway-jpa-encryption.md"
    - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-028-async-processing-quartz-db-dlq.md"
    - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-029-jvm-deployment-envelope-observability.md"
  arch:
    - "https://github.com/csim-sg/yacc/blob/dev/.docs/architecture/001-technology-architecture.md"
    - "https://github.com/csim-sg/yacc/blob/dev/.docs/architecture/002-application-architecture.md"
    - "https://github.com/csim-sg/yacc/blob/dev/.docs/architecture/003-data-architecture.md"
  gov:
    - "https://github.com/csim-sg/yacc/blob/dev/.docs/governance/GOV-038-GPA-007-gap-analysis-and-fail-closed.md"
  runbooks: "N/A for this capture task — real-time contract capture only, no deployment or operational change (runbooks apply from FR-02/MIG-014 deploy work onward)"
status: superseded as binding scope by LEDGER-MIG-003-RECONCILED (.docs/migration/ledger-mig-003-reconciled.md, MIG-003 #338); retained as capture provenance
superseded_by: LEDGER-MIG-003-RECONCILED v1.0.0
row_count: 86
---

# MIG-002 — Atomic Real-time Inventory-to-Evidence Ledger

Versioned atomic ledger of the Node/TypeScript real-time surface (Socket.io +
socket-controllers + `@yacc/common` contract constants), captured from source at the
baseline revision above. Binding frozen scope for Java/Spring real-time parity (SPEC-002
AC-01, AC-02, AC-06) alongside `asyncapi.yaml` + `schemas/*.json` (same directory).

**Row semantics**

- One row = exactly one named artifact (one event constant, one socket-controller
  operation, one raw runtime event literal, or one named real-time behavior). No ranges,
  aggregates, wildcard-quantities, or approximations.
- **Envelope divergence (captured, not resolved):** the `{event,data,timestamp}` envelope
  is applied ONLY by `wsGateway` emit paths (`websockets/gateway.ts`); socket-controller
  handlers emit bare payloads. Both shapes are captured; MIG-003 canonicalizes to one
  (target per ADR-026: envelope preserved verbatim).
- **Contract divergence (captured, not resolved):** the `@yacc/common` contract set (20
  constants) and the backend `websockets/wsConstants.ts` runtime set (13 constants incl.
  2 QueueEvents, `notification.dismissed`, no SystemEvents group) disagree. The 20
  contract constants are rows WS-EVT-001..020 with per-constant wiring status; backend-only
  constants are rows WS-QEV-001..003. MIG-003 reconciles.
- `Result` = ledger closure state; all rows are `blocked` ("pending implementation
  evidence") until MIG-050/051/052 produce passing evidence. A `fail`/`blocked` row at
  MIG-072 blocks cutover.
- `Rev` = baseline revision shorthand `@98db628`.

Counts (code-verified at capture): **6 socket controllers** (excluding `index.ts`),
**20 contract event constants**, **28 socket-controller operations** (26 `@OnMessage` +
`@OnConnect` + `@OnDisconnect`), **17 raw runtime emit-only literals** (incl. reaction
acks = reaction literals 2/4/6 of 7), **3 backend-only runtime constants** (2
gateway-emitted queue events + 1 defined-not-wired notification constant), **18
real-time behavior rows**. Total **86 rows**.

---

## 1. Contract event constants — `@yacc/common/websocket/constants` (20 rows, individual)

| ID | Constant (literal) | Baseline source @98db628 | Wiring status at baseline | Required target behavior (Java/Spring, ADR-026) | AsyncAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|---|
| WS-EVT-001 | `CONVERSATION_UPDATED` = `conversation.updated` | `common/src/websocket/constants/ConversationEvents.constant.ts` | Wired: emitted (services/websocket/conversation.handler.ts, tag.service.ts) + inbound @OnMessage (socket-controllers/conversation.controller.ts:77) | Raw WS event, room fan-out to `conversation:{id}`, payload per schemas/conversation-updated.schema.json | `asyncapi.yaml` ch `conversation.updated` | MIG-050/051 behavior tests; MIG-052 frontend adaptation | blocked | 2026-09-26 |
| WS-EVT-002 | `CONVERSATION_REOPENED` = `conversation.reopened` | `common/src/websocket/constants/ConversationEvents.constant.ts` | Wired: emitted (services/conversation.service.ts); no socket-controller handler | Raw WS event preserving reopen semantics | `asyncapi.yaml` ch `conversation.reopened` | MIG-050 behavior tests | blocked | 2026-09-26 |
| WS-EVT-003 | `MESSAGE_RECEIVED` = `message.received` | `common/src/websocket/constants/MessageEvents.constant.ts` | Wired: messageStatusTracker, gateway-hooks/exchange, irc-ingestion; broadcast via connector.controller.ts:43 → room | Raw WS event to `conversation:{id}`, payload per schemas/message-received.schema.json | `asyncapi.yaml` ch `message.received` | MIG-050/060/061 connector parity tests | blocked | 2026-09-26 |
| WS-EVT-004 | `MESSAGE_SENT` = `message.sent` | `common/src/websocket/constants/MessageEvents.constant.ts` | Wired: messageStatusTracker, websocket-gateway, message.handler + inbound @OnMessage (message.controller.ts:22) | Raw WS event, dual-direction capture | `asyncapi.yaml` ch `message.sent` | MIG-050 behavior tests | blocked | 2026-09-26 |
| WS-EVT-005 | `MESSAGE_FAILED` = `message.failed` | `common/src/websocket/constants/MessageEvents.constant.ts` | Wired: messageStatusTracker, message.handler, queue-database-integration + inbound @OnMessage (message.controller.ts:53) | Raw WS event incl. retry metadata (attempt 1..3, retryAt) | `asyncapi.yaml` ch `message.failed` | MIG-050/063 behavior tests | blocked | 2026-09-26 |
| WS-EVT-006 | `NOTIFICATION_RECEIVED` = `notification.received` | `common/src/websocket/constants/NotificationEvents.constant.ts` | Wired: emitted via wsGateway → ENVELOPED | Raw WS event to `user:{id}` room, `{event,data,timestamp}` envelope | `asyncapi.yaml` ch `notification.received` | MIG-050 behavior tests; notification integration evidence | blocked | 2026-09-26 |
| WS-EVT-007 | `NOTIFICATION_DELETED` = `notification.deleted` | `common/src/websocket/constants/NotificationEvents.constant.ts` | **Defined-not-wired**: zero emitters, zero consumers at baseline | Target must wire or drop via MIG-003 canonicalization (scope note to founder) | `asyncapi.yaml` ch `notification.deleted` | MIG-003 reconciliation record | blocked | 2026-09-26 |
| WS-EVT-008 | `NOTIFICATION_READ` = `notification.read` | `common/src/websocket/constants/NotificationEvents.constant.ts` | **Defined-not-wired**: constant referenced only at definition site; no emitter found | Target must wire or drop via MIG-003 | `asyncapi.yaml` ch `notification.read` | MIG-003 reconciliation record | blocked | 2026-09-26 |
| WS-EVT-009 | `PRESENCE_UPDATED` = `presence.updated` | `common/src/websocket/constants/PresenceEvents.constant.ts` | Wired: presence.handler, event-backlog, websocket.server.ts:158 disconnect broadcast + inbound @OnMessage (presence.controller.ts:23) | Raw WS presence event; two divergent payload shapes captured (schemas/presence-updated.schema.json + common PresencePayload) — MIG-003 canonicalizes | `asyncapi.yaml` ch `presence.updated` | MIG-051 presence behavior tests (AC-06) | blocked | 2026-09-26 |
| WS-EVT-010 | `TYPING_STARTED` = `typing.started` | `common/src/websocket/constants/PresenceEvents.constant.ts` | Wired: typing.handler + inbound @OnMessage (typing.controller.ts:22) | Raw WS event to `conversation:{id}` (except sender), 5s timeout window | `asyncapi.yaml` ch `typing.started` | MIG-051 typing behavior tests (AC-06) | blocked | 2026-09-26 |
| WS-EVT-011 | `TYPING_STOPPED` = `typing.stopped` | `common/src/websocket/constants/PresenceEvents.constant.ts` | Wired: typing.handler + inbound @OnMessage (typing.controller.ts:53) + emitted by typing.timeout handler | Raw WS event; explicit stop + server-timeout path | `asyncapi.yaml` ch `typing.stopped` | MIG-051 typing behavior tests (AC-06) | blocked | 2026-09-26 |
| WS-EVT-012 | `USER_ONLINE` = `user.online` | `common/src/websocket/constants/PresenceEvents.constant.ts` | Inbound-only: @OnMessage (presence.controller.ts:50) broadcasts `presence.updated` + replies `online.users`; no outbound `user.online` emit | Target: inbound operation semantics preserved (or canonicalized by MIG-003) | `asyncapi.yaml` ch `user.online` | MIG-051 presence behavior tests | blocked | 2026-09-26 |
| WS-EVT-013 | `USER_OFFLINE` = `user.offline` | `common/src/websocket/constants/PresenceEvents.constant.ts` | Inbound-only: @OnMessage (presence.controller.ts:89) broadcasts `presence.updated`; server disconnect path does not use this constant (broadcasts presence.updated directly) | Target: presence-on-disconnect preserved | `asyncapi.yaml` ch `user.offline` | MIG-051 presence behavior tests | blocked | 2026-09-26 |
| WS-EVT-014 | `CONNECTION_ESTABLISHED` = `system.connection.established` | `common/src/websocket/constants/SystemEvents.constant.ts` | **Defined-not-wired**: runtime emits raw literal `connection.established` instead (websocket.server.ts:83, conversation.controller.ts:39) | Target emits contract name on raw-WS connect (MIG-003 maps literal ↔ constant) | `asyncapi.yaml` ch `system.connection.established` | MIG-050 connect behavior test | blocked | 2026-09-26 |
| WS-EVT-015 | `RECONNECTION_STARTED` = `system.reconnection.started` | `common/src/websocket/constants/SystemEvents.constant.ts` | **Defined-not-wired**: zero wiring; reconnect behavior exists client-side only | Target emits on reconnect attempt (ADR-026 re-implemented reconnect) | `asyncapi.yaml` ch `system.reconnection.started` | MIG-051 reconnect behavior tests (AC-06) | blocked | 2026-09-26 |
| WS-EVT-016 | `RECONNECTION_FAILED` = `system.reconnection.failed` | `common/src/websocket/constants/SystemEvents.constant.ts` | **Defined-not-wired**: zero wiring | Target emits after max attempts exhausted | `asyncapi.yaml` ch `system.reconnection.failed` | MIG-051 reconnect behavior tests (AC-06) | blocked | 2026-09-26 |
| WS-EVT-017 | `HEARTBEAT_RECEIVED` = `system.heartbeat` | `common/src/websocket/constants/SystemEvents.constant.ts` | **Defined-not-wired**: baseline heartbeat = Socket.io engine ping/pong (60s), not an app event | Target: application-level 60s heartbeat emits this contract event (ADR-026) | `asyncapi.yaml` ch `system.heartbeat` | MIG-051 heartbeat behavior tests (AC-06) | blocked | 2026-09-26 |
| WS-EVT-018 | `ERROR_OCCURRED` = `system.error` | `common/src/websocket/constants/SystemEvents.constant.ts` | Partial: frontend references constant; backend emits raw literal `error` {message} on handler failure | Target emits contract name with SystemPayload shape | `asyncapi.yaml` ch `system.error` | MIG-050 error-path behavior test | blocked | 2026-09-26 |
| WS-EVT-019 | `BACKLOG_REPLAY_STARTED` = `system.backlog.replay.started` | `common/src/websocket/constants/SystemEvents.constant.ts` | **Defined-not-wired**: backlog replay exists (event-backlog.service.ts) without emitting this event | Target emits at replay start; replay <5s/100 events SLO | `asyncapi.yaml` ch `system.backlog.replay.started` | MIG-051 backlog behavior tests (AC-06) | blocked | 2026-09-26 |
| WS-EVT-020 | `BACKLOG_REPLAY_COMPLETED` = `system.backlog.replay.completed` | `common/src/websocket/constants/SystemEvents.constant.ts` | **Defined-not-wired**: same status as WS-EVT-019 | Target emits at replay completion | `asyncapi.yaml` ch `system.backlog.replay.completed` | MIG-051 backlog behavior tests (AC-06) | blocked | 2026-09-26 |

## 2. Socket-controller operations — 6 controllers (28 rows)

### 2a. connector.controller.ts — `@SocketController()` connector bridge (6 rows)

| ID | Operation | Baseline source @98db628 | Required target behavior (Java/Spring) | AsyncAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| WS-OP-CONN-001 | `@OnMessage('connector.message.received')` → emits `message.received` to `conversation:{id}` (bare) | `socket-controllers/connector.controller.ts:43` | Raw WS handler bridging Telegram/IRC inbound to conversation room (MIG-060/061 connectors feed this) | ch `connector.message.received` | MIG-050/060/061 tests | blocked | 2026-09-26 |
| WS-OP-CONN-002 | `@OnMessage('connector.status.changed')` → broadcasts `connector.status` + room `status.updated` (bare) | `socket-controllers/connector.controller.ts:94` | Raw WS handler; platform enum telegram/irc; status enum connected/disconnected/error/reconnecting | ch `connector.status.changed` | MIG-050/062 tests | blocked | 2026-09-26 |
| WS-OP-CONN-003 | `@OnMessage('connector.subscribe')` → join `connector:{platform}`, ack `connector.subscribed` | `socket-controllers/connector.controller.ts:144` | Raw WS handler preserving connector-room subscription + ack | ch `connector.subscribe` | MIG-050 tests | blocked | 2026-09-26 |
| WS-OP-CONN-004 | `@OnMessage('connector.unsubscribe')` → leave `connector:{platform}`, ack `connector.unsubscribed` | `socket-controllers/connector.controller.ts:186` | Raw WS handler preserving unsubscribe + ack | ch `connector.unsubscribe` | MIG-050 tests | blocked | 2026-09-26 |
| WS-OP-CONN-005 | `@OnMessage('connector.message.error')` → emits `message.error` to `conversation:{id}` (bare) | `socket-controllers/connector.controller.ts:229` | Raw WS handler; willRetry flag preserved (feeds MIG-063 retry semantics) | ch `connector.message.error` | MIG-050/063 tests | blocked | 2026-09-26 |
| WS-OP-CONN-006 | `@OnMessage('connector.message.ack')` → emits `message.ack` to `conversation:{id}` (bare) | `socket-controllers/connector.controller.ts:283` | Raw WS handler; platformMessageId preserved | ch `connector.message.ack` | MIG-050 tests | blocked | 2026-09-26 |

### 2b. conversation.controller.ts — conversation events + rooms (5 rows)

| ID | Operation | Baseline source @98db628 | Required target behavior (Java/Spring) | AsyncAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| WS-OP-CONV-001 | `@OnConnect()` — join `user:{userId}` room, emit `connection.established` (bare) | `socket-controllers/conversation.controller.ts:21` | Raw WS session registry: on connect join user room (keyed by userId per ADR-026), emit established event | ch `connection` | MIG-050 session-registry tests | blocked | 2026-09-26 |
| WS-OP-CONV-002 | `@OnDisconnect()` — broadcast `presence.updated` offline | `socket-controllers/conversation.controller.ts:49` | Raw WS cleanup + presence-offline broadcast on disconnect | ch `connection` | MIG-050/051 tests | blocked | 2026-09-26 |
| WS-OP-CONV-003 | `@OnMessage('conversation.updated')` → room fan-out `conversation:{id}` except sender (bare) | `socket-controllers/conversation.controller.ts:77` | Raw WS handler; payload per schemas/conversation-updated.schema.json | ch `conversation.updated` | MIG-050 tests | blocked | 2026-09-26 |
| WS-OP-CONV-004 | `@OnMessage('subscribe.conversation')` → join room, ack `conversation.subscribed` | `socket-controllers/conversation.controller.ts:107` | Raw WS room subscription keyed (userId, conversationId) per ADR-026 + ack | ch `subscribe.conversation` | MIG-050 tests | blocked | 2026-09-26 |
| WS-OP-CONV-005 | `@OnMessage('unsubscribe.conversation')` → leave room, ack `conversation.unsubscribed` | `socket-controllers/conversation.controller.ts:137` | Raw WS room unsubscription + ack | ch `unsubscribe.conversation` | MIG-050 tests | blocked | 2026-09-26 |

### 2c. message.controller.ts — message events (4 rows)

| ID | Operation | Baseline source @98db628 | Required target behavior (Java/Spring) | AsyncAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| WS-OP-MSG-001 | `@OnMessage('message.sent')` → room fan-out (bare) | `socket-controllers/message.controller.ts:22` | Raw WS handler, payload per schemas/message-sent.schema.json | ch `message.sent` | MIG-050 tests | blocked | 2026-09-26 |
| WS-OP-MSG-002 | `@OnMessage('message.failed')` → room fan-out (bare) | `socket-controllers/message.controller.ts:53` | Raw WS handler, payload per schemas/message-failed.schema.json | ch `message.failed` | MIG-050 tests | blocked | 2026-09-26 |
| WS-OP-MSG-003 | `@OnMessage('message.retry')` → ack `message.retry.acknowledged` + broadcast `message.retry.started` | `socket-controllers/message.controller.ts:85` | Raw WS handler; once-only retry semantics shared with REST-MSG-003 | ch `message.retry` | MIG-050/063 tests | blocked | 2026-09-26 |
| WS-OP-MSG-004 | `@OnMessage('message.received.ack')` — optional client tracking, no reply | `socket-controllers/message.controller.ts:128` | Raw WS handler (best-effort, error-swallowing preserved) | ch `message.received.ack` | MIG-050 tests | blocked | 2026-09-26 |

### 2d. presence.controller.ts — presence (5 rows)

| ID | Operation | Baseline source @98db628 | Required target behavior (Java/Spring) | AsyncAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| WS-OP-PRES-001 | `@OnMessage('presence.updated')` → broadcast all except sender (bare) | `socket-controllers/presence.controller.ts:23` | Raw WS handler; presence.status enum online/offline/away in contract type | ch `presence.updated` | MIG-051 presence tests (AC-06) | blocked | 2026-09-26 |
| WS-OP-PRES-002 | `@OnMessage('user.online')` → broadcast `presence.updated` online + reply `online.users` | `socket-controllers/presence.controller.ts:50` | Raw WS handler; online-users query from session registry | ch `user.online` | MIG-051 presence tests | blocked | 2026-09-26 |
| WS-OP-PRES-003 | `@OnMessage('user.offline')` → broadcast `presence.updated` offline | `socket-controllers/presence.controller.ts:89` | Raw WS handler | ch `user.offline` | MIG-051 presence tests | blocked | 2026-09-26 |
| WS-OP-PRES-004 | `@OnMessage('user.status')` → broadcast `user.status.changed` (active/idle/away) | `socket-controllers/presence.controller.ts:120` | Raw WS handler; granular presence preserved | ch `user.status` | MIG-051 presence tests | blocked | 2026-09-26 |
| WS-OP-PRES-005 | `@OnMessage('request.online.users')` → reply `online.users` or generic `error` | `socket-controllers/presence.controller.ts:153` | Raw WS handler with error-path emit | ch `request.online.users` | MIG-051 presence tests | blocked | 2026-09-26 |

### 2e. reaction.controller.ts — reaction surface (4 of 7 reaction literals; remaining 3 acks in §3)

| ID | Operation | Baseline source @98db628 | Required target behavior (Java/Spring) | AsyncAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| WS-OP-REACT-001 | Reaction literal 1/7 `@OnMessage('reaction.added')` → room fan-out + sender ack `reaction.added.ack` (bare) | `socket-controllers/reaction.controller.ts:22` | Raw WS handler; payload per schemas/reaction-added.schema.json | ch `reaction.added` | MIG-050 tests | blocked | 2026-09-26 |
| WS-OP-REACT-002 | Reaction literal 3/7 `@OnMessage('reaction.removed')` → room fan-out + sender ack `reaction.removed.ack` (bare) | `socket-controllers/reaction.controller.ts:62` | Raw WS handler; payload per schemas/reaction-removed.schema.json | ch `reaction.removed` | MIG-050 tests | blocked | 2026-09-26 |
| WS-OP-REACT-003 | Reaction literal 5/7 `@OnMessage('reaction.list')` → reply `reaction.list.ack` (reactions always `[]` at baseline) or generic `error` | `socket-controllers/reaction.controller.ts:102` | Raw WS handler; baseline no-DB behavior captured; MIG-003 canonicalizes list semantics | ch `reaction.list` | MIG-050 tests | blocked | 2026-09-26 |
| WS-OP-REACT-004 | Reaction literal 7/7 `@OnMessage('reaction.count')` → room fan-out {messageId, emoji, count, timestamp} (bare) | `socket-controllers/reaction.controller.ts:135` | Raw WS handler | ch `reaction.count` | MIG-050 tests | blocked | 2026-09-26 |

### 2f. typing.controller.ts — typing (4 rows)

| ID | Operation | Baseline source @98db628 | Required target behavior (Java/Spring) | AsyncAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| WS-OP-TYPE-001 | `@OnMessage('typing.started')` → room fan-out except sender (bare) | `socket-controllers/typing.controller.ts:22` | Raw WS handler; 5s timeout window | ch `typing.started` | MIG-051 typing tests (AC-06) | blocked | 2026-09-26 |
| WS-OP-TYPE-002 | `@OnMessage('typing.stopped')` → room fan-out except sender (bare) | `socket-controllers/typing.controller.ts:53` | Raw WS handler | ch `typing.stopped` | MIG-051 typing tests | blocked | 2026-09-26 |
| WS-OP-TYPE-003 | `@OnMessage('typing.timeout')` → emits `typing.stopped` to room (best-effort) | `socket-controllers/typing.controller.ts:85` | Raw WS server-side timeout path | ch `typing.timeout` | MIG-051 typing tests | blocked | 2026-09-26 |
| WS-OP-TYPE-004 | `@OnMessage('typing.heartbeat')` — optional keep-alive, no reply | `socket-controllers/typing.controller.ts:121` | Raw WS handler (error-swallowing preserved) | ch `typing.heartbeat` | MIG-051 typing tests | blocked | 2026-09-26 |

## 3. Raw runtime emit-only literals (17 rows; reaction literals 2/4/6 of 7 here)

| ID | Literal | Baseline source @98db628 | Required target behavior (Java/Spring) | AsyncAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| WS-RAW-001 | `connection.established` — emitted by BOTH websocket.server.ts:83 and conversation.controller.ts:39 (duplicate emit path) | `websockets/websocket.server.ts:83`, `socket-controllers/conversation.controller.ts:39` | Single connect-time emit of contract event (MIG-003 dedupes) | ch `connection.established` | MIG-050 tests | blocked | 2026-09-26 |
| WS-RAW-002 | `conversation.subscribed` — ack {conversationId} | `socket-controllers/conversation.controller.ts:120` | Subscribe ack preserved | ch `conversation.subscribed` | MIG-050 tests | blocked | 2026-09-26 |
| WS-RAW-003 | `conversation.unsubscribed` — ack {conversationId} | `socket-controllers/conversation.controller.ts:150` | Unsubscribe ack preserved | ch `conversation.unsubscribed` | MIG-050 tests | blocked | 2026-09-26 |
| WS-RAW-004 | `message.retry.acknowledged` — ack {messageId, timestamp} | `socket-controllers/message.controller.ts:98` | Retry ack preserved | ch `message.retry.acknowledged` | MIG-050 tests | blocked | 2026-09-26 |
| WS-RAW-005 | `message.retry.started` — room broadcast {messageId, conversationId, timestamp} | `socket-controllers/message.controller.ts:105` | Retry-start broadcast preserved | ch `message.retry.started` | MIG-050 tests | blocked | 2026-09-26 |
| WS-RAW-006 | `online.users` — reply {users[], timestamp} | `socket-controllers/presence.controller.ts:68,161` | Online-users reply preserved | ch `online.users` | MIG-051 tests | blocked | 2026-09-26 |
| WS-RAW-007 | `user.status.changed` — broadcast {userId, status, timestamp} | `socket-controllers/presence.controller.ts:132` | Granular presence broadcast preserved | ch `user.status.changed` | MIG-051 tests | blocked | 2026-09-26 |
| WS-RAW-008 | `connector.status` — broadcast {platform, status, message, timestamp} | `socket-controllers/connector.controller.ts:110` | Connector status broadcast preserved | ch `connector.status` | MIG-062 tests | blocked | 2026-09-26 |
| WS-RAW-009 | `status.updated` — room broadcast to `connector:{platform}` | `socket-controllers/connector.controller.ts:119` | Connector-room status preserved | ch `status.updated` | MIG-062 tests | blocked | 2026-09-26 |
| WS-RAW-010 | `connector.subscribed` — ack {platform, timestamp} | `socket-controllers/connector.controller.ts:163` | Subscribe ack preserved | ch `connector.subscribed` | MIG-050 tests | blocked | 2026-09-26 |
| WS-RAW-011 | `connector.unsubscribed` — ack {platform, timestamp} | `socket-controllers/connector.controller.ts:205` | Unsubscribe ack preserved | ch `connector.unsubscribed` | MIG-050 tests | blocked | 2026-09-26 |
| WS-RAW-012 | `message.error` — room event {messageId, error, willRetry, timestamp} | `socket-controllers/connector.controller.ts:256` | Delivery-failure event preserved | ch `message.error` | MIG-063 tests | blocked | 2026-09-26 |
| WS-RAW-013 | `message.ack` — room event {messageId, platformMessageId, timestamp} | `socket-controllers/connector.controller.ts:308` | Delivery-ack event preserved | ch `message.ack` | MIG-063 tests | blocked | 2026-09-26 |
| WS-RAW-014 | Reaction literal 2/7 `reaction.added.ack` — sender ack {messageId, emoji, timestamp} | `socket-controllers/reaction.controller.ts:39` | Sender-ack literal preserved | ch `reaction.added.ack` | MIG-050 tests | blocked | 2026-09-26 |
| WS-RAW-015 | Reaction literal 4/7 `reaction.removed.ack` — sender ack {messageId, emoji, timestamp} | `socket-controllers/reaction.controller.ts:79` | Sender-ack literal preserved | ch `reaction.removed.ack` | MIG-050 tests | blocked | 2026-09-26 |
| WS-RAW-016 | Reaction literal 6/7 `reaction.list.ack` — reply {messageId, reactions[], timestamp}; reactions always `[]` at baseline | `socket-controllers/reaction.controller.ts:111` | Reply literal preserved; MIG-003 canonicalizes list semantics | ch `reaction.list.ack` | MIG-050 tests | blocked | 2026-09-26 |
| WS-RAW-017 | `error` — generic error emit {message} on handler failure | `socket-controllers/presence.controller.ts:170`, `socket-controllers/reaction.controller.ts:122` | Centralized error emit; MIG-003 maps raw `error` literal ↔ `system.error` contract constant | ch `error` | MIG-050 error-path tests | blocked | 2026-09-26 |

> Reaction-literal audit (7/7 individually captured): 1 `reaction.added` (WS-OP-REACT-001),
> 2 `reaction.added.ack` (WS-RAW-014), 3 `reaction.removed` (WS-OP-REACT-002),
> 4 `reaction.removed.ack` (WS-RAW-015), 5 `reaction.list` (WS-OP-REACT-003),
> 6 `reaction.list.ack` (WS-RAW-016), 7 `reaction.count` (WS-OP-REACT-004) — one row and
> one AsyncAPI channel per literal.

## 4. Backend-only runtime constants — backend `websockets/wsConstants.ts` (3 rows)

| ID | Event | Baseline source @98db628 | Required target behavior (Java/Spring) | AsyncAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| WS-QEV-001 | `message.retry.scheduled` (backend wsConstant QueueEvents.MESSAGE_RETRY_SCHEDULED — NOT in the 20-constant common contract) | `websockets/wsConstants.ts:50`, emitted `services/queue-database-integration.ts:190` via wsGateway → ENVELOPED | Re-expressed over Quartz (ADR-028); MIG-003 reconciles backend wsConstants vs common contract | ch `message.retry.scheduled` | MIG-063 tests | blocked | 2026-09-26 |
| WS-QEV-002 | `queue.message.dlq` (backend wsConstant QueueEvents.MESSAGE_DLQ — NOT in the 20-constant common contract) | `websockets/wsConstants.ts:51`, emitted `services/queue-database-integration.ts:261` via wsGateway → ENVELOPED | Re-expressed over DB DLQ (ADR-028); MIG-003 reconciliation | ch `queue.message.dlq` | MIG-063 tests | blocked | 2026-09-26 |
| WS-QEV-003 | `notification.dismissed` (backend wsConstant NotificationEvents.NOTIFICATION_DISMISSED — NOT in the 20-constant common contract) — defined-not-wired: zero baseline emitters (dismiss path logs only, no socket emit) | `websockets/wsConstants.ts:34` | Defined-not-wired captured as frozen surface row; MIG-003 canonicalizes (wire the emit on dismissal, or drop with founder-visible scope note); Java target emits contract name per AC-06 | ch `notification.dismissed` | MIG-052 notification tests | blocked | 2026-09-26 |

## 5. Real-time behaviors (18 rows)

| ID | Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | AsyncAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| WS-BHV-001 | Envelope `{event,data,timestamp}` — verbatim shape, timestamp ISO 8601 set at emit | `websockets/gateway.ts:73-77` | Envelope preserved verbatim (ADR-026); applied uniformly (socket-controller bare emits canonicalized in MIG-003) | `schemas/envelope.schema.json` | MIG-050 envelope contract tests | blocked | 2026-09-26 |
| WS-BHV-002 | Gateway emit path `emitGlobally` — io.emit + envelope + error swallow | `websockets/gateway.ts:66` | Raw WS broadcast to all sessions with envelope | ch (all glob broadcasts) | MIG-050 tests | blocked | 2026-09-26 |
| WS-BHV-003 | Gateway emit path `emitToUser` — room `user:{userId}` + envelope | `websockets/gateway.ts:100` | Session-registry targeted send (userId key) | ch (user sends) | MIG-050 tests | blocked | 2026-09-26 |
| WS-BHV-004 | Gateway emit path `emitToConversation` — room `conversation:{id}` + envelope | `websockets/gateway.ts:131` | Session-registry room send (conversationId key) | ch (conversation sends) | MIG-050 tests | blocked | 2026-09-26 |
| WS-BHV-005 | Gateway emit path `emitToRooms` — per-room loop + envelope | `websockets/gateway.ts:170` | Multi-room send preserved | ch (multi-room) | MIG-050 tests | blocked | 2026-09-26 |
| WS-BHV-006 | Room namespace `user:{userId}` — personal room joined at connect (websocket.server.ts:79, conversation.controller.ts:35) | `websockets/websocket.server.ts:79` | Session registry keyed (userId, conversationId) per ADR-026 | info.description | MIG-050 session-registry tests | blocked | 2026-09-26 |
| WS-BHV-007 | Room namespace `conversation:{conversationId}` — subscribe/unsubscribe/room fan-out | `websocket.server.ts:215-311`, conversation/typing/message/reaction controllers | Room semantics preserved incl. subscriber queries | info.description | MIG-050 tests | blocked | 2026-09-26 |
| WS-BHV-008 | Room namespace `connector:{platform}` — ops monitoring rooms (telegram, irc) | `socket-controllers/connector.controller.ts:118,149,185` | Connector rooms preserved (MIG-062) | ch `connector.subscribe` | MIG-062 tests | blocked | 2026-09-26 |
| WS-BHV-009 | Event backlog — 1h rolling window per user, Redis keys `ws:backlog:{userId}` TTL 3600s, store/replay/clear lifecycle | `services/websocket/event-backlog.service.ts`, `websockets/wsConstants.ts:106` | **Re-homed to PostgreSQL** `websocket_backlog` table, 1h window (ADR-028; Redis dropped); replay <5s/100 events SLO | info.description | MIG-051 backlog tests (AC-06) | blocked | 2026-09-26 |
| WS-BHV-010 | Heartbeat — 60s ping interval (PING_INTERVAL_MS=60000), pingTimeout 60s; Socket.io engine-level at baseline | `websockets/wsConstants.ts:71`, `websocket.server.ts:35-36` | Application-level 60s heartbeat re-implemented on raw WS; emits `system.heartbeat` contract event (ADR-026; polling fallback removed) | ch `system.heartbeat` | MIG-051 heartbeat tests (AC-06) | blocked | 2026-09-26 |
| WS-BHV-011 | Reconnect/backoff — server contract RECONNECT_CONFIG: initial 1000ms, max 60000ms, maxAttempts 5, factor 2 | `websockets/wsConstants.ts:81-101` | Exponential backoff re-implemented (resilience is application-owned, ADR-026) | info.description | MIG-051 reconnect tests (AC-06) | blocked | 2026-09-26 |
| WS-BHV-012 | Reconnect/backoff — client behavior: socket.io reconnection delays [1000,2000,4000,8000,30000]ms, 10 attempts (lib/socket.ts singleton stack) | `frontend/src/lib/socket.ts:77-105` | Frontend drops socket.io-client (MIG-052); raw-WS client re-implements identical backoff ladder; second WS stack (services/websocket/WebSocketClient) reconciled by MIG-003 | info.description | MIG-052 frontend tests (AC-06/AC-07) | blocked | 2026-09-26 |
| WS-BHV-013 | Connection timeout — CONNECTION_TIMEOUT_MS = 3600000 (1h) | `websockets/wsConstants.ts:76` | Equivalent idle/connection bound on raw WS | info.description | MIG-050 tests | blocked | 2026-09-26 |
| WS-BHV-014 | Presence lifecycle — connect tracking (userId→socketIds map), last-socket-off disconnect broadcast, server-side presence broadcast | `websockets/websocket.server.ts:120-164` | Session-registry presence semantics preserved (AC-06) | ch `presence.updated` | MIG-051 presence tests | blocked | 2026-09-26 |
| WS-BHV-015 | Typing timeout — TYPING_TIMEOUT_MS = 5000; explicit stop + timeout + heartbeat keep-alive | `websockets/wsConstants.ts:111`, `socket-controllers/typing.controller.ts` | Typing timeout/keep-alive preserved (AC-06) | ch `typing.timeout`, ch `typing.heartbeat` | MIG-051 typing tests | blocked | 2026-09-26 |
| WS-BHV-016 | Auth on handshake — `socket.handshake.auth.token` → BetterAuth getSession → DB user load → status enforcement (inactive/suspended rejected) → attach userId/email/role/name; failures rejected pre-connect | `websockets/auth.middleware.ts:33-93` | Raw WS handshake auth: token → Spring Security validation → status enforcement (RBAC/status parity, ADR-025); reject before session establishment | ch `connection` | MIG-050 auth tests; AC-04 status-enforcement evidence | blocked | 2026-09-26 |
| WS-BHV-017 | Generic error emit — `socket.emit('error', {message})` on handler failure (request.online.users, reaction.list) | `socket-controllers/presence.controller.ts:170`, `socket-controllers/reaction.controller.ts:122` | Centralized error emit; MIG-003 maps raw `error` literal ↔ `system.error` contract constant | ch `error` | MIG-050 error-path tests | blocked | 2026-09-26 |
| WS-BHV-018 | correlationId propagation in real-time payloads — correlationId carried in event metadata (message status payloads) | `services/messageStatusTracker.ts:428` | MDC correlationId parity end-to-end (TR-07, ADR-029) | info.description | MIG-011/MIG-050 observability evidence | blocked | 2026-09-26 |

---

## Capture reconciliation notes (for MIG-003)

1. **Envelope coherence:** gateway emissions are enveloped; socket-controller emits are
   bare payloads. ADR-026 fixes `{event,data,timestamp}`; MIG-003 picks the single
   server-side emit path shape.
2. **Constant-set coherence:** `@yacc/common` (20 constants) vs backend `wsConstants.ts`
   (13: MessageEvents 3, ConversationEvents 2, NotificationEvents 3 with
   `notification.dismissed` replacing `notification.deleted` (row WS-QEV-003), PresenceEvents 3 without
   user.online/user.offline, QueueEvents 2 (rows WS-QEV-001/002), no SystemEvents group). Both sets are frozen
   above; unification is a MIG-003 decision within frozen scope.
3. **Literal-vs-constant drift:** runtime emits raw `connection.established` /
   `error` instead of `system.connection.established` / `system.error`; 5 SystemEvents +
   `notification.deleted` + `notification.read` have zero backend wiring. The Java target
   must emit contract names; wire mapping frozen by the rows above.
4. **Presence payload divergence:** backend runtime shape {userId,status,lastSeen} (+ an
   `isOnline` boolean variant in websocket.server.ts:158) vs common contract type
   {userId,userName,status online|offline|away,lastSeenAt,typingIn?}. Both captured.
5. **Duplicate WS stacks (frontend) and emit-path duplication (backend
   connection.established)** are captured for MIG-003 reconciliation; not resolved here.
6. **Schema source note:** payload JSON Schemas in `schemas/` re-express the verified
   baseline types (backend `websocket.types.ts` Zod schemas + common TS interfaces) as
   language-neutral JSON Schema per ADR-023. Zod is NOT the contract source.
