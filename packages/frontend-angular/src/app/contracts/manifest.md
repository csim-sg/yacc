# Contracts Manifest — completeness registry (ANG-002)

**Baseline:** live backend controllers + socket emit paths at `dev` @ `230bd226` (2026-10-06), re-derived from SPEC-001 T3 §4.2 (HTTP) and §5.1 (Socket.io) per the ANG-002 issue. Live code is the baseline wherever this file, `.docs/02-api-and-data-model.md`, or React type claims disagree (T3 §4.4 method).

**Rules (T3 §2.2):** every baseline endpoint/event maps to its owning schema file and its covering Playwright spec. A row with **no covering spec is a recorded, visible gap** — never silently dropped. Gap rows cite the T3 gap register (G1–G10) or a new **D-row** (DTO-claim drift verified in ANG-002, listed below). Production response parsing stays permissive; these schemas are parsed only by the parity harness (ANG-003), never `.parse()`-ed in the production path.

**Source-of-truth files:** `contracts/common/*`, `contracts/http/*.schema.ts`, `contracts/ws/events.schema.ts`, `contracts/ws/connection.ts`, `contracts/cache-keys.ts`.

## DTO-claim drift register (verified 2026-10-06 @ `230bd226` — recorded, NOT fixed)

The founder override pins Angular to React's calls/behavior 1:1; where a React service *type claim* disagrees with the verified wire, the contract encodes the **wire** and the drift is recorded here so family issues (ANG-005..013) port the behavior knowingly:

| # | Drift | React claim | Verified wire | Parity disposition |
|---|---|---|---|---|
| D1 | Tags attach/detach routes | `POST /api/tags/conversations/:id`, `DELETE /api/tags/conversations/:id/tags/:tagId` | `POST /api/conversations/:id/tags`, `DELETE /api/conversations/:id/tags/:tagId` (no `/api/tags/conversations/*` route exists) | React attach/detach calls 404 today; W8 anchor is `tags.e2e.spec.ts`. Angular ports the wire routes; visible-behavior parity is judged by the W8 gate (ANG-009). |
| D2 | Message list response | `{ data, page, pageSize, total }` | `{ messages, total, page, limit }` | React reads `.data` → empty message list on the detail page; W7 parity = same visible behavior (ANG-008 owns it). |
| D3 | Message send response | `{ data: message }` | raw message (201) | React appends `response.data` (undefined) to its cache; W7 parity rides the visible reply path (ANG-008). |
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

## Socket.io events (T3 §5.1 — per-event wire format)

| Event | Direction | Wire format (verified @ `230bd226`) | Schema (symbol) | Covering Playwright spec | Status |
|---|---|---|---|---|---|
| `conversation.updated` | S→C | **flat** payload, room `conversation:{id}` | `ConversationUpdatedEventSchema` | `inbox-network.spec.ts` / `conversation-detail.spec.ts` (live-update assertions, W5/W7) | covered |
| `message.received` | S→C | **flat** payload, conversation room | `MessageReceivedEventSchema` | `inbox-network.spec.ts`, `conversation-detail.spec.ts` (W7) | covered |
| `message.sent` | S→C | **envelope** `{ event, data, timestamp }`, global (T3-G5 / U3: wire truth encoded; no frontend "fix") | `MessageSentEventSchema` | none asserting the envelope payload | **gap** (shape-mismatched consumer today; status UI rides the HTTP append — W7 covers the visible behavior) |
| `message.failed` | S→C | **envelope**, global (T3-G5) | `MessageFailedEventSchema` | none asserting the envelope payload | **gap** (same as `message.sent`) |
| `connection.established` | S→C | raw `{ socketId, timestamp }`, on connect | `ConnectionEstablishedEventSchema` | none (unconsumed) | **gap** (LIVE, unconsumed — recorded) |
| `presence.updated` | S→C | raw `{ userId, isOnline, timestamp }`, global (T3-G4 wire truth) | `PresenceUpdatedEventSchema` | none (no live UI, W21) | **gap** (parity = same absence) |
| `notification.received` | S→C | **no backend emitter** (T3-G2) | `NotificationReceivedEventSchema` (declared shape) | none (REST-only notification specs) | **gap** (declared, no emitter — parity = same absence) |
| `conversation.reopened` | S→C | **no backend emitter** (T3-G3) | `ConversationReopenedEventSchema` (declared shape) | none | **gap** (declared, no emitter) |
| `message.retry.scheduled` | S→C | envelope, global (legacy gateway) | `MessageRetryScheduledEventSchema` | none | **gap** (LIVE, unconsumed) |
| `queue.message.dlq` | S→C | envelope, global (legacy gateway) | `QueueMessageDlqEventSchema` | none | **gap** (LIVE, unconsumed) |
| `typing.started` / `typing.stopped` | S→C | producer unwired (`emitEvent` has zero callers, §5.3) | `TypingStartedEventSchema`, `TypingStoppedEventSchema` (declared) | none (no live UI, W20) | **gap** (unwired producer — parity = same absence) |
| Other §5.3 unwired registry events (connector/emoji family) | S→C | unwired handler registry (§5.3) | *(not consumed by the frontend; not part of the live listener set)* | none | **gap** (unwired — recorded, not encoded) |
| client→server (`subscribe.*`, `typing.*`, `presence.*`, acks) | C→S | **the frontend never emits anything** (T3-G10, T2 B14) | **none by design** — `WebSocketClientService` has no `emit` (inbound-only, ARCH-005 boundary 2) | n/a | by-design absence |

## Structural invariants (grep gates — issue AC-ANG-002-4/5)

Gate commands live in the ANG-002 issue "Verification" section and in PR evidence; stated invariant-only here (command literals would self-match the gates that scan `src/`):

| Gate | Invariant |
|---|---|
| Boundary (no shared common package) | zero imports of the YACC common workspace package in this package |
| Single HTTP entry | zero bare-fetch calls outside spec files; exactly one `provideHttpClient()` wiring (app.config.ts) |
| No auth drift | zero references to the dead React auth base path (T3 G1) — auth rides `/api/auth/*` only |
| Lowercase role enum | `RoleSchema`/`UserStatusSchema` values are the lowercase wire labels (see `common/role.schema.ts`) |
| Single socket entry | exactly one file imports the socket.io client: `services/websocket-client.service.ts` |
| No ad-hoc cache keys | cache-key literals live only in `contracts/cache-keys.ts` |

## Change procedure (T3 §3)

Contract changes land in `contracts/` + this manifest + consuming services in one reviewable unit; gates re-run; affected Playwright specs named in the PR. Tech-lead arbitrates wire-truth questions; this manifest and T3 are the records.
