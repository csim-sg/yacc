# MIG-073 — Findings & Remediation Ledger

**Issue**: csim-sg/yacc#367 (MIG-073) · **Date**: 2026-10-19
**Reviewed revision**: `origin/dev` @ `13004361ffb278f865182b4e515f38e02158bc97`
**Threat model**: [MIG-073-threat-model.md](MIG-073-threat-model.md) (method, trust boundaries,
surface inventory, severity definitions — §5 there scopes every severity below to threat-model
findings)
**Statuses**: `open` · `remediated` · `accepted-residual` (founder-only, E4)

**No waiver has been granted for any finding in this ledger. No severity has been reclassified.
No remediation was performed inside MIG-073** (fixes are separate issues per the issue's out-of-scope
guardrail; escalation stops E1/E5).

## 1. Ledger

| ID | Surface (threat-model §4) | STRIDE | Severity | Status | Owner / remediation routing | Evidence anchor (revision `1300436`) |
|---|---|---|---|---|---|---|
| TM-001 | S5 Raw WS — conversation-room join | I, E | **Sev-2** | **open** | tech-lead → bounded remediation issue (WS resource-level authorization) | `YaccWebSocketHandler.subscribeConversation` (`api/realtime/YaccWebSocketHandler.java:177-191`); room traffic `GatewayExchange.publishMessageReceived` (`api/connector/GatewayExchange.java:226-233`), `ConnectorRelayService.java:65/113/129`, `WebSocketTypingService.java:52/65/82`; broadcast `GatewayExchange.java:335` |
| TM-002 | S1 REST — conversation-content read paths | I | **Sev-2** | **open** | tech-lead → product-policy decision (frozen-contract interplay; may resolve jointly with TM-001) | `ConversationsController.list/get` (`api/conversation/ConversationsController.java:48-92`), `MessageController.list/status` (`api/message/MessageController.java:56-100`), `NotesController.list/create` (`api/note/NotesController.java:40-56`); check exists only at `ConversationTagController.requireAccess` + `MessageController.retry` |
| TM-003 | S7/S11 — Helm↔Spring env contract mismatch | I/D (availability of controls) | Sev-3 | open | tech-lead → bounded chart-fix issue, or fold into #361 (MIG-070 staging rehearsal) | `deploy/helm/yacc-backend/templates/deployment.yaml:50-61` vs `application.yml:143-144` (bootstrap), missing `YACC_AUTH_TOKEN_SIGNING_KEY` / `YACC_RECOVERY_KEY_HASH` / `YACC_INTEGRATION_ENCRYPTION_MASTER_KEY` injections vs `application.yml:132,155,273`, `SENDGRID_API_KEY` vs `YACC_AUTH_EMAIL_SENDGRID_API_KEY` (`deployment.yaml:98-103` vs `application.yml:164`) |
| TM-004 | S7/S9 — unconsumed secret material mounted in pod env | I | Sev-3 | open | tech-lead → chart cleanup issue (with R2 disposition) | `deployment.yaml:74-115` (`CLOUDFLARE_R2_*`, `TELEGRAM_BOT_TOKEN`, `IRC_PASSWORD`); no consumer: `TelegramCredentialsResolver.java:19-23` (DB-first, "No env fallback"), `IrcConnectionConfigResolver.java:22-28`, R2 negative evidence §4 S9 |
| TM-005 | S5 — WS access token in upgrade query parameter | I | Sev-3 | open (capture half `unverified`, E6) | tech-lead → ingress log-redaction decision in the MIG-070 envelope | `WebSocketHandshakeAuthInterceptor.java:37-38,84-89`; path contract `application.yml:255-265`; ADR-026 |
| TM-006 | S6 — IRC plaintext transport (no TLS support) | C, I | Sev-3 | open | tech-lead → ops decision (TLS-terminating endpoint / tunnel, or accept at MIG-070) | `IrcProtocolClient.java` (plain `java.net.Socket`), default port 6667 (`IrcConnectionConfigResolver.java:54`); profile-controlled endpoint |
| TM-007 | S1.3 — unauthenticated Prometheus scrape | I | Sev-4 | open | tech-lead → network-protection decision at MIG-070 (path frozen by ADR-029) | `AuthSecurityConfig.java:90-95` (`/actuator/prometheus` permitAll); `application.yml:90-101` |
| TM-008 | S3.5 — public-client refresh/revoke authenticates by client id | S | Sev-4 | open (documented design posture) | none proposed — founder visibility at AC-MIG-073-3 if residual risk is to be accepted (E4) | `AsPublicClientAuthenticationProvider.java` (compensating controls: PKCE S256 `AsClientPolicy.java:92-94`, rotation `reuseRefreshTokens=false`, `AsRefreshTokenSerializationFilter.java`, status seam `AsStatusEnforcingAuthorizationService.java`) |
| TM-009 | S10 — audit persistence is best-effort | R | Sev-4 | open | routing note to #366 (MIG-091 QA/ledger closure, E7 — kept here, `#366` untouched) | `JpaAuditPersistence.java:41-59` (swallow + non-UUID drop; baseline parity per javadoc) |
| TM-010 | S1.7 — reset rate limiter keyed on `RemoteAddr`, in-memory | D | Sev-4 | open | note for MIG-070 ingress topology decision (single-instance envelope, ADR-029) | `PasswordResetRateLimitFilter.java:64-95` |

Counts: **10 findings — Sev-1: 0, Sev-2: 2 (both open), Sev-3: 4 (open), Sev-4: 4 (open).
Remediated: 0. Accepted-residual: 0.**

## 2. Finding details

### TM-001 — WS conversation-room join has no resource-level authorization (Sev-2, open)

- **Surface / artifacts.** Raw WebSocket plane (`MIG-073-threat-model.md` §4 S5):
  `subscribe.conversation` handling in `api/realtime/YaccWebSocketHandler.java` (`subscribeConversation`,
  lines 177-191) joins `conversation:{conversationId}` (`api/realtime/RealtimeRooms.java`) via
  `api/realtime/WebSocketSessionRegistry.joinRoom` with **no** role or assignment check. The REST
  plane enforces `ConversationAccessService.canAccess` at its gated endpoints — the WS demux does not.
- **Impact.** Conversation rooms carry content-bearing events: full inbound message bodies —
  `GatewayExchange.publishMessageReceived` publishes `MessageReceivedPayload` **including
  `event.body()`** — plus `ConnectorRelayService` conversation-room publishes (message received /
  error / ack relays) and typing events. Any authenticated identity of any role can therefore
  receive message content for any conversation whose id it knows. Ids are discoverable:
  `MESSAGE_SENT` is broadcast to **all** sessions (`GatewayExchange.java:335`,
  `WebSocketEventPublisher.publishToAll`), so a `user`-role client learns conversation ids it is not
  assigned to, then subscribes.
- **STRIDE.** Information disclosure; elevation within the realtime plane (bypasses the RBAC
  assignment boundary that S1.2 documents).
- **Attack path.** Authenticate (any role) → open `/ws?token=…` (S5 handshake passes for any ACTIVE
  identity) → receive `message.sent` broadcast → `subscribe.conversation` with the learned id →
  receive `message.received` frames with message bodies for unassigned conversations.
- **Severity rationale.** Sev-2 per the stated definitions: an authenticated principal exceeds the
  documented authorization boundary (`ConversationAccessService` contract: "`user` role only when
  assigned") with real confidentiality impact. Not Sev-1: requires authentication; no
  auth-bypass/secret exposure.
- **Parity context (not a waiver).** The Node baseline joins the room unconditionally as well
  (`packages/backend/src/socket-controllers/conversation.controller.ts:107-112`,
  `socket.join(room)` with no authorization). Parity explains provenance; it does not neutralize the
  finding for the no-waiver gate.
- **Evidence.** Revision `1300436`; files cited above (line numbers from this revision).
- **Routing.** E1 → tech-lead. Recommended shape (decision owned by tech-lead, **not** implemented
  here): apply the existing `ConversationAccessService.canAccess` (or a realtime-plane equivalent)
  at `subscribeConversation` and at room-publish fan-out; a bounded remediation issue is a
  tech-lead decision. **Blocks MIG-072 cutover until remediated and re-reviewed to `pass`.**

### TM-002 — REST conversation-content read paths lack resource-level authorization (Sev-2, open)

- **Surface / artifacts.** Identity/RBAC surface (§4 S1): `GET /api/conversations`
  (`ConversationsController.list`), `GET /api/conversations/{id}` (`get`), `GET
  /api/conversations/{conversationId}/messages` (`MessageController.list`), `GET
  …/{messageId}/status` (`status`), `GET|POST /api/conversations/{conversationId}/notes`
  (`NotesController.list/create`) — all authenticated-only (`anyRequest().authenticated()`), none
  applies `ConversationAccessService.canAccess`.
- **Impact.** Any authenticated `user`-role identity can list **all** conversations and read full
  message/note content of any conversation by id — the same data class as TM-001, on the REST plane.
  The RBAC matrix gates management writes (status/priority: manager+; assign: admin+; user
  administration: SUPER_ADMIN; message retry and tags: assignment/resource check) but no read path.
- **STRIDE.** Information disclosure.
- **Severity rationale.** Sev-2: authenticated cross-boundary read of platform conversation content;
  the resource-level control demonstrably exists as a component but is not applied on these paths.
- **Contract interplay (recorded, E2).** The frozen ledger rows for these reads
  (`ledger-mig-001-rest.md` REST-CONV-001/002 and the Messages section; reconciled copy in
  `ledger-mig-003-reconciled.md`) specify "identical filter set / envelope" with **no RBAC cell** —
  the reads were parity-mandated, and the Node baseline is equally open
  (`controllers/conversations.controller.ts:123-131` list with no user scoping). Changing REST read
  authorization therefore touches frozen-contract behavior — per stop E2 the frozen
  `.docs/migration/**` set is not edited here; this row records the observation and routes the
  decision.
- **Evidence.** Revision `1300436`; files cited above; frozen rows cited read-only.
- **Routing.** E1 → tech-lead (with strategist sign-off where the product RBAC matrix for reads is
  defined): either a founder-visible policy decision that the shared-inbox read model is intended
  (which would make this an acceptance question, not a code fix — E4) or a remediation issue adding
  resource checks with a contract-amendment path. **Blocks MIG-072 cutover until resolved and
  re-reviewed.**

### TM-003 — Helm env injection does not match the Spring env contract (Sev-3, open)

- **Surface / artifacts.** §4 S7/S11: `deploy/helm/yacc-backend/templates/deployment.yaml` vs
  `services/backend-java/src/main/resources/application.yml`.
- **Facts (each verified at revision `1300436`).**
  1. Chart injects `BOOTSTRAP_SUPER_ADMIN_EMAIL` / `BOOTSTRAP_SUPER_ADMIN_PASSWORD`
     (`deployment.yaml:50-61`); Spring binds `YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL` /
     `YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL` (`application.yml:143-144`). No mapping exists
     (literal `${…}` placeholders) ⇒ a charted fresh deployment cannot complete bootstrap
     (fail-closed startup refusal, `SuperAdminBootstrap`).
  2. No injection exists for `YACC_AUTH_TOKEN_SIGNING_KEY` (`application.yml:132`) ⇒
     `JwtTokenService` refuses to start (fail-closed) — the service **cannot boot from this chart as
     committed**.
  3. No injection exists for `YACC_RECOVERY_KEY_HASH` (`application.yml:155`) ⇒ an armed recovery
     always fails closed (`SuperAdminRecovery` rejects missing hash) — the recovery control cannot
     execute through the chart.
  4. No injection exists for `YACC_INTEGRATION_ENCRYPTION_MASTER_KEY` (`application.yml:273`) ⇒
     `EncryptionService` refuses to start (fail-closed).
  5. Chart injects `SENDGRID_API_KEY` (`deployment.yaml:98-103`); Spring binds
     `YACC_AUTH_EMAIL_SENDGRID_API_KEY` (`application.yml:164`) ⇒ the SendGrid key can never bind.
  6. `YACC_AUTH_AS_ISSUER` (`application.yml:209`) has no injection ⇒ production would run the AS
     with the `http://localhost:8080` issuer default (issuer confusion risk is bounded — signatures
     still enforced — but discovery/issuer values would be wrong for the deployment).
- **Impact.** Every affected control fails **closed** (boot/refusal), so this is a deployment
  availability defect of security-relevant controls, not an open door — Sev-3. It also means the
  merged chart cannot currently produce the runtime evidence MIG-070 needs.
- **Routing.** E5 (no chart change in MIG-073) → tech-lead: bounded chart-fix issue, or explicitly
  folded into #361 (MIG-070 cutover rehearsal, which owns staging deploy evidence).

### TM-004 — Unconsumed secret material mounted into the pod environment (Sev-3, open)

- **Surface / artifacts.** §4 S9/S7: `deployment.yaml:74-115` mounts `CLOUDFLARE_R2_*`,
  `TELEGRAM_BOT_TOKEN`, `IRC_PASSWORD` (secret `yacc-backend-secrets`, all `optional: true`).
- **Facts.** The Java service consumes **none** of them: Telegram/IRC credentials resolve DB-first
  with an explicit no-env-fallback contract (`TelegramCredentialsResolver.java`,
  `IrcConnectionConfigResolver.java`), and R2 has no client/dependency/endpoint anywhere in
  `services/backend-java` (negative evidence in §4 S9 — the configured-but-unused disposition the
  issue guardrail pins). Note also the template hardcodes secret key names (`R2_ENDPOINT`,
  `R2_ACCESS_KEY_ID`, …) that do not match the chart's own values schema (`r2-endpoint`,
  `r2-access-key`, …) — the values block is equally dead.
- **Impact.** Credential material with no consumer is exposed to the pod env anyway — readable via
  pod-level compromise paths (env dump, crash diagnostics) and a standing lure for future code to
  "just read the env var". Restricted preconditions (requires pod/cluster access) ⇒ Sev-3.
- **Routing.** E5 → tech-lead: chart cleanup issue (remove dead mounts or wire them to real
  consumers); the R2 disposition (keep/remove) is a tech-lead/founder call documented here, not
  decided here.

### TM-005 — WebSocket access token travels in the upgrade query parameter (Sev-3, open)

- **Surface / artifacts.** §4 S5: `WebSocketHandshakeAuthInterceptor.TOKEN_PARAMETER` (`token`),
  read from the upgrade URI (`tokenOf`, lines 84-89); the browser constraint is the design premise
  (browsers cannot set `Authorization` on an upgrade) and the path/behavior are frozen
  (ADR-026; `application.yml:255-265`).
- **Impact.** Bearer tokens embedded in URLs can be captured by intermediary access logs, proxy
  telemetry, and browser history. The code-side exposure is structural; whether ingress actually
  logs full query strings **cannot be verified without the live environment** — that half is marked
  **`unverified`** (stop E6); no runtime claim is made.
- **Severity rationale.** Sev-3: exploitation requires access to intermediaries/logs (network
  position), and the transport is frozen contract surface.
- **Routing.** tech-lead: ingress log-redaction / short-lived-token policy decision in the MIG-070
  envelope. (Mitigation directions exist — e.g., one-time upgrade tickets — but are out of scope, E5.)

### TM-006 — IRC connector has no TLS support; plaintext transport (Sev-3, open)

- **Surface / artifacts.** §4 S6: `IrcProtocolClient` uses a plain `java.net.Socket`; default port
  6667 (`IrcConnectionConfigResolver.DEFAULT_PORT`); endpoint/server/port/nick/password come from
  the (SUPER_ADMIN-managed, encrypted-at-rest) profile config.
- **Impact.** The IRC login password (if set) and all message traffic transit in cleartext between
  the pod and a plaintext endpoint; a network-position attacker can read both. The credential at
  rest is encrypted (S7) but its use on the wire is unprotected unless the operator points the
  profile at a TLS-terminating front (the client cannot negotiate TLS itself). Baseline-inherited
  posture; restricted preconditions (on-path position) ⇒ Sev-3.
- **Routing.** tech-lead: ops decision — require a TLS-terminating endpoint/tunnel in the MIG-070
  environment, or record founder acceptance (E4) of the restricted-precondition exposure.

### TM-007 — Unauthenticated Prometheus scrape surface (Sev-4, open)

- **Surface / artifacts.** §4 S1.3: `/actuator/prometheus` is in the permitAll set
  (`AuthSecurityConfig.java:90-95`); remapped and exposed in `application.yml:90-101`; the wire path
  is frozen by ADR-029.
- **Impact.** Operational metrics (JVM, WS sessions, queue/DLQ gauges) are readable by any principal
  with network reach to the port. Metadata-class disclosure; the scrape path is a frozen deployment
  contract. Sev-4.
- **Routing.** tech-lead: network-level protection (ingress policy / NetworkPolicy) decision at
  MIG-070; no code change proposed (E5).

### TM-008 — AS public-client refresh/revoke authenticates by client id only (Sev-4, open)

- **Surface / artifacts.** §4 S3.5: `AsPublicClientAuthenticationProvider` (public client, empty
  additional parameters only); compensating controls: mandatory PKCE S256 + consent + exact redirect
  URIs (`AsClientPolicy`), rotate-on-use refresh (`reuseRefreshTokens=false`), whole-operation
  per-token serialization (`AsRefreshTokenSerializationFilter`), status-enforcing grant resolution
  (`AsStatusEnforcingAuthorizationService`), process-local grant store.
- **Impact.** Standard OAuth 2.1 public-SPA posture: refresh tokens are bearer possessions; a stolen
  refresh token is usable until consumed (single-use rotation bounds the window; the racing replay
  deterministically fails). Documented design posture with named compensating controls ⇒ Sev-4;
  recorded for founder visibility, not proposed for change.
- **Routing.** None proposed. If the founder prefers sender-constrained refresh (DPoP/mTLS class),
  that is a new acceptance decision (E4), out of scope here.

### TM-009 — Audit persistence is best-effort (Sev-4, open)

- **Surface / artifacts.** §4 S10: `JpaAuditPersistence.persist` swallows persistence failures
  (log-warn, never rethrow) and drops records whose `entityId` is not a UUID (both exact baseline
  parity per the class contract).
- **Impact.** The security audit trail can silently lose records under DB failure, and known record
  classes (non-UUID entity ids) are dropped by design — repudiation/completeness weakness, no
  confidentiality impact. Sev-4.
- **Routing.** E7: kept in this ledger as a threat-model finding; routed as a note to **#366
  (MIG-091)**, which owns QA/ledger-wide closure — `#366`'s acceptance was **not** edited (its
  taxonomy/closure scope stays its own).

### TM-010 — Password-reset rate limiter keys on `RemoteAddr` with in-memory state (Sev-4, open)

- **Surface / artifacts.** §4 S1.7: `PasswordResetRateLimitFilter` (3 req/h fixed window on
  `forgot-password`/`reset-password`; `request.getRemoteAddr()` key; `ConcurrentHashMap` windows).
- **Impact.** Behind a proxy/LB, all clients can share the proxy's address bucket (collective 429s),
  and state is per-instance and restart-lossy (single-instance envelope; in-memory by design).
  Brute-force economics are still bounded by bcrypt + token entropy. Sev-4.
- **Routing.** Note for the MIG-070 ingress topology decision (trusted-proxy header handling is an
  environment decision); no code change proposed (E5).

## 3. Dated finding report — the AC-MIG-073-3 record

**Report date**: 2026-10-19 · **Revision of record**: `origin/dev` @
`13004361ffb278f865182b4e515f38e02158bc97` · **Ledger revision**: 1 (initial review)

| Severity | Open | Remediated | Accepted-residual | Total |
|---|---|---|---|---|
| Sev-1 | **0** | 0 | 0 | 0 |
| Sev-2 | **2** (TM-001, TM-002) | 0 | 0 | 2 |
| Sev-3 | 4 (TM-003…TM-006; TM-005 capture half `unverified`) | 0 | 0 | 4 |
| Sev-4 | 4 (TM-007…TM-010) | 0 | 0 | 4 |
| **Total** | **10** | **0** | **0** | **10** |

- **Statement of outcome.** At this revision the review records **zero open Sev-1 findings** and
  **two open Sev-2 findings**. Therefore **AC-MIG-073-2 ("zero open Sev-1/2 findings") is NOT met by
  this review**, and the reviewed outcome cannot yet serve as the passing no-waiver prerequisite for
  MIG-072 cutover.
- **No waiver was granted.** No finding was waived, no severity was reclassified to pass AC-2, and
  no remediation was performed inside MIG-073 (out of scope; stops E1/E5). TM-001 and TM-002 are
  recorded `open` with owned routing to tech-lead; both block MIG-072 until remediated and
  re-reviewed to `pass`, or until an amended acceptance path is decided by tech-lead/founder.
- **No residual risk was accepted here.** `accepted-residual` is founder-only (guardrail 3 / stop
  E4); the count is zero. TM-008 and TM-007 are recorded `open` with founder-visibility notes.
- **Evidence honesty.** Findings are grounded in merged source/config/contract artifacts at the
  revision above; no runtime or environment evidence exists or is claimed (no functioning staging
  deploy path — the Java `deploy` job reports `success` with deploy steps skipped when
  `KUBE_CONFIG_STAGING` is unset). TM-005's log-capture half is explicitly `unverified` (E6).
- **Severity scope.** Sev-1/Sev-2 definitions are the threat-model document's §5, scoped to
  threat-model findings; the phase/test-wide taxonomy and the ledger-wide zero-open report remain
  MIG-091's (#366, AC-MIG-091-4/5). Findings TM-001/TM-002 are **not** asserted to be MIG-091
  ledger rows; TM-009 carries only an E7 routing note.
- **Re-review note (from the issue's dependency-semantics record).** If the MIG-071 drill (#362)
  later changes a reviewed control, a targeted re-review of that surface is required against
  AC-MIG-073-2 — recorded here as the standing note; no AC text changes.
