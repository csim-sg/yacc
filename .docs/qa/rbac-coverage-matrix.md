---
doc_id: QA-RBAC-COVERAGE-MATRIX
version: 1.0.0
status: accepted-coverage-evidence (AC-11 / #366 AC-MIG-091-2; child task #457)
head_commit: fd9429dbbbcb77fcea2a770b41b86e0092f84967
binding_contract:
  rest: ".docs/migration/openapi.yaml (v1.0.0-mig-003-canonical) — read-only citation"
  realtime: ".docs/migration/asyncapi.yaml (v1.0.0-mig-003-canonical) — read-only citation"
  ledger: ".docs/migration/ledger-mig-003-reconciled.md (156 rows) — read-only citation"
model_sources:
  - "SPEC-002 §Business Policy (four-role matrix; 2026-10-18 shared-inbox viewing decision)"
  - ".docs/01-product-specification.md §2 + Story 1.3 (locked P0 role matrix)"
  - ".docs/governance/GOV-021-phase2-architecture-decisions.md §2 (Phase-2 RBAC decision)"
  - ".docs/adr/ADR-025-auth-spring-security-dual-role-oidc-bootstrap-recovery.md (4 roles + status enforcement)"
  - ".docs/migration/contract-canonicalization.md §1.4/§1.5/§5 (auth map; role casing; assign split)"
created: 2026-11-06
task: "https://github.com/csim-sg/yacc/issues/457"
---

# RBAC Coverage Matrix (SPEC-002 AC-11)

Role × operation coverage matrix for the Java backend (`services/backend-java`). Every row
is one **frozen contract operation** — the REST row set is the complete
`openapi.yaml` operation list, and the real-time row set is the complete frozen
`asyncapi.yaml` inbound (`publish:`) channel list. Rows are **not** derived from the test
suites; tests are cited as evidence per row. No row was invented and no privileged
operation was dropped.

## 1. Model sources and precedence

The accepted permission model, in precedence order:

1. **Frozen contract (ADR-023, binding):** `openapi.yaml` fixes which operations are
   anonymous (`security: []`) and which require the `bearerAuth` scheme (declared
   explicitly or inherited from the document-level `security:` default). The frozen
   **ledger** (`ledger-mig-003-reconciled.md`, 156 rows) fixes the per-operation target
   behavior, including the baseline RBAC gates (`super_admin only`, `admin+`,
   `manager+`, `any authenticated role`).
2. **SPEC-002 §Business Policy:** the four-role matrix (`SUPER_ADMIN`, `ADMIN`,
   `MANAGER`, `USER`) retains the explicit least-privilege baseline — no role inheritance,
   no implied new permission — and the **founder decision of 2026-10-18** (#367 comment
   `6268859088`) amends the **viewing** scope only: every *active authenticated* identity
   may view all conversation content. `USER` reply/retry stay assignment-bound.
   `inactive`/`suspended` accounts are denied everywhere (ADR-025).
3. **Product spec §2 + Story 1.3 and GOV-021 §2** name the same baseline for inbox,
   reply/retry, tags, notes, assignment, bulk actions, notifications — with one
   exception: routing rules, where these sources conflict with the frozen ledger
   (open dispute recorded below).

**Open conflict (routing-rules access — disputed, pending founder decision).** Two
approved sources disagree on routing-rule access, and no recorded adjudication
resolves the conflict:

- **Option A — keep the frozen ledger (current implementation):** the binding ledger
  rows `REST-RULES-001..005` (captured at baseline `98db628` per MIG-003, the scope
  ceiling per SPEC-002 AC-01/ADR-023) record `manager+` reads and `admin+` writes, and
  the Java implementation matches that. Adopting this reading as the accepted model
  would override the product/governance records below (a product-record amendment).
- **Option B — follow the product record and GOV-021:** the product spec §2 role
  table, §7.6 and Stories 7.1–7.2, and GOV-021 §2 (with GOV-034) specify routing-rule
  CRUD as **Super Admin only**. Adopting this reading would override a frozen
  target-behaviour cell (a founder-authorized ADR-023 amendment to
  `REST-RULES-001..005` plus a bounded authorization change).

Tech-lead has adjudicated this as a genuine conflict between approved records that
neither builder nor tech-lead may settle, and has requested the founder decision
(#457 comment `6678930687`, 2026-11-06). The five `REST-RULES-001..005` rows (§3.8,
rows 37–41) are marked **disputed — pending founder decision**, with both readings
displayed there. This matrix records the conflict without resolving it: no permission
behaviour, test expectation, frozen file, or AC text changes while the decision is
pending (see §8).

**Role naming.** The wire enum is lowercase (`super_admin|admin|manager|user`,
canonicalization §1.1); matrix columns use the Spring authority names
(`SUPER_ADMIN`/`ADMIN`/`MANAGER`/`USER` per ADR-025). No role inheritance exists —
every gate is explicit (`@PreAuthorize` with `hasRole`/`hasAnyRole`, or in-code role
checks where the POC enforced them in-controller).

## 2. Shared axes (apply to every row below)

### 2.1 Anonymous axis

- **Public surface (11 REST ops, rows marked `anon: allow`):** reachable without any
  token: the three health probes, `forgot-password`, `reset-password`, `verify-email`,
  the two OIDC RP entry points, `sign-in/email`, `sign-up/email`, `refresh-token`.
  Evidence: `ObservabilityEndpointsTest#frozenHealthWirePathsRemainAtRoot` (health 200
  unauthenticated), `AuthFlowIntegrationTest#signInReturnsCanonicalSessionContract`,
  `AuthFlowIntegrationTest#signUpCreatesUserRoleOnlyAndIgnoresInjectedRole`,
  `AuthRecoveryFlowIntegrationTest` (forgot/reset/verify-email without a token),
  `OidcLoginIntegrationTest` (authorization + callback without a session),
  `AuthFlowIntegrationTest#refreshRotatesTheGrantAndRetiresThePresentedOne`.
- **Everything else (all remaining REST rows, all WS ops):** `anon: 401` — deny by
  default (`anyRequest().authenticated()`, `AuthSecurityConfig#securityFilterChain`).
  Evidence: `AuthFlowIntegrationTest#protectedSurfaceRequiresAToken` (auth surface),
  `RbacMatrixApiIntegrationTest#anonymousRequestIsDeniedOnTheProtectedBusinessSurface`
  (business surface, same filter chain), `ObservabilityEndpointsTest#prometheusPathIsNotDuplicatedAtRoot`
  (deny-by-default posture), `RealtimeWebSocketIntegrationTest#upgradeWithoutTokenIsRefused` (WS).
- **Force-password-change interplay:** a bootstrap/recovery identity authenticates but is
  denied (403) every non-auth path until the credential is replaced — orthogonal to the
  role matrix (all rows below assume replaced credentials). Evidence:
  `AuthFlowIntegrationTest#bootstrapSuperAdminIsLockedUntilCredentialReplacement`.

### 2.2 Inactive / suspended axis (ADR-025 status enforcement)

One shared seam denies non-`ACTIVE` identities **before any role gate** on every bearer
path: `BearerTokenAuthenticationConverter` → `TokenAuthenticationService#requireActive`
(401 on the REST resource server), the embedded-AS grant seam
(`AsStatusEnforcingAuthorizationService#findByToken` → grants of non-active owners are
invisible → `invalid_grant` on refresh/code exchange), and the raw-WS handshake
(`WebSocketHandshakeAuthInterceptor` → upgrade refused pre-connect, WS-BHV-016).
Consequently the `inactive`/`suspended` cell of **every authenticated REST row** is
`401 deny` and of **every WS op** is `upgrade refused (no session exists)`.

Shared evidence:
- REST seam: `AuthFlowIntegrationTest#suspendedIdentityIsDeniedOnProtectedRest`,
  `AuthFlowIntegrationTest#inactiveIdentityIsDeniedOnProtectedRest` (auth surface),
  `RbacStatusDenialIntegrationTest#suspendedIdentityIsDeniedOnBusinessRestReadAndWrite`,
  `RbacStatusDenialIntegrationTest#inactiveIdentityIsDeniedOnBusinessRestReadAndWrite`
  (business read + write surfaces; also pin the active-USER allow on the same rows),
  `TokenAuthenticationServiceTest` (seam unit level).
- AS seam: `AsStatusEnforcingAuthorizationServiceTest#hidesGrantWhenOwnerIsSuspended`,
  `AsStatusEnforcingAuthorizationServiceTest#hidesGrantWhenOwnerIsInactive`,
  `AsStatusEnforcingAuthorizationServiceTest#hidesGrantWhenOwnerNoLongerExists` (fail-closed).
- Sign-in itself denies non-active identities:
  `AuthFlowIntegrationTest#signInRejectsBadCredentialsAndNonActiveIdentitiesUniformly`.
- WS seam: `WebSocketHandshakeAuthInterceptorTest#inactiveIdentityIsRejectedWith401`,
  `WebSocketHandshakeAuthInterceptorTest#suspendedIdentityIsRejectedWith401` (interceptor
  unit level), `RealtimeWebSocketIntegrationTest#upgradeWithInactiveIdentityTokenIsRefused`,
  `RealtimeWebSocketIntegrationTest#upgradeWithSuspendedIdentityTokenIsRefused` (full
  servlet-container upgrade path).

### 2.3 Cell legend

`A` = allow · `D` = deny · `403` = Spring `AccessDeniedHandler` role denial ·
`401` = unauthenticated/unactive denial · `A*` = conditional allow (condition noted in
the row) · `—` = no identity involved (public probe) · Evidence cites
`Class#method` at head commit `fd9429d`; new evidence classes are marked **(new)**.

## 3. REST matrix (73 frozen operations)

### 3.1 Health probes — public, no identity

| # | Operation | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Evidence |
|---|---|---|---|---|---|---|---|---|
| 1 | `GET /health` (`getHealth`) | A | A | A | A | A | — | `ObservabilityEndpointsTest#frozenHealthWirePathsRemainAtRoot` |
| 2 | `GET /health/live` (`getHealthLive`) | A | A | A | A | A | — | `ObservabilityEndpointsTest#frozenHealthWirePathsRemainAtRoot` |
| 3 | `GET /health/ready` (`getHealthReady`) | A | A | A | A | A | — | `ObservabilityEndpointsTest#frozenHealthWirePathsRemainAtRoot` |

### 3.2 Auth surface — anonymous token/credential flows

| # | Operation | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Evidence |
|---|---|---|---|---|---|---|---|---|
| 4 | `POST /api/auth/forgot-password` (`authForgotPassword`) | A | A | A | A | A (rate-limited) | A (anti-enumeration constant 200; no session) | `AuthRecoveryFlowIntegrationTest` forgot-password flow |
| 5 | `POST /api/auth/reset-password` (`authResetPassword`) | A | A | A | A | A (rate-limited, token-bearing) | A (token-bearing; no bearer session) | `AuthRecoveryFlowIntegrationTest` reset-password flow |
| 6 | `POST /api/auth/verify-email` (`authVerifyEmail`) | A | A | A | A | A (token-bearing) | A (token-bearing; no bearer session) | `AuthRecoveryFlowIntegrationTest` verify-email flow |
| 7 | `GET /api/auth/oidc/authorization/{registrationId}` (`authOidcAuthorization`) | A | A | A | A | A (RP enabled) | A (RP entry point) | `OidcLoginIntegrationTest` authorization step |
| 8 | `GET /api/auth/oidc/callback/{registrationId}` (`authOidcCallback`) | A | A | A | A | A (RP callback) | A (RP callback) | `OidcLoginIntegrationTest` callback step |
| 9 | `POST /api/auth/sign-in/email` (`authSignInEmail`) | A | A | A | A | A (rate-limited) | **D** (non-active denied uniformly) | `AuthFlowIntegrationTest#signInReturnsCanonicalSessionContract`; `AuthFlowIntegrationTest#signInRejectsBadCredentialsAndNonActiveIdentitiesUniformly` |
| 10 | `POST /api/auth/sign-up/email` (`authSignUpEmail`) | A | A | A | A | A → **creates USER only** (§5) | A (creates fresh ACTIVE identity) | `AuthFlowIntegrationTest#signUpCreatesUserRoleOnlyAndIgnoresInjectedRole` |
| 11 | `POST /api/auth/refresh-token` (`authRefreshToken`) | A | A | A | A | A (grant in body) | **D** (`invalid_grant` — AS seam hides the grant) | `AuthFlowIntegrationTest#refreshRotatesTheGrantAndRetiresThePresentedOne`; `AsStatusEnforcingAuthorizationServiceTest#hidesGrantWhenOwnerIsSuspended`; `AsStatusEnforcingAuthorizationServiceTest#hidesGrantWhenOwnerIsInactive` |

### 3.3 Auth surface — bearer session operations (all roles, own session)

| # | Operation | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Evidence |
|---|---|---|---|---|---|---|---|---|
| 12 | `POST /api/auth/sign-out` (`authSignOut`) | A | A | A | A | 401 | 401 | `AuthFlowIntegrationTest#signOutRevokesTheRefreshGrant`; `RbacMatrixApiIntegrationTest#sessionOperationsAllowEveryActiveRole` **(new)** |
| 13 | `GET /api/auth/get-session` (`authGetSession`) | A | A | A | A | 401 | 401 | `AuthFlowIntegrationTest#getSessionResolvesThePresentedAccessToken`; `AuthFlowIntegrationTest#protectedSurfaceRequiresAToken`; `RbacMatrixApiIntegrationTest#sessionOperationsAllowEveryActiveRole` **(new)** |
| 14 | `POST /api/auth/change-password` (`authChangePassword`) | A | A | A | A | 401 | 401 | `AuthFlowIntegrationTest#bootstrapSuperAdminIsLockedUntilCredentialReplacement`; `RbacMatrixApiIntegrationTest#sessionOperationsAllowEveryActiveRole` **(new)** (per-role own-credential change) |

### 3.4 User administration — `super_admin` only (ledger `REST-USER-001..004`)

| # | Operation | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Evidence |
|---|---|---|---|---|---|---|---|---|
| 15 | `GET /api/users` (`listUsers`) | A | 403 | 403 | 403 | 401 | 401 | `UsersApiIntegrationTest#superAdminListsUsersWithFrozenEnvelope`; `UsersApiIntegrationTest#nonSuperAdminDeniedAndRolesReadable`; `RbacMatrixApiIntegrationTest#userAdministrationIsSuperAdminOnly` **(new)** (ADMIN/MANAGER cells) |
| 16 | `POST /api/users` (`createUser`) | A | 403 | 403 | 403 | 401 | 401 | `UsersApiIntegrationTest#createUserThenUpdateThenSoftDelete`; `RbacMatrixApiIntegrationTest#userAdministrationIsSuperAdminOnly` **(new)** |
| 17 | `PUT /api/users/{id}` (`updateUser`) | A | 403 | 403 | 403 | 401 | 401 | `UsersApiIntegrationTest#createUserThenUpdateThenSoftDelete`; `UsersApiIntegrationTest#duplicateEmailConflictsAndSelfModificationForbidden`; `RbacMatrixApiIntegrationTest#userAdministrationIsSuperAdminOnly` **(new)** |
| 18 | `DELETE /api/users/{id}` (`deleteUser`) | A | 403 | 403 | 403 | 401 | 401 | `UsersApiIntegrationTest#createUserThenUpdateThenSoftDelete`; `RbacMatrixApiIntegrationTest#userAdministrationIsSuperAdminOnly` **(new)** |
| 19 | `GET /api/users/roles` (`listUserRoles`) | A | A | A | A | 401 | 401 | `UsersApiIntegrationTest#nonSuperAdminDeniedAndRolesReadable` (USER 200); `RbacMatrixApiIntegrationTest#sessionOperationsAllowEveryActiveRole` **(new)** |

### 3.5 Conversation surface — shared-inbox viewing + privileged writes

**Rows 20–21 and 27–28, 31 encode the 2026-10-18 shared-inbox **viewing** scope (§7).**

| # | Operation | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Evidence |
|---|---|---|---|---|---|---|---|---|
| 20 | `GET /api/conversations` (`listConversations`) | A | A | A | A | 401 | 401 | `ConversationSurfaceApiIntegrationTest#listReturnsEnvelopeAndGetByUuid`; `RbacStatusDenialIntegrationTest#suspendedIdentityIsDeniedOnBusinessRestReadAndWrite` **(new)** (active-USER allow) |
| 21 | `GET /api/conversations/{id}` (`getConversation`) | A | A | A | A | 401 | 401 | `ConversationSurfaceApiIntegrationTest#listReturnsEnvelopeAndGetByUuid`; `RbacMatrixApiIntegrationTest#sharedInboxViewingAllowsEveryActiveRole` **(new)** |
| 22 | `PATCH /api/conversations/{id}/status` (`updateConversationStatus`) | A | A | A | 403 | 401 | 401 | `ConversationSurfaceApiIntegrationTest#statusPriorityAssignEnforceRoleMatrixAndAudit` (USER deny, SA allow); `RbacMatrixApiIntegrationTest#conversationWritesFollowTheRoleMatrix` **(new)** (ADMIN/MANAGER allow) |
| 23 | `PATCH /api/conversations/{id}/priority` (`updateConversationPriority`) | A | A | A | 403 | 401 | 401 | `ConversationSurfaceApiIntegrationTest#statusPriorityAssignEnforceRoleMatrixAndAudit` (MANAGER allow); `RbacMatrixApiIntegrationTest#conversationWritesFollowTheRoleMatrix` **(new)** |
| 24 | `PATCH /api/conversations/{id}/assign` (`assignConversationByPatch`) | A | A | 403 | 403 | 401 | 401 | `ConversationSurfaceApiIntegrationTest#statusPriorityAssignEnforceRoleMatrixAndAudit` (SA allow, MANAGER deny); `RbacMatrixApiIntegrationTest#conversationWritesFollowTheRoleMatrix` **(new)** |
| 25 | `POST /api/conversations/{conversationId}/assign` (`assignConversationByPost`) | A | A | A | 403 | 401 | 401 | `ConversationSurfaceApiIntegrationTest#postAssignmentRequiresManagerPlusAndNotifies` (MANAGER allow, USER deny); `RbacMatrixApiIntegrationTest#conversationWritesFollowTheRoleMatrix` **(new)** |
| 26 | `POST /api/conversations/bulk` (`bulkActionConversations`) | A | A | A | 403 | 401 | 401 | `ConversationSurfaceApiIntegrationTest#bulkActionReportsPartialSuccess` (SA allow, USER deny); `RbacMatrixApiIntegrationTest#conversationWritesFollowTheRoleMatrix` **(new)** |

### 3.6 Message surface — viewing open; reply/retry assignment-bound for `USER`

| # | Operation | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Evidence |
|---|---|---|---|---|---|---|---|---|
| 27 | `GET /api/conversations/{conversationId}/messages` (`getConversationMessages`) | A | A | A | A | 401 | 401 | `MessageApiIntegrationTest#listUsesFrozenCustomShapeAndSendReturnsDataEnvelope`; `RbacMatrixApiIntegrationTest#sharedInboxViewingAllowsEveryActiveRole` **(new)** |
| 28 | `POST /api/conversations/{conversationId}/messages` (`sendConversationMessage`) | A | A | A | A* (assigned only; 403 when unassigned) | 401 | 401 | `MessageApiIntegrationTest#sendRequiresAssignmentForUserRole` (all four roles, both USER variants, 404 precedence) |
| 29 | `POST /api/conversations/{conversationId}/messages/{messageId}/retry` (`retryConversationMessage`) | A | A | A | A* (assigned only; 403 when unassigned) | 401 | 401 | `MessageApiIntegrationTest#retryIsOnceOnlyAndRequiresAssignmentForUserRole` (USER assigned/unassigned, SA passes); `RbacMatrixApiIntegrationTest#privilegedRolesPassTheReplyAndRetryGates` **(new)** (ADMIN/MANAGER cells) |
| 30 | `GET /api/conversations/{conversationId}/messages/{messageId}/status` (`getConversationMessageStatus`) | A | A | A | A | 401 | 401 | `MessageApiIntegrationTest#statusLookupAndMissingConversation`; `RbacMatrixApiIntegrationTest#sharedInboxViewingAllowsEveryActiveRole` **(new)** |

### 3.7 Notes + tags — all roles (GOV-021 §2); tag links additionally resource-scoped

| # | Operation | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Evidence |
|---|---|---|---|---|---|---|---|---|
| 31 | `GET /api/conversations/{conversationId}/notes` (`listConversationNotes`) | A | A | A | A | 401 | 401 | `NoteApiIntegrationTest#createNoteParsesMentionsAndListsPaginated`; `RbacMatrixApiIntegrationTest#sharedInboxViewingAllowsEveryActiveRole` **(new)** |
| 32 | `POST /api/conversations/{conversationId}/notes` (`createConversationNote`) | A | A | A | A | 401 | 401 | `NoteApiIntegrationTest#createNoteParsesMentionsAndListsPaginated` (USER creates); `RbacMatrixApiIntegrationTest#privilegedRolesPassTheReplyAndRetryGates` **(new)** |
| 33 | `GET /api/tags` (`listTags`) | A | A | A | A | 401 | 401 | `TagApiIntegrationTest#createListAndLinkUnlinkWithTagAccessControl` (USER reads); `RbacMatrixApiIntegrationTest#sharedInboxViewingAllowsEveryActiveRole` **(new)** |
| 34 | `POST /api/tags` (`createTag`) | A | A | A | A | 401 | 401 | `TagApiIntegrationTest#createListAndLinkUnlinkWithTagAccessControl` (USER creates); `RbacMatrixApiIntegrationTest#privilegedRolesPassTheReplyAndRetryGates` **(new)** |
| 35 | `POST /api/conversations/{id}/tags` (`addTagToConversation`) | A | A | A | A* (resource access: privileged always, USER if assigned) | 401 | 401 | `TagApiIntegrationTest#createListAndLinkUnlinkWithTagAccessControl` (USER assigned/unassigned variants); `RbacMatrixApiIntegrationTest#privilegedRolesPassTheReplyAndRetryGates` **(new)** (privileged cells) |
| 36 | `DELETE /api/conversations/{id}/tags/{tagId}` (`removeTagFromConversation`) | A | A | A | A* (same resource rule) | 401 | 401 | `TagApiIntegrationTest#createListAndLinkUnlinkWithTagAccessControl`; `RbacMatrixApiIntegrationTest#privilegedRolesPassTheReplyAndRetryGates` **(new)** |

### 3.8 Routing rules — disputed — pending founder decision (ledger `REST-RULES-001..005`)

**Status: all five rows `disputed — pending founder decision`** (#457 decision request,
comment `6678930687`, 2026-11-06 — open conflict between the frozen ledger and the
product/governance records, §1). The role cells below are the **current implementation
behaviour**, which matches the frozen ledger's reading (Option A); the alternative
reading (Option B — Super Admin only) is displayed in the table beneath so both
readings stay visible. This matrix changes no permission.

| # | Operation | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| 37 | `GET /api/routing-rules` (`listRoutingRules`) | A | A | A | 403 | 401 | 401 | `RoutingRulesApiIntegrationTest#crudLifecycleWithRbacAndLenientJson` (MANAGER allow); `RbacMatrixApiIntegrationTest#routingRulesAreManagerReadAdminWrite` **(new)** | disputed — pending founder decision |
| 38 | `POST /api/routing-rules` (`createRoutingRule`) | A | A | 403 | 403 | 401 | 401 | `RoutingRulesApiIntegrationTest#crudLifecycleWithRbacAndLenientJson` (ADMIN allow, MANAGER deny); `RbacMatrixApiIntegrationTest#routingRulesAreManagerReadAdminWrite` **(new)** | disputed — pending founder decision |
| 39 | `PATCH /api/routing-rules/{id}` (`updateRoutingRule`) | A | A | 403 | 403 | 401 | 401 | `RoutingRulesApiIntegrationTest#crudLifecycleWithRbacAndLenientJson` (ADMIN allow); `RbacMatrixApiIntegrationTest#routingRulesAreManagerReadAdminWrite` **(new)** | disputed — pending founder decision |
| 40 | `DELETE /api/routing-rules/{id}` (`deleteRoutingRule`) | A | A | 403 | 403 | 401 | 401 | `RoutingRulesApiIntegrationTest#crudLifecycleWithRbacAndLenientJson` (ADMIN allow); `RbacMatrixApiIntegrationTest#routingRulesAreManagerReadAdminWrite` **(new)** | disputed — pending founder decision |
| 41 | `GET /api/routing-rules/{id}/executions` (`getRoutingRuleExecutions`) | A | A | A | 403 | 401 | 401 | `RoutingRulesApiIntegrationTest#crudLifecycleWithRbacAndLenientJson` (MANAGER allow); `RbacMatrixApiIntegrationTest#routingRulesAreManagerReadAdminWrite` **(new)** | disputed — pending founder decision |

**Both readings (rows 37–41).** `SUPER_ADMIN = A` and `USER = 403` are common to both
readings; the anonymous and inactive/suspended cells are unchanged by both; the
readings differ only on the ADMIN/MANAGER cells:

| # | Operation | Option A — frozen ledger `REST-RULES-001..005` (current implementation; cells above) | Option B — product spec §2/§7.6 + Stories 7.1–7.2 + GOV-021 §2 (`Super Admin only`) |
|---|---|---|---|
| 37 | `GET /api/routing-rules` | manager+ read — ADMIN `A`, MANAGER `A` | ADMIN `403`, MANAGER `403` |
| 38 | `POST /api/routing-rules` | admin+ write — ADMIN `A`, MANAGER `403` | ADMIN `403`, MANAGER `403` |
| 39 | `PATCH /api/routing-rules/{id}` | admin+ write — ADMIN `A`, MANAGER `403` | ADMIN `403`, MANAGER `403` |
| 40 | `DELETE /api/routing-rules/{id}` | admin+ write — ADMIN `A`, MANAGER `403` | ADMIN `403`, MANAGER `403` |
| 41 | `GET /api/routing-rules/{id}/executions` | manager+ read — ADMIN `A`, MANAGER `A` | ADMIN `403`, MANAGER `403` |

This matrix adopts neither reading; the founder decision (#457 comment `6678930687`)
will select one. AC-MIG-091-2 coverage stays unproven for these five rows until the
decision lands.

### 3.9 Notifications — every role, own scope (ledger `REST-NOTIF-001..004`)

| # | Operation | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Evidence |
|---|---|---|---|---|---|---|---|---|
| 42 | `GET /api/notifications` (`listNotifications`) | A | A | A | A | 401 | 401 | `RbacMatrixApiIntegrationTest#notificationOperationsAreOwnScopeForEveryRole` **(new)** |
| 43 | `PATCH /api/notifications/{id}` (`markNotificationRead`) | A | A | A | A | 401 | 401 | `RbacMatrixApiIntegrationTest#notificationOperationsAreOwnScopeForEveryRole` **(new)** |
| 44 | `DELETE /api/notifications/{id}` (`dismissNotification`) | A | A | A | A | 401 | 401 | `RbacMatrixApiIntegrationTest#notificationOperationsAreOwnScopeForEveryRole` **(new)** |
| 45 | `POST /api/notifications/mark-all-read` (`markAllNotificationsRead`) | A | A | A | A | 401 | 401 | `RbacMatrixApiIntegrationTest#notificationOperationsAreOwnScopeForEveryRole` **(new)** |

### 3.10 Audit — manager+ reads, admin+ export (ledger `REST-AUDIT-001`, `REST-AUDITLOG-001..003`)

| # | Operation | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Evidence |
|---|---|---|---|---|---|---|---|---|
| 46 | `GET /api/conversations/{conversationId}/audit-logs` (`getConversationAuditLogs`) | A | A | A | 403 | 401 | 401 | `AuditLogsApiIntegrationTest#managerReadsConversationAuditPage` (MANAGER allow, USER deny); `RbacMatrixApiIntegrationTest#auditSurfaceIsManagerReadAdminExport` **(new)** |
| 47 | `GET /api/audit-logs` (`queryAuditLogs`) | A | A | A | 403 | 401 | 401 | `AuditLogsApiIntegrationTest#queryFiltersAndExportDownload` (MANAGER allow); `RbacMatrixApiIntegrationTest#auditSurfaceIsManagerReadAdminExport` **(new)** |
| 48 | `GET /api/audit-logs/conversations/{conversationId}` (`queryConversationAuditLogs`) | A | A | A | 403 | 401 | 401 | `AuditLogsApiIntegrationTest#queryFiltersAndExportDownload` (MANAGER allow); `RbacMatrixApiIntegrationTest#auditSurfaceIsManagerReadAdminExport` **(new)** |
| 49 | `POST /api/audit-logs/export` (`exportAuditLogs`) | A | A | 403 | 403 | 401 | 401 | `AuditLogsApiIntegrationTest#queryFiltersAndExportDownload` (MANAGER deny, ADMIN allow); `RbacMatrixApiIntegrationTest#auditSurfaceIsManagerReadAdminExport` **(new)** |

### 3.11 DLQ — manager+ reads, admin+ re-queue, `super_admin` delete (ledger `REST-DLQ-001..004`)

| # | Operation | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Evidence |
|---|---|---|---|---|---|---|---|---|
| 50 | `GET /api/dlq` (`listDlqEntries`) | A | A | A | 403 | 401 | 401 | `DlqQueueApiIntegrationTest#listStatsReQueueAndRemoveFollowRoleMatrix` (MANAGER allow); `RbacMatrixApiIntegrationTest#dlqSurfaceFollowsTheRoleMatrix` **(new)** |
| 51 | `GET /api/dlq/stats` (`getDlqStats`) | A | A | A | 403 | 401 | 401 | `DlqQueueApiIntegrationTest#listStatsReQueueAndRemoveFollowRoleMatrix` (MANAGER allow); `RbacMatrixApiIntegrationTest#dlqSurfaceFollowsTheRoleMatrix` **(new)** |
| 52 | `POST /api/dlq/{id}/re-queue` (`reQueueDlqEntry`) | A | A | 403 | 403 | 401 | 401 | `DlqQueueApiIntegrationTest#listStatsReQueueAndRemoveFollowRoleMatrix` (MANAGER deny, SA allow); `RbacMatrixApiIntegrationTest#dlqSurfaceFollowsTheRoleMatrix` **(new)** |
| 53 | `DELETE /api/dlq/{id}` (`removeDlqEntry`) | A | 403 | 403 | 403 | 401 | 401 | `DlqQueueApiIntegrationTest#listStatsReQueueAndRemoveFollowRoleMatrix` (MANAGER deny, SA allow); `RbacMatrixApiIntegrationTest#dlqSurfaceFollowsTheRoleMatrix` **(new)** |

### 3.12 Queue — manager+ reads/retries, `super_admin` clear (ledger `REST-QUEUE-001..008`)

| # | Operation | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Evidence |
|---|---|---|---|---|---|---|---|---|
| 54 | `GET /api/queue/stats` (`getQueueStats`) | A | A | A | 403 | 401 | 401 | `DlqQueueApiIntegrationTest#queueSurfaceStatsRetryBulkAndByReason` (MANAGER allow); `RbacMatrixApiIntegrationTest#queueSurfaceFollowsTheRoleMatrix` **(new)** |
| 55 | `GET /api/queue/dlq` (`getQueueDlqEntries`) | A | A | A | 403 | 401 | 401 | `DlqQueueApiIntegrationTest#queueSurfaceStatsRetryBulkAndByReason` (MANAGER allow); `RbacMatrixApiIntegrationTest#queueSurfaceFollowsTheRoleMatrix` **(new)** |
| 56 | `POST /api/queue/retry/{messageId}` (`retryQueuedMessage`) | A | A | A | 403 | 401 | 401 | `DlqQueueApiIntegrationTest#queueSurfaceStatsRetryBulkAndByReason` (MANAGER allow); `RbacMatrixApiIntegrationTest#queueSurfaceFollowsTheRoleMatrix` **(new)** |
| 57 | `POST /api/queue/dlq/retry` (`bulkRetryDlq`) | A | A | A | 403 | 401 | 401 | `DlqQueueApiIntegrationTest#queueSurfaceStatsRetryBulkAndByReason` (MANAGER allow); `RbacMatrixApiIntegrationTest#queueSurfaceFollowsTheRoleMatrix` **(new)** |
| 58 | `GET /api/queue/dlq/stats` (`getQueueDlqStats`) | A | A | A | 403 | 401 | 401 | `DlqQueueApiIntegrationTest#queueSurfaceStatsRetryBulkAndByReason` (MANAGER allow); `RbacMatrixApiIntegrationTest#queueSurfaceFollowsTheRoleMatrix` **(new)** |
| 59 | `GET /api/queue/job/{jobId}` (`getQueueJob`) | A | A | A | 403 | 401 | 401 | `DlqQueueApiIntegrationTest#queueSurfaceStatsRetryBulkAndByReason` (MANAGER allow); `RbacMatrixApiIntegrationTest#queueSurfaceFollowsTheRoleMatrix` **(new)** |
| 60 | `POST /api/queue/dlq/clear/{messageId}` (`clearQueueDlqEntry`) | A | 403 | 403 | 403 | 401 | 401 | `DlqQueueApiIntegrationTest#queueSurfaceStatsRetryBulkAndByReason` (MANAGER deny, SA allow); `RbacMatrixApiIntegrationTest#queueSurfaceFollowsTheRoleMatrix` **(new)** |
| 61 | `GET /api/queue/dlq/by-reason/{reason}` (`getQueueDlqByReason`) | A | A | A | 403 | 401 | 401 | `DlqQueueApiIntegrationTest#queueSurfaceStatsRetryBulkAndByReason` (MANAGER allow); `RbacMatrixApiIntegrationTest#queueSurfaceFollowsTheRoleMatrix` **(new)** |

### 3.13 IRC integration — `super_admin` control plane, admin+ status, manager+ profile reads (ledger `REST-IRCCONN-001..004`, `REST-IRCPROF-001..008`)

For the two `test` endpoints (rows 64, 73) the `super_admin` allow cell asserts the role
gate passed (the deep outcome depends on external IRC connectivity and stays pinned by
`IrcApiIntegrationTest`). For row 63 (`connect`) the `super_admin` allow cell and the
connection-state lifecycle stay pinned by `IrcApiIntegrationTest` — the new walk asserts
only the deny cells there, because `IrcConnectionState` is an in-memory singleton shared
across the whole test context and an allowed `connect` inside the walk would leak
`retrying` state into the existing suite's `disconnected` assertion.

| # | Operation | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Evidence |
|---|---|---|---|---|---|---|---|---|
| 62 | `POST /api/integrations/irc/config` (`saveIrcConfig`) | A | 403 | 403 | 403 | 401 | 401 | `IrcApiIntegrationTest#configSaveConnect409TestAndStatus` (SA allow); `RbacMatrixApiIntegrationTest#ircControlPlaneIsSuperAdminOnly` **(new)** |
| 63 | `POST /api/integrations/irc/connect` (`connectIrc`) | A | 403 | 403 | 403 | 401 | 401 | `IrcApiIntegrationTest#configSaveConnect409TestAndStatus` (SA allow + state lifecycle); `RbacMatrixApiIntegrationTest#ircControlPlaneIsSuperAdminOnly` **(new)** (A/M/U deny cells) |
| 64 | `POST /api/integrations/irc/test` (`testIrcConnection`) | A | 403 | 403 | 403 | 401 | 401 | `IrcApiIntegrationTest#configSaveConnect409TestAndStatus` (SA gate-pass with 400 body validation); `RbacMatrixApiIntegrationTest#ircControlPlaneIsSuperAdminOnly` **(new)** (A/M/U deny cells) |
| 65 | `GET /api/integrations/irc/status` (`getIrcStatus`) | A | A | 403 | 403 | 401 | 401 | `IrcApiIntegrationTest#configSaveConnect409TestAndStatus` (ADMIN allow); `RbacMatrixApiIntegrationTest#ircControlPlaneIsSuperAdminOnly` **(new)** |
| 66 | `POST /api/integrations/irc/profiles` (`createIrcProfile`) | A | 403 | 403 | 403 | 401 | 401 | `IrcApiIntegrationTest#profileLifecycleWithSingleActivePolicy` (SA allow); `RbacMatrixApiIntegrationTest#ircProfilesAreSuperAdminWriteManagerRead` **(new)** |
| 67 | `GET /api/integrations/irc/profiles` (`listIrcProfiles`) | A | A | A | 403 | 401 | 401 | `IrcApiIntegrationTest#profileLifecycleWithSingleActivePolicy` (ADMIN allow); `RbacMatrixApiIntegrationTest#ircProfilesAreSuperAdminWriteManagerRead` **(new)** |
| 68 | `GET /api/integrations/irc/profiles/{id}` (`getIrcProfile`) | A | A | A | 403 | 401 | 401 | `IrcApiIntegrationTest#profileLifecycleWithSingleActivePolicy`; `RbacMatrixApiIntegrationTest#ircProfilesAreSuperAdminWriteManagerRead` **(new)** |
| 69 | `PUT /api/integrations/irc/profiles/{id}` (`updateIrcProfile`) | A | 403 | 403 | 403 | 401 | 401 | `IrcApiIntegrationTest#profileLifecycleWithSingleActivePolicy` (SA allow); `RbacMatrixApiIntegrationTest#ircProfilesAreSuperAdminWriteManagerRead` **(new)** |
| 70 | `POST /api/integrations/irc/profiles/{id}/activate` (`activateIrcProfile`) | A | 403 | 403 | 403 | 401 | 401 | `IrcApiIntegrationTest#profileLifecycleWithSingleActivePolicy` (SA allow); `RbacMatrixApiIntegrationTest#ircProfilesAreSuperAdminWriteManagerRead` **(new)** |
| 71 | `POST /api/integrations/irc/profiles/{id}/disable` (`disableIrcProfile`) | A | 403 | 403 | 403 | 401 | 401 | `IrcApiIntegrationTest#profileLifecycleWithSingleActivePolicy` (SA allow); `RbacMatrixApiIntegrationTest#ircProfilesAreSuperAdminWriteManagerRead` **(new)** |
| 72 | `DELETE /api/integrations/irc/profiles/{id}` (`deleteIrcProfile`) | A | 403 | 403 | 403 | 401 | 401 | `IrcApiIntegrationTest#profileLifecycleWithSingleActivePolicy` (SA lifecycle); `RbacMatrixApiIntegrationTest#ircProfilesAreSuperAdminWriteManagerRead` **(new)** |
| 73 | `POST /api/integrations/irc/profiles/{id}/test` (`testIrcProfileConnection`) | A | 403 | 403 | 403 | 401 | 401 | `IrcApiIntegrationTest#profileLifecycleWithSingleActivePolicy` (SA allow); `RbacMatrixApiIntegrationTest#ircProfilesAreSuperAdminWriteManagerRead` **(new)** |

## 4. Real-time matrix — 27 frozen inbound (`publish:`) channels

**Accepted model (ledger `WS-BHV-016` + ADR-026 + handler parity):** authorization on the
raw-WS surface is enforced **at the handshake** — a valid access token of an `ACTIVE`
identity is required; `inactive`/`suspended`/anonymous upgrades are refused before any
session exists. After the handshake, every frozen inbound op is available to every
active role in all four columns — the baseline socket controllers carry no per-op role
gate (ledger `WS-OP-*` rows record no role requirement), and the Java handler
(`YaccWebSocketHandler#handleTextMessage`) mirrors that exactly. Room scoping
(`conversation:{id}`, `connector:{platform}`, `user:{userId}`) bounds event delivery but
is not a role gate.

| Inbound op (`publish:` channel) | SUPER_ADMIN | ADMIN | MANAGER | USER | anonymous | inactive/suspended | Op-behavior evidence (handshake evidence shared, §2) |
|---|---|---|---|---|---|---|---|
| `connection` (on-connect join + established) | A | A | A | A | refused | refused | `RealtimeWebSocketIntegrationTest#authenticatedUpgradeReceivesEstablishedEventAndConversationAck`; `YaccWebSocketHandlerTest` |
| `subscribe.conversation` | A | A | A | A | refused | refused | `RealtimeWebSocketIntegrationTest#authenticatedUpgradeReceivesEstablishedEventAndConversationAck`; `YaccWebSocketHandlerTest` |
| `unsubscribe.conversation` | A | A | A | A | refused | refused | `YaccWebSocketHandlerTest`; `WebSocketSessionRegistryTest` |
| `conversation.updated` (relay) | A | A | A | A | refused | refused | `ApplicationEventRelayServiceTest` |
| `message.sent` (relay) | A | A | A | A | refused | refused | `ApplicationEventRelayServiceTest` |
| `message.failed` (relay) | A | A | A | A | refused | refused | `ApplicationEventRelayServiceTest` |
| `message.retry` (relay; ack + started) | A | A | A | A | refused | refused | `ApplicationEventRelayServiceTest` |
| `message.received.ack` (relay) | A | A | A | A | refused | refused | `ApplicationEventRelayServiceTest` |
| `reaction.added` | A | A | A | A | refused | refused | `ApplicationEventRelayServiceTest`; `YaccWebSocketHandlerTest` |
| `reaction.removed` | A | A | A | A | refused | refused | `ApplicationEventRelayServiceTest` |
| `reaction.list` | A | A | A | A | refused | refused | `ApplicationEventRelayServiceTest` |
| `reaction.count` | A | A | A | A | refused | refused | `YaccWebSocketHandlerTest#reactionCountFansOutTheRegeneratedCountPayloadExceptTheSender` (+ #444 bad-frame pins); `ApplicationEventRelayServiceTest` |
| `presence.updated` | A | A | A | A | refused | refused | `WebSocketPresenceTypingIntegrationTest`; `WebSocketPresenceServiceTest` |
| `user.online` | A | A | A | A | refused | refused | `WebSocketPresenceTypingIntegrationTest`; `WebSocketPresenceServiceTest` |
| `user.offline` | A | A | A | A | refused | refused | `WebSocketPresenceServiceTest` (disconnect broadcast parity) |
| `user.status` | A | A | A | A | refused | refused | `WebSocketPresenceTypingIntegrationTest` |
| `request.online.users` | A | A | A | A | refused | refused | `WebSocketPresenceServiceTest` |
| `typing.started` | A | A | A | A | refused | refused | `WebSocketPresenceTypingIntegrationTest`; `WebSocketTypingServiceTest` |
| `typing.stopped` | A | A | A | A | refused | refused | `WebSocketPresenceTypingIntegrationTest`; `WebSocketTypingServiceTest` |
| `typing.timeout` | A | A | A | A | refused | refused | `WebSocketTypingServiceTest` (server-side timeout path) |
| `typing.heartbeat` | A | A | A | A | refused | refused | `WebSocketTypingServiceTest` |
| `connector.subscribe` | A | A | A | A | refused | refused | `ConnectorRealtimeBridgeIntegrationTest`; `YaccWebSocketHandlerTest` |
| `connector.unsubscribe` | A | A | A | A | refused | refused | `ConnectorRealtimeBridgeIntegrationTest` |
| `connector.message.received` | A | A | A | A | refused | refused | `ConnectorRelayService` via `ConnectorRealtimeBridgeIntegrationTest`; `GatewayExchangeFlowIntegrationTest` |
| `connector.status.changed` | A | A | A | A | refused | refused | `ConnectorRealtimeBridgeIntegrationTest` |
| `connector.message.error` | A | A | A | A | refused | refused | `ConnectorRealtimeBridgeIntegrationTest` |
| `connector.message.ack` | A | A | A | A | refused | refused | `ConnectorRealtimeBridgeIntegrationTest` |

Shared handshake evidence for every row's `anonymous`/`inactive`/`suspended` cells:
`RealtimeWebSocketIntegrationTest#upgradeWithoutTokenIsRefused`,
`RealtimeWebSocketIntegrationTest#upgradeWithGarbageTokenIsRefused`,
`RealtimeWebSocketIntegrationTest#upgradeWithInactiveIdentityTokenIsRefused`,
`RealtimeWebSocketIntegrationTest#upgradeWithSuspendedIdentityTokenIsRefused` **(new)**,
`WebSocketHandshakeAuthInterceptorTest#missingTokenIsRejectedWith401BeforeAnySessionExists`,
`WebSocketHandshakeAuthInterceptorTest#blankTokenIsRejectedWith401`,
`WebSocketHandshakeAuthInterceptorTest#invalidSignatureOrExpiredTokenIsRejectedWith401`,
`WebSocketHandshakeAuthInterceptorTest#inactiveIdentityIsRejectedWith401`,
`WebSocketHandshakeAuthInterceptorTest#suspendedIdentityIsRejectedWith401`.
All-four-roles admit proof: `RealtimeWebSocketIntegrationTest#upgradeAdmitsEveryActiveRole` **(new)**.

Outbound (`subscribe:`) channels are emission-side behavior, not authorization surface —
they carry no client-supplied credential and are out of the RBAC matrix's row set by
construction (the 59 outbound ops remain covered by the MIG-050/051/062 contract tests).

## 5. Self-registration creates `USER` only (AC-MIG-091-2 / AC-11)

`POST /api/auth/sign-up/email` has no role field in the frozen request contract
(canonicalization §1.4: "Self-registration → creates `USER` only … no role field
accepted") and the response `user.role` is always `user` (§1.5). Role-smuggling attempts
are inert: unknown body members are ignored by bean validation.

Evidence: `AuthFlowIntegrationTest#signUpCreatesUserRoleOnlyAndIgnoresInjectedRole` —
posts a body smuggling `"role":"super_admin"` (and `"status"`), asserts the wire response
`user.role = user`, and asserts the **persisted** entity role is `USER` (persistence-level
proof, not just the DTO). No escalation path exists from the request body.

## 6. Status denial summary (AC-11)

- **Sign-in** of an `inactive`/`suspended` identity is denied identically to bad
  credentials (no oracle): `AuthFlowIntegrationTest#signInRejectsBadCredentialsAndNonActiveIdentitiesUniformly`.
- **Already-issued access tokens** stop working on the next request (REST read *and*
  write surfaces): §2.2 evidence, including
  `RbacStatusDenialIntegrationTest#suspendedIdentityIsDeniedOnBusinessRestReadAndWrite` **(new)**
  and `RbacStatusDenialIntegrationTest#inactiveIdentityIsDeniedOnBusinessRestReadAndWrite` **(new)**
  — denial (401) fires **before** any role gate on
  `GET /api/conversations` (read) and `POST /api/tags` (write).
- **Refresh grants** of non-active owners are invisible (refresh/code exchange →
  `invalid_grant`): `AsStatusEnforcingAuthorizationServiceTest` (§2.2).
- **WS**: upgrades with inactive/suspended tokens are refused pre-connect, so no WS op is
  reachable at all: §4 shared handshake evidence.

## 7. The 2026-10-18 shared-inbox viewing scope (founder decision #367 comment 6268859088)

**Decision:** every **active authenticated** identity — all four roles, including
self-registered/OIDC-first-login `USER` accounts — may **view** all conversation content
(messages, message status, notes) of every conversation: assigned, unassigned, or
assigned to another user. `USER` **reply/retry remain assignment-bound**. `inactive`/
`suspended` denial is unchanged. **No other permission changed.**

**Rows that encode it** (allow-for-all-four-roles viewing rows):

| Matrix rows | Operation family |
|---|---|
| 20, 21 | `GET /api/conversations`, `GET /api/conversations/{id}` (list + detail) |
| 27, 30 | `GET .../messages`, `GET .../messages/{messageId}/status` (message content + delivery status) |
| 31 | `GET /api/conversations/{conversationId}/notes` (notes viewing) |

The write rows adjacent to the viewing rows are **unchanged** by the decision and stay
role-gated as before: reply/retry (28, 29 — `USER` assignment-bound), status/priority/
assignment/bulk (22–26), tag links (35, 36 — resource-scoped), notes creation (32 —
all roles per GOV-021, pre-existing), routing rules/audit/DLQ/queue/IRC (37–73). The
matrix states explicitly that **no other permission changed**: every non-viewing row's
cells match the frozen ledger target behavior verbatim, and the only role-cell difference
from the pre-decision baseline is the **USER allow on the five viewing rows above**
(previously assignment-restricted reads; the founder decision removed that restriction
for reads only).

Implementation surface of the decision: `ConversationsController` list/get,
`MessageController#list`/`#status`, `NotesController#list` carry no role gate (any
authenticated identity passes) while the write paths keep their gates
(`MessageController#send`/`#retry` assignment guard, `ConversationsController` `@PreAuthorize`).
Evidence: `RbacStatusDenialIntegrationTest` **(new)** (active-USER 200 on the viewing read),
`RbacMatrixApiIntegrationTest#sharedInboxViewingAllowsEveryActiveRole` **(new)**
(all four roles on the viewing rows incl. foreign-assignee and unassigned fixtures),
against `MessageApiIntegrationTest#sendRequiresAssignmentForUserRole` (assignment-bound
writes still enforced for the same identity).

## 8. Matrix ↔ implementation cross-check (one open dispute — routing rules)

Derivation order: frozen `openapi.yaml` (row set + anonymous/bearer) → frozen ledger
target behavior (role gates) → model docs (§1). Each row's accepted cells were checked
against the implementation (`@PreAuthorize` annotations, in-code role guards,
`AuthSecurityConfig` permit-all list, `WebSocketHandshakeAuthInterceptor`,
`YaccWebSocketHandler` switch).

**Stop-and-report status: one open item — the routing-rules source conflict (§1, §3.8).**
Rows 37–41 match the Java implementation and their binding frozen source
(`REST-RULES-001..005`) exactly, but the accepted product/governance records (product
spec §2 role table, §7.6, Stories 7.1–7.2, GOV-021 §2, GOV-034) specify **Super Admin
only**, and no recorded adjudication resolves which approved source controls. That is
an **open inter-document conflict, not a matrix↔implementation mismatch** — the
implementation matches its frozen source; the conflict is over which source is
authoritative. Per tech-lead's adjudication, the five `REST-RULES-001..005` rows are
**disputed — pending founder decision** (#457 comment `6678930687`, 2026-11-06) and
AC-MIG-091-2 coverage stays unproven for them until the decision lands. **All other
rows: zero discrepancies found.**

## 9. Coverage self-check and counts

- REST rows: **73** (11 anonymous public, 3 explicit-bearer auth ops, 59 inheriting the
  document-level bearer default) — matches the frozen `openapi.yaml` operation count
  (verified by enumerating `paths` at head `fd9429d`).
- WS inbound rows: **27** — the complete frozen `asyncapi.yaml` `publish:` channel set,
  each mapped to a implemented `YaccWebSocketHandler` case or the on-connect path.
- Evidence citations: every row cites at least one `Class#method` that exists at head
  `fd9429d`; rows marked **(new)** cite test methods introduced by this task
  (`RbacMatrixApiIntegrationTest`, `RbacStatusDenialIntegrationTest`,
  `RealtimeWebSocketIntegrationTest#upgradeWithSuspendedIdentityTokenIsRefused` +
  `#upgradeAdmitsEveryActiveRole`).
- Allow/deny cell counts (role columns × rows; mechanically verified): REST — **292
  cells (213 allow, 79 deny)**; WS — **108 cells (108 allow)** — denial lives on the
  shared handshake gate, not per-op. Anonymous cells: REST — 73 (11 allow, 62 deny-401);
  WS — 27 refused at the handshake. Inactive/suspended cells: deny on every
  authenticated surface (§2.2/§6).
- **Unproven cells: 0** — every cell is either directly asserted by a cited test method
  or is a mechanical consequence of a shared, directly-asserted seam (§2.1/§2.2/§4) —
  with one scoped exception: the five **disputed** routing-rule rows (37–41, §3.8).
  Their cells are asserted against the frozen-ledger reading (Option A), but which
  reading is the accepted target behaviour is **pending the founder decision**, so
  AC-MIG-091-2 coverage stays unproven for those five rows until it lands.
- Every previously-uncited gap closed by this task: IRC deny cells (62–73
  non-super cells), ADMIN/MANAGER user-administration denials (15–18), routing-rule
  SUPER/USER cells (37–41), audit SUPER/USER cells (46–49), DLQ/queue ADMIN/USER cells
  (50–61), notification own-scope rows (42–45), conversation-surface ADMIN/MANAGER/
  USER cells (22–26), message/tag/notes privileged cells (29, 32, 34–36), session rows
  per role (12–14), suspended full-stack WS refusal, all-four-role WS admit.
- Self-check performed at head `fd9429d`: every cited `Class#method` resolved against
  the test sources (see PR handover for the mechanical check output).

## 10. Out of scope / not claimed

- No production (`src/main`) change, no permission-model change, no `.docs/migration/**`
  edit (frozen contract cited read-only), no frontend/E2E work (#461), no severity
  taxonomy (#458), no ledger attribution (#459/#460).
- Routing-rule access (rows 37–41 / `REST-RULES-001..005`) is **disputed — pending
  founder decision** (#457 comment `6678930687`): this matrix records the open conflict
  (§1/§3.8/§8), adopts neither reading, and changes no permission, test expectation,
  frozen file, or AC text.
- This matrix documents offline permission-test coverage; it is **not** deployment
  evidence and makes no staging/API-reachability claim (#361).
- Force-password-change (bootstrap/recovery lock) is recorded as an orthogonal gate
  (§2.1), not a matrix cell.
