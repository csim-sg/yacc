# Java QA Parity Matrix — QA-001 / QA-003 / QA-004 (MIG-091d)

**Issue**: [#456](https://github.com/csim-sg/yacc/issues/456) (MIG-091d, child of #366 MIG-091)
**Purpose**: re-express the environment-independent test targets of the QA-001/QA-003/QA-004 catalogs on the Java suite (`services/backend-java`), so #366's AC-MIG-091-1 (offline half) rests on recorded evidence instead of assertion.
**Source catalogs** (read at base `dev` @ `fd9429dbbbcb77fcea2a770b41b86e0092f84967`):

- `.docs/qa/QA-001-integration-test-cases.md` (33 enumerated cases, `TC-*-NNN`)
- `.docs/qa/QA-003-real-time-integration-tests.md` (26 enumerated cases, `TC-RT-NNN`)
- `.docs/qa/QA-004-phase1-acceptance-suite.md` (152 enumerated cases with explicit IDs across §3.1–3.8)

**Enumeration basis**: one row per case that carries an explicit case ID in the catalog. The QA-004 §2 feature matrix says "151 total" and §6 says "143 scenarios" while the enumerated §3 lists carry 152 IDs (it also has numbering gaps, e.g. no `EDGE-INT-005`, and `EDGE-INT-008a/b/c` sub-IDs); the enumerated IDs are authoritative here.

## Disposition legend

| Disposition | Meaning |
|---|---|
| `covered` | An existing Java test at the recorded commit evidences the catalog case's Java-target substance (`Class#method` cited). |
| `covered-by-new-test` | No prior Java evidence existed; a new test added by this issue closes the gap (listed in [Gaps closed](#gaps-closed-by-new-tests)). |
| `not-applicable` | The case has no Java-target substance — the reason is tied to the Java target (frozen contract/ADR-023, ADR-026 raw WS, ADR-027/028), not convenience. |
| `deferred` | A named issue owns the remaining work; the reason states why it cannot be closed by this offline slice (AC-2). |
| `gap-reported` | **Stop-and-report finding F1**: the catalog case exposes a real product gap vs the frozen contract on the Java target. Recorded here and on the issue for tech-lead disposition; no `src/main` change is made in this slice (binding guardrail). |

**Cross-issue boundaries honored here**: QA-002 (browser E2E) and all browser/device rows are #461; RBAC gap closure is #457; frozen-ledger row attribution (156 rows) is #459/#460 — this matrix cites ledger rows, never edits them (ADR-023/GOV-038).

---

## QA-001 — Integration Test Cases for BE-007-010 (Inbox API & Messaging)

| Case | Title | Disposition | Java evidence | Serves | Note |
|---|---|---|---|---|---|
| TC-001-001 | List conversations — default pagination | covered | `ConversationSurfaceApiIntegrationTest#listReturnsEnvelopeAndGetByUuid` | REST-CONV-001 | asserts 200 + `data` array + `page=1` + `limit=20`. |
| TC-001-002 | List conversations — auth required | covered-by-new-test | `ConversationListQueryApiIntegrationTest#unauthenticatedListIsDeniedWith401` | REST-CONV-001 | no-token request → 401 `{error}` (chain context: `AuthFlowIntegrationTest#protectedSurfaceRequiresAToken`). |
| TC-001-003 | List — response format | covered | `OpenApiDtoConformanceTest#responseDtosSerializeToContractConformingJson` + `ConversationSurfaceApiIntegrationTest#listReturnsEnvelopeAndGetByUuid` | REST-CONV-001 | the 14-field summary shape is the frozen contract component (`Conversation`); DTO wire conformance is contract-tested, the envelope live. |
| TC-002-001 | Custom page size | covered-by-new-test | `ConversationListQueryApiIntegrationTest#paginationHonorsCustomLimitPageOffsetTotalAndOutOfRangePages` | REST-CONV-001 | `limit=10` / `limit=5` honored. |
| TC-002-002 | Page offset | covered-by-new-test | same as TC-002-001 | REST-CONV-001 | page 1 vs page 2 return disjoint conversations. |
| TC-002-003 | Total pages calculation | covered-by-new-test | same as TC-002-001 | REST-CONV-001 | `total` matches the seeded count for every limit. |
| TC-002-004 | Out of range page | covered-by-new-test | same as TC-002-001 | REST-CONV-001 | `page=100` → 200 + empty data, `total` preserved. |
| TC-003-001 | Filter by channel | covered-by-new-test | `ConversationListQueryApiIntegrationTest#filtersByChannelStatusPriorityAssigneeAndTheirCombinations` | REST-CONV-001 | telegram/irc each return only their own. |
| TC-003-002 | Filter by status | gap-reported | — | REST-CONV-001 | **F1**: `?status=open/pending/resolved` (the frozen OpenAPI enum labels) is rejected 400 — the enum-typed request param binds via case-sensitive `valueOf`. See [F1](#f1-enum-typed-list-query-params-reject-contract-valid-labels). |
| TC-003-003 | Filter by priority | gap-reported | — | REST-CONV-001 | **F1**: `?priority=low/normal/high/urgent` rejected 400 for the same reason. |
| TC-003-004 | Filter by assignee | covered-by-new-test | `ConversationListQueryApiIntegrationTest#filtersByChannelStatusPriorityAssigneeAndTheirCombinations` | REST-CONV-001 | only the assignee's conversations returned. |
| TC-003-005 | Multiple filters combined | gap-reported | `ConversationListQueryApiIntegrationTest#filtersByChannelStatusPriorityAssigneeAndTheirCombinations` (channel+assignee subset) | REST-CONV-001 | AND logic proven for the wire-correct filters (channel+assignee); the status/priority members cannot pass contract labels — **F1**. |
| TC-004-001 | Full-text search on message bodies | covered-by-new-test | `ConversationListQueryApiIntegrationTest#searchMatchesBodiesSendersAndThreadIdsCaseInsensitivelyAndReturnsEmptyWithoutMatches` | REST-CONV-001 | case-insensitive body match (Java also matches title/thread id/sender name — `ConversationRepository#matchesSearch`). |
| TC-004-002 | Search on sender names | covered-by-new-test | same as TC-004-001 | REST-CONV-001 | sender-name match, case-insensitive. |
| TC-004-003 | Search with no matches | covered-by-new-test | same as TC-004-001 | REST-CONV-001 | non-matching term → empty data, `total=0`. |
| TC-005-001 | Filter by date range | covered-by-new-test | `ConversationListQueryApiIntegrationTest#dateRangeBoundsFilterOnLastActivityIncludingSingleSidedRanges` | REST-CONV-001 | `dateFrom`+`dateTo` window on `lastActivityAt`. |
| TC-005-002 | Filter from date only | covered-by-new-test | same as TC-005-001 | REST-CONV-001 | |
| TC-005-003 | Filter to date only | covered-by-new-test | same as TC-005-001 | REST-CONV-001 | |
| TC-006-001 | Sort by last activity (default) | covered-by-new-test | `ConversationListQueryApiIntegrationTest#sortingSupportsLastActivityDefaultCreatedAndPriorityInBothDirections` | REST-CONV-001 | default order = `lastActivityAt` DESC. |
| TC-006-002 | Sort by creation date | covered-by-new-test | same as TC-006-001 | REST-CONV-001 | `sortBy=created` asc/desc (desc == reverse(asc)). |
| TC-006-003 | Sort by priority | covered-by-new-test | same as TC-006-001 | REST-CONV-001 | sorts by the native PG enum value (`low<normal<high<urgent`) — same semantics as the Node `desc(conversations.priority)` PG-enum sort; catalog's `urgent→high→medium→low` wording predates the `normal` rename. |
| TC-007-001 | Get conversation by ID | covered | `ConversationSurfaceApiIntegrationTest#listReturnsEnvelopeAndGetByUuid` | REST-CONV-002 | full detail envelope, id echoed. |
| TC-007-002 | Get non-existent conversation | covered | same as TC-007-001 | REST-CONV-002 | 404 `{error: "Conversation not found"}`. |
| TC-008-001 | Get conversation messages | covered | `MessageApiIntegrationTest#listUsesFrozenCustomShapeAndSendReturnsDataEnvelope` | REST-MSG-001 | frozen custom shape `{messages,total,page,limit}` (defaults 1/50); chronological order asserted by the TC-008-002 test. |
| TC-008-002 | Message pagination | covered-by-new-test | `MessageApiIntegrationTest#messageListPaginatesInChronologicalOrderAcrossPages` | REST-MSG-001 | page offset + ascending `createdAt` order. |
| TC-009-001 | Send outbound message | covered | `MessageApiIntegrationTest#listUsesFrozenCustomShapeAndSendReturnsDataEnvelope` + `GatewayExchangeFlowIntegrationTest#sendReturnsFrozen201PendingThenAsyncDispatchDeliversAndEmits` | REST-MSG-002 | frozen 201 `{data}` with `pending`/`outbound`. |
| TC-009-002 | Send triggers conversation update | covered-by-new-test | `MessageApiIntegrationTest#sendRejectsBlankBodyAndUpdatesTheConversationLatestMessageSurface` | REST-MSG-002 | Java surface: the list item's `latestMessageAt`/`latestMessagePreview` reflect the sent message (Node `lastActivityAt` list field). The `conversations.last_activity_at` column itself is inbound/assignment-driven by POC parity (`ConversationIngressService`, `AssignmentService`) — outbound send persists the message row only. |
| TC-010-001 | User cannot access other user's data | covered | `MessageApiIntegrationTest#sendRequiresAssignmentForUserRole` + `ConversationSurfaceApiIntegrationTest#statusPriorityAssignEnforceRoleMatrixAndAudit` | REST-MSG-002, REST-CONV-003..005 | assignment-bound `user` reply policy (403) + role-gated mutations. Reads: the frozen contract scopes no role visibility on `listConversations` (see QA-004 RBAC-INBOX-001 note). |
| TC-010-002 | Manager can update status | covered | `ConversationSurfaceApiIntegrationTest#statusPriorityAssignEnforceRoleMatrixAndAudit` | REST-CONV-003 | manager+ → 200, status persisted. |
| TC-010-003 | User role cannot update | covered | same as TC-010-002 | REST-CONV-003 | `user` → 403. |
| TC-011-001 | Invalid channel filter | covered-by-new-test | `ConversationListQueryApiIntegrationTest#invalidQueryParametersAreRejectedWith400` | REST-CONV-001 | 400 `channel must be one of telegram, irc`. |
| TC-011-002 | Invalid date format | covered-by-new-test | same as TC-011-001 | REST-CONV-001 | 400 `must be an ISO date`. |
| TC-011-003 | Invalid pagination parameters | covered-by-new-test | same as TC-011-001 | REST-CONV-001 | `limit=abc` → 400 (type mismatch); `limit=0` / `page=0` → 400 (service validation). |

---

## QA-003 — Real-Time Integration Tests (raw WebSocket, ADR-026)

Server-side substance is the Java target; explicit browser/device halves are #461 (QA-002 scope) and noted where the catalog statement is client-only.

| Case | Title | Disposition | Java evidence | Serves | Note |
|---|---|---|---|---|---|
| TC-RT-001 | WebSocket connects on page load | covered | `RealtimeWebSocketIntegrationTest#authenticatedUpgradeReceivesEstablishedEventAndConversationAck` + `WebSocketHeartbeatIntegrationTest#heartbeatsArrivePeriodicallyWithTheFrozenSystemPayload` | WS-RAW-001..003, WS-EVT-014 | real Tomcat upgrade → exactly one `system.connection.established`; 60s heartbeat server-side. Browser page-load rendering → #461. |
| TC-RT-002 | WebSocket connects on demand | not-applicable | — | WS-RAW-001 | manual `socket.connect()` is client-side state management; the server-side on-demand upgrade path is the same upgrade covered by TC-RT-001. Browser half → #461. |
| TC-RT-003 | Receive new inbound message | covered | `GatewayExchangeFlowIntegrationTest#telegramInboundPersistsConversationMessageAuditAndEmitsReceived` + `WebSocketMessageFanOutOrderingIntegrationTest#threeRapidMessageReceivedEventsFanOutInOrderToSubscribedPeers` | WS-EVT-005, WS-QEV-001 | `message.received` fires to the conversation room on inbound; unread-count/notification UI halves → #461. |
| TC-RT-004 | Multiple rapid messages | covered-by-new-test | `WebSocketMessageFanOutOrderingIntegrationTest#threeRapidMessageReceivedEventsFanOutInOrderToSubscribedPeers` | WS-EVT-005 | 3 rapid emissions arrive at a subscribed peer in emission order, none lost. |
| TC-RT-005 | Confirmation when message sent | covered | `GatewayExchangeFlowIntegrationTest#sendReturnsFrozen201PendingThenAsyncDispatchDeliversAndEmits` + `ApplicationEventRelayServiceTest#messageSentFansOutTheVerbatimPayload` | WS-EVT-006 | async dispatch emits `message.sent` (status transition pending→sent). |
| TC-RT-006 | Message sent with attachment | not-applicable | `AsyncApiRealtimePayloadConformanceTest#messageSentPayloadValidatesAgainstTheFrozenSchema` | WS-EVT-006 | the frozen `message.sent` payload schema has no attachment members; `SendMessageBody.attachmentIds` is wire-optional with Phase-6 storage (no upload route in the frozen OpenAPI). |
| TC-RT-007 | Failed message notification | covered | `GatewayExchangeFlowIntegrationTest#failedDispatchRecordsFailureDlqRetryCycleAndFrames` + `ApplicationEventRelayServiceTest#messageFailedFansOutTheVerbatimPayload` | WS-EVT-007, WS-QEV-002 | `message.failed` broadcast on delivery failure (retry-pending signal, founder Option A). |
| TC-RT-008 | Network error handling | covered | `TelegramConnectorTest#sendMessageMapsTransportFailuresToRetryableNetworkErrors` + `GatewayExchangeTest#nonTerminalRedeliveryFailureEmitsFailedWithTheNextLadderStep` | WS-EVT-007 | transport failure → retryable typed error → `message.failed` with ladder step; terminal outcome is `queue.message.dlq` (`GatewayExchangeTest#onCycleExhaustedPublishesOneEnvelopedFrameFromTheCommittedRow`). |
| TC-RT-009 | WebSocket disconnects unexpectedly | covered | `RealtimePropertiesTest#backoffComputationIsDeterministicExponentialGrowthCappedAtMax` | WS-BHV-012..014 | server-side reconnect policy frozen (deterministic exponential growth, capped); client-side backoff UI → #461. |
| TC-RT-010 | Reconnect after 30 seconds | covered | `WebSocketReconnectServiceTest#detectedReconnectEmitsTheMarkerBeforeRestoration` + `WebSocketBacklogReplayIntegrationTest#reconnectionRestoresTheDurableBacklogInOrderThenClearsIt` | WS-BHV-009, WS-EVT-019/020 | detected reconnect → marker + durable backlog restoration. |
| TC-RT-011 | Max reconnection attempts | covered | `RealtimePropertiesTest#policyIsExhaustedAfterMaxAttempts` | WS-BHV-014 | policy exhaustion is deterministic; client retry UX → #461. |
| TC-RT-012 | Receive missed messages on reconnect | covered | `WebSocketBacklogReplayIntegrationTest#reconnectionRestoresTheDurableBacklogInOrderThenClearsIt` | WS-BHV-009, WS-EVT-015 | durable PostgreSQL backlog replays in order, then clears. |
| TC-RT-013 | Backlog exceeds 1 hour window | covered | `WebSocketBacklogServiceTest#storeWritesOneRowWithOneHourExpiryAndConversationScope` + `WebSocketBacklogReplayIntegrationTest#replayFiltersExpiredRowsOnExpiresAt` | WS-EVT-015 | 1h `expires_at` window; expired rows never replay. |
| TC-RT-014 | Backlog with conversation updates | covered | `WebSocketBacklogServiceTest#eligibleEventsAreExactlyTheBaselineGatewayFamilies` + `WebSocketEventPublisherTest#roomEmissionStoresBacklogEligibleEventsPerRecipient` | WS-EVT-015 | `conversation.updated`/`conversation.reopened` are baseline backlog-eligible families; state-change rows stored per recipient. |
| TC-RT-015 | message.received event structure | covered | `AsyncApiRealtimePayloadConformanceTest#messageReceivedPayloadValidatesAgainstTheFrozenSchema` + `ApplicationEventRelayServiceTest#messageReceivedAckEmitsNothingAtAll` | WS-EVT-005 | payload validates against the frozen AsyncAPI schema. |
| TC-RT-016 | message.sent event structure | covered | `AsyncApiRealtimePayloadConformanceTest#messageSentPayloadValidatesAgainstTheFrozenSchema` | WS-EVT-006 | frozen schema conformance. |
| TC-RT-017 | message.failed event structure | covered | `AsyncApiRealtimePayloadConformanceTest#messageFailedPayloadValidatesAgainstTheFrozenSchemaWithTheLadderBounds` | WS-EVT-007 | frozen schema incl. ladder bounds. |
| TC-RT-018 | 100 messages per second | not-applicable | — | — | throughput/latency target is a non-deterministic measurement, excluded from the deterministic offline suite by the issue's evidence policy; environment-gated load acceptance belongs to #461. Functional ordering/loss-free behavior is covered by TC-RT-004/TC-RT-012. |
| TC-RT-019 | Multiple concurrent conversations | covered | `WebSocketEventPublisherTest#roomEmissionReachesOnlyRoomMembers` + `YaccWebSocketHandlerTest#subscribeConversationJoinsRoomAndAcks` | WS-OP-CONV-004, WS-BHV-002 | conversation-room isolation; no cross-room fan-out. |
| TC-RT-020 | Chrome WebSocket | not-applicable | — | — | browser matrix is QA-002/#461; no server-side dimension. |
| TC-RT-021 | Firefox WebSocket | not-applicable | — | — | same as TC-RT-020. |
| TC-RT-022 | Mobile Safari | not-applicable | — | — | same as TC-RT-020 (device matrix). |
| TC-RT-023 | Mobile Chrome | not-applicable | — | — | same as TC-RT-020 (device matrix). |
| TC-RT-024 | Malformed event data | covered | `YaccWebSocketHandlerTest#malformedFrameAndMissingEventEmitBadFrameErrors` + `ApplicationEventRelayServiceTest#conversationUpdatedRejectsMissingAndInvalidMembers` | WS-BHV-017, WS-EVT-018 | malformed inbound frames → `system.error`/`bad_frame` without breaking the session; outbound application payloads are schema-validated before fan-out, so the server never emits malformed events. |
| TC-RT-025 | Duplicate event | covered | `GatewayExchangeTest#duplicateDeliveryOfAnAlreadySentMessageCollapses` | WS-QEV-003 | server-side delivery idempotency (`sent` is terminal); client-side UI dedupe → #461. |
| TC-RT-026 | Out-of-order events | covered | `WebSocketBacklogReplayIntegrationTest#reconnectionRestoresTheDurableBacklogInOrderThenClearsIt` + `WebSocketMessageFanOutOrderingIntegrationTest#threeRapidMessageReceivedEventsFanOutInOrderToSubscribedPeers` | WS-EVT-015, WS-EVT-005 | server emits/replays in emission order; client-side reordering display → #461. |

---

## QA-004 — Phase 1 Acceptance Suite

### 3.1 Authentication (18)

| Case | Title | Disposition | Java evidence | Serves | Note |
|---|---|---|---|---|---|
| HP-AUTH-001 | Login with valid credentials | covered | `AuthFlowIntegrationTest#signInReturnsCanonicalSessionContract` | — | frozen op is `POST /api/auth/sign-in/email` (catalog's `/api/auth/login` is the Node-era name). |
| HP-AUTH-002 | Refresh token HttpOnly cookie | not-applicable | `AuthFlowIntegrationTest#signInReturnsCanonicalSessionContract` | — | the frozen contract returns `{user, accessToken, refreshToken, mustChangePassword}` in the body; there is no cookie member in the sign-in response schema. |
| HP-AUTH-003 | Access token 48h TTL | not-applicable | `AuthorizationServerConfigTest#ttlDefaultsApplyWhenTokenSectionOmitted` | — | the Java target pins accessTtl 30m / refreshTtl 30d (MIG-030 conventions); the 48h claim is Node-era and superseded by the frozen auth contract. |
| HP-AUTH-004 | Protected endpoints with valid token | covered | `AuthFlowIntegrationTest#protectedSurfaceRequiresAToken` + `AuthFlowIntegrationTest#getSessionResolvesThePresentedAccessToken` | — | |
| HP-AUTH-005 | Logout terminates session | covered | `AuthFlowIntegrationTest#signOutRevokesTheRefreshGrant` | — | frozen op `POST /api/auth/sign-out`. |
| HP-AUTH-006 | Forgot password emails reset link | covered | `AuthRecoveryFlowIntegrationTest#forgotPasswordAnswersConstant200ForUnknownAndKnownAddresses` + `SmtpAuthEmailSenderTest#sendsAFromToSubjectTextMessage` + `AuthEmailServiceTest#resetEmailBodiesCarryTheActionLink` | — | Mailhog is compose-local infra; the SMTP transport and link body are asserted directly. |
| EDGE-AUTH-001 | Wrong password → 401 | covered | `AuthFlowIntegrationTest#signInRejectsBadCredentialsAndNonActiveIdentitiesUniformly` | — | |
| EDGE-AUTH-002 | Unknown email → 401 (uniform) | covered | same as EDGE-AUTH-001 | — | anti-enumeration uniform denial. |
| EDGE-AUTH-003 | Empty email → 400 | covered-by-new-test | `AuthFlowIntegrationTest#signInRejectsBlankAndMalformedEmailsWithBeanValidation` | — | `@NotBlank @Email` bean validation on `SignInRequest`. |
| EDGE-AUTH-004 | No token → 401 | covered | `AuthFlowIntegrationTest#protectedSurfaceRequiresAToken` | — | |
| EDGE-AUTH-005 | Malformed token → 401 | covered | `AuthFlowIntegrationTest#foreignKeySignedTokenIsRejectedByTheResourceServer` | — | |
| EDGE-AUTH-006 | Refresh rotation single-use | covered | `AuthFlowIntegrationTest#refreshRotatesTheGrantAndRetiresThePresentedOne` + `AuthorizationServerIntegrationTest#concurrentReuseOfOneRefreshTokenYieldsExactlyOneSuccessAndOneInvalidGrant` | — | |
| RBAC-AUTH-001 | super_admin all actions | covered | `AuthFlowIntegrationTest#rbacMatrixGatesEveryRoleExplicitly` | — | |
| RBAC-AUTH-002 | admin ops actions | covered | `AuthFlowIntegrationTest#rbacMatrixGatesEveryRoleExplicitly` + `UsersApiIntegrationTest#nonSuperAdminDeniedAndRolesReadable` | — | |
| RBAC-AUTH-003 | manager reads audit logs | covered | `AuditLogsApiIntegrationTest#managerReadsConversationAuditPage` | — | |
| RBAC-AUTH-004 | user denied admin endpoints | covered | `AuthFlowIntegrationTest#rbacMatrixGatesEveryRoleExplicitly` + `UsersApiIntegrationTest#nonSuperAdminDeniedAndRolesReadable` | — | |
| RBAC-AUTH-005 | disabled user cannot login | covered | `AuthFlowIntegrationTest#signInRejectsBadCredentialsAndNonActiveIdentitiesUniformly` + `AuthFlowIntegrationTest#suspendedIdentityIsDeniedOnProtectedRest` | — | Node "disabled" = Java `suspended`/`inactive` (frozen `UserStatus` enum); non-active identities are denied at sign-in and their grants are hidden (`AsStatusEnforcingAuthorizationServiceTest#hidesGrantWhenOwnerIsSuspended`). |
| RBAC-AUTH-006 | Role change effective next login | deferred | — | — | **→ #457**: role-change→session-propagation evidence is RBAC-slice scope (seq 30e); token authorities are minted from the current role at sign-in (`TokenAuthenticationServiceTest#authenticatesActiveIdentityWithRoleAuthority`), but the change-propagation acceptance row belongs to the RBAC matrix — adding it here would race #457's parallel RBAC work in the same milestone. |

### 3.2 Inbox List & Filters (18)

| Case | Title | Disposition | Java evidence | Serves | Note |
|---|---|---|---|---|---|
| HP-INBOX-001 | Default pagination | covered | `ConversationSurfaceApiIntegrationTest#listReturnsEnvelopeAndGetByUuid` + `ConversationListQueryApiIntegrationTest#paginationHonorsCustomLimitPageOffsetTotalAndOutOfRangePages` | REST-CONV-001 | |
| HP-INBOX-002 | Filter by channel | covered-by-new-test | `ConversationListQueryApiIntegrationTest#filtersByChannelStatusPriorityAssigneeAndTheirCombinations` | REST-CONV-001 | |
| HP-INBOX-003 | Filter by status | gap-reported | — | REST-CONV-001 | **F1** (same as QA-001 TC-003-002). |
| HP-INBOX-004 | Filter by priority | gap-reported | — | REST-CONV-001 | **F1** (same as QA-001 TC-003-003). |
| HP-INBOX-005 | Filter by assignee | covered-by-new-test | same as HP-INBOX-002 | REST-CONV-001 | |
| HP-INBOX-006 | Combined filters | gap-reported | `ConversationListQueryApiIntegrationTest#filtersByChannelStatusPriorityAssigneeAndTheirCombinations` (channel+assignee subset) | REST-CONV-001 | AND logic proven on the wire-correct filters; status/priority members — **F1**. |
| EDGE-INBOX-001 | Empty result set | covered-by-new-test | same as HP-INBOX-002 (impossible combination → `total=0`) | REST-CONV-001 | |
| EDGE-INBOX-002 | Page beyond max | covered-by-new-test | `ConversationListQueryApiIntegrationTest#paginationHonorsCustomLimitPageOffsetTotalAndOutOfRangePages` | REST-CONV-001 | |
| EDGE-INBOX-003 | Invalid limit > 100 → 400 | covered-by-new-test | `ConversationListQueryApiIntegrationTest#invalidQueryParametersAreRejectedWith400` | REST-CONV-001 | Java enforces the 1..100 bound (service validation). |
| EDGE-INBOX-004 | Invalid status → 400 | covered | `ConversationListQueryApiIntegrationTest#invalidQueryParametersAreRejectedWith400` | REST-CONV-001 | 400 returned as the catalog expects — but read alongside **F1**: today every label (valid or invalid) is rejected, so this row passes vacuously until F1 is fixed. |
| EDGE-INBOX-005 | `priority=medium` → 400 | covered | same as EDGE-INBOX-004 | REST-CONV-001 | same F1 caveat. |
| EDGE-INBOX-006 | Invalid UUID assignee → 400 | not-applicable | `ConversationListQueryApiIntegrationTest#filtersByChannelStatusPriorityAssigneeAndTheirCombinations` | REST-CONV-001 | the frozen contract types `assignedUserId` as a plain string (no `uuid` format); the Java target compares it literally (POC parity) so a non-UUID value yields an empty match set, not a validation error. |
| RBAC-INBOX-001 | user sees only assigned conversations | not-applicable | — | REST-CONV-001 | the frozen `listConversations` op declares no security/role-scoping requirement, and ledger REST-CONV-001 records the 13-param list without visibility scoping; every authenticated role may read (controller contract). Assignment-based 403s live on the write paths (`sendRequiresAssignmentForUserRole`). |
| RBAC-INBOX-002 | manager sees all | covered | `ConversationListQueryApiIntegrationTest#filtersByChannelStatusPriorityAssigneeAndTheirCombinations` (manager identity lists everything) | REST-CONV-001 | |
| RBAC-INBOX-003 | admin sees all | covered | same as RBAC-INBOX-002 | REST-CONV-001 | |
| RBAC-INBOX-004 | super_admin sees all | covered | `ConversationSurfaceApiIntegrationTest#listReturnsEnvelopeAndGetByUuid` (super identity) | REST-CONV-001 | |
| RBAC-INBOX-005 | unauthenticated cannot list | covered-by-new-test | `ConversationListQueryApiIntegrationTest#unauthenticatedListIsDeniedWith401` | REST-CONV-001 | same evidence as QA-001 TC-001-002. |
| RBAC-INBOX-006 | suspended user cannot list | covered | `AuthFlowIntegrationTest#suspendedIdentityIsDeniedOnProtectedRest` | — | suspended grant denied on protected REST. |

### 3.3 Conversation Detail & Status (8)

| Case | Title | Disposition | Java evidence | Serves | Note |
|---|---|---|---|---|---|
| HP-CONV-001 | Conversation detail with messages | covered | `ConversationSurfaceApiIntegrationTest#listReturnsEnvelopeAndGetByUuid` | REST-CONV-002 | |
| HP-CONV-002 | Status change with audit | covered | `ConversationSurfaceApiIntegrationTest#statusPriorityAssignEnforceRoleMatrixAndAudit` + `AuditLogsApiIntegrationTest#managerReadsConversationAuditPage` | REST-CONV-003 | mutation + audit row readable. |
| HP-CONV-003 | Auto-reopen resolved on inbound | covered | `GatewayExchangeFlowIntegrationTest#inboundOnAResolvedConversationReopensItWithTheAuditParity` | WS-EVT-002 (attribution → #460) | reopen state + `conversation_reopened` audit asserted; the `conversation.reopened` WS frame itself has no server emitter in Java main — recorded as a deferred finding (see [Findings](#stop-and-report-findings--deferred-rows)). |
| EDGE-CONV-001 | Invalid status transition → 400 | covered-by-new-test | `ConversationListQueryApiIntegrationTest#statusUpdateEdgeCasesValidateTransitionInputAndAllowSameStatus` | REST-CONV-003 | |
| EDGE-CONV-002 | Same-status transition idempotent 200 | covered-by-new-test | same as EDGE-CONV-001 | REST-CONV-003 | |
| EDGE-CONV-003 | Non-existent conversation → 404 | covered | `ConversationSurfaceApiIntegrationTest#listReturnsEnvelopeAndGetByUuid` | REST-CONV-002 | |
| RBAC-CONV-001 | manager+ can change status | covered | `ConversationSurfaceApiIntegrationTest#statusPriorityAssignEnforceRoleMatrixAndAudit` | REST-CONV-003 | |
| RBAC-CONV-002 | user cannot change status | covered | same as RBAC-CONV-001 | REST-CONV-003 | |

### 3.4 Messaging & Delivery Status (24)

| Case | Title | Disposition | Java evidence | Serves | Note |
|---|---|---|---|---|---|
| HP-MSG-001 | Send to Telegram conversation → 201 pending | covered | `MessageApiIntegrationTest#listUsesFrozenCustomShapeAndSendReturnsDataEnvelope` | REST-MSG-002 | |
| HP-MSG-002 | pending → sent on delivery | covered | `GatewayExchangeFlowIntegrationTest#sendReturnsFrozen201PendingThenAsyncDispatchDeliversAndEmits` | REST-MSG-002, WS-EVT-006 | |
| HP-MSG-003 | Message with attachment | not-applicable | `OpenApiDtoConformanceTest#requestDtosRoundTripContractConformingWireJson` | REST-MSG-002 | `SendMessageBody.attachmentIds` is wire-optional (contract component; MIG-102) with Phase-6 storage; the frozen contract has no upload/attachment-resolution route, so no attachment persistence behavior exists to test. |
| HP-MSG-004 | Send to IRC conversation; queue when disconnected | covered | `GatewayExchangeFlowIntegrationTest#sendReturnsFrozen201PendingThenAsyncDispatchDeliversAndEmits` + `GatewayExchangeFlowIntegrationTest#failedDispatchRecordsFailureDlqRetryCycleAndFrames` | REST-MSG-002, WS-QEV-001..003 | ADR-028: the BullMQ queue clause is superseded by the PostgreSQL DB-DLQ + Quartz retry cycle (`QueueRetryWorkerIntegrationTest#failedAttemptsWalkTheBackoffLadderThenRecordTheExhaustedTerminalState`). |
| HP-MSG-005 | Inbound message from Telegram | covered | `GatewayExchangeFlowIntegrationTest#telegramInboundPersistsConversationMessageAuditAndEmitsReceived` | WS-EVT-005 | |
| HP-MSG-006 | Inbound message from IRC | covered | `GatewayExchangeFlowIntegrationTest#ircInboundCarriesTheResolvedProfileIdentityAndCreatesTheConversation` | WS-EVT-005 | |
| HP-MSG-007 | Message status visible in conversation | covered | `MessageApiIntegrationTest#listUsesFrozenCustomShapeAndSendReturnsDataEnvelope` + `OpenApiDtoConformanceTest#responseDtosSerializeToContractConformingJson` | REST-MSG-001 | `status` is a frozen member of the message wire shape. |
| HP-MSG-008 | Delete unsent message | not-applicable | — | — | no `DELETE /api/messages/{id}` route exists in the frozen OpenAPI (route inventory: `RestRouteCoverageConformanceTest#everyFrozenOpenApiRouteIsImplemented`). |
| EDGE-MSG-001 | Message too long → 400 | covered | `MessageApiIntegrationTest#listUsesFrozenCustomShapeAndSendReturnsDataEnvelope` (10001 chars → 400) | REST-MSG-002 | the frozen cap is 10000 (`SendMessageBody`), not the catalog's Node-era 5000. |
| EDGE-MSG-002 | Empty body → 400 | covered-by-new-test | `MessageApiIntegrationTest#sendRejectsBlankBodyAndUpdatesTheConversationLatestMessageSurface` | REST-MSG-002 | `@NotBlank`. |
| EDGE-MSG-003 | Message to non-existent conversation → 404 | covered | `MessageApiIntegrationTest#statusLookupAndMissingConversation` + `MessageApiIntegrationTest#sendRequiresAssignmentForUserRole` (404 precedence) | REST-MSG-002 | |
| EDGE-MSG-004 | Attachment > 5 MB → 413 | not-applicable | — | — | no upload route in the frozen contract (see HP-MSG-003). |
| EDGE-MSG-005 | Send to conversation assigned to other user → 403 | covered | `MessageApiIntegrationTest#sendRequiresAssignmentForUserRole` | REST-MSG-002 | |
| EDGE-MSG-006 | Retry exhausted → failed, retryCount=3 | covered | `QueueRetryWorkerIntegrationTest#failedAttemptsWalkTheBackoffLadderThenRecordTheExhaustedTerminalState` + `GatewayExchangeFlowIntegrationTest#failedDispatchRecordsFailureDlqRetryCycleAndFrames` | WS-QEV-001..003 | |
| EDGE-MSG-007 | Failed message in DLQ | covered | `GatewayExchangeFlowIntegrationTest#exhaustionEmitsTheTerminalDlqFrameOnceWithCommittedCounters` + `DlqQueueApiIntegrationTest#listStatsReQueueAndRemoveFollowRoleMatrix` | WS-QEV-003 | |
| EDGE-MSG-008 | Send to resolved conversation | covered | `GatewayExchangeFlowIntegrationTest#inboundOnAResolvedConversationReopensItWithTheAuditParity` + `MessageApiIntegrationTest#sendRequiresAssignmentForUserRole` | REST-MSG-002 | the catalog allows either branch; the Java target allows the send (no status guard in the frozen send op — 201 pending) and auto-reopens on inbound. |
| EDGE-MSG-009 | Invalid attachment ID → 404 | not-applicable | — | — | no attachment-resolution behavior in the frozen contract/ledger (see HP-MSG-003). |
| EDGE-MSG-010 | Sender attribution for outbound | covered | `MessageApiIntegrationTest#sendRequiresAssignmentForUserRole` (exactly one persisted row per accepted send) + `GatewayExchangeFlowIntegrationTest#sendReturnsFrozen201PendingThenAsyncDispatchDeliversAndEmits` | REST-MSG-002 | `sender_id` = authenticated user, `sender_name` = directory display name (`MessageService#send`). |
| RBAC-MSG-001 | user can send to assigned conversation | covered | `MessageApiIntegrationTest#sendRequiresAssignmentForUserRole` | REST-MSG-002 | |
| RBAC-MSG-002 | user cannot send to unassigned | covered | same as RBAC-MSG-001 | REST-MSG-002 | |
| RBAC-MSG-003 | manager can send anywhere | covered | same as RBAC-MSG-001 | REST-MSG-002 | |
| RBAC-MSG-004 | admin can send anywhere | covered | same as RBAC-MSG-001 | REST-MSG-002 | |
| RBAC-MSG-005 | super_admin can send anywhere | covered | same as RBAC-MSG-001 | REST-MSG-002 | |
| RBAC-MSG-006 | unauthenticated cannot send | covered | `AuthFlowIntegrationTest#protectedSurfaceRequiresAToken` | — | |

### 3.5 Retry Queue & DLQ (20)

| Case | Title | Disposition | Java evidence | Serves | Note |
|---|---|---|---|---|---|
| HP-QUEUE-001 | Sent on first attempt, retryCount=0 | covered | `GatewayExchangeFlowIntegrationTest#sendReturnsFrozen201PendingThenAsyncDispatchDeliversAndEmits` | WS-QEV-001 | |
| HP-QUEUE-002 | Retried once, second attempt succeeds | covered | `GatewayExchangeFlowIntegrationTest#redeliveryDeliverThenClearsTheDlqRowAndDuplicateDeliveryCollapses` + `QueueRetryWorkerIntegrationTest#successfulRedeliveryClearsTheDlqRowAndCompletesTheCycle` | WS-QEV-001..002 | |
| HP-QUEUE-003 | Backoff schedule visible in Redis | not-applicable | `QueueRetryPropertiesTest#delayBeforeAttemptWalksTheOneFiveThirtyLadder` | WS-QEV-001 | the Redis/BullMQ inspection clause is superseded by ADR-028 (no Redis); the frozen 1m/5m/30m ladder is DB-scheduled and asserted on the Quartz/PostgreSQL store (`QueueRetryWorkerIntegrationTest#retriedMarkerConsumptionSchedulesAQuartzCycleWithTheOneToOneIdentity`). |
| HP-QUEUE-004 | Manager views queue stats | covered | `DlqQueueApiIntegrationTest#queueSurfaceStatsRetryBulkAndByReason` | — | |
| HP-QUEUE-005 | Manager retries failed message manually | covered | `DlqQueueApiIntegrationTest#listStatsReQueueAndRemoveFollowRoleMatrix` + `MessageApiIntegrationTest#retryIsOnceOnlyAndRequiresAssignmentForUserRole` | — | |
| HP-QUEUE-006 | DLQ stores final failures | covered | `GatewayExchangeFlowIntegrationTest#exhaustionEmitsTheTerminalDlqFrameOnceWithCommittedCounters` + `DlqRetentionIntegrationTest#expiredEntriesAreRemovedInBoundedBatchesAndUnexpiredEntriesArePreserved` | WS-QEV-003 | |
| EDGE-QUEUE-001 | Retry exhausted → failed + DLQ | covered | `QueueRetryWorkerIntegrationTest#failedAttemptsWalkTheBackoffLadderThenRecordTheExhaustedTerminalState` | WS-QEV-003 | |
| EDGE-QUEUE-002 | Retry count increments per failure | covered | `GatewayExchangeTest#nonTerminalRedeliveryFailureEmitsFailedWithTheNextLadderStep` | WS-QEV-002 | |
| EDGE-QUEUE-003 | DLQ entry carries error details | covered | `DlqQueueApiIntegrationTest#listStatsReQueueAndRemoveFollowRoleMatrix` | — | entry rows carry failure reason/error/attempts columns (`RepositoryMappingIntegrationTest#deadLetterQueueEntryRoundTripsTracingColumns`). |
| EDGE-QUEUE-004 | Cannot retry a sent message → 400 | covered | `MessageApiIntegrationTest#retryIsOnceOnlyAndRequiresAssignmentForUserRole` | — | |
| EDGE-QUEUE-005 | Retry non-existent message → 404 | covered-by-new-test | `MessageApiIntegrationTest#manualRetryOfAMissingMessageReturns404` | — | |
| EDGE-QUEUE-006 | Queue stats accurate counts | covered | `DlqQueueApiIntegrationTest#queueSurfaceStatsRetryBulkAndByReason` | — | |
| EDGE-QUEUE-007 | DLQ entry cleared (manager+) | covered | `DlqQueueApiIntegrationTest#listStatsReQueueAndRemoveFollowRoleMatrix` | — | |
| EDGE-QUEUE-008 | Backoff increments 1m→5m→30m | covered | `QueueRetryPropertiesTest#delayBeforeAttemptWalksTheOneFiveThirtyLadder` + `QueueRetryPropertiesTest#beyondTheLadderTheLastDelayRepeats` + `QueueRetryWorkerIntegrationTest#failedAttemptsWalkTheBackoffLadderThenRecordTheExhaustedTerminalState` | WS-QEV-002 | |
| RBAC-QUEUE-001 | manager reads queue stats | covered | `DlqQueueApiIntegrationTest#queueSurfaceStatsRetryBulkAndByReason` | — | |
| RBAC-QUEUE-002 | admin reads queue stats | covered | same as RBAC-QUEUE-001 | — | |
| RBAC-QUEUE-003 | super_admin reads queue stats | covered | same as RBAC-QUEUE-001 | — | |
| RBAC-QUEUE-004 | user denied queue stats | covered | same as RBAC-QUEUE-001 | — | |
| RBAC-QUEUE-005 | user cannot retry messages | covered | `DlqQueueApiIntegrationTest#listStatsReQueueAndRemoveFollowRoleMatrix` | — | |
| RBAC-QUEUE-006 | manager can clear DLQ | covered | same as RBAC-QUEUE-005 | — | |

### 3.6 WebSocket & Real-Time (28)

| Case | Title | Disposition | Java evidence | Serves | Note |
|---|---|---|---|---|---|
| HP-WS-001 | Connect + hello/heartbeat | covered | `RealtimeWebSocketIntegrationTest#authenticatedUpgradeReceivesEstablishedEventAndConversationAck` + `WebSocketHeartbeatServiceTest#theDefaultIntervalIsTheFrozen60Seconds` | WS-RAW-001..003, WS-EVT-014 | raw-WS `system.connection.established` replaces the Socket.io hello. |
| HP-WS-002 | conversation_updated on new message | covered | `YaccWebSocketHandlerTest#conversationUpdatedMessageSentAndMessageFailedFanOutToTheRoomExceptTheSender` + `GatewayExchangeFlowIntegrationTest#sendReturnsFrozen201PendingThenAsyncDispatchDeliversAndEmits` | WS-EVT-001, WS-EVT-006 | ADR-026 mapping: `conversation.updated` is a room-relayed demux op; the automatic push channel on an accepted API send is `message.sent`. |
| HP-WS-003 | message.sent on delivery success | covered | `GatewayExchangeFlowIntegrationTest#sendReturnsFrozen201PendingThenAsyncDispatchDeliversAndEmits` + `ApplicationEventRelayServiceTest#messageSentFansOutTheVerbatimPayload` | WS-EVT-006 | |
| HP-WS-004 | message.failed on delivery failure | covered | `GatewayExchangeFlowIntegrationTest#failedDispatchRecordsFailureDlqRetryCycleAndFrames` + `ApplicationEventRelayServiceTest#messageFailedFansOutTheVerbatimPayload` | WS-EVT-007 | |
| HP-WS-005 | notification.received on assignment | deferred | `ConversationSurfaceApiIntegrationTest#postAssignmentRequiresManagerPlusAndNotifies` (assignment surface) | WS-EVT-004 | **→ #460**: the `notification.received` frame is a frozen subscribe-only channel with no server emitter wired on the assignment path in Java main; the REST assignment surface + notification envelope are covered. Whether the WS push is required is WS-ledger attribution (frozen surface), not an offline test. |
| HP-WS-006 | presence.updated online/offline | covered | `WebSocketPresenceServiceTest#userOnlineBroadcastsOnlinePresenceAndRepliesOnlineUsers` + `WebSocketPresenceServiceTest#userOfflineBroadcastsOfflinePresenceExceptSender` + `WebSocketPresenceTypingIntegrationTest#presenceAndTypingFlowBetweenTwoRealSessions` | WS-EVT-010, WS-BHV-004..006 | |
| HP-WS-007 | typing.started | covered | `WebSocketTypingServiceTest#typingStartedFansOutToTheConversationRoomExceptSender` + `WebSocketPresenceTypingIntegrationTest#presenceAndTypingFlowBetweenTwoRealSessions` | WS-EVT-008 | |
| HP-WS-008 | typing.stopped (timeout) | covered | `WebSocketTypingServiceTest#typingStoppedFansOutToTheConversationRoomExceptSender` + `WebSocketTypingServiceTest#typingTimeoutEmitsStoppedToTheRoom` | WS-EVT-009 | |
| HP-WS-009 | conversation.reopened event | deferred | `GatewayExchangeFlowIntegrationTest#inboundOnAResolvedConversationReopensItWithTheAuditParity` (state + audit) | WS-EVT-002 | **→ #460**: `conversation.reopened` is a frozen subscribe-only channel and a backlog-eligible family, but Java main has no server emitter for it — the reopen flow emits the `conversation_reopened` audit + state change. Recorded as a stop-and-report finding; frame-emission attribution is WS-ledger work (WS-EVT-002), not an offline test. |
| HP-WS-010 | Heartbeat 60s | covered | `WebSocketHeartbeatIntegrationTest#heartbeatsArrivePeriodicallyWithTheFrozenSystemPayload` + `WebSocketHeartbeatServiceTest#beatBroadcastsTheFrozenHeartbeatSystemEvent` | WS-EVT-013 | |
| EDGE-WS-001 | Reconnect with backlog replay | covered | `WebSocketBacklogReplayIntegrationTest#reconnectionRestoresTheDurableBacklogInOrderThenClearsIt` | WS-BHV-009 | |
| EDGE-WS-002 | Backlog expires after 1h | covered | `WebSocketBacklogReplayIntegrationTest#replayFiltersExpiredRowsOnExpiresAt` | WS-EVT-015 | |
| EDGE-WS-003 | Reconnect backoff curve | covered | `RealtimePropertiesTest#backoffComputationIsDeterministicExponentialGrowthCappedAtMax` | WS-BHV-012..013 | frozen server-side policy; client-side curve display → #461. |
| EDGE-WS-004 | Max reconnection attempts (5) | covered | `RealtimePropertiesTest#policyIsExhaustedAfterMaxAttempts` + `IrcConnectorTest#reconnectGivesUpAfterExactlyFiveAttemptsAndReportsFailed` (connector analogue) | WS-BHV-014 | |
| EDGE-WS-005 | Broadcast to multiple clients | covered | `WebSocketEventPublisherTest#publishToAllReachesEveryConnectedSession` + `WebSocketEventPublisherTest#roomEmissionReachesOnlyRoomMembers` | WS-BHV-002 | |
| EDGE-WS-006 | Typing indicator timeout | covered | `WebSocketTypingServiceTest#typingTimeoutEmitsStoppedToTheRoom` | WS-EVT-009 | |
| EDGE-WS-007 | Duplicate events filtered | covered | `GatewayExchangeTest#duplicateDeliveryOfAnAlreadySentMessageCollapses` | WS-QEV-003 | |
| EDGE-WS-008 | Events buffered during disconnect | covered | `WebSocketEventPublisherTest#roomEmissionStoresBacklogEligibleEventsPerRecipient` + `WebSocketBacklogReplayIntegrationTest#reconnectionRestoresTheDurableBacklogInOrderThenClearsIt` | WS-BHV-009, WS-EVT-015 | |
| EDGE-WS-009 | Connection lost mid-event | covered | `WebSocketEventPublisherTest#sessionEmissionReportsUndeliveredFramesWithoutThrowing` + `WebSocketBacklogReplayIntegrationTest#replaySendFailureRetainsTheUndeliveredRowsInPostgreSQL` | WS-BHV-009, WS-BHV-011 | undelivered frames never break the emitting flow; retention keeps the remainder durable. |
| EDGE-WS-010 | Invalid event type ignored | covered | `YaccWebSocketHandlerTest#unknownEventEmitsSystemErrorToTheFailingSession` | WS-BHV-017 | server answers `system.error` and keeps the session; client display → #461. |
| RBAC-WS-001 | user only receives assigned-conversation events | covered | `WebSocketEventPublisherTest#roomEmissionReachesOnlyRoomMembers` | WS-BHV-002 | ADR-026 rooms are subscription-scoped (`subscribe.conversation` ack); role-based event visibility scoping is not a contract behavior (see RBAC-INBOX-001 note). |
| RBAC-WS-002 | manager receives all events | covered | `WebSocketEventPublisherTest#publishToAllReachesEveryConnectedSession` | WS-BHV-003 | global broadcasts are role-independent by frozen parity (`emitGlobally`). |
| RBAC-WS-003 | admin receives all events | covered | same as RBAC-WS-002 | WS-BHV-003 | |
| RBAC-WS-004 | super_admin receives all events | covered | same as RBAC-WS-002 | WS-BHV-003 | |
| RBAC-WS-005 | notifications only to assigned user | covered | `WebSocketEventPublisherTest#publishToSessionTargetsExactlyOneChannel` + `WebSocketEventPublisherTest#globalEmissionStoresOneBacklogRowPerUserAcrossTheirSessions` | WS-BHV-003, WS-EVT-015 | per-user targeting/backlog scoping proven at the transport. |
| RBAC-WS-006 | presence scoped to organization | not-applicable | — | — | single-tenant deployment; the identity model has no organization dimension (`User`, `Account`). |
| RBAC-WS-007 | unauthorized client rejected | covered | `RealtimeWebSocketIntegrationTest#upgradeWithoutTokenIsRefused` + `WebSocketHandshakeAuthInterceptorTest#missingTokenIsRejectedWith401BeforeAnySessionExists` | WS-BHV-016 | |
| RBAC-WS-008 | invalid token disconnects client | covered | `RealtimeWebSocketIntegrationTest#upgradeWithGarbageTokenIsRefused` + `AsStatusEnforcingAuthorizationServiceTest#hidesGrantWhenOwnerIsSuspended` | WS-BHV-016 | invalid/suspended grants are refused (and never admitted) — reconnect requires fresh auth. |

### 3.7 Integrations: Telegram & IRC (21 enumerated)

| Case | Title | Disposition | Java evidence | Serves | Note |
|---|---|---|---|---|---|
| HP-INT-001 | Telegram message received + stored | covered | `GatewayExchangeFlowIntegrationTest#telegramInboundPersistsConversationMessageAuditAndEmitsReceived` | — | |
| HP-INT-002 | Telegram message sent | covered | `TelegramConnectorTest#sendMessagePostsTheBaselineRequestShapeAndMapsTheResult` + `GatewayExchangeFlowIntegrationTest#sendReturnsFrozen201PendingThenAsyncDispatchDeliversAndEmits` | — | |
| HP-INT-003 | IRC message received | covered | `GatewayExchangeFlowIntegrationTest#ircInboundCarriesTheResolvedProfileIdentityAndCreatesTheConversation` | — | |
| HP-INT-004 | IRC message sent | covered | `IrcConnectorTest#sendMessageDeliversSanitizedPrivmsgWithIrcMessageId` | — | |
| HP-INT-005 | New Telegram group creates conversation | covered | `GatewayExchangeFlowIntegrationTest#telegramInboundPersistsConversationMessageAuditAndEmitsReceived` (find-or-create on `(channel, externalThreadId)`) + `TelegramConnectorTest#intakeNormalizesTextMessageUpdatesAndHandsThemToTheReceiver` | — | |
| HP-INT-006 | New IRC channel creates conversation | covered | `GatewayExchangeFlowIntegrationTest#ircInboundCarriesTheResolvedProfileIdentityAndCreatesTheConversation` | — | |
| HP-INT-007 | Save IRC config (no side effects, no secret echo) | covered | `IrcApiIntegrationTest#configSaveConnect409TestAndStatus` (asserts sanitized response — `doesNotContain` plaintext password) | REST-IRCCONN-001 | |
| HP-INT-008 | Manual IRC connect (retrying, attemptCount 0) | covered | `IrcApiIntegrationTest#configSaveConnect409TestAndStatus` + `IrcConnectionStateTest#manualRetryingKeepsThePreExistingIncidentSemantics` | REST-IRCCONN-002 | |
| HP-INT-009 | Test IRC connection (body-first, sanitized) | covered | `IrcApiIntegrationTest#configSaveConnect409TestAndStatus` | REST-IRCCONN-003 | 10s timeout enforced at the client seam (`IrcProtocolClientTest#silentServerExpiresTheRegistrationDeadline` is the bounded-deadline analogue). |
| EDGE-INT-001 | Telegram timeout → queued retry | covered | `TelegramConnectorTest#sendMessageMapsTransportFailuresToRetryableNetworkErrors` + `GatewayExchangeFlowIntegrationTest#failedDispatchRecordsFailureDlqRetryCycleAndFrames` | WS-QEV-001 | ADR-028: queue = DB DLQ/Quartz. |
| EDGE-INT-002 | IRC connection lost → auto-reconnect | covered | `IrcConnectorTest#reconnectsAfterConnectionLossAndRejoinsOverAFreshSocket` + `IrcConnectorTest#reconnectGivesUpAfterExactlyFiveAttemptsAndReportsFailed` | — | pending outbound messages ride the DB retry cycle (ADR-028), not a connector-local queue. |
| EDGE-INT-003 | Duplicate Telegram webhook deduped | not-applicable | `TelegramConnectorTest#intakeNormalizesTextMessageUpdatesAndHandsThemToTheReceiver` | — | the Java intake is the Bot API `getUpdates` seam (no webhook delivery), so webhook duplicate delivery does not occur on the Java transport; no frozen-ledger row claims inbound external-message-id dedupe parity (conversation find-or-create is deduped on `(channel, externalThreadId)`). |
| EDGE-INT-004 | Malformed webhook payload rejected | covered | `TelegramConnectorTest#intakeRejectsMalformedPayloadsAndUndatedTextMessages` + `GatewayExchangeTest#malformedInboundFailsClosedWithoutAnyPersistence` | — | |
| EDGE-INT-006 | Config save without encryption key → 400 | not-applicable | `EncryptionServiceTest#failsClosedWhenKeyMissing` | REST-IRCCONN-001 | the Java `EncryptionService` is fail-closed at bean construction (ADR-027): a missing master key fails startup, so the request-time `encryption_key_missing` branch is unreachable in the Java target. |
| EDGE-INT-007 | Connect without stored config → 409 | covered | `IrcApiIntegrationTest#configSaveConnect409TestAndStatus` (`irc_not_configured`) | REST-IRCCONN-002 | |
| EDGE-INT-008a | Test unreachable server → sanitized 500 | covered | `IrcApiIntegrationTest#configSaveConnect409TestAndStatus` | REST-IRCCONN-003 | |
| EDGE-INT-008b | Partial test body → 400 validation_error | covered | `IrcApiIntegrationTest#configSaveConnect409TestAndStatus` | REST-IRCCONN-003 | |
| EDGE-INT-008c | Out-of-range port → 400 validation_error | covered | `IrcApiIntegrationTest#configSaveConnect409TestAndStatus` | REST-IRCCONN-003 | |
| RBAC-INT-001 | super_admin manages IRC integrations | deferred | `IrcIntegrationController` carries `@PreAuthorize("hasRole('SUPER_ADMIN')")` on config/connect/test | REST-IRCCONN-001..003 | **→ #457**: role-denial integration evidence for the IRC surface is RBAC-slice scope (seq 30e) — the enforcement annotations exist but the 403s are not integration-asserted yet; adding them here would race #457's parallel RBAC work. |
| RBAC-INT-002 | admin/manager/user cannot save IRC config | deferred | same as RBAC-INT-001 | REST-IRCCONN-001 | **→ #457** (same rationale). |
| RBAC-INT-003 | admin/manager/user cannot connect/test IRC | deferred | same as RBAC-INT-001 | REST-IRCCONN-002/003 | **→ #457** (same rationale). |

### 3.8 Smoke Suite (15)

| Case | Title | Disposition | Java evidence | Serves | Note |
|---|---|---|---|---|---|
| SMOKE-001 | auth → inbox → message cycle | covered | `AuthFlowIntegrationTest#signInReturnsCanonicalSessionContract` + `ConversationSurfaceApiIntegrationTest#listReturnsEnvelopeAndGetByUuid` + `GatewayExchangeFlowIntegrationTest#sendReturnsFrozen201PendingThenAsyncDispatchDeliversAndEmits` | — | composite of proven offline legs (no single browser-flow test — that is #461). |
| SMOKE-002 | Telegram integration end-to-end | covered | `GatewayExchangeFlowIntegrationTest#telegramInboundPersistsConversationMessageAuditAndEmitsReceived` + `GatewayExchangeFlowIntegrationTest#sendReturnsFrozen201PendingThenAsyncDispatchDeliversAndEmits` | — | |
| SMOKE-003 | IRC integration end-to-end | covered | `GatewayExchangeFlowIntegrationTest#ircInboundCarriesTheResolvedProfileIdentityAndCreatesTheConversation` + `IrcConnectorTest#sendMessageDeliversSanitizedPrivmsgWithIrcMessageId` | — | |
| SMOKE-004 | WebSocket real-time notification | covered | `RealtimeWebSocketIntegrationTest#authenticatedUpgradeReceivesEstablishedEventAndConversationAck` + `WebSocketMessageFanOutOrderingIntegrationTest#threeRapidMessageReceivedEventsFanOutInOrderToSubscribedPeers` | WS-RAW-001, WS-EVT-005 | the <1s latency clause is a live-environment measurement (→ #461); frame arrival + ordering proven offline. |
| SMOKE-005 | Failed message retry → success | covered | `QueueRetryWorkerIntegrationTest#successfulRedeliveryClearsTheDlqRowAndCompletesTheCycle` | WS-QEV-001..002 | |
| SMOKE-006 | Role-based access control | covered | `AuthFlowIntegrationTest#rbacMatrixGatesEveryRoleExplicitly` | — | |
| SMOKE-007 | Pagination across list endpoints | covered-by-new-test | `ConversationListQueryApiIntegrationTest#paginationHonorsCustomLimitPageOffsetTotalAndOutOfRangePages` + `MessageApiIntegrationTest#messageListPaginatesInChronologicalOrderAcrossPages` (+ `UsersApiIntegrationTest#superAdminListsUsersWithFrozenEnvelope`) | REST-CONV-001, REST-MSG-001 | |
| SMOKE-008 | Filters work correctly | gap-reported | `ConversationListQueryApiIntegrationTest#filtersByChannelStatusPriorityAssigneeAndTheirCombinations` (channel/assignee halves) | REST-CONV-001 | channel + assignee filters proven; the status/priority halves are **F1**. |
| SMOKE-009 | Error handling 404/400/403/401 | covered | `ConversationSurfaceApiIntegrationTest#listReturnsEnvelopeAndGetByUuid` (404) + `MessageApiIntegrationTest#listUsesFrozenCustomShapeAndSendReturnsDataEnvelope` (400) + `ConversationSurfaceApiIntegrationTest#statusPriorityAssignEnforceRoleMatrixAndAudit` (403) + `AuthFlowIntegrationTest#protectedSurfaceRequiresAToken` (401) | — | |
| SMOKE-010 | DB rollback on failure | covered | `GatewayExchangeFlowIntegrationTest#malformedInboundFailsClosedWithoutAnyRows` | — | fail-closed = no partial persistence (the transactional substance of the rollback clause). |
| SMOKE-011 | Concurrent message sends | deferred | — | — | **→ #461**: multi-threaded API concurrency requires committed-state execution; the API integration harness is deliberately `@Transactional` per test (shared-container conventions), so a concurrent-send smoke is unsound on this harness and belongs to the E2E closure pass's environment. |
| SMOKE-012 | WebSocket + API consistency | covered | `GatewayExchangeFlowIntegrationTest#telegramInboundPersistsConversationMessageAuditAndEmitsReceived` (persisted row + emitted frame from the same committed state) + `ApplicationEventRelayServiceTest#messageSentFansOutTheVerbatimPayload` | WS-EVT-005/006 | |
| SMOKE-013 | Audit logging works | covered | `AuditLogsApiIntegrationTest#managerReadsConversationAuditPage` + `AuditLogsApiIntegrationTest#queryFiltersAndExportDownload` | — | |
| SMOKE-014 | Search works | covered-by-new-test | `ConversationListQueryApiIntegrationTest#searchMatchesBodiesSendersAndThreadIdsCaseInsensitivelyAndReturnsEmptyWithoutMatches` | REST-CONV-001 | |
| SMOKE-015 | Healthy under load (50 msg/min) | not-applicable | — | — | load/soak target is a non-deterministic measurement, excluded from the deterministic offline suite; environment-gated load acceptance belongs to #461. |

---

## Gaps closed by new tests

All new tests are Java-only, on the existing harnesses (`AbstractApiIntegrationTest` Testcontainers/MockMvc; the real-Tomcat raw-WS harness of `RealtimeWebSocketIntegrationTest`), with zero `src/main` change. Each new test names the catalog cases it discharges (no orphan tests):

| # | Test | Harness | Discharges |
|---|---|---|---|
| 1 | `ConversationListQueryApiIntegrationTest#unauthenticatedListIsDeniedWith401` | Testcontainers API | QA-001 TC-001-002; QA-004 RBAC-INBOX-005 |
| 2 | `ConversationListQueryApiIntegrationTest#paginationHonorsCustomLimitPageOffsetTotalAndOutOfRangePages` | Testcontainers API | QA-001 TC-002-001..004; QA-004 HP-INBOX-001, EDGE-INBOX-002, SMOKE-007 |
| 3 | `ConversationListQueryApiIntegrationTest#filtersByChannelStatusPriorityAssigneeAndTheirCombinations` | Testcontainers API | QA-001 TC-003-001/TC-003-004 (+ working AND subset of TC-003-005); QA-004 HP-INBOX-002/HP-INBOX-005 (+ working subset of HP-INBOX-006), EDGE-INBOX-001, RBAC-INBOX-002..004 (status/priority filter rows = finding F1) |
| 4 | `ConversationListQueryApiIntegrationTest#searchMatchesBodiesSendersAndThreadIdsCaseInsensitivelyAndReturnsEmptyWithoutMatches` | Testcontainers API | QA-001 TC-004-001..003; QA-004 SMOKE-014 |
| 5 | `ConversationListQueryApiIntegrationTest#dateRangeBoundsFilterOnLastActivityIncludingSingleSidedRanges` | Testcontainers API | QA-001 TC-005-001..003 |
| 6 | `ConversationListQueryApiIntegrationTest#sortingSupportsLastActivityDefaultCreatedAndPriorityInBothDirections` | Testcontainers API | QA-001 TC-006-001..003 |
| 7 | `ConversationListQueryApiIntegrationTest#invalidQueryParametersAreRejectedWith400` | Testcontainers API | QA-001 TC-011-001..003; QA-004 EDGE-INBOX-003/004/005 |
| 8 | `ConversationListQueryApiIntegrationTest#statusUpdateEdgeCasesValidateTransitionInputAndAllowSameStatus` | Testcontainers API | QA-004 EDGE-CONV-001/002 |
| 9 | `MessageApiIntegrationTest#messageListPaginatesInChronologicalOrderAcrossPages` (additive) | Testcontainers API | QA-001 TC-008-002; QA-004 SMOKE-007 |
| 10 | `MessageApiIntegrationTest#sendRejectsBlankBodyAndUpdatesTheConversationLatestMessageSurface` (additive) | Testcontainers API | QA-001 TC-009-002; QA-004 EDGE-MSG-002 |
| 11 | `MessageApiIntegrationTest#manualRetryOfAMissingMessageReturns404` (additive) | Testcontainers API | QA-004 EDGE-QUEUE-005 |
| 12 | `AuthFlowIntegrationTest#signInRejectsBlankAndMalformedEmailsWithBeanValidation` (additive) | Testcontainers API | QA-004 EDGE-AUTH-003 |
| 13 | `WebSocketMessageFanOutOrderingIntegrationTest#threeRapidMessageReceivedEventsFanOutInOrderToSubscribedPeers` | real-Tomcat raw WS | QA-003 TC-RT-004 (also serves TC-RT-003, TC-RT-026; QA-004 SMOKE-004) |

## Stop-and-report findings / deferred rows

### F1 — Enum-typed list query params reject contract-valid labels (product gap; stop-and-report)

**Affected catalog rows (7):** QA-001 TC-003-002, TC-003-003, TC-003-005; QA-004 HP-INBOX-003, HP-INBOX-004, HP-INBOX-006, SMOKE-008.

**Observed behavior (probed on the real Spring context, `GET /api/conversations` via the context's own `DispatcherServlet`/`ConversionService`):**

- `?status=open` → **400** `{"error":"Validation error"}` · `?status=OPEN` → 200
- `?pending` → 400 · `?priority=high` → **400** · `?priority=HIGH` → 200 · `?status=` (empty) → 200 (absent)

**Why it is a gap:** the frozen OpenAPI contract (`ADR-023`, op `listConversations`) declares `status` as `enum [open, pending, resolved]` and `priority` as `enum [low, normal, high, urgent]` — the lowercase wire labels — and ledger row `REST-CONV-001` records the "identical filter set, validation" target behavior. The Java controller binds `@RequestParam ConversationStatus`/`ConversationPriority` with no case-insensitive converter, so Spring's default `valueOf` enum conversion rejects every contract-valid label. The Node-era POC never had this problem on the *conversation* list because Drizzle compared strings — this is a Java-target wire regression the QA-001 filter rows (previously untested on Java) exposed.

**Adjacent blast radius (same binding pattern, outside this slice's catalogs — for tech-lead awareness):** `GET /api/users?status=active` → 400 and `GET /api/users?role=user` → 400 probe identically; `GET /api/users` filters are not QA-001/003/004 rows and were not asserted here.

**Disposition of this slice:** recorded only — the binding guardrail forbids `src/main` change here. The smallest fix shape (a case-insensitive `Converter<String, ConversationStatus/Priority/UserStatus/UserRole>` or `@Creator`-style binding) is a one-line-per-enum production change that needs tech-lead tasking and fresh REST contract evidence; it is NOT deferred to #459/#460 (ledger attribution cannot fix runtime behavior).

2. **`conversation.reopened` frame has no server emitter (QA-004 HP-WS-009 → deferred #460).** The frozen AsyncAPI channel `conversation.reopened` is subscribe-only (server→client), the event family is backlog-eligible (`WebSocketBacklogService`), and ledger row `WS-EVT-002` records it as "Raw WS event preserving reopen semantics" — but Java `src/main` never emits the frame: the inbound reopen flow (`ConversationIngressService#touchInboundActivity`) emits the `conversation_reopened` audit + status/`last_activity_at` change only. Per the issue guardrail (no `src/main` change; frozen ledger read-only) this is recorded, not fixed. Resolution requires the WS-ledger attribution pass (#460) and, if confirmed, a product decision via tech-lead/strategist.
3. **`notification.received` frame has no server emitter on assignment (QA-004 HP-WS-005 → deferred #460).** Same class as (2): the channel is frozen and subscribe-only; the assignment path persists + notifies over REST (`postAssignmentRequiresManagerPlusAndNotifies`), but no WS frame is emitted. Ledger attribution (#460) owns the row.
4. **RBAC denial evidence for the IRC integration surface (QA-004 RBAC-INT-001..003 → deferred #457).** `IrcIntegrationController` enforces `SUPER_ADMIN` via `@PreAuthorize`, but no integration test asserts the 403s; RBAC parity evidence is #457's owned slice (milestone decomposition seq 30e), and duplicating it here would race that parallel work.
5. **No other product gap was found, fixed, or introduced by this slice.** Findings 2–3 are recorded against ledger-attribution issues; every other catalog row maps to existing or new offline Java evidence, `not-applicable` with a Java-target reason, or an explicitly named owner.

## Deterministic evidence

- Base: `dev` @ `fd9429dbbbcb77fcea2a770b41b86e0092f84967` · recorded head: the single `test(qa): offline QA parity matrix + gap-closure tests (MIG-091d #456)` commit on branch `feat/issue-456` (exact SHA pinned in the PR handover and the issue builder comment — a file cannot contain its own commit hash; the verification below ran on this exact tree).
- Commands and observed results (local, Testcontainers; Docker available):
  - Targeted: `./gradlew --no-daemon test --tests 'com.yacc.api.conversation.ConversationListQueryApiIntegrationTest' --tests 'com.yacc.api.message.MessageApiIntegrationTest' --tests 'com.yacc.api.auth.AuthFlowIntegrationTest' --tests 'com.yacc.api.realtime.WebSocketMessageFanOutOrderingIntegrationTest'` → **BUILD SUCCESSFUL; 29 tests, 0 failures** (ConversationListQueryApiIntegrationTest 8/8, MessageApiIntegrationTest 7/7, AuthFlowIntegrationTest 13/13, WebSocketMessageFanOutOrderingIntegrationTest 1/1).
  - Full gate: `./gradlew --no-daemon check --rerun-tasks` → **BUILD SUCCESSFUL** (all tasks re-executed); `test` task: **96 suites / 574 tests / 0 failures / 0 errors / 0 skipped**; `contractTest`: 4 suites / 28 tests, passing; `jacocoTestCoverageVerification` (≥85%) passed.
- Boundary proof (AC-5), at the recorded head: `git diff --stat origin/dev` = exactly this matrix + the 3 test files + 2 additive test-file edits (5 files, test/doc only); `git diff origin/dev -- services/backend-java/src/main .docs/migration` = **0 lines**.
- Mapping self-check (AC-1), scripted at the recorded head: all **116** cited `Class#method` pairs resolve — 113 in `services/backend-java/src/test`, 3 intentional `src/main` behavior pointers (`ConversationIngressService#touchInboundActivity`, `ConversationRepository#matchesSearch`, `MessageService#send`); 0 missing.
- Mapping counts (211 catalog rows = QA-001 33 + QA-003 26 + QA-004 152): `covered` **140** · `covered-by-new-test` **37** · `not-applicable` **20** · `deferred` **7** (RBAC-AUTH-006 + RBAC-INT-001..003 → #457; HP-WS-005 + HP-WS-009 → #460; SMOKE-011 → #461) · `gap-reported` **7** (finding F1).
- New tests: 13 (1 new 8-method API test class, 1 new 1-method raw-WS test class, 3 additive methods in `MessageApiIntegrationTest`, 1 additive method in `AuthFlowIntegrationTest`) — all on the existing Testcontainers/raw-WS harnesses, no production change, no existing test weakened/renamed/disabled.
