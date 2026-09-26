---
ledger_id: LEDGER-MIG-003-RECONCILED
version: 1.0.0
spec: "https://github.com/Antpolis/documentation/blob/master/02-Architecture-Landscape/projects/yacc/spec/SPEC-002-java-spring-backend-migration.md"
milestone: "https://github.com/csim-sg/yacc/milestone/3"
task: "https://github.com/csim-sg/yacc/issues/338"
baseline_revision: 98db628d78c79578dd11eb0476fab812d81fed32
baseline_branch: dev
canonicalized_at: 2026-09-26
supersedes:
  - LEDGER-MIG-001-REST v1.0.0 (.docs/migration/ledger-mig-001-rest.md — capture provenance)
  - LEDGER-MIG-002-REALTIME v1.0.0 (.docs/migration/ledger-mig-002-realtime.md — capture provenance)
binding_contract:
  rest: ".docs/migration/openapi.yaml (v1.0.0-mig-003-canonical)"
  realtime: ".docs/migration/asyncapi.yaml (v1.0.0-mig-003-canonical) + .docs/migration/schemas/*.json"
  canonicalization_record: ".docs/migration/contract-canonicalization.md"
durable_context:
  spec: "https://github.com/Antpolis/documentation/blob/master/02-Architecture-Landscape/projects/yacc/spec/SPEC-002-java-spring-backend-migration.md"
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
  runbooks: "N/A for this canonicalization task — contract/ledger freeze only, no deployment or operational change (runbooks apply from FR-02/MIG-014 deploy work onward)"
status: canonical (BINDING frozen scope for SPEC-002 AC-01; single scope source)
row_count: 156
---

# MIG-003 — Reconciled Atomic Inventory-to-Evidence Ledger (BINDING)

The single, complete, versioned atomic ledger for SPEC-002 — merged from the MIG-001
(REST, 70 rows) and MIG-002 (real-time, 86 rows) captures at baseline revision `98db628`
(branch `dev`). This file is **the** binding scope ceiling and the only basis for AC-01
and founder acceptance (SPEC-002 §Atomic Inventory and Evidence Ledger). The two capture
ledgers are retained as baseline provenance only and are no longer binding.

**Merge integrity (verified):** 70 + 86 = 156 rows in; 156 unique row IDs out. No row was
added, removed, duplicated, renumbered, or approximated. Row text is carried verbatim from
the captures except for the rows the captures explicitly deferred to MIG-003 — those rows
carry the frozen canonicalization decision inline (resolutions in
`.docs/migration/contract-canonicalization.md`).

**Row semantics** (unchanged from the captures)

- One row = exactly one named artifact. No ranges, aggregates, wildcard-quantities, or
  approximations. The single `ALL /api/auth/*` catch-all is one literal baseline route and
  is one row (REST-AUTH-004); its target decomposes into the frozen explicit wire
  sub-paths (§1.4 of the canonicalization record).
- `Result` = ledger closure state. No Java target exists yet, so every row is `blocked`
  ("pending implementation evidence"). Rows flip to `pass` only with linked evidence at
  MIG-040/041/050/051/052+; a `fail`/`blocked` row at MIG-072 blocks cutover (AC-03/AC-09).
- `Evidence location` names the future acceptance-evidence artifact that will prove the row.
- `Rev` = baseline revision shorthand `@98db628`.

Canonicalization resolutions applied to deferred rows (summary — full rationale in
`contract-canonicalization.md`):

1. **Auth (REST-AUTH-003/004):** canonical user object `UserResponse` (id uuid, role
   lowercase); `ALL /api/auth/*` replaced by explicit frozen wire endpoints
   (`sign-up/email`, `sign-out`, `get-session`, `refresh-token`); `/simple-auth/*`
   (frontend drift) has no contract existence.
2. **Rate limits (REST-XSRV-003):** login 5 req/15 min; password reset 3 req/60 min.
3. **Health probes (REST-HEALTH-001..003):** wire paths `/health`, `/health/live`,
   `/health/ready` preserved verbatim (Actuator groups, ADR-029).
4. **Queue job identity (REST-QUEUE-006):** `jobId` opaque string; Quartz identity 1:1;
   response shape and state vocabulary preserved (MIG-063 mapping).
5. **Envelope (WS-BHV-001):** one outbound frame `{event,data,timestamp}` applied
   uniformly; inbound (client→server) stays bare.
6. **Event-name set:** 23 named constants (union of common 20 + backend-only 3); wire
   name = contract name.
7. **Literal↔constant (WS-EVT-014/018, WS-RAW-001/017):** raw `connection.established` →
   `system.connection.established` (single connect-time emit); raw `error` →
   `system.error` (SystemPayload shape).
8. **Defined-not-wired notification events (WS-EVT-007/008, WS-QEV-003):** disposition
   `retained-no-emitter` (parity-of-absence) with founder-visible scope note — see §8.
9. **Presence payload (WS-EVT-009):** canonical `{userId, status, lastSeen}`; `isOnline`
   variant retired.
10. **Frontend surfaces (WS-BHV-012):** ONE raw-WS client + ONE API client target
    (contract-canonicalization.md §2–3); both baseline stacks retired in MIG-052/MIG-034.

---

## Auth — AuthController `@JsonController('/api/auth')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-AUTH-001 | `POST /api/auth/forgot-password` — anti-enumeration constant 200; rate limited | `controllers/auth.controller.ts:44` | Spring endpoint, same body `{email}` → constant `{message}`, always HTTP 200, rate-limit preserved, audit parity | `openapi.yaml` op `authForgotPassword` | MIG-041 contract test `authForgotPassword`; MIG-091 auth flow evidence | blocked | 2026-09-26 |
| REST-AUTH-002 | `POST /api/auth/reset-password` — token+password reset; 400 generic on invalid token; rate limited | `controllers/auth.controller.ts:100` | Spring endpoint, same body `{token,password}` → `{success,message}`; 400 generic anti-enumeration error; rate-limit preserved | `openapi.yaml` op `authResetPassword` | MIG-041 contract test `authResetPassword`; MIG-091 auth flow evidence | blocked | 2026-09-26 |
| REST-AUTH-003 | `POST /api/auth/sign-in/email` — sign-in delegate; rate limited | `controllers/auth.controller.ts:136` | Spring Security authentication endpoint preserving wire path + body; response DTO CANONICALIZED `{user: UserResponse, accessToken, refreshToken}` (contract-canonicalization.md §1.5; BetterAuth replaced per ADR-025) | `openapi.yaml` op `authSignInEmail` | MIG-030/MIG-041 auth tests | blocked | 2026-09-26 |
| REST-AUTH-004 | `ALL /api/auth/*` — single catch-all delegate route (BetterAuth handler: sign-up/email, sign-out, get-session, refresh-token) | `controllers/auth.controller.ts:154` | Replaced per ADR-025 by explicit Spring Security + Spring Authorization Server endpoints (dual-role OIDC); wire sub-path mapping FROZEN: `POST /api/auth/sign-up/email`, `POST /api/auth/sign-out`, `GET /api/auth/get-session`, `POST /api/auth/refresh-token` (contract-canonicalization.md §1.4); no crypto-coupling to BETTER_AUTH_SECRET | `openapi.yaml` ops `authSignUpEmail`, `authSignOut`, `authGetSession`, `authRefreshToken` | MIG-032/MIG-033 OIDC tests; MIG-034 frontend adaptation evidence | blocked | 2026-09-26 |

## Users — UsersController `@JsonController('/api/users')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-USER-001 | `GET /api/users` — paginated list; query `page,limit(20/50/100),role,status,search`; super_admin only; BaseListResponse | `controllers/users.controller.ts:117` | `@RestController` GET with identical query validation (page ≥1; limit ∈ {20,50,100}), super_admin RBAC, `{data,page,limit,total}` envelope | `openapi.yaml` op `listUsers` | MIG-041 contract test `listUsers`; RBAC matrix evidence (AC-04/AC-11) | blocked | 2026-09-26 |
| REST-USER-002 | `POST /api/users` — create user; body `{email,password,name,role}`; 201; super_admin only | `controllers/users.controller.ts:150` | `@RestController` POST, 201, identical body/response DTOs, super_admin RBAC | `openapi.yaml` op `createUser` | MIG-041 contract test `createUser` | blocked | 2026-09-26 |
| REST-USER-003 | `PUT /api/users/:id` — update user; partial body; self role/status modification prevented; super_admin only | `controllers/users.controller.ts:166` | `@RestController` PUT, identical partial-update semantics incl. self-modification guard | `openapi.yaml` op `updateUser` | MIG-041 contract test `updateUser`; RBAC self-modification test | blocked | 2026-09-26 |
| REST-USER-004 | `DELETE /api/users/:id` — soft delete; self-deletion prevented; super_admin only | `controllers/users.controller.ts:182` | `@RestController` DELETE, soft-delete (deletedAt) semantics preserved, self-deletion guard | `openapi.yaml` op `deleteUser` | MIG-041 contract test `deleteUser` | blocked | 2026-09-26 |
| REST-USER-005 | `GET /api/users/roles` — static 4-role definitions with permissions; any authenticated user | `controllers/users.controller.ts:196` | `@RestController` GET returning identical role/permission matrix (super_admin/admin/manager/user) | `openapi.yaml` op `listUserRoles` | MIG-041 contract test `listUserRoles`; AC-11 RBAC matrix evidence | blocked | 2026-09-26 |

## Conversations — ConversationsController `@JsonController('/api/conversations')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-CONV-001 | `GET /api/conversations/` — filtered paginated list; 13 query params (page,limit,channel,status,priority,assignedUserId,tagId,search,dateFrom,dateTo,unread,sortBy,sortOrder); BaseListResponse | `controllers/conversations.controller.ts:123` | `@RestController` GET with identical filter set, validation, and `{data,page,limit,total}` envelope | `openapi.yaml` op `listConversations` | MIG-041 contract test `listConversations` | blocked | 2026-09-26 |
| REST-CONV-002 | `GET /api/conversations/:id` — single conversation envelope `{data}` | `controllers/conversations.controller.ts:170` | `@RestController` GET by UUID param, identical envelope | `openapi.yaml` op `getConversation` | MIG-041 contract test `getConversation` | blocked | 2026-09-26 |
| REST-CONV-003 | `PATCH /api/conversations/:id/status` — body `{status: open\|pending\|resolved}`; admin/manager/super_admin; audit event `conversation_status_change` | `controllers/conversations.controller.ts:214` | `@RestController` PATCH, same enum validation, RBAC, audit event parity via Spring Security events + audit table (ADR-029) | `openapi.yaml` op `updateConversationStatus` | MIG-041 contract test `updateConversationStatus`; audit parity evidence | blocked | 2026-09-26 |
| REST-CONV-004 | `PATCH /api/conversations/:id/priority` — body `{priority: low\|normal\|high\|urgent}`; manager/admin/super_admin; audit event `conversation_priority_change` | `controllers/conversations.controller.ts:243` | `@RestController` PATCH, same enum validation, RBAC, audit parity | `openapi.yaml` op `updateConversationPriority` | MIG-041 contract test `updateConversationPriority` | blocked | 2026-09-26 |
| REST-CONV-005 | `PATCH /api/conversations/:id/assign` — body `{assignedUserId}`; admin/super_admin; audit event `conversation_assigned` | `controllers/conversations.controller.ts:272` | `@RestController` PATCH, same body, RBAC, audit parity | `openapi.yaml` op `assignConversationByPatch` | MIG-041 contract test `assignConversationByPatch` | blocked | 2026-09-26 |

## Messages — MessageController `@JsonController('/api/conversations/:conversationId/messages')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-MSG-001 | `GET /api/conversations/:conversationId/messages` — page/limit (defaults 1/50); custom shape `{messages,total,page,limit}` (not BaseListResponse) | `controllers/message.controller.ts:74` | `@RestController` GET preserving the custom (non-envelope) response shape | `openapi.yaml` op `getConversationMessages` | MIG-041 contract test `getConversationMessages` | blocked | 2026-09-26 |
| REST-MSG-002 | `POST /api/conversations/:conversationId/messages` — body `{body(1..10000), attachmentIds?}`; 201; roles user/manager/admin/super_admin | `controllers/message.controller.ts:146` | `@RestController` POST, identical validation, role matrix, 201 | `openapi.yaml` op `sendConversationMessage` | MIG-041 contract test `sendConversationMessage`; RBAC evidence | blocked | 2026-09-26 |
| REST-MSG-003 | `POST /api/conversations/:conversationId/messages/:messageId/retry` — manual retry exactly once per message; any role if assigned; 200 | `controllers/message.controller.ts:278` | `@RestController` POST preserving once-only retry semantics and assignment-based authorization | `openapi.yaml` op `retryConversationMessage` | MIG-041 contract test `retryConversationMessage` | blocked | 2026-09-26 |
| REST-MSG-004 | `GET /api/conversations/:conversationId/messages/:messageId/status` — message status lookup | `controllers/message.controller.ts:418` | `@RestController` GET, identical status payload | `openapi.yaml` op `getConversationMessageStatus` | MIG-041 contract test `getConversationMessageStatus` | blocked | 2026-09-26 |

## Notes — NotesController `@JsonController('/api/conversations/:conversationId/notes')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-NOTE-001 | `GET /api/conversations/:conversationId/notes` — page/pageSize (defaults 1/50, clamp 1..100); BaseListResponse | `controllers/note.controller.ts:42` | `@RestController` GET with identical pagination clamping and envelope | `openapi.yaml` op `listConversationNotes` | MIG-041 contract test `listConversationNotes` | blocked | 2026-09-26 |
| REST-NOTE-002 | `POST /api/conversations/:conversationId/notes` — body `{body, replyToMessageId?, isInternal?}`; mention parsing notifies mentioned users; 201 | `controllers/note.controller.ts:101` | `@RestController` POST, identical body + mention-parsing notification behavior (hooks into notification domain) | `openapi.yaml` op `createConversationNote` | MIG-041 contract test `createConversationNote`; notification integration evidence | blocked | 2026-09-26 |

## Tags — TagController `@JsonController('/api')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-TAG-001 | `GET /api/tags` — all tags; any authenticated role; envelope `{data:[Tag]}` | `controllers/tag.controller.ts:40` | `@RestController` GET, identical envelope | `openapi.yaml` op `listTags` | MIG-041 contract test `listTags` | blocked | 2026-09-26 |
| REST-TAG-002 | `POST /api/tags` — create tag; name required ≤255, optional hex color; 201; any authenticated role (GOV-021) | `controllers/tag.controller.ts:85` | `@RestController` POST with identical validation (name ≤255, `#RRGGBB` color) | `openapi.yaml` op `createTag` | MIG-041 contract test `createTag` | blocked | 2026-09-26 |
| REST-TAG-003 | `POST /api/conversations/:id/tags` — link tag (integer tagId ≥1); resource-level conversation access check; 201 | `controllers/tag.controller.ts:160` | `@RestController` POST with identical validation + resource-level `canAccessConversation` authorization | `openapi.yaml` op `addTagToConversation` | MIG-041 contract test `addTagToConversation`; RBAC evidence | blocked | 2026-09-26 |
| REST-TAG-004 | `DELETE /api/conversations/:id/tags/:tagId` — unlink tag; resource-level access check; 200 | `controllers/tag.controller.ts:239` | `@RestController` DELETE with identical validation + resource-level authorization | `openapi.yaml` op `removeTagFromConversation` | MIG-041 contract test `removeTagFromConversation` | blocked | 2026-09-26 |

## Routing rules — RoutingRulesController `@JsonController('/api/routing-rules')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-RULES-001 | `GET /api/routing-rules` — list all rules (manager+); BaseListResponse without pagination (limit=total) | `controllers/routing-rules.controller.ts:47` | `@RestController` GET, manager+ RBAC, same envelope semantics | `openapi.yaml` op `listRoutingRules` | MIG-041 contract test `listRoutingRules` | blocked | 2026-09-26 |
| REST-RULES-002 | `POST /api/routing-rules` — create rule; admin+; 201; lenient rule JSON (ADR-021) | `controllers/routing-rules.controller.ts:102` | `@RestController` POST re-expressing ADR-021 lenient JSON validation in Java | `openapi.yaml` op `createRoutingRule` | MIG-041 contract test `createRoutingRule`; ADR-021 leniency tests | blocked | 2026-09-26 |
| REST-RULES-003 | `PATCH /api/routing-rules/:id` — update rule; admin+; 200 | `controllers/routing-rules.controller.ts:152` | `@RestController` PATCH, admin+ RBAC | `openapi.yaml` op `updateRoutingRule` | MIG-041 contract test `updateRoutingRule` | blocked | 2026-09-26 |
| REST-RULES-004 | `DELETE /api/routing-rules/:id` — delete rule; admin+; 200 | `controllers/routing-rules.controller.ts:208` | `@RestController` DELETE, admin+ RBAC | `openapi.yaml` op `deleteRoutingRule` | MIG-041 contract test `deleteRoutingRule` | blocked | 2026-09-26 |
| REST-RULES-005 | `GET /api/routing-rules/:id/executions` — rule execution logs; manager+; 200 | `controllers/routing-rules.controller.ts:263` | `@RestController` GET, manager+ RBAC, execution-log payload parity | `openapi.yaml` op `getRoutingRuleExecutions` | MIG-041 contract test `getRoutingRuleExecutions` | blocked | 2026-09-26 |

## Bulk actions — BulkActionsController `@JsonController('/api/conversations')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-BULK-001 | `POST /api/conversations/bulk` — conversationIds 1..100; action assign\|tag\|status; best-effort partial success `{data:{successCount,failureCount,failures[]}}`; manager+; 200; audit `bulk_action_applied` per success | `controllers/bulk-action.controller.ts:80` | `@RestController` POST preserving max-100, best-effort semantics, RBAC, audit parity | `openapi.yaml` op `bulkActionConversations` | MIG-041 contract test `bulkActionConversations` | blocked | 2026-09-26 |

## Assignments — AssignmentsController `@JsonController('/api/conversations/:conversationId/assign')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-ASSIGN-001 | `POST /api/conversations/:conversationId/assign` — body `{assignedUserId}`; manager+ in-code RBAC; 200; `{data: AssignmentResponse}` | `controllers/assignment.controller.ts:40` | `@RestController` POST preserving body, RBAC, and AssignmentResponse shape | `openapi.yaml` op `assignConversationByPost` | MIG-041 contract test `assignConversationByPost` | blocked | 2026-09-26 |

## Notifications — NotificationsController `@JsonController('/api/notifications')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-NOTIF-001 | `GET /api/notifications` — own notifications; page/pageSize (defaults 1/20, clamp 1..100); BaseListResponse | `controllers/notifications.controller.ts:45` | `@RestController` GET scoped to authenticated user, identical pagination + envelope | `openapi.yaml` op `listNotifications` | MIG-041 contract test `listNotifications` | blocked | 2026-09-26 |
| REST-NOTIF-002 | `PATCH /api/notifications/:id` — body `{isRead: boolean}`; own notification only; 200 | `controllers/notifications.controller.ts:109` | `@RestController` PATCH with ownership enforcement + identical validation | `openapi.yaml` op `markNotificationRead` | MIG-041 contract test `markNotificationRead` | blocked | 2026-09-26 |
| REST-NOTIF-003 | `DELETE /api/notifications/:id` — dismiss own notification; 204 | `controllers/notifications.controller.ts:175` | `@RestController` DELETE, 204, ownership enforcement | `openapi.yaml` op `dismissNotification` | MIG-041 contract test `dismissNotification` | blocked | 2026-09-26 |
| REST-NOTIF-004 | `POST /api/notifications/mark-all-read` — mark all own notifications read; 200 | `controllers/notifications.controller.ts:229` | `@RestController` POST, own-scope bulk mark | `openapi.yaml` op `markAllNotificationsRead` | MIG-041 contract test `markAllNotificationsRead` | blocked | 2026-09-26 |

## Audit (conversation-scoped) — AuditController `@JsonController('/api/conversations')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-AUDIT-001 | `GET /api/conversations/:conversationId/audit-logs` — conversation audit page; custom shape `{items,total,page,limit,pages}`; controller-level RBAC manager/admin/super_admin | `controllers/audit.controller.ts:28` | `@RestController` GET with manager+ RBAC and identical custom page shape | `openapi.yaml` op `getConversationAuditLogs` | MIG-041 contract test `getConversationAuditLogs` | blocked | 2026-09-26 |

## Audit logs (query/export) — AuditLogsQueryController `@JsonController('/api/audit-logs')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-AUDITLOG-001 | `GET /api/audit-logs` — filterable query (actorId,action,entityType,entityId,dateFrom,dateTo,page,limit default 20 max 100); BaseListResponse; manager+ | `controllers/audit-log.controller.ts:45` | `@RestController` GET with identical filters, 400 on invalid date range, envelope | `openapi.yaml` op `queryAuditLogs` | MIG-041 contract test `queryAuditLogs` | blocked | 2026-09-26 |
| REST-AUDITLOG-002 | `GET /api/audit-logs/conversations/:conversationId` — audit logs where entityId = conversationId; BaseListResponse; manager+ | `controllers/audit-log.controller.ts:109` | `@RestController` GET with identical filter subset + envelope | `openapi.yaml` op `queryConversationAuditLogs` | MIG-041 contract test `queryConversationAuditLogs` | blocked | 2026-09-26 |
| REST-AUDITLOG-003 | `POST /api/audit-logs/export` — body `{format: csv\|json, filters}`; file download with Content-Disposition `audit-logs-<iso>.<fmt>`; admin+; 200 | `controllers/audit-log.controller.ts:177` | `@RestController` POST producing identical CSV/JSON download contract | `openapi.yaml` op `exportAuditLogs` | MIG-041 contract test `exportAuditLogs` | blocked | 2026-09-26 |

## DLQ — DLQController `@JsonController('/api/dlq')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-DLQ-001 | `GET /api/dlq` — entries list; page/limit (defaults 1/25; limit 1..100); optional failureReason filter; custom shape `{entries,total,page,limit}`; manager+ | `controllers/dlq.controller.ts:54` | `@RestController` GET with identical validation (400 on page<1 or limit>100), shape, RBAC | `openapi.yaml` op `listDlqEntries` | MIG-041 contract test `listDlqEntries` | blocked | 2026-09-26 |
| REST-DLQ-002 | `GET /api/dlq/stats` — DLQ statistics by failure reason etc.; manager+; 200 | `controllers/dlq.controller.ts:114` | `@RestController` GET, manager+ RBAC, stats parity | `openapi.yaml` op `getDlqStats` | MIG-041 contract test `getDlqStats` | blocked | 2026-09-26 |
| REST-DLQ-003 | `POST /api/dlq/:id/re-queue` — move entry back to retry queue; admin+; 200 | `controllers/dlq.controller.ts:144` | `@RestController` POST re-expressed over Quartz + DB DLQ (ADR-028), admin+ RBAC | `openapi.yaml` op `reQueueDlqEntry` | MIG-041 contract test `reQueueDlqEntry`; MIG-063 async evidence | blocked | 2026-09-26 |
| REST-DLQ-004 | `DELETE /api/dlq/:id` — remove entry after ops review; super_admin only; 200 | `controllers/dlq.controller.ts:193` | `@RestController` DELETE, super_admin RBAC, over DB DLQ (ADR-028) | `openapi.yaml` op `removeDlqEntry` | MIG-041 contract test `removeDlqEntry` | blocked | 2026-09-26 |

## Queue — QueueController `@JsonController('/api/queue')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-QUEUE-001 | `GET /api/queue/stats` — queue statistics + timestamp; manager+; 200 | `controllers/queue.controller.ts:92` | `@RestController` GET re-expressed over Quartz/DB queue stats (Redis removed per ADR-028), manager+ RBAC | `openapi.yaml` op `getQueueStats` | MIG-041 contract test `getQueueStats`; MIG-063 evidence | blocked | 2026-09-26 |
| REST-QUEUE-002 | `GET /api/queue/dlq` — DLQ entries paginated (page default 1, pageSize default 20); manager+ | `controllers/queue.controller.ts:143` | `@RestController` GET over DB DLQ, manager+ RBAC | `openapi.yaml` op `getQueueDlqEntries` | MIG-041 contract test `getQueueDlqEntries` | blocked | 2026-09-26 |
| REST-QUEUE-003 | `POST /api/queue/retry/:messageId` — retry message by ID; manager+ | `controllers/queue.controller.ts:213` | `@RestController` POST over Quartz retry (backoff 1m/5m/30m preserved), manager+ RBAC | `openapi.yaml` op `retryQueuedMessage` | MIG-041 contract test `retryQueuedMessage`; MIG-063 evidence | blocked | 2026-09-26 |
| REST-QUEUE-004 | `POST /api/queue/dlq/retry` — bulk retry by `messageIds[]`; manager+ | `controllers/queue.controller.ts:273` | `@RestController` POST bulk retry over DB DLQ, manager+ RBAC | `openapi.yaml` op `bulkRetryDlq` | MIG-041 contract test `bulkRetryDlq` | blocked | 2026-09-26 |
| REST-QUEUE-005 | `GET /api/queue/dlq/stats` — DLQ stats; manager+ | `controllers/queue.controller.ts:358` | `@RestController` GET over DB DLQ stats, manager+ RBAC | `openapi.yaml` op `getQueueDlqStats` | MIG-041 contract test `getQueueDlqStats` | blocked | 2026-09-26 |
| REST-QUEUE-006 | `GET /api/queue/job/:jobId` — job details; manager+ | `controllers/queue.controller.ts:416` | `@RestController` GET; job-identity re-expressed over Quartz job store; wire FROZEN: `jobId` opaque string, response shape unchanged, Quartz identity 1:1, state vocabulary preserved via MIG-063 mapping (contract-canonicalization.md §5) | `openapi.yaml` op `getQueueJob` | MIG-041 contract test `getQueueJob`; MIG-063 evidence | blocked | 2026-09-26 |
| REST-QUEUE-007 | `POST /api/queue/dlq/clear/:messageId` — clear DLQ entry; super_admin only | `controllers/queue.controller.ts:497` | `@RestController` POST, super_admin RBAC, over DB DLQ | `openapi.yaml` op `clearQueueDlqEntry` | MIG-041 contract test `clearQueueDlqEntry` | blocked | 2026-09-26 |
| REST-QUEUE-008 | `GET /api/queue/dlq/by-reason/:reason` — entries filtered by failure reason; manager+ | `controllers/queue.controller.ts:556` | `@RestController` GET with reason path filter, manager+ RBAC | `openapi.yaml` op `getQueueDlqByReason` | MIG-041 contract test `getQueueDlqByReason` | blocked | 2026-09-26 |

## IRC integration — IRCIntegrationController `@Controller('/api/integrations/irc')` (non-JsonController)

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-IRCCONN-001 | `POST /api/integrations/irc/config` — save config `{server,port,username,password?,channels[]}` (channels ≥1, each `#`-prefixed); super_admin; audit `integration.irc.config_updated`; errors `validation_error`/`encryption_key_missing` (400), 500 `internal_error` | `controllers/ircIntegration.controller.ts:62` | `@RestController` POST, AES-256-GCM credential encryption (ADR-027), audit parity, identical error codes | `openapi.yaml` op `saveIrcConfig` | MIG-041 contract test `saveIrcConfig`; MIG-061 encryption evidence | blocked | 2026-09-26 |
| REST-IRCCONN-002 | `POST /api/integrations/irc/connect` — manual connect (body ignored); idempotent; DB-first config else env fallback; 409 `irc_not_configured`; sets status retrying/attemptCount 0; super_admin | `controllers/ircIntegration.controller.ts:152` | `@RestController` POST with identical idempotent semantics, 409 code, audit parity | `openapi.yaml` op `connectIrc` | MIG-041 contract test `connectIrc`; MIG-061 evidence | blocked | 2026-09-26 |
| REST-IRCCONN-003 | `POST /api/integrations/irc/test` — side-effect-free connection test; body-first (optional body), else stored config; 10s hard timeout; 400 partial-body validation; 409 unconfigured; 500 client failure; super_admin | `controllers/ircIntegration.controller.ts:248` | `@RestController` POST preserving body-first logic, timeout, sanitized `{success,message}`, error codes | `openapi.yaml` op `testIrcConnection` | MIG-041 contract test `testIrcConnection`; MIG-061 evidence | blocked | 2026-09-26 |
| REST-IRCCONN-004 | `GET /api/integrations/irc/status` — connection status (works unconfigured; no secrets); admin+; 200 `{data: status}` | `controllers/ircIntegration.controller.ts:390` | `@RestController` GET, admin+ RBAC, IRCConnectionStatusModel parity | `openapi.yaml` op `getIrcStatus` | MIG-041 contract test `getIrcStatus` | blocked | 2026-09-26 |

## IRC profiles — IRCProfileController `@JsonController('/api/integrations/irc/profiles')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-IRCPROF-001 | `POST /api/integrations/irc/profiles` — create profile; super_admin in-code RBAC; 201; 401/403 errors | `controllers/ircProfile.controller.ts:67` | `@RestController` POST, multi-profile DB-first model (ADR-017), AES-256-GCM credentials, super_admin RBAC | `openapi.yaml` op `createIrcProfile` | MIG-041 contract test `createIrcProfile`; MIG-061 evidence | blocked | 2026-09-26 |
| REST-IRCPROF-002 | `GET /api/integrations/irc/profiles` — list profiles (raw array); admin/manager/super_admin | `controllers/ircProfile.controller.ts:133` | `@RestController` GET returning raw array (not enveloped), read RBAC trio | `openapi.yaml` op `listIrcProfiles` | MIG-041 contract test `listIrcProfiles` | blocked | 2026-09-26 |
| REST-IRCPROF-003 | `GET /api/integrations/irc/profiles/:id` — profile by numeric id; admin/manager/super_admin; 404 unknown | `controllers/ircProfile.controller.ts:166` | `@RestController` GET with numeric-id validation + 404 | `openapi.yaml` op `getIrcProfile` | MIG-041 contract test `getIrcProfile` | blocked | 2026-09-26 |
| REST-IRCPROF-004 | `PUT /api/integrations/irc/profiles/:id` — update profile; super_admin | `controllers/ircProfile.controller.ts:209` | `@RestController` PUT, super_admin RBAC | `openapi.yaml` op `updateIrcProfile` | MIG-041 contract test `updateIrcProfile` | blocked | 2026-09-26 |
| REST-IRCPROF-005 | `POST /api/integrations/irc/profiles/:id/activate` — activate (single-active policy); super_admin; 200 | `controllers/ircProfile.controller.ts:267` | `@RestController` POST preserving single-active-profile policy | `openapi.yaml` op `activateIrcProfile` | MIG-041 contract test `activateIrcProfile` | blocked | 2026-09-26 |
| REST-IRCPROF-006 | `POST /api/integrations/irc/profiles/:id/disable` — disable profile; super_admin; 200 | `controllers/ircProfile.controller.ts:327` | `@RestController` POST, super_admin RBAC | `openapi.yaml` op `disableIrcProfile` | MIG-041 contract test `disableIrcProfile` | blocked | 2026-09-26 |
| REST-IRCPROF-007 | `DELETE /api/integrations/irc/profiles/:id` — delete profile; super_admin; 204 | `controllers/ircProfile.controller.ts:388` | `@RestController` DELETE, 204, super_admin RBAC | `openapi.yaml` op `deleteIrcProfile` | MIG-041 contract test `deleteIrcProfile` | blocked | 2026-09-26 |
| REST-IRCPROF-008 | `POST /api/integrations/irc/profiles/:id/test` — test stored credentials without switching active profile; super_admin; 200 | `controllers/ircProfile.controller.ts:445` | `@RestController` POST preserving no-side-effect test semantics | `openapi.yaml` op `testIrcProfileConnection` | MIG-041 contract test `testIrcProfileConnection` | blocked | 2026-09-26 |

## Health — HealthController `@Controller('/health')` (non-JsonController)

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-HEALTH-001 | `ALL /health` — full health: PostgreSQL+Redis+R2 parallel checks, SLO block, uptime, 200/500 | `controllers/health.controller.ts:235` | Actuator-based health (ADR-029 remap to `/actuator/health/*` or custom `/health/*`); dependency set changes (Redis removed per ADR-028); wire paths `/health`, `/health/live`, `/health/ready` preserved verbatim via Actuator health groups (ADR-029) — FROZEN (contract-canonicalization.md §5) | `openapi.yaml` op `getHealth` | MIG-012 probe evidence; MIG-091 operational evidence (AC-05) | blocked | 2026-09-26 |
| REST-HEALTH-002 | `ALL /health/live` — liveness `{status:'alive',timestamp}`; 200 | `controllers/health.controller.ts:296` | Liveness probe endpoint (ADR-029 mapping), same public no-auth contract | `openapi.yaml` op `getHealthLive` | MIG-012 probe evidence | blocked | 2026-09-26 |
| REST-HEALTH-003 | `ALL /health/ready` — readiness; 200 all deps up / 503 `not_ready` with per-dependency booleans | `controllers/health.controller.ts:313` | Readiness probe endpoint (ADR-029 mapping), per-dependency readiness booleans | `openapi.yaml` op `getHealthReady` | MIG-012 probe evidence | blocked | 2026-09-26 |

## Cross-cutting REST-stack behaviors (service-level rows)

| ID | Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-XSRV-001 | Pagination contract — `BaseListRequest` (page 0-indexed internal, limit default set [15,25,35,45,55,100,150,200,0], searchText) → `BaseListResponse` `{data,page,limit,total}` 1-indexed | `packages/common/src/requests/base-list.request.ts`, `packages/common/src/responses/base-list.response.ts` | Identical wire envelope `{data,page,limit,total}`; internal normalization may differ (KISS); envelope frozen in MIG-003 | `openapi.yaml` component `BaseListResponse` | MIG-041 pagination contract tests | blocked | 2026-09-26 |
| REST-XSRV-002 | REST auth middleware — `authorizationChecker` + `currentUserChecker` verify Bearer JWT (BETTER_AUTH_SECRET-coupled) and enforce `@Authorized` roles; CORS exposes `set-auth-token,x-total-count,x-current-page,x-total-pages` | `middleware/routingControllersAuth.ts`, `src/index.ts` useExpressServer config | Spring Security filter chain (ADR-025): JWT resource-server, method RBAC, status enforcement; CORS exposed-header parity | `openapi.yaml` securityScheme `bearerAuth` | MIG-030 security tests; MIG-073 threat-model evidence | blocked | 2026-09-26 |
| REST-XSRV-003 | Rate limiting — `loginRateLimiter` (sign-in) + `passwordResetRateLimiter` (forgot/reset password) | `middleware/rateLimit.middleware.ts`, `controllers/auth.controller.ts` | Equivalent rate-limit policy on the same three auth endpoints (Spring filter/interceptor); limits FROZEN: login 5 req/15 min, password reset 3 req/60 min (contract-canonicalization.md §5) | `openapi.yaml` ops `authSignInEmail`, `authForgotPassword`, `authResetPassword` (429s) | MIG-030/MIG-041 rate-limit tests | blocked | 2026-09-26 |
| REST-XSRV-004 | Request pipeline — bodyParser, correlationId, requestLogging middlewares; validation whitelist + forbidNonWhitelisted; default error handler `{error}` | `src/index.ts` useExpressServer config, `middleware/*.ts` | Spring filter/interceptor equivalents: MDC correlationId (TR-07), `@Valid`/`@ControllerAdvice` error contract (TR-04), logback JSON field-shape parity (ADR-029) | `openapi.yaml` component `ErrorResponse` | MIG-011 observability evidence; MIG-041 error contract tests | blocked | 2026-09-26 |

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
| WS-EVT-007 | `NOTIFICATION_DELETED` = `notification.deleted` | `common/src/websocket/constants/NotificationEvents.constant.ts` | **Defined-not-wired**: zero emitters, zero consumers at baseline | DISPOSITION (MIG-003): retained-no-emitter (parity-of-absence; founder-visible note: contract-canonicalization.md §4.4) — target emits nothing | `asyncapi.yaml` ch `notification.deleted` | MIG-052 no-emit contract test (disposition: contract-canonicalization.md §4.4) | blocked | 2026-09-26 |
| WS-EVT-008 | `NOTIFICATION_READ` = `notification.read` | `common/src/websocket/constants/NotificationEvents.constant.ts` | **Defined-not-wired**: constant referenced only at definition site; no emitter found | DISPOSITION (MIG-003): retained-no-emitter (parity-of-absence; contract-canonicalization.md §4.4) — target emits nothing; was: wire or drop via MIG-003 | `asyncapi.yaml` ch `notification.read` | MIG-052 no-emit contract test (disposition: contract-canonicalization.md §4.4) | blocked | 2026-09-26 |
| WS-EVT-009 | `PRESENCE_UPDATED` = `presence.updated` | `common/src/websocket/constants/PresenceEvents.constant.ts` | Wired: presence.handler, event-backlog, websocket.server.ts:158 disconnect broadcast + inbound @OnMessage (presence.controller.ts:23) | Raw WS presence event; payload CANONICALIZED `{userId, status: online|offline, lastSeen}` uniformly incl. disconnect path; `isOnline` variant retired; common `PresencePayload` is not wire truth (contract-canonicalization.md §4.5) | `asyncapi.yaml` ch `presence.updated` | MIG-051 presence behavior tests (AC-06) | blocked | 2026-09-26 |
| WS-EVT-010 | `TYPING_STARTED` = `typing.started` | `common/src/websocket/constants/PresenceEvents.constant.ts` | Wired: typing.handler + inbound @OnMessage (typing.controller.ts:22) | Raw WS event to `conversation:{id}` (except sender), 5s timeout window | `asyncapi.yaml` ch `typing.started` | MIG-051 typing behavior tests (AC-06) | blocked | 2026-09-26 |
| WS-EVT-011 | `TYPING_STOPPED` = `typing.stopped` | `common/src/websocket/constants/PresenceEvents.constant.ts` | Wired: typing.handler + inbound @OnMessage (typing.controller.ts:53) + emitted by typing.timeout handler | Raw WS event; explicit stop + server-timeout path | `asyncapi.yaml` ch `typing.stopped` | MIG-051 typing behavior tests (AC-06) | blocked | 2026-09-26 |
| WS-EVT-012 | `USER_ONLINE` = `user.online` | `common/src/websocket/constants/PresenceEvents.constant.ts` | Inbound-only: @OnMessage (presence.controller.ts:50) broadcasts `presence.updated` + replies `online.users`; no outbound `user.online` emit | Target: inbound operation semantics preserved (or canonicalized by MIG-003) | `asyncapi.yaml` ch `user.online` | MIG-051 presence behavior tests | blocked | 2026-09-26 |
| WS-EVT-013 | `USER_OFFLINE` = `user.offline` | `common/src/websocket/constants/PresenceEvents.constant.ts` | Inbound-only: @OnMessage (presence.controller.ts:89) broadcasts `presence.updated`; server disconnect path does not use this constant (broadcasts presence.updated directly) | Target: presence-on-disconnect preserved | `asyncapi.yaml` ch `user.offline` | MIG-051 presence behavior tests | blocked | 2026-09-26 |
| WS-EVT-014 | `CONNECTION_ESTABLISHED` = `system.connection.established` | `common/src/websocket/constants/SystemEvents.constant.ts` | **Defined-not-wired**: runtime emits raw literal `connection.established` instead (websocket.server.ts:83, conversation.controller.ts:39) | Target emits contract name `system.connection.established` on raw-WS connect — ONE connect-time emit (duplicate path deduped; mapping FROZEN: contract-canonicalization.md §4.3) | `asyncapi.yaml` ch `system.connection.established` | MIG-050 connect behavior test | blocked | 2026-09-26 |
| WS-EVT-015 | `RECONNECTION_STARTED` = `system.reconnection.started` | `common/src/websocket/constants/SystemEvents.constant.ts` | **Defined-not-wired**: zero wiring; reconnect behavior exists client-side only | Target emits on reconnect attempt (ADR-026 re-implemented reconnect) | `asyncapi.yaml` ch `system.reconnection.started` | MIG-051 reconnect behavior tests (AC-06) | blocked | 2026-09-26 |
| WS-EVT-016 | `RECONNECTION_FAILED` = `system.reconnection.failed` | `common/src/websocket/constants/SystemEvents.constant.ts` | **Defined-not-wired**: zero wiring | Target emits after max attempts exhausted | `asyncapi.yaml` ch `system.reconnection.failed` | MIG-051 reconnect behavior tests (AC-06) | blocked | 2026-09-26 |
| WS-EVT-017 | `HEARTBEAT_RECEIVED` = `system.heartbeat` | `common/src/websocket/constants/SystemEvents.constant.ts` | **Defined-not-wired**: baseline heartbeat = Socket.io engine ping/pong (60s), not an app event | Target: application-level 60s heartbeat emits this contract event (ADR-026) | `asyncapi.yaml` ch `system.heartbeat` | MIG-051 heartbeat behavior tests (AC-06) | blocked | 2026-09-26 |
| WS-EVT-018 | `ERROR_OCCURRED` = `system.error` | `common/src/websocket/constants/SystemEvents.constant.ts` | Partial: frontend references constant; backend emits raw literal `error` {message} on handler failure | Target emits `system.error` enveloped, `data` = SystemPayload `{type:'error', timestamp, error:{code,message}}` (mapping FROZEN: contract-canonicalization.md §4.3) | `asyncapi.yaml` ch `system.error` | MIG-050 error-path behavior test | blocked | 2026-09-26 |
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
| WS-RAW-001 | `connection.established` — emitted by BOTH websocket.server.ts:83 and conversation.controller.ts:39 (duplicate emit path) | `websockets/websocket.server.ts:83`, `socket-controllers/conversation.controller.ts:39` | Raw literal RETIRED → canonical `system.connection.established` (WS-EVT-014); ONE connect-time emit, enveloped (contract-canonicalization.md §4.3) | ch `connection.established` | MIG-050 tests | blocked | 2026-09-26 |
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
| WS-RAW-017 | `error` — generic error emit {message} on handler failure | `socket-controllers/presence.controller.ts:170`, `socket-controllers/reaction.controller.ts:122` | Raw literal RETIRED → canonical `system.error` enveloped, SystemPayload shape (WS-EVT-018; contract-canonicalization.md §4.3) | ch `error` | MIG-050 error-path tests | blocked | 2026-09-26 |

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
| WS-QEV-003 | `notification.dismissed` (backend wsConstant NotificationEvents.NOTIFICATION_DISMISSED — NOT in the 20-constant common contract) — defined-not-wired: zero baseline emitters (dismiss path logs only, no socket emit) | `websockets/wsConstants.ts:34` | DISPOSITION (MIG-003): retained-no-emitter (parity-of-absence; founder-visible note: contract-canonicalization.md §4.4) — target emits nothing | ch `notification.dismissed` | MIG-052 no-emit contract test (disposition: contract-canonicalization.md §4.4) | blocked | 2026-09-26 |

## 5. Real-time behaviors (18 rows)

| ID | Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | AsyncAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| WS-BHV-001 | Envelope `{event,data,timestamp}` — verbatim shape, timestamp ISO 8601 set at emit | `websockets/gateway.ts:73-77` | Envelope preserved verbatim (ADR-026); CANONICALIZED: applied uniformly to ALL outbound emissions — one emit path (contract-canonicalization.md §4.1) | `schemas/envelope.schema.json` | MIG-050 envelope contract tests | blocked | 2026-09-26 |
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
| WS-BHV-012 | Reconnect/backoff — client behavior: socket.io reconnection delays [1000,2000,4000,8000,30000]ms, 10 attempts (lib/socket.ts singleton stack) | `frontend/src/lib/socket.ts:77-105` | Frontend drops socket.io-client (MIG-052); ONE canonical raw-WS client re-implements identical backoff ladder; BOTH baseline stacks (`lib/socket.ts` + `services/websocket/WebSocketClient`) retired (contract-canonicalization.md §3) | info.description | MIG-052 frontend tests (AC-06/AC-07) | blocked | 2026-09-26 |
| WS-BHV-013 | Connection timeout — CONNECTION_TIMEOUT_MS = 3600000 (1h) | `websockets/wsConstants.ts:76` | Equivalent idle/connection bound on raw WS | info.description | MIG-050 tests | blocked | 2026-09-26 |
| WS-BHV-014 | Presence lifecycle — connect tracking (userId→socketIds map), last-socket-off disconnect broadcast, server-side presence broadcast | `websockets/websocket.server.ts:120-164` | Session-registry presence semantics preserved (AC-06) | ch `presence.updated` | MIG-051 presence tests | blocked | 2026-09-26 |
| WS-BHV-015 | Typing timeout — TYPING_TIMEOUT_MS = 5000; explicit stop + timeout + heartbeat keep-alive | `websockets/wsConstants.ts:111`, `socket-controllers/typing.controller.ts` | Typing timeout/keep-alive preserved (AC-06) | ch `typing.timeout`, ch `typing.heartbeat` | MIG-051 typing tests | blocked | 2026-09-26 |
| WS-BHV-016 | Auth on handshake — `socket.handshake.auth.token` → BetterAuth getSession → DB user load → status enforcement (inactive/suspended rejected) → attach userId/email/role/name; failures rejected pre-connect | `websockets/auth.middleware.ts:33-93` | Raw WS handshake auth: token → Spring Security validation → status enforcement (RBAC/status parity, ADR-025); reject before session establishment | ch `connection` | MIG-050 auth tests; AC-04 status-enforcement evidence | blocked | 2026-09-26 |
| WS-BHV-017 | Generic error emit — `socket.emit('error', {message})` on handler failure (request.online.users, reaction.list) | `socket-controllers/presence.controller.ts:170`, `socket-controllers/reaction.controller.ts:122` | Centralized error emit; MIG-003 maps raw `error` literal ↔ `system.error` contract constant | ch `error` | MIG-050 error-path tests | blocked | 2026-09-26 |
| WS-BHV-018 | correlationId propagation in real-time payloads — correlationId carried in event metadata (message status payloads) | `services/messageStatusTracker.ts:428` | MDC correlationId parity end-to-end (TR-07, ADR-029) | info.description | MIG-011/MIG-050 observability evidence | blocked | 2026-09-26 |

---


---

## 8. Reconciliation record

Every divergence flagged in the two capture ledgers' "Capture reconciliation notes" is
resolved and frozen in `.docs/migration/contract-canonicalization.md` (§1 auth, §2 API
client, §3 socket stack, §4 real-time, §5 REST resolutions). None of the resolutions adds,
removes, or duplicates a ledger row; they only freeze target behavior on rows the captures
explicitly deferred to MIG-003.

## 9. Founder-visible scope note (required by capture rows WS-EVT-007/008, WS-QEV-003)

`notification.deleted`, `notification.read`, and `notification.dismissed` had zero baseline
wiring. MIG-003 disposition: **retained-no-emitter (parity-of-absence)** — the channels and
rows stay frozen, the target emits nothing, and MIG-052 asserts no-emit. Wiring any of the
three in Java is NEW wire behavior and requires a new founder decision per the SPEC-002
completion boundary; dropping them would likewise alter the frozen surface. No founder
decision is required for this disposition (it changes nothing).

## 10. Verification

- Row integrity: ID-set comparison against both capture ledgers — 156 unique IDs, no
  duplicates, none missing (verification command output recorded in the MIG-003 PR).
- Drift confirmation: `rg -n "simple-auth|User.id|super_admin|SUPER_ADMIN" packages/frontend/src`
  (drift confirmed in POC frontend; resolved at contract layer by
  `contract-canonicalization.md` §1; frontend code reconciliation is MIG-034).
