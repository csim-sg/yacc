# ADR-030: Java Package Layout + Guardrail Codification

**Status:** Accepted  
**Date:** 2026-09-26 (drafted); accepted 2026-09-26 in MIG-005 (#339)  
**Owner:** Tech-lead (technical author), Founder (decision authority)  
**Type:** Architecture  
**Acceptance:** Accepted in MIG-005 (#339) per MIG-004 (#337) AC-MIG-004-3; binding for all MIG-010..091 implementation.  
**Amended:** 2026-10-16 in MIG-100 (#410) — Decision 1–2 corrected in place to the founder-accepted standalone API-module model; see [Amendment](#amendment-2026-10-16-issue-410) below. No new ADR number (KISS).  
**Related:** ADR-024 (Java/Spring replacement architecture — parent decision), ADR-023 (contract source), ADR-025..029 (auth, WS, data, async, envelope)

## Context

ADR-024 fixed the Java/Spring replacement at the level of principles (package-by-feature, constructor DI, JPA + Flyway, config-vs-infrastructure). SPEC-002 (TR-01) requires the concrete package layout to be codified **before any Java code exists**, so every later phase (MIG-010 scaffold onward) builds against one architecture contract. The TypeScript guardrails in `AGENTS.md` (flat `src/` folders, one-definition-per-file, index-const exports, config-vs-infra, no-global-prefix, Drizzle-only, Zod validation) do not map to Spring and must be explicitly replaced or marked non-applicable.

## Decision

1. **Single Gradle module; API modules + shared persistence planes at the top level** (KISS; amended 2026-10-16, #410):
   **API modules** `api.<feature>` — `auth`, `user`, `conversation`, `message`, `note`, `tag`, `routingrule`, `notification`, `audit`, `dlq`, `queue`, `integration`, `realtime` (`api.connector` when the Phase 6 connectors land) — plus the shared planes **`entity`**, **`repository`**, **`service`**, and the unchanged **`config`**, **`common`**. `com.yacc.YaccApplication` stays at the root (package `com.yacc`).
2. **~~Each feature package uses exactly four sub-layers~~ — SUPERSEDED (2026-10-16, #410).** The mandatory per-feature `controller`/`service`/`repository`/`model` skeleton is replaced by the standalone API-module model codified in the Amendment below: an API module owns its controller and wire DTOs; a layer package is created only where it has real content. No mandatory four-layer skeleton; no speculative layers.
3. **Boundary rule:** one bounded context per package; services may depend on another package's *service* API but **never on another package's repository**. Cross-feature workflows compose through services.
4. **Cross-cutting placement:** environment binding via `@ConfigurationProperties` classes colocated in their feature package (platform-wide ones in `config`); singleton infrastructure clients via `@Configuration`+`@Bean` in the owning feature (e.g. `integration` owns the S3/R2 client); shared pure utilities/types in `common`.
5. **Full guardrail set** (DI, typing, REST conventions, raw WS, data, auth, async, observability, deployment, KISS) codified in the companion ARCH document `.docs/architecture/004-java-backend-guardrails.md`, which maps every AGENTS.md TS guardrail to its Java equivalent or explicit N/A.
6. Founder-fixed decisions are codified, not reopened: dual-role OIDC (embedded Spring Authorization Server), raw Spring WebSocket, Quartz + DB DLQ (Redis dropped), full reset, single instance, roll-forward only.

## Amendment (2026-10-16, issue #410)

**What changed and why.** The accepted wording of Decision 2 ("each feature package uses exactly four sub-layers") was read broadly and applied to the whole backend, producing forced, largely empty layer packages (62 tracked `.gitkeep` layer markers across 16 feature packages) and separation for separation's sake. The founder clarified that **"module" means standalone API packages**, each owning its controller and request/response wire DTOs, with entities, repositories, and genuinely shared services in their own packages. This amendment codifies that correction **in place** (no new ADR number; SPEC-002 KISS). Decisions 3–6 are unchanged and the boundary rule is retained.

### Target package map (authoritative from this amendment)

| Package | Contents |
|---|---|
| `com.yacc.api.<feature>` | The feature's REST controller(s) **and its request/response wire DTOs** (records). A mapper/service belongs inside the module **only when real logic warrants it** — never created by default. One bounded context per API module. Feature-local `@ConfigurationProperties`/`@Configuration` and the feature's security infrastructure stay here (ARCH-004 §4 unchanged). |
| `com.yacc.entity` | All JPA entities plus the domain enums and JPA attribute converters that belong to them (flat plane — no per-feature nesting). |
| `com.yacc.repository` | All Spring Data repository interfaces (flat plane). |
| `com.yacc.service` | Services that are genuinely shared / persistence-oriented across features (e.g. auth/identity, audit persistence, DLQ, platform encryption). Cross-feature consumption alone does not hoist a service — cross-module access composes through the owning module's service API (Decision 3; ARCH-004 §1). Feature-local logic stays with its API module. |
| `com.yacc.config` | Cross-cutting platform configuration — unchanged. |
| `com.yacc.common` | True shared types/utilities — unchanged in intent (existing sub-packages are not churned). |
| `com.yacc.YaccApplication` | Root bootstrap (package `com.yacc`) — unchanged. |

**No mandatory four-layer skeleton.** Do not force `controller`/`service`/`repository`/`model` sub-packages in every module; do not create speculative mapper/service/persistence packages; a directory exists only if it has content (no `.gitkeep` skeleton packages).

### Current → target mapping (source of truth: `services/backend-java/src/main/java/com/yacc` @ `dev`, 2026-10-16)

Mechanical placement rules for MIG-101 (#411): `*Controller` → `api.<feature>`; classes annotated `@Entity`/`@Embeddable`, their enums, and the `*Converter` JPA attribute converters → `entity`; `JpaRepository` interfaces → `repository`; `<feature>.service` classes → `api.<feature>`, **except** the platform set called out in the mapping table below (auth identity, audit persistence, DLQ, `EncryptionService`) → `service`; cross-module callers keep importing the owning module's service (Decision 3); every remaining `<feature>.model` class is a wire DTO → `api.<feature>`; feature-root config/security classes → their feature's API module; `.gitkeep` layer markers are deleted, not moved.

| Current (`com.yacc.*`) | Class group (file count) | Target |
|---|---|---|
| `YaccApplication` | root bootstrap (1) | `com.yacc` — unchanged |
| `audit.controller` | controllers (2) | `api.audit` |
| `audit.model` | entity: `AuditLog` (1); wire DTOs: all remaining classes (9) | `entity` / `api.audit` |
| `audit.repository` | `AuditLogRepository` (1) | `repository` |
| `audit.service` | platform audit persistence: `AuditPersistence`, `JpaAuditPersistence`, `LoggingAuditPersistence`, `SecurityAuditEventListener` (4; `AuditPersistence` ← auth, conversation, integration, note, routingrule, tag, user; `LoggingAuditPersistence` is relocated, not deleted — referenced only by its own unit test) | `service` |
| `audit.service` | audit query: `AuditLogsQueryService` (1; audit controller only) | `api.audit` |
| `auth` (root classes) | auth security/config infrastructure: `AuthorizationServerConfig`, `AuthSecurityConfig`, `OAuth2LoginConfig`, `AuthEmailConfig`, `AuthProperties`, AS/RP converters, policies, filters, handlers (19) | `api.auth` (feature-local config/security per ARCH-004 §4) |
| `auth.controller` | `AuthController` (1) | `api.auth` |
| `auth.model` | entities: `Account`, `PasswordResetToken`, `Session`, `User`, `Verification`; enums: `UserRole`, `UserStatus`; converters: `UserRoleConverter`, `UserStatusConverter` (9); wire DTOs + principals: all remaining classes (17) | `entity` / `api.auth` |
| `auth.repository` | `AccountRepository`, `PasswordResetTokenRepository`, `SessionRepository`, `UserRepository`, `VerificationRepository` (5) | `repository` |
| `auth.service` | auth identity platform (20; founder-named shared): `AuthenticationService`, `AuthEmailService`, `AuthEmailSender`, `SendGridAuthEmailSender`, `SmtpAuthEmailSender`, `EmailVerificationService`, `PasswordResetService`, `SessionService`, `JwtTokenService`, `TokenAuthenticationService`, `OidcIdentityService`, `YaccOidcUserService`, `YaccUserDetailsService`, `UserDirectoryService`, `SuperAdminBootstrap`, `SuperAdminProvisioner`, `SuperAdminRecovery`, `BearerTokenAuthenticationConverter`; `EmailAlreadyRegisteredException`/`InvalidTokenException` are **non-bean shared error types** consumed by `common.controller.ApiExceptionHandler`, not beans (cross-feature evidence: `UserDirectoryService` ← conversation, message, note, notification, routingrule, user; `JwtTokenService`/`TokenAuthenticationService` ← realtime) | `service` |
| `common.controller` / `common.logging` / `common.model` / `common.seed` | global `@ControllerAdvice` + exceptions + `ServiceInfoController` (8), `PinoJsonEncoder` (1), shared response/error records (4), `DeterministicSeed` (1) | `common` — unchanged in intent |
| `config` | `CorrelationIdFilterConfig`, `CorrelationIdFilter`, `YaccProperties` (3) | `config` — unchanged |
| `conversation.controller` | controllers (3) | `api.conversation` |
| `conversation.model` | entities: `Conversation`, `ConversationTag`, `@Embeddable ConversationTagId`; enums: `ChannelType`, `ConversationPriority`, `ConversationStatus`; converters: `ChannelTypeConverter`, `ConversationPriorityConverter`, `ConversationStatusConverter` (9); wire DTOs: all remaining classes (18) | `entity` / `api.conversation` |
| `conversation.repository` | `ConversationRepository`, `ConversationTagRepository` (2) | `repository` |
| `conversation.service` | `AssignmentService`, `BulkActionService`, `ConversationAccessService`, `ConversationService` (4; `ConversationAccessService` ← message, note, tag and `ConversationService` ← tag via Decision 3 imports — module-local) | `api.conversation` |
| `connector.*` | empty placeholder — 4 tracked `.gitkeep` layer markers, no classes | `api.connector` when Phase 6 lands (markers deleted) |
| `dlq.controller` | `DlqController` (1) | `api.dlq` |
| `dlq.model` | entity: `DeadLetterQueueEntry` (1); wire DTOs: all remaining classes (9) | `entity` / `api.dlq` |
| `dlq.repository` | `DeadLetterQueueEntryRepository` (1) | `repository` |
| `dlq.service` | `DlqService` (1; founder-named persistence-oriented service; ← message, queue) | `service` |
| `integration` (root class) | `EncryptionProperties` (1) | `api.integration` (feature-local config per ARCH-004 §4) |
| `integration.controller` | controllers (2) | `api.integration` |
| `integration.model` | entities: `IntegrationConfig`, `IntegrationConnectionProfile` (2); wire DTOs: all remaining classes (14) | `entity` / `api.integration` |
| `integration.repository` | `IntegrationConfigRepository`, `IntegrationConnectionProfileRepository` (2) | `repository` |
| `integration.service` | platform crypto: `EncryptionService` (1; ← `common.seed` — `common` must not depend on a feature module) | `service` |
| `integration.service` | IRC integration logic: `IrcConfigService`, `IrcConnectionState`, `IrcProfileService` (3; integration only) | `api.integration` |
| `message.controller` | `MessageController` (1) | `api.message` |
| `message.model` | entities: `Attachment`, `Message`, `RawPayload`; enums: `MessageDirection`, `MessageStatus`; converters: `MessageDirectionConverter`, `MessageStatusConverter` (7); wire DTOs: all remaining classes (6) | `entity` / `api.message` |
| `message.repository` | `AttachmentRepository`, `MessageRepository`, `RawPayloadRepository` (3) | `repository` |
| `message.service` | `MessageQueryService`, `MessageService` (2; `MessageQueryService` ← conversation, queue via Decision 3 imports — module-local) | `api.message` |
| `note.controller` | `NotesController` (1) | `api.note` |
| `note.model` | entity: `Note` (1); wire DTOs: all remaining classes (4) | `entity` / `api.note` |
| `note.repository` | `NoteRepository` (1) | `repository` |
| `note.service` | `MentionParser`, `NoteService` (2; note only) | `api.note` |
| `notification.controller` | `NotificationsController` (1) | `api.notification` |
| `notification.model` | entity: `Notification` (1); wire DTOs: all remaining classes (5) | `entity` / `api.notification` |
| `notification.repository` | `NotificationRepository` (1) | `repository` |
| `notification.service` | `NotificationService` (1; ← conversation, note via Decision 3 imports — module-local) | `api.notification` |
| `queue.controller` | `QueueController` (1) | `api.queue` |
| `queue.model` | no entity (Quartz is DB-backed, no JPA entity in this package); wire DTOs: all classes (15) | `api.queue` |
| `queue.service` | `QueueService` (1; queue controller only — `DlqService` is the shared DLQ path) | `api.queue` |
| `realtime` (root classes) | `RealtimeProperties`, `RealtimeSessionRegistryConfig`, `RealtimeWebSocketConfig` (3) | `api.realtime` (WS module config per ARCH-004 §4) |
| `realtime.model` | WS wire frames/envelopes/events: all classes (8) | `api.realtime` |
| `realtime.service` | `MetricsSink`, `MicrometerMetricsSink`, `WebSocketEventPublisher`, `WebSocketHandshakeAuthInterceptor`, `WebSocketSessionRegistry`, `YaccWebSocketHandler` (6; realtime only) | `api.realtime` |
| `routingrule.controller` | `RoutingRulesController` (1) | `api.routingrule` |
| `routingrule.model` | entities: `RoutingRule`, `RoutingRuleExecution` (2); wire DTOs: all remaining classes (5) | `entity` / `api.routingrule` |
| `routingrule.repository` | `RoutingRuleExecutionRepository`, `RoutingRuleRepository` (2) | `repository` |
| `routingrule.service` | `RoutingRulesService` (1; routingrule only) | `api.routingrule` |
| `tag.controller` | controllers (2) | `api.tag` |
| `tag.model` | entity: `Tag` (1); wire DTOs: all remaining classes (7) | `entity` / `api.tag` |
| `tag.repository` | `TagRepository` (1) | `repository` |
| `tag.service` | `TagService` (1; ← conversation, routingrule via Decision 3 imports — module-local) | `api.tag` |
| `user.controller` | `UsersController` (1) | `api.user` |
| `user.model` | no entity/repository of its own; wire DTOs: all classes (7) | `api.user` |
| `user.service` | `UserAdminService` (1; user only) | `api.user` |

Coverage check: 284 main-source `.java` files across 15 populated packages + root (19 `@Entity` + 1 `@Embeddable`, 7 entity-domain enums + 2 wire enum declarations (`WebSocketMetric` and its nested `MetricType`) = 9 enum declarations, 7 JPA attribute converters, 19 repositories) and 62 tracked `.gitkeep` layer markers (deleted by MIG-101, not moved). The `*.service` packages hold 49 files — 29 `@Service` beans, 9 `@Component` (no `@Configuration`), 3 interfaces, 2 shared exception types, 6 non-stereotype classes; of those 49, **26 remain in `com.yacc.service`** and **23 relocate to their `api.<feature>` module** (table above). `realtime.model` keeps all 8 classes — including `WebSocketMetric` (which declares the nested `MetricType` enum) — as `api.realtime` wire types.

### Transitional state

Code merged before this amendment still follows the superseded per-feature `controller/service/repository/model` layout. **MIG-101 (#411)** reconciles the merged Java backend to the map above (behavior-preserving; zero `.gitkeep`-only directories; contracts byte-unchanged). From the moment this amendment is accepted, the four-sub-layer rule is superseded: reviewers must not enforce it, and new Java code must not be added to the superseded layout. The relation to the rejected alternatives below is unchanged in spirit: the top level is still feature-cohesive (API modules), not a layer-first transplant — only genuinely shared persistence types are hoisted to their own planes.

## Alternatives Considered

- **Hexagonal / clean-architecture layering (`domain`/`application`/`infrastructure` rings):** rejected — over-engineered for a single-tenant, single-instance service (ADR-024); violates the SPEC-002 KISS constraint.
- **Layer-first packages (`controllers/`, `services/`, `repositories/` at top level — the TS flat-folder shape transplanted):** rejected — scatters one feature across packages and invites cross-package repository leakage; package-by-feature keeps the bounded context cohesive.
- **Multi-module Gradle build (per-feature Jars):** rejected as default — build complexity with no current need; revisit only via a reviewed ADR-level finding.
- **jOOQ or query-builder data access:** rejected as default (ADR-024/ADR-027); Spring Data JPA is the simplest correct default.

## Consequences

- **Stability:** every MIG-010..091 issue has one authoritative layout to implement against; review can enforce placement mechanically (wrong-layer/wrong-package = blocking finding).
- **Cost:** slight upfront discipline (package declarations, boundary checks) versus the POC's flat folders; no new tooling required.
- **Security:** feature boundaries give auth/audit checks a single seam (controller layer) per context; supports the RBAC/status-enforcement evidence (AC-04/AC-11).
- **Operability:** predictable file locations reduce onboarding cost for the three-developer team (AC-10 handover).

## Standards Alignment

- TOGAF: application architecture (component & boundary model).
- AWS Well-Architected: operational excellence (simplicity, consistency), security (bounded auth surface).
- ISO 27001: support for access-control structure (single controller seam per bounded context).
