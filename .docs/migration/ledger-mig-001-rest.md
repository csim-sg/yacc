---
ledger_id: LEDGER-MIG-001-REST
version: 1.0.0
spec: SPEC-002 (vault: 02-Architecture-Landscape/projects/yacc/spec/SPEC-002-java-spring-backend-migration.md)
milestone: "https://github.com/csim-sg/yacc/milestone/3"
task: "https://github.com/csim-sg/yacc/issues/335"
baseline_revision: 98db628d78c79578dd11eb0476fab812d81fed32
baseline_branch: dev
captured_at: 2026-09-26
reconciliation_target: MIG-003 (#338)
status: capture (frozen-scope candidate; canonicalized by MIG-003)
row_count: 70
---

# MIG-001 — Atomic REST Inventory-to-Evidence Ledger

Versioned atomic ledger of the Node/TypeScript REST surface, captured from source at the
baseline revision above. This ledger is binding frozen scope for the Java/Spring REST
parity (SPEC-002 AC-01) alongside `openapi.yaml` (same directory).

**Row semantics**

- One row = exactly one named artifact (one route operation, or one named cross-cutting
  REST-stack behavior). No ranges, aggregates, wildcards-as-quantity, or approximations.
  The single `ALL /api/auth/*` catch-all is one literal route in the baseline code and is
  enumerated as one row (REST-AUTH-004); it is not a quantity wildcard.
- `Result` = ledger closure state. At capture time no Java target exists, so every row is
  `blocked` ("pending implementation evidence"). Rows flip to `pass` only with linked
  evidence at MIG-040/041+; a `fail`/`blocked` row at MIG-072 blocks cutover (AC-03/AC-09).
- `Evidence location` names the future acceptance-evidence artifact that will prove the row.
- `Rev` = baseline revision shorthand `@98db628` for the source path cited in the row.

Counts (code-verified at capture): **17 controllers** (excluding `controllers/index.ts`),
**66 route operations** (incl. **4 `@All`** routes: REST-AUTH-004, REST-HEALTH-001..003),
**2 non-JsonController controllers** (`@Controller`: HealthController, IRCIntegrationController),
**4 cross-cutting REST-stack rows**. Ledger total = 70 rows.

---

## Auth — AuthController `@JsonController('/api/auth')`

| ID | Route / Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-AUTH-001 | `POST /api/auth/forgot-password` — anti-enumeration constant 200; rate limited | `controllers/auth.controller.ts:44` | Spring endpoint, same body `{email}` → constant `{message}`, always HTTP 200, rate-limit preserved, audit parity | `openapi.yaml` op `authForgotPassword` | MIG-041 contract test `authForgotPassword`; MIG-091 auth flow evidence | blocked | 2026-09-26 |
| REST-AUTH-002 | `POST /api/auth/reset-password` — token+password reset; 400 generic on invalid token; rate limited | `controllers/auth.controller.ts:100` | Spring endpoint, same body `{token,password}` → `{success,message}`; 400 generic anti-enumeration error; rate-limit preserved | `openapi.yaml` op `authResetPassword` | MIG-041 contract test `authResetPassword`; MIG-091 auth flow evidence | blocked | 2026-09-26 |
| REST-AUTH-003 | `POST /api/auth/sign-in/email` — sign-in delegate; rate limited | `controllers/auth.controller.ts:136` | Spring Security authentication endpoint preserving wire path + body; response contract canonicalized in MIG-003 (BetterAuth replaced per ADR-025) | `openapi.yaml` op `authSignInEmail` | MIG-030/MIG-041 auth tests | blocked | 2026-09-26 |
| REST-AUTH-004 | `ALL /api/auth/*` — single catch-all delegate route (BetterAuth handler: sign-up/email, sign-out, get-session, refresh-token) | `controllers/auth.controller.ts:154` | Replaced per ADR-025 by explicit Spring Security + Spring Authorization Server endpoints (dual-role OIDC); wire sub-path mapping frozen in MIG-003 reconciliation; no crypto-coupling to BETTER_AUTH_SECRET | `openapi.yaml` op `authBetterAuthWildcard` | MIG-032/MIG-033 OIDC tests; MIG-034 frontend adaptation evidence | blocked | 2026-09-26 |

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
| REST-QUEUE-006 | `GET /api/queue/job/:jobId` — job details; manager+ | `controllers/queue.controller.ts:416` | `@RestController` GET; job-identity semantics re-expressed over Quartz job store (BullMQ jobId replaced); contract frozen in MIG-003 | `openapi.yaml` op `getQueueJob` | MIG-041 contract test `getQueueJob`; MIG-063 evidence | blocked | 2026-09-26 |
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
| REST-HEALTH-001 | `ALL /health` — full health: PostgreSQL+Redis+R2 parallel checks, SLO block, uptime, 200/500 | `controllers/health.controller.ts:235` | Actuator-based health (ADR-029 remap to `/actuator/health/*` or custom `/health/*`); dependency set changes (Redis removed per ADR-028); exact mapping frozen in MIG-003 | `openapi.yaml` op `getHealth` | MIG-012 probe evidence; MIG-091 operational evidence (AC-05) | blocked | 2026-09-26 |
| REST-HEALTH-002 | `ALL /health/live` — liveness `{status:'alive',timestamp}`; 200 | `controllers/health.controller.ts:296` | Liveness probe endpoint (ADR-029 mapping), same public no-auth contract | `openapi.yaml` op `getHealthLive` | MIG-012 probe evidence | blocked | 2026-09-26 |
| REST-HEALTH-003 | `ALL /health/ready` — readiness; 200 all deps up / 503 `not_ready` with per-dependency booleans | `controllers/health.controller.ts:313` | Readiness probe endpoint (ADR-029 mapping), per-dependency readiness booleans | `openapi.yaml` op `getHealthReady` | MIG-012 probe evidence | blocked | 2026-09-26 |

## Cross-cutting REST-stack behaviors (service-level rows)

| ID | Behavior | Baseline source @98db628 | Required target behavior (Java/Spring) | OpenAPI | Evidence location | Result | Rev |
|---|---|---|---|---|---|---|---|
| REST-XSRV-001 | Pagination contract — `BaseListRequest` (page 0-indexed internal, limit default set [15,25,35,45,55,100,150,200,0], searchText) → `BaseListResponse` `{data,page,limit,total}` 1-indexed | `packages/common/src/requests/base-list.request.ts`, `packages/common/src/responses/base-list.response.ts` | Identical wire envelope `{data,page,limit,total}`; internal normalization may differ (KISS); envelope frozen in MIG-003 | `openapi.yaml` component `BaseListResponse` | MIG-041 pagination contract tests | blocked | 2026-09-26 |
| REST-XSRV-002 | REST auth middleware — `authorizationChecker` + `currentUserChecker` verify Bearer JWT (BETTER_AUTH_SECRET-coupled) and enforce `@Authorized` roles; CORS exposes `set-auth-token,x-total-count,x-current-page,x-total-pages` | `middleware/routingControllersAuth.ts`, `src/index.ts` useExpressServer config | Spring Security filter chain (ADR-025): JWT resource-server, method RBAC, status enforcement; CORS exposed-header parity | `openapi.yaml` securityScheme `bearerAuth` | MIG-030 security tests; MIG-073 threat-model evidence | blocked | 2026-09-26 |
| REST-XSRV-003 | Rate limiting — `loginRateLimiter` (sign-in) + `passwordResetRateLimiter` (forgot/reset password) | `middleware/rateLimit.middleware.ts`, `controllers/auth.controller.ts` | Equivalent rate-limit policy on the same three auth endpoints (Spring filter/interceptor); limits frozen in MIG-003 | `openapi.yaml` ops `authSignInEmail`, `authForgotPassword`, `authResetPassword` (429s) | MIG-030/MIG-041 rate-limit tests | blocked | 2026-09-26 |
| REST-XSRV-004 | Request pipeline — bodyParser, correlationId, requestLogging middlewares; validation whitelist + forbidNonWhitelisted; default error handler `{error}` | `src/index.ts` useExpressServer config, `middleware/*.ts` | Spring filter/interceptor equivalents: MDC correlationId (TR-07), `@Valid`/`@ControllerAdvice` error contract (TR-04), logback JSON field-shape parity (ADR-029) | `openapi.yaml` component `ErrorResponse` | MIG-011 observability evidence; MIG-041 error contract tests | blocked | 2026-09-26 |

---

## Capture reconciliation notes (for MIG-003)

1. `@Controller` (non-JsonController) routes (health, ircIntegration) bypass JSON
   transformation in routing-controllers; health endpoints hand-write `res.json(...)`,
   ircIntegration uses `@Res()` passthrough. The Java target centralizes on
   `@RestController` + `@ControllerAdvice`; wire shapes captured above are the parity target.
2. Trailing-slash path `GET /api/conversations/` (`@Get('/')`) is registered as
   `/api/conversations` in practice; OpenAPI path item normalized, behavior preserved.
3. Two distinct POST assignment routes exist and are both frozen:
   `PATCH /api/conversations/:id/assign` (REST-CONV-005, admin/super_admin) and
   `POST /api/conversations/:conversationId/assign` (REST-ASSIGN-001, manager+) —
   different methods, RBAC, and response envelopes. Do not merge in canonicalization.
4. Duplicate queue/DLQ surface (`/api/dlq/*` vs `/api/queue/dlq/*`) is baseline reality;
   both surfaces are frozen rows. Any consolidation is a scope change requiring a new
   founder decision (SPEC-002 completion boundary).
5. `REST-QUEUE-006` job identity is BullMQ-specific; Quartz job-store mapping is a
   MIG-063 implementation concern with the wire contract frozen in MIG-003.
6. Enum inventories verified at capture: roles super_admin/admin/manager/user; statuses
   active/inactive/suspended; conversation status open/pending/resolved; priority
   low/normal/high/urgent; message status pending/sent/failed; direction inbound/outbound;
   IRC connection connected/retrying/disconnected/failed; bulk action assign/tag/status.
