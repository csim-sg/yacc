# Contracts Manifest — completeness registry (ANG-002; socket section re-pointed to the frozen AsyncAPI by ANG-006)

**Baseline:** live backend controllers at `dev` @ `230bd226` (2026-10-06) for HTTP (re-derived from SPEC-001 T3 §4.2); the real-time section is re-pointed to the **frozen `.docs/migration/asyncapi.yaml`** + Java raw WebSocket (ADR-023/ADR-026; SPEC-003 §Java Baseline Approval AD-2/R1) — the Node Socket.io capture (T3 §5.1) is superseded as the real-time wire truth (R1; the ANG-002 seam reconciliation is discharged here). Live code is the baseline wherever this file, `.docs/02-api-and-data-model.md`, or React type claims disagree (T3 §4.4 method).

**Rules (T3 §2.2):** every baseline endpoint/event maps to its owning schema file and its covering Playwright spec. A row with **no covering spec is a recorded, visible gap** — never silently dropped. Gap rows cite the T3 gap register (G1–G10) or a new **D-row** (DTO-claim drift verified in ANG-002, listed below). Production response parsing stays permissive; these schemas are parsed only by the parity harness (ANG-003), never `.parse()`-ed in the production path.

**Source-of-truth files:** `contracts/common/*`, `contracts/http/*.schema.ts`, `contracts/ws/events.schema.ts` (frozen AsyncAPI envelope + per-channel data), `contracts/ws/connection.ts` (raw-WS transport pins), `contracts/cache-keys.ts`.

## DTO-claim drift register (verified 2026-10-06 @ `230bd226` — recorded, NOT fixed)

The founder override pins Angular to React's calls/behavior 1:1; where a React service *type claim* disagrees with the verified wire, the contract encodes the **wire** and the drift is recorded here so family issues (ANG-005..013) port the behavior knowingly:

| # | Drift | React claim | Verified wire | Parity disposition |
|---|---|---|---|---|
| D1 | Tags attach/detach routes | `POST /api/tags/conversations/:id`, `DELETE /api/tags/conversations/:id/tags/:tagId` | `POST /api/conversations/:id/tags`, `DELETE /api/conversations/:id/tags/:tagId` (no `/api/tags/conversations/*` route exists) | React attach/detach calls 404 today; W8 anchor is `tags.e2e.spec.ts`. Angular ports the wire routes; visible-behavior parity is judged by the W8 gate (ANG-009). |
| D2 | Message list response | `{ data, page, pageSize, total }` | `{ messages, total, page, limit }` | React reads `.data` → empty message list on the detail page; W7 parity = same visible behavior (ANG-008 owns it). |
| D3 | Message send response | `{ data: message }` | raw message (201) | **Resolved in ANG-008 (#378, U3 disposition):** the send path consumes the approved frozen-contract operation (`sendConversationMessage` → `{ data: Message }` 201, the backend-of-record shape); `SendMessageResponseSchema` encodes the envelope and `MessagesService.send` unwraps it, so the store's confirmed append receives the message row (React appends `response.data` 1:1). The historical Node-era raw-wire note above is retained for provenance. |
| D4 | Users list response | `{ users, pagination }` | `BaseListResponse` `{ data, page, limit, total }` | W15 coverage is nav-level only; ANG-011 ports the wire shape. |
| D5 | Audit logs list response | `{ items, total, page, limit, pages }` | `BaseListResponse` `{ data, page, limit, total }` | W18 spec is API-level; ANG-013 ports the wire shape. |
| D6 | Notes list response | `{ data, page, pageSize, total }` | `BaseListResponse` `{ data, page, limit, total }` (`pageSize` is request-param only) | W9 hook-level; ANG-009 ports the wire shape. |
| D7 | Message status response | (no React type) | raw `{ messageId, status, createdAt, updatedAt }` | G8 API-only; encoded to pin the shape. |

## HTTP endpoints (T3 §4.2)

| Family | Endpoint (method path) | Roles | Schema (file → symbol) | Covering Playwright spec | Status |
|---|---|---|---|---|---|
| Auth | `POST /api/auth/sign-in/email` (rate-limited) | public | `http/auth.schema.ts` → `SignInRequestSchema`, `AuthSessionResponseSchema` | `frontend-login.spec.ts`, `fe-002-login-ui.spec.ts` (W1) | covered |
| Auth | `POST /api/auth/sign-up/email` (BetterAuth delegation) | public | `http/auth.schema.ts` → `SignUpRequestSchema`, `AuthSessionResponseSchema` | `backend-auth.spec.ts` (API-level) | API-level only |
| Auth | `POST /api/auth/sign-out` | auth | `http/auth.schema.ts` → `AuthSignOutResponseSchema` | `fe-003-rbac-nav.spec.ts` (session gate), `backend-auth.spec.ts` (API) | covered |
| Auth | `GET /api/auth/get-session` | auth | `http/auth.schema.ts` → `AuthSessionGetResponseSchema` | `fe-003-rbac-nav.spec.ts` (redirect behavior), `backend-auth.spec.ts` (API) | covered |
| Auth | `POST /api/auth/refresh-token` (single-use rotation) | public | `http/auth.schema.ts` → `RefreshTokenRequestSchema`, `AuthRefreshResponseSchema` | `backend-auth.spec.ts` (API-level) | API-level only |
| Auth | `POST /api/auth/change-password` | auth | `http/auth.schema.ts` → `ChangePasswordRequestSchema`, `AuthSignOutResponseSchema` | none | **gap** (no spec; ANG-004 wires the flow) |
| Auth | `POST /api/auth/forgot-password` | public | `http/auth.schema.ts` → `ForgotPasswordRequestSchema`, `MessageResponseSchema` | `backend-auth.spec.ts` (API-level) | API-level only |
| Auth | `POST /api/auth/reset-password` | public | `http/auth.schema.ts` → `ResetPasswordRequestSchema`, `SuccessMessageResponseSchema` | `backend-auth.spec.ts` (API-level) | API-level only |
| Auth | `POST /api/auth/verify-email` | public | `http/auth.schema.ts` → `VerifyEmailRequestSchema`, `SuccessMessageResponseSchema` | none | **gap** (no spec) |
| Conversations | `GET /api/conversations` | auth | `http/conversations.schema.ts` → `ListConversationsParamsSchema`, `ListConversationsResponseSchema` (D-note: wire `limit`) | `inbox-content.spec.ts`, `inbox-filters.spec.ts`, `inbox-network.spec.ts` (W5), `backend-conversations.spec.ts` (API) | covered |
| Conversations | `GET /api/conversations/:id` | auth | `http/conversations.schema.ts` → `ConversationDetailSchema`, `GetConversationResponseSchema` | `conversation-detail.spec.ts` (W7) | covered |
| Conversations | `PATCH /api/conversations/:id/status` | admin, manager, super_admin | `http/conversations.schema.ts` → `UpdateConversationStatusRequestSchema`, `UpdateConversationResponseSchema` | none (test-only hook) | **gap** (G8/W11 — parity = same absence) |
| Conversations | `PATCH /api/conversations/:id/priority` | manager, admin, super_admin | `http/conversations.schema.ts` → `UpdateConversationPriorityRequestSchema`, `UpdateConversationResponseSchema` | none | **gap** (G8/W12 — parity = same absence) |
| Conversations | `PATCH /api/conversations/:id/assign` | admin, super_admin | `http/conversations.schema.ts` → `AssignConversationByIdRequestSchema`, `UpdateConversationResponseSchema` | none | **gap** (G8 — second, non-live assign route; live consumer uses the POST route below) |
| Assignments | `POST /api/conversations/:conversationId/assign` | manager+ (auth) | `http/assignments.schema.ts` → `AssignConversationRequestSchema`, `AssignConversationResponseSchema` | `fe-004-cache-invalidation.spec.ts` (hook-level, W10) | hook-level only |
| Bulk | `POST /api/conversations/bulk` | manager+ | `http/conversations.schema.ts` (requests via `AssignConversationByIdRequestSchema`-style bodies are action-specific) — see note below | none | **gap** (G8/W13 — service unwired in React; recorded) |
| Messages | `GET /api/conversations/:conversationId/messages` | auth | `http/messages.schema.ts` → `ListMessagesResponseSchema` (D2) | `conversation-detail.spec.ts` (W7), `backend-regression.spec.ts` (API) | covered (visible parity = D2 behavior) |
| Messages | `POST /api/conversations/:conversationId/messages` | auth (user+) | `http/messages.schema.ts` → `SendMessageRequestSchema`, `SendMessageResponseSchema` (D3) | `conversation-detail.spec.ts` (W7) | covered (visible parity = D3 behavior) |
| Messages | `POST .../messages/:messageId/retry` | auth (+assignment rule) | `http/messages.schema.ts` → `RetryMessageResponseSchema` | `conversation-detail.spec.ts` (W7) | covered |
| Messages | `GET .../messages/:messageId/status` | auth | `http/messages.schema.ts` → `GetMessageStatusResponseSchema` (D7) | none | **gap** (G8 — parity = same absence) |
| Notes | `GET /api/conversations/:conversationId/notes` | auth | `http/notes.schema.ts` → `ListNotesParamsSchema`, `ListNotesResponseSchema` (D6) | none (fe-004 hooks are test-only) | **gap** (W9 hook-level — recorded, T4 owns masking analysis) |
| Notes | `POST /api/conversations/:conversationId/notes` | auth | `http/notes.schema.ts` → `CreateNoteRequestSchema`, `CreateNoteResponseSchema` | none | **gap** (W9 hook-level — recorded) |
| Tags | `GET /api/tags` | auth | `http/tags.schema.ts` → `ListTagsResponseSchema` | `tags.e2e.spec.ts` (W8) | covered |
| Tags | `POST /api/tags` | auth | `http/tags.schema.ts` → `CreateTagRequestSchema`, `CreateTagResponseSchema` | `tags.e2e.spec.ts` (W8) | covered |
| Tags | `POST /api/conversations/:id/tags` | auth | `http/tags.schema.ts` → `AttachTagRequestSchema`, `ConversationTagsResponseSchema` (D1) | `tags.e2e.spec.ts` (W8; React's drifted path is D1) | covered (wire route) |
| Tags | `DELETE /api/conversations/:id/tags/:tagId` | auth | `http/tags.schema.ts` → `ConversationTagsResponseSchema` (D1) | `tags.e2e.spec.ts` (W8) | covered (wire route) |
| Routing rules | `GET /api/routing-rules` | manager+ | `http/routing-rules.schema.ts` → `ListRoutingRulesResponseSchema` | acceptance/phase2 only (`routing-rules.spec.ts` — **not in default run set**) | **gap** (default-run coverage missing) |
| Routing rules | `GET /api/routing-rules/:id` | manager+ | `http/routing-rules.schema.ts` → `GetRoutingRuleResponseSchema` | none | **gap** |
| Routing rules | `POST /api/routing-rules` | admin+ | `http/routing-rules.schema.ts` → `CreateRoutingRuleRequestSchema`, `CreateRoutingRuleResponseSchema` | acceptance/phase2 only | **gap** (default-run coverage missing) |
| Routing rules | `PATCH /api/routing-rules/:id` | admin+ | `http/routing-rules.schema.ts` → `UpdateRoutingRuleRequestSchema`, `UpdateRoutingRuleResponseSchema` | acceptance/phase2 only | **gap** (default-run coverage missing) |
| Routing rules | `DELETE /api/routing-rules/:id` | admin+ | `http/routing-rules.schema.ts` → `DeleteRoutingRuleResponseSchema` | acceptance/phase2 only | **gap** (default-run coverage missing) |
| Routing rules | `GET /api/routing-rules/:id/executions` | manager+ | `http/routing-rules.schema.ts` → `ListRoutingRuleExecutionsParamsSchema`, `ListRoutingRuleExecutionsResponseSchema` | none | **gap** |
| Users | `GET /api/users` | super_admin | `http/users.schema.ts` → `ListUsersParamsSchema`, `ListUsersResponseSchema` (D4) | `fe-003-rbac-nav.spec.ts` (nav-level only, W15) | nav-level only |
| Users | `POST /api/users` | super_admin | `http/users.schema.ts` → `CreateUserRequestSchema`, `CreateUserResponseSchema` | none | **gap** (W15 — parity = same absence of UI flow) |
| Users | `PUT /api/users/:id` | super_admin | `http/users.schema.ts` → `UpdateUserRequestSchema`, `UpdateUserResponseSchema` | none | **gap** (W15) |
| Users | `DELETE /api/users/:id` | super_admin | `http/users.schema.ts` → `DeleteUserResponseSchema` | none | **gap** (W15) |
| Users | `GET /api/users/roles` | auth | `http/users.schema.ts` → `ListRolesResponseSchema` | none | **gap** (G8 — API-only) |
| Notifications | `GET /api/notifications` | auth | *(no schema family — API-only, G8; excluded from ANG-002 family scope)* | none | **gap** (G8/W17 — notification UI is socket-fed and that socket event has no emitter, G2; REST-only specs only) |
| Notifications | `PATCH /api/notifications/:id`, `DELETE /api/notifications/:id`, `POST /api/notifications/mark-all-read` | auth | *(no schema family — G8)* | none | **gap** (G8/W17) |
| Audit | `GET /api/audit-logs` | manager+ | `http/audit-logs.schema.ts` → `ListAuditLogsParamsSchema`, `ListAuditLogsResponseSchema` (D5) | `backend-audit-logs.spec.ts` (API-level, W18) | API-level only |
| Audit | `GET /api/audit-logs/conversations/:conversationId` | manager+ | `http/audit-logs.schema.ts` → `ListConversationAuditLogsParamsSchema`, `ListConversationAuditLogsResponseSchema` (D5) | `backend-audit-logs.spec.ts` (API-level) | API-level only |
| Audit | `POST /api/audit-logs/export` | admin+ | `http/audit-logs.schema.ts` → `ExportAuditLogsRequestSchema` (response = binary blob) | none | **gap** (G8 — API-only) |
| IRC | `POST /api/integrations/irc/config` | super_admin | `http/irc.schema.ts` → `IrcConfigRequestSchema` | `INT-010-irc-profiles.spec.ts` (W16) | covered (W16) |
| IRC | `POST /api/integrations/irc/connect` | super_admin | `http/irc.schema.ts` → `IrcConnectRequestSchema` | `INT-010-irc-profiles.spec.ts` (W16) | covered (W16) |
| IRC | `POST /api/integrations/irc/test` | super_admin | `http/irc.schema.ts` → `IrcTestRequestSchema`, `IrcTestResponseSchema` | `INT-010-irc-profiles.spec.ts` (W16 — live consumer) | covered (W16) |
| IRC | `GET /api/integrations/irc/status` | admin+ | `http/irc.schema.ts` → `IrcStatusResponseSchema` | `INT-010-irc-profiles.spec.ts` (W16) | covered (W16) |
| IRC profiles | `POST/GET /api/integrations/irc/profiles` | super_admin (mutate) / admin+ (read) | `http/irc.schema.ts` → `CreateIrcProfileRequestSchema`, `IrcProfileSchema`, `ListIrcProfilesResponseSchema` | `INT-010-irc-profiles.spec.ts` (W16) | covered (W16) |
| IRC profiles | `GET/PUT/DELETE /api/integrations/irc/profiles/:id`, `POST .../:id/activate`, `POST .../:id/disable`, `POST .../:id/test` | super_admin (mutate) / admin+ (read) | `http/irc.schema.ts` → `UpdateIrcProfileRequestSchema`, `TestConnectionResultSchema` | `INT-010-irc-profiles.spec.ts` (W16) | covered (W16) |
| Queue/DLQ | `/api/queue/*`, `/api/dlq/*` | manager→super_admin ladder | *(no schema family — no FE consumer, G8; excluded from ANG-002 family scope)* | none | **gap** (G8 — parity = same absence) |
| Health | `GET /health` (also `/live`, `/ready`) | public | *(no schema family — no FE consumer, G8)* | none | **gap** (G8) |

**Bulk note:** `POST /api/conversations/bulk` bodies are action-discriminated (`{ conversationIds, action: 'assign'|'tag'|'status', data }` with `data` = `{ assigneeId }` | `{ tagId }` | `{ status }`), consumed by the unwired `bulkActions.service` (G8/W13). When a family issue ports bulk actions (ANG-007+), its schema lands in `contracts/http/conversations.schema.ts` and this row is updated — recorded here so the surface is not silently dropped.

## Real-time channels (frozen `asyncapi.yaml` — the R1 target, ANG-006)

Baseline row source superseded: this section is re-pointed from the Node Socket.io capture to the **frozen `.docs/migration/asyncapi.yaml`** (ADR-023, GOV-038) + Java raw Spring WebSocket (ADR-026) per SPEC-003 §Java Baseline Approval **AD-2/R1**. Every server→client frame carries the frozen `{event, data, timestamp}` envelope (`schemas/envelope.schema.json`); the per-channel `data` payload is the frozen schema. Wire shapes are encoded in `contracts/ws/events.schema.ts`; transport constants in `contracts/ws/connection.ts`.

| Channel (frozen name) | Frozen disposition (`asyncapi.yaml`) | Angular listener | Writes to | Notes |
|---|---|---|---|---|
| `conversation.updated` | wired, enveloped | yes (`ConversationEventsService`) | invalidate conversation detail + conversations lists | B4 mapping; updates are idempotent refetches |
| `conversation.reopened` | declared channel, payload shape not pinned | yes (`ConversationEventsService`) | same invalidations | **U2 open**: backend emitter is an open founder product decision — no live coverage claimed (parity-of-absence); `conversationId` consumed only when present |
| `message.received` | wired, enveloped | yes (`MessageEventsService`) | append to loaded message list (id dedup) + invalidate conversations lists | inbound rows map onto the store `Message` shape (`status: 'sent'`, `direction: 'inbound'`) |
| `message.sent` | wired, enveloped (`sentAt`) | yes (`MessageEventsService`) | patch row status → `sent` + invalidate conversations lists | frozen data schema supersedes the Node-era `platformMessageId`/`timestamp` members |
| `message.failed` | wired, enveloped (`retryAt`, `attempt` ≤ 3) | yes (`MessageEventsService`) | patch row status → `failed` + invalidate conversations lists | same supersession (no `maxAttempts`/`isFinal`) |
| `typing.started` / `typing.stopped` | wired, enveloped (`name`) | yes (`PresenceEventsService`) | `WebSocketStateService` typing rows + 5s auto-clear timers | W20 state half; UI is ANG-007/008 |
| `presence.updated` | wired, enveloped — MIG-003 canonical `{userId, status: online\|offline, lastSeen}` | yes (`PresenceEventsService`) | `WebSocketStateService` presence rows | retired `{userId, isOnline, timestamp}` variant and the richer React listener type are NOT encoded (T3-G4 parity = canonical shape) |
| `notification.received` | wired, enveloped (`schemas/notification.schema.json`, enum `assignment\|mention\|system`) | yes (`NotificationEventsService`) | `NotificationsStore.addNotification` | U1: whether the backend emits it is an open founder decision — wire truth only |
| `notification.deleted` / `notification.read` / `notification.dismissed` | **`retained-no-emitter`** (MIG-003 parity-of-absence; target emits nothing; MIG-052 asserts no-emit) | **no listener** | — | U1 disposition recorded; registering a listener would claim coverage that does not exist |
| `system.connection.established` | wired-in-target (replaces retired raw `connection.established`) | routed (`SystemEventsService`) | none (validated by the router) | single connect-time emit |
| `system.reconnection.started` / `system.reconnection.failed` | wired-in-target (ADR-026 app-level reconnect) | routed (`SystemEventsService`) | none | no React store row exists; none invented |
| `system.heartbeat` | wired-in-target (60s application-level) | routed (`SystemEventsService`) | client `lastHeartbeatAt` liveness timestamp | client never sends pings (inbound-only) |
| `system.error` | wired-in-target (replaces retired raw `error`; SystemPayload) | routed (`SystemEventsService`) | `WebSocketStateService` last-error row | `data.error.message` surfaced |
| `system.backlog.replay.started` / `system.backlog.replay.completed` | wired-in-target (ADR-026/ADR-028 PostgreSQL backlog) | routed (`SystemEventsService`) | none | backlog-replay consumption = message/conversation handlers applying replayed frames idempotently (id dedup) |
| `message.retry.scheduled` / `queue.message.dlq` | wired (gateway envelopes) | **no listener** | — | LIVE, unconsumed at the React baseline — parity of absence |
| `connection.established` / `error` (raw literals) | **retired** → canonical `system.*` (WS-EVT-014/018) | no listener | — | baseline provenance only; target does not emit them |
| client→server (`subscribe.*`, `message.retry`, acks, presence/typing/reaction/connector publishes) | publish operations exist in the frozen contract | **none implemented** | — | the verified frontend surface emits nothing (T2 B14 / T3-G10; ARCH-005 boundary 2) — inbound-only by design; no `eventId` exists on the wire |

## Structural invariants (grep gates — issue AC-ANG-002-4/5 + AC-ANG-006-1)

Gate commands live in the ANG-002 issue "Verification" section and in PR evidence; stated invariant-only here (command literals would self-match the gates that scan `src/`):

| Gate | Invariant |
|---|---|
| Boundary (no shared common package) | zero imports of the YACC common workspace package in this package |
| Single HTTP entry | zero bare-fetch calls outside spec files; exactly one `provideHttpClient()` wiring (app.config.ts) |
| No auth drift | zero references to the dead React auth base path (T3 G1) — auth rides `/api/auth/*` only |
| Lowercase role enum | `RoleSchema`/`UserStatusSchema` values are the lowercase wire labels (see `common/role.schema.ts`) |
| Single raw-WS socket entry | exactly one file constructs a WebSocket: `services/websocket-client.service.ts` (via the `WS_SOCKET_FACTORY` seam) |
| No socket.io (ANG-006 re-point) | `rg -n "socket\.io-client" packages/frontend-angular` = 0 — zero references, zero dependency |
| Inbound-only socket | `rg -n "\.emit\(" packages/frontend-angular/src --glob '!**/*.spec.ts'` = 0 — zero production client→server sends |
| No ad-hoc cache keys | cache-key literals live only in `contracts/cache-keys.ts` |

## Change procedure (T3 §3)

Contract changes land in `contracts/` + this manifest + consuming services in one reviewable unit; gates re-run; affected Playwright specs named in the PR. Tech-lead arbitrates wire-truth questions; this manifest and T3 are the records.
