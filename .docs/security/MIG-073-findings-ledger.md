# MIG-073 — Findings & Remediation Ledger

**Issue**: csim-sg/yacc#367 (MIG-073) · **Date**: 2026-10-20 (final re-assessment after the authorized TM-011 remediation merged; initial review 2026-10-19)
**Ledger revision**: 5 (2026-10-20 final re-assessment at the merged #442 remediation: TM-011 re-recorded **`remediated (proposed)`** on merged commit/test/contract evidence — a builder proposal for the fresh independent reviewer assessment to validate or reject, **not** a builder self-adjudication; re-anchored to `f83863f`; every other disposition re-assessed at the new revision and unchanged. Revision 4 = 2026-10-20 review-loop-3 adjudication, #367 comment `6291375868`: TM-001 narrowed to the founder-named content classes; TM-015 conversation-scoped typing-receipt row adjudicated `not-a-finding`; TM-014 widened to typing **and** global presence identity; presence flow corrected; TM-011 open. Revision 3 = 2026-10-20 adjudication: TM-012 resolved as not-a-finding on accepted records. Revision 2 = 2026-10-20 re-assessment at the merged founder shared-view policy baseline. Revision 1 = 2026-10-19 @ `1300436`)
**Reviewed revision**: `origin/dev` @ `f83863ffa5d06521bcd0d68f5d49876151a9e235` (PR #443 merge — the #442 TM-011 remediation; branch merge commit `7c074049452a30b60192234fffc091ad0208e8da` on `feat/issue-367`)
**Revision note (re-anchor)**: the delta between the revision-4 anchor `f9436c610ff2ec2ffe1bb8d0a9b20db6480bfec6` and `f83863f` is **exactly the five authorized #442 remediation files** (+146/−7: `api/message/MessageController.java`, `MessageApiIntegrationTest.java`, frozen `.docs/migration/openapi.yaml` plus its byte-identical test copy, `.docs/migration/ledger-mig-003-reconciled.md`) — `git diff f9436c6 f83863f` touches nothing else (verified in this re-assessment). Every revision-4 evidence anchor outside those files therefore remains valid unchanged; the `MessageController` line anchors were re-verified at `f83863f` (the inserted guard shifts the method line numbers cited in TM-002). No code, config, or contract byte was changed by MIG-073 itself — the remediation was implemented, reviewed, and merged in #442/PR #443 only.
**Threat model**: [MIG-073-threat-model.md](MIG-073-threat-model.md) (method, trust boundaries,
surface inventory, severity definitions — §5 there scopes every severity below to threat-model
findings; §1.1 there records the reviewed policy baseline)
**Policy baseline (accepted records)**: founder decision 2026-10-18 (#367 comment `6268859088`), merged into the product records by #437 (`csim-sg/yacc#438` → `dev` @ `f9436c6`; `Antpolis/documentation#19` → vault `master`): **all active authenticated identities (all roles, incl. self-registered/OIDC-first-login `USER`) may view all conversation content — messages, status, notes — of every conversation** (assigned, unassigned, other-assignee); `USER` **reply/retry remain assignment-bound** (`.docs/01-product-specification.md` L466–467, L469; `.docs/05-quick-reference.md` Reply/Retry rows); assignment/status/priority/tags/notes-creation/notification semantics unchanged; `inactive`/`suspended` denial unchanged. **Not a waiver, not residual-risk acceptance, not an AC change, not cutover approval.**
**Statuses**: `open` · `resolved-policy (candidate)` · `not-a-finding (adjudicated)` · `remediated` · `remediated (proposed)` · `accepted-residual` (founder-only, E4).
`remediated (proposed)` = the builder records merged remediation evidence (commit/test/contract) for a finding while **expressly not adjudicating it**: the status takes effect only if the fresh independent reviewer assessment at this issue's exact head validates the evidence and tech-lead records the resulting AC-MIG-073-2 decision. It is **not** a waiver, **not** a severity reclassification, **not** an accepted residual, and it carries no cutover claim; the AC-MIG-073-2 checkbox stays unchecked until that decision.
`not-a-finding (adjudicated)` = an adjudicated disposition that no accepted record is crossed — not a waiver, not a severity reclassification, excluded from finding counts.
`resolved-policy (candidate)` = a re-assessment disposition under which the documented boundary a finding depended on was changed by the accepted founder policy above, so the observed behavior no longer crosses an accepted-record boundary. It is **not** remediation (no code changed), **not** a waiver, and **not** an accepted residual. Whether such a disposition satisfies AC-MIG-073-2 is expressly reserved to the fresh independent reviewer assessment and tech-lead decision — the builder does not self-declare the AC-2 outcome.
**No waiver has been granted for any finding in this ledger. No severity has been reclassified.
No remediation was performed inside MIG-073** (fixes are separate issues per the issue's out-of-scope
guardrail; escalation stops E1/E5): the authorized TM-011 remediation was implemented, independently
reviewed in #442, and merged via PR #443, and it is recorded here only as `remediated (proposed)` —
proposed by this ledger with evidence, pending validation by this issue's fresh independent
reviewer assessment.

## 1. Ledger

| ID | Surface (threat-model §4) | STRIDE | Severity | Status | Owner / remediation routing | Evidence anchor (revision `f83863f`; unchanged from `1300436`/`f9436c6` outside the five #442 remediation files) |
|---|---|---|---|---|---|---|
| TM-001 | S5 Raw WS — conversation-room join (receive path: founder-named content classes) | I, E | Sev-2 (rev-1; re-dispositioned; narrowed in revision 4) | **resolved-policy (candidate)** | reviewer/tech-lead adjudication of the AC-2 effect — see §2; typing receipt is **not** part of this disposition → TM-015 | `YaccWebSocketHandler.subscribeConversation` (`api/realtime/YaccWebSocketHandler.java:177-188`, room join `:184`); room traffic `GatewayExchange.publishMessageReceived` (`api/connector/GatewayExchange.java:226-233`), `ConnectorRelayService.java:65,113,129`; id-discovery broadcast `GatewayExchange.java:335`; excluded classes cross-referenced: TM-015 (typing receipt), TM-014 (typing/presence identity), TM-013 (relay injection) |
| TM-002 | S1 REST — conversation-content read paths | I | Sev-2 (rev-1; re-dispositioned; write half split out to TM-012) | **resolved-policy (candidate)** | reviewer/tech-lead adjudication of the AC-2 effect — see §2 | `ConversationsController.list/get` (`api/conversation/ConversationsController.java:48-72`), `MessageController.list/status` (`api/message/MessageController.java:59-71,105-111` — re-anchored at `f83863f` after the #442 send guard shifted the file), `NotesController.list` (`api/note/NotesController.java:40-49`); all authenticated-only, none applies `ConversationAccessService.canAccess` |
| TM-003 | S7/S11 — Helm↔Spring env contract mismatch | I/D (availability of controls) | Sev-3 | open | tech-lead → bounded chart-fix issue, or fold into #361 (MIG-070 staging rehearsal) | `deploy/helm/yacc-backend/templates/deployment.yaml:50-61` vs `application.yml:143-144` (bootstrap), missing `YACC_AUTH_TOKEN_SIGNING_KEY` / `YACC_RECOVERY_KEY_HASH` / `YACC_INTEGRATION_ENCRYPTION_MASTER_KEY` injections vs `application.yml:132,155,273`, `SENDGRID_API_KEY` vs `YACC_AUTH_EMAIL_SENDGRID_API_KEY` (`deployment.yaml:98-103` vs `application.yml:164`) |
| TM-004 | S7/S9 — unconsumed secret material mounted in pod env | I | Sev-3 | open | tech-lead → chart cleanup issue (with R2 disposition) | `deployment.yaml:74-115` (`CLOUDFLARE_R2_*`, `TELEGRAM_BOT_TOKEN`, `IRC_PASSWORD`); no consumer: `TelegramCredentialsResolver.java:19-23` (DB-first, "No env fallback"), `IrcConnectionConfigResolver.java:22-28`, R2 negative evidence §4 S9 |
| TM-005 | S5 — WS access token in upgrade query parameter | I | Sev-3 | open (capture half `unverified`, E6) | tech-lead → ingress log-redaction decision in the MIG-070 envelope | `WebSocketHandshakeAuthInterceptor.java:37-38,84-89`; path contract `application.yml:255-265`; ADR-026 |
| TM-006 | S6 — IRC plaintext transport (no TLS support) | C, I | Sev-3 | open | tech-lead → ops decision (TLS-terminating endpoint / tunnel, or accept at MIG-070) | `IrcProtocolClient.java` (plain `java.net.Socket`), default port 6667 (`IrcConnectionConfigResolver.java:54`); profile-controlled endpoint |
| TM-007 | S1.3 — unauthenticated Prometheus scrape | I | Sev-4 | open | tech-lead → network-protection decision at MIG-070 (path frozen by ADR-029) | `AuthSecurityConfig.java:90-95` (`/actuator/prometheus` permitAll); `application.yml:90-101` |
| TM-008 | S3.5 — public-client refresh/revoke authenticates by client id | S | Sev-4 | open (documented design posture) | none proposed — founder visibility at AC-MIG-073-3 if residual risk is to be accepted (E4) | `AsPublicClientAuthenticationProvider.java` (compensating controls: PKCE S256 `AsClientPolicy.java:92-94`, rotation `reuseRefreshTokens=false`, `AsRefreshTokenSerializationFilter.java`, status seam `AsStatusEnforcingAuthorizationService.java`) |
| TM-009 | S10 — audit persistence is best-effort | R | Sev-4 | open | routing note to #366 (MIG-091 QA/ledger closure, E7 — kept here, `#366` untouched) | `JpaAuditPersistence.java:41-59` (swallow + non-UUID drop; baseline parity per javadoc) |
| TM-010 | S1.7 — reset rate limiter keyed on `RemoteAddr`, in-memory | D | Sev-4 | open | note for MIG-070 ingress topology decision (single-instance envelope, ADR-029) | `PasswordResetRateLimitFilter.java:64-95` |
| TM-011 | S1 REST — outbound send (`POST /api/conversations/{conversationId}/messages`): `USER` reply assignment-bound not enforced | T, E | **Sev-2** | **remediated (proposed)** | remediation implemented, independently reviewed, and merged in **#442 / PR #443** (founder Option A "fix + reconcile", #367 comment `6292298750`; merged to `dev` @ `f83863f` 2026-10-20; the PR #443 formal-approval gate was founder-waived for that exact head and recorded pre-merge; #442 Done). **This ledger records the proposal only**: the fresh independent reviewer assessment at this issue's exact head must validate the evidence below, and the AC-MIG-073-2 outcome is the reviewer/tech-lead decision — the builder does not self-adjudicate, and no waiver/residual/cutover claim is made. Until validated, this row is not a counted remediation and the finding's gate effect persists as recorded in the report (§3) | Revision-1 finding evidence (historical): `MessageController.send` had **no** role/assignment check; `MessageService.send` (`api/message/MessageService.java:78-91`) applies `requireConversation` only, persists, then publishes `MessageCreatedEvent` → `GatewayExchange` **external dispatch**. **Remediation evidence @ `f83863f`:** controller guard `MessageController.java:79-86` — `access.exists` → 404 first (every role), then `USER && !access.isAssignedTo` → 403, both **before** `messages.send(...)` (`:87`), so a denial persists no row and publishes no `MessageCreatedEvent` (no dispatch side effect); integration test `MessageApiIntegrationTest#sendRequiresAssignmentForUserRole` (`MessageApiIntegrationTest.java:147-240`; four groups — assigned USER 201 frozen wire + exactly one row; unassigned USER 403 pinned body on other-assignee **and** unassigned conversations with row count unchanged; SUPER_ADMIN/ADMIN/MANAGER 201 on other-assignee/unassigned unchanged; 404 existence precedence for both role classes); authorized frozen reconciliation — `openapi.yaml` op `sendConversationMessage` summary `:891` + 403 description `:910` + dated provenance block `:63-70`, byte-identical test copy `services/backend-java/src/test/resources/contract/openapi.yaml` (`diff -q` verified), `ledger-mig-003-reconciled.md` REST-MSG-002 row `:132` + `amended_at`/`amendments` front matter `:10-15`; recorded #442/#443 verification: focused integration test green, `contractTest` green, full `check` incl. JaCoCo ≥85% green, full-suite 558 tests / 0 failures (evidence of record on #442/#443, not re-run by this docs-only issue); contrast `MessageController.retry:97-100` (assignment bound, unchanged); accepted records `.docs/01-product-specification.md:466` + `.docs/05-quick-reference.md` (Reply: `USER` ✅ *(if assigned)*) |
| TM-012 | S1 REST — notes creation (`POST /api/conversations/{conversationId}/notes`) resource authorization | T | — (adjudicated not a finding) | **not-a-finding (adjudicated)** | none — capability as accepted: frozen openapi "any authenticated user" (no 403) vs tags "with conversation access" (403); GOV-021 all-roles notes-create; product record User "create notes"; founder bound "notes-creation semantics unchanged"; contrary reading recorded as caveat (§2) | `NotesController.create` (`api/note/NotesController.java:51-57`), `NoteService.create` (`api/note/NoteService.java:64-83`, `conversations.exists` only); records: frozen `openapi.yaml:965-987` ("any authenticated user", responses 400/404 only), `ledger-mig-003-reconciled.md` REST-NOTE-002 (binding; no RBAC/resource cell; baseline provenance `ledger-mig-001-rest.md:101` REST-NOTE-002 likewise), `GOV-021-phase2-architecture-decisions.md:53` ("Notes: create (internal)" all four roles ✅, no resource qualifier); founder bound "notes-creation semantics unchanged"; contrast tags `REST-TAG-003/004` (explicit resource check, enforced at `ConversationTagController.requireAccess`) |
| TM-013 | S5/S6 — connector relay/subscribe caller authorization (any authenticated WS session) | S, T | **Sev-3** | **open** | tech-lead → caller-role gating decision (E2: frozen `WS-OP-CONN-001/002/005/006` declare no caller role — cite-only) | `YaccWebSocketHandler.java:131-138` (relay ops from any authenticated session), `:205-215` (`connectorSubscribe` joins `connector:{platform}`, no role gate); `ConnectorRelayService.java:57-132` (client-supplied `body`/`senderId`/`senderName` → `conversation:{id}` rooms; `connector.status` `publishToAll` at `:90`); no first-party client emits these ops (grep over `packages/frontend/src` + `packages/frontend-angular/src`: 0 matches) |
| TM-014 | S5 — ephemeral presence/typing fan-out identity binding | S | **Sev-4** | **open** | tech-lead → hardening backlog (server-side identity binding at fan-out) | `WebSocketTypingService.java:44-88` (client-supplied `conversationId`/`userId`/`name` fanned out; sender exclusion by session id only; handshake identity `RealtimeSession` unused in the payload), `WebSocketPresenceService.java:58-88,130-146` (client-declared presence/status broadcast via `publishToAll`); frozen `WS-OP-TYPE-001..004` + `WS-OP-PRES-001..004` (client-declared identity payloads); spoofing scope only — receipt is TM-015 |
| TM-015 | S5 — conversation-scoped typing receipt by any authenticated room subscriber | I | — (adjudicated not a finding) | **not-a-finding (adjudicated)** | none — see §2 TM-015; caveat recorded | `YaccWebSocketHandler.java:177-188` (room join `:184`), `WebSocketTypingService.java:44-88` (`:52/:65/:82` room fan-out); frozen `asyncapi.yaml:369-375` (unqualified join) + `WS-OP-TYPE-001..004`; product `.docs/01-product-specification.md` §5.6 (L187-189) / Story 9.2 (L797-805); baseline `conversation.controller.ts:107` / `typing.controller.ts:22` |

Counts (ledger revision 5): **15 ledger rows → 13 findings — Sev-1: 0, Sev-2: 1 (TM-011, `remediated (proposed)`; it was the one open Sev-2 at the last independently validated revision 4), Sev-3: 5 open (TM-003…TM-006, TM-013; TM-005 capture half `unverified`), Sev-4: 5 open (TM-007…TM-010, TM-014); resolved-policy (candidate): 2 (TM-001, TM-002).
Remediated: 1 (TM-011 — **proposed**, pending independent validation). Accepted-residual: 0. Not-a-finding (adjudicated): 2 (TM-012, TM-015) — excluded from finding totals.**

## 2. Finding details

### TM-001 — WS conversation-room join has no resource-level authorization — re-dispositioned `resolved-policy (candidate)` (Sev-2 at revision 1)

- **Surface / artifacts.** Raw WebSocket plane (§4 S5):
  `subscribe.conversation` handling in `api/realtime/YaccWebSocketHandler.java` (`subscribeConversation`,
  lines 177-188) joins `conversation:{conversationId}` (`api/realtime/RealtimeRooms.java`) via
  `api/realtime/WebSocketSessionRegistry.joinRoom` with **no** role or assignment check (room join at
  `:184`). The REST plane applies `ConversationAccessService.canAccess` only at its gated write
  endpoints — the WS demux does not apply it at all. Room traffic in scope: full inbound message
  bodies — `GatewayExchange.publishMessageReceived` publishes `MessageReceivedPayload` **including
  `event.body()`** — plus `ConnectorRelayService` conversation-room publishes (message received /
  error / ack relays). The typing events the room also carries are **not** part of this
  disposition — they are TM-015 (receipt) and TM-014 (identity). Ids are discoverable:
  `MESSAGE_SENT` is broadcast to **all** sessions (`GatewayExchange.java:335`).
- **Revision-1 finding (recorded for history).** Any authenticated identity of any role could receive
  message content for any conversation whose id it knew — a Sev-2 authenticated cross-boundary
  disclosure, because the then-accepted contract bounded `user` viewing to assigned conversations
  (`ConversationAccessService` "user ⇒ assigned-only") and the Node baseline joined rooms
  unconditionally (`packages/backend/src/socket-controllers/conversation.controller.ts:107-112`).
- **Re-assessment (revision 2).** The boundary this finding depended on — assignment-bounded
  **viewing** — no longer exists in the accepted records: the founder's shared-view decision
  (2026-10-18, #367 comment `6268859088`) and the corrected product records merged by #437
  (`.docs/01-product-specification.md` L465/L469; `.docs/05-quick-reference.md` View row) approve
  **all** active authenticated identities to **view** all conversation content — messages, status,
  notes — on every conversation. The content classes the room carries — message bodies
  (`message.received`) and message delivery status (`message.error`, `message.ack`) — are the
  policy's named view classes; the id-discovery path
  (`MESSAGE_SENT` broadcast) reveals only ids of conversations the identity may already view. The
  realtime room is the push-delivery channel of the approved universal view, so the receive path no
  longer crosses an accepted-record boundary. **Disposition: no longer a finding because the
  documented boundary it depended on has changed — recorded as `resolved-policy (candidate)`.**
- **Narrowed in revision 4 (tech-lead adjudication #367 comment `6291375868`).** This disposition
  covers exactly the founder-named content classes the room carries — `message.received` bodies
  (`GatewayExchange.publishMessageReceived`), message delivery status (`message.error`/
  `message.ack` via `ConnectorRelayService`), and the `MESSAGE_SENT` id-discovery broadcast (ids of
  conversations every active authenticated identity may view). Explicitly **out** of this
  disposition: conversation-scoped typing **receipt** → **TM-015** (adjudicated
  `not-a-finding`); typing/presence **identity spoofing** → **TM-014** (open, Sev-4); relay
  **injection** → **TM-013** (open, Sev-3); **presence delivery** is not part of this room-join
  flow at all — presence is a global broadcast (`WebSocketPresenceService` `publishToAll`;
  frozen `WS-OP-PRES-001..004`), never room-delivered. Status unchanged:
  `resolved-policy (candidate)`; no code change, no waiver, no reclassification.
- **What this disposition does not cover.** (a) The **publish/inject** side of the same rooms — any
  authenticated session can emit the `connector.*` relay ops into them — is a write/spoofing surface
  the view policy does not settle: **TM-013** (open). (b) Typing **identity spoofing** carried on
  the fan-out and **global presence identity**: **TM-014** (open, Sev-4 — spoofing scope only).
  (c) Conversation-scoped typing **receipt** by room subscribers: **TM-015** (adjudicated
  `not-a-finding`, excluded from counts). (d) **Presence delivery** — not part of this
  room-join flow; presence is a global broadcast, not room-scoped (revision-4 correction). (e) The
  AC-2 effect of a policy-resolved disposition is not declared by the builder (ledger header;
  threat-model §6).
- **Evidence.** Revision `f83863f` (all cited WS files unchanged since `1300436` and `f9436c6` —
  the `f9436c6 → f83863f` delta is exactly the five #442 remediation files); accepted records
  cited above. No code change, no waiver, no reclassification.

### TM-002 — REST conversation-content read paths lack resource-level authorization — re-dispositioned `resolved-policy (candidate)`; write half split to TM-012 (Sev-2 at revision 1)

- **Surface / artifacts (read half).** Identity/RBAC surface (§4 S1): `GET /api/conversations`
  (`ConversationsController.list`), `GET /api/conversations/{id}` (`get`,
  `ConversationsController.java:48-72`), `GET /api/conversations/{conversationId}/messages`
  (`MessageController.list`, `:59-71`), `GET …/{messageId}/status` (`status`, `:105-111` —
  re-anchored at `f83863f` after the #442 send guard shifted the file),
  `GET /api/conversations/{conversationId}/notes` (`NotesController.list`, `:40-49`) — all
  authenticated-only (`anyRequest().authenticated()`), none applies
  `ConversationAccessService.canAccess`.
- **Revision-1 finding (recorded for history).** Any authenticated `user`-role identity could read
  full message/note content of any conversation — Sev-2 authenticated cross-boundary read under the
  then-accepted assignment-bounded view contract; frozen rows for the reads
  (`ledger-mig-001-rest.md` REST-CONV-001/002, Messages section, reconciled copy in
  `ledger-mig-003-reconciled.md`) had **no RBAC cell** (parity-mandated, Node baseline equally open
  at `controllers/conversations.controller.ts:123-131`), which put the disposition at a
  frozen-contract vs locked-matrix conflict resolvable only by the founder (E2).
- **Re-assessment (revision 2).** That founder-level conflict is **resolved**: the founder chose
  shared-inbox viewing (2026-10-18) and #437 merged the corrected product records
  (`.docs/01-product-specification.md` §2/§3/Story 1.3 + Locked P0 Role Matrix — View all
  conversations: ✅ all roles, with the dated founder note at L469; `.docs/05-quick-reference.md`
  §P0 Role Matrix). The frozen contract's "any authenticated user" read descriptions now **agree**
  with the corrected product records — both accepted sources state the same read scope, and the
  code matches both. **Disposition: no longer a finding because the documented boundary it depended
  on has changed — recorded as `resolved-policy (candidate)`.**
- **Split (per the re-assessment activation record).** Revision-1 TM-002 bundled the notes **create**
  path (`POST …/notes`) with the reads. A view-policy change cannot settle a write path: the
  notes-create path was assessed on its own evidence as **TM-012** — adjudicated **not-a-finding**
  (tech-lead, 2026-10-20; see §2 below).
- **What this disposition does not cover.** The write surfaces (`POST …/messages` → TM-011;
  `POST …/notes` → TM-012) and the AC-2 effect of the disposition itself (not declared by the
  builder).
- **Evidence.** Revision `f83863f` (cited files unchanged since `1300436`/`f9436c6` outside the
  #442 remediation files — `MessageController` re-anchored); accepted records cited above; frozen
  rows cited read-only (E2 honored). No code change, no waiver, no reclassification.

### TM-011 — `POST /api/conversations/{id}/messages`: accepted-record reply boundary not enforced (Sev-2 — new in revision 2; remediation merged in revision 5, status `remediated (proposed)`)

- **Surface / artifacts (pre-remediation, recorded for history).** §4 S1. `MessageController.send`
  (`MessageController.java:73-90` at `f83863f`; `:70-79` before the remediation) accepted
  any authenticated principal with **no role or assignment check**; `MessageService.send`
  (`MessageService.java:78-91`) applies `requireConversation` (existence) only; the persisted
  `PENDING` message then triggers `MessageCreatedEvent` → `GatewayExchange` **external dispatch** to
  Telegram/IRC — a customer-facing side effect. Contrast: `MessageController.retry` enforces the
  assignment bound for `USER` (`:97-100` at `f83863f`, `ConversationAccessService.isAssignedTo`);
  `ConversationAccessService.canAccess` (`api/conversation/ConversationAccessService.java:31-42`) is applied nowhere on the send path.
- **Observed check/absence (pre-remediation).** Absent: no role check, no assignment check, on any
  role. A self-registered/OIDC `USER` (`UserRole.USER` is the provisioning default:
  `AuthenticationService.java:130-136`, `OidcIdentityService.java` USER-only rule) could post an
  outbound reply on **any** conversation id.
- **Applicable approved record.** The accepted records keep `USER` reply **assignment-bound**:
  `.docs/01-product-specification.md` Locked P0 Role Matrix L466 "Reply on conversation … User ✅
  (if assigned)" (with the founder note L469), `.docs/05-quick-reference.md` Reply row, and the
  founder decision bounds on #367 ("USER reply/retry stay assignment-bound"). The shared-view
  decision universalized **viewing only**.
- **Contract interplay (recorded, E2).** The frozen baseline documented the open behavior:
  `openapi.yaml` op `sendConversationMessage` — "roles user/manager/admin/super_admin",
  403 declared only as "Role not allowed" (never triggerable for the four listed roles, no
  assignment qualifier); ledger `REST-MSG-002` listed the roles with no assignment qualifier. The
  frozen set is cite-only in MIG-073 and was never edited here: the founder explicitly authorized
  the minimal reconciliation (Option A) and **#442 performed it** — the op summary, the 403
  description, a dated provenance block, and the `REST-MSG-002` cells now record the
  assignment-bound `user`-role send rule (see the remediation evidence below).
- **Disposition (revisions 2–4, historical).** **Still a finding.** The view policy does not touch
  reply scope; the current, founder-approved product record explicitly bounds `USER` reply to
  assigned conversations, and no code path enforces it. This is a security control failing to
  enforce its documented (accepted) policy with a plausible attack path.
- **Severity rationale (historical).** Sev-2 per the stated definitions: an authenticated principal
  exceeds the accepted authorization boundary (assignment-bound reply) with real integrity impact —
  an unassigned identity sends customer-facing outbound communication that is dispatched to the
  external platform. Not Sev-1: authentication required; no auth-bypass/secret exposure; no
  privilege escalation across identities.
- **Attack path (historical, closed by the remediation if validated).** Self-register (USER) →
  authenticate → `POST /api/conversations/{any id}/messages` → 201/PENDING → gateway dispatch
  delivers the message to the customer thread of an unassigned conversation.
- **Remediation (revision 5 — merged in #442/PR #443; recorded as `remediated (proposed)`, not
  adjudicated here).**
  1. **Controller guard** (`MessageController.java:79-86` @ `f83863f`): `access.exists(conversationId)`
      → `NotFoundException` 404 first (every role, unchanged existence semantics), then
      `principal.getRole() == USER && !access.isAssignedTo(conversationId, principal.getId())` →
      `ForbiddenException` 403 — both **before** `messages.send(...)` (`:87`), so a denial persists
      no `Message` row and publishes no `MessageCreatedEvent` (no external dispatch side effect;
      `MessageService.send` persists at `:88` and publishes at `:89`, only when called). One import
      + one guard pair; the service, security chain, retry, and all other endpoints are unchanged.
  2. **Integration test** `MessageApiIntegrationTest#sendRequiresAssignmentForUserRole`
      (`MessageApiIntegrationTest.java:147-240`): assigned USER 201 with the unchanged frozen
      `{data}` wire and exactly one new row; unassigned USER 403 with the pinned body on both the
      other-assignee and unassigned variants with row count unchanged (the observable no-side-effect
      proof); SUPER_ADMIN/ADMIN/MANAGER 201 on other-assignee and unassigned conversations
      (privileged behavior unchanged); 404 existence precedence preserved for both role classes.
  3. **Authorized frozen reconciliation** (founder Option A; performed in #442 only — E2/E5
      honored): `openapi.yaml` op `sendConversationMessage` summary `:891` ("user only when
      assigned") + 403 description `:910` ("…or user-role identity not assigned to the
      conversation") + dated provenance block `:63-70`; byte-identical test copy
      `services/backend-java/src/test/resources/contract/openapi.yaml` (`diff -q` verified at this
      revision); `ledger-mig-003-reconciled.md` REST-MSG-002 row `:132` (Route/Behavior and
      Required-target-behavior cells + Evidence location citing the new test) with `amended_at`/
      `amendments` front matter `:10-15`. No other frozen row, `version`, or `row_count` changed.
  4. **Verification of record** (from #442/#443 — not re-run by this docs-only issue): focused
      `MessageApiIntegrationTest` green, `contractTest` green, full `check` incl. JaCoCo ≥85% green,
      full-suite 558 tests / 0 failures; PR #443 CI `build-test`/`lint`/`test`/`contract-tests`/
      `package` SUCCESS. Formal PR #443 approval was founder-waived for the exact merged head and
      recorded pre-merge — a waived approval action, not a content waiver, and it has **no** AC-2
      or cutover effect.
- **Status and routing (revision 5).** TM-011 is recorded **`remediated (proposed)`**: the
  remediation has merged to `dev` @ `f83863f`, but this ledger does not adjudicate it. The fresh
  independent reviewer assessment at this issue's exact head must validate the evidence above
  (guard ordering, no-side-effect proof, test coverage, frozen-reconciliation minimality), and the
  AC-MIG-073-2 outcome — whether the gate is satisfied or any further action is required — is the
  **reviewer's and tech-lead's** decision recorded at that head. Until then: the open-Sev-2 count at
  the last independently validated revision (4) stands at 1, the AC-MIG-073-2 checkbox remains
  unchecked, and this document makes **no waiver, no residual-acceptance, and no cutover claim**.
  - *Historical decision context (rationale for the founder choice; superseded "pending" state
    retained for provenance):* the frozen `sendConversationMessage`/`REST-MSG-002` recorded a
    role-only target (contrast the frozen tags ops "with conversation access" + 403 and retry "all
    roles if assigned"), so a code fix changed documented target behavior and the frozen
    reconciliation required explicit founder authorization (ADR-023 / E2) — hence the A/B/C set:
    A fix + reconcile (authorized and executed via #442), B code-only while frozen prose stays
    stale, C no fix with explicit residual acceptance.
  **At revision 4 this finding blocked MIG-072 cutover. At revision 5 the remediation has merged,
  but this document records no cutover change: the block is considered lifted only if the fresh
  independent reviewer validates the remediation and tech-lead records the AC-MIG-073-2 outcome.**

### TM-012 — `POST /api/conversations/{id}/notes`: notes-creation resource authorization — adjudicated **not a finding** (tech-lead, 2026-10-20)

- **Surface / artifacts.** §4 S1. `NotesController.create` (`NotesController.java:51-57`) accepts
  any authenticated principal; `NoteService.create` (`NoteService.java:64-83`) applies
  `requireConversation` (`conversations.exists(...)` only — `:117-121`); the note is persisted with
  the authenticated author, @mentions resolved into notifications, and a `note.created` audit event.
- **Adjudication (tech-lead, 2026-10-20; #367 comment `6291002089`).** **Not a finding**: the
  accepted records reconcile on the all-roles authenticated notes-create reading (formerly reading
  (i) below), and the code matches every accepted record. Evidence, verified directly:
  1. **The frozen contract deliberately records the absence of a resource qualifier.**
     `openapi.yaml:965-987` op `createConversationNote` — summary "Create note with mention parsing
     (**any authenticated user**)", responses 400/404 only, **no 403**, no access qualifier. The
     frozen contract is *not* silent because it lacks vocabulary: the tag ops
     (`addTagToConversation` `:1033-1055`, `removeTagFromConversation` `:1056-…`) say "*with
     conversation access*; GOV-021" and declare `403: No conversation access`. The notes/tags
     asymmetry is a deliberate frozen capture, not an omission.
  2. **Binding ledger asymmetry.** `ledger-mig-003-reconciled.md` `REST-NOTE-002` carries no
     RBAC/resource cell (baseline provenance `ledger-mig-001-rest.md:101` likewise), while
     `REST-TAG-003/004` explicitly declare a resource-level conversation access check.
  3. **`GOV-021` gives the capability to all four roles with no resource qualifier.**
     `GOV-021-phase2-architecture-decisions.md:53`: "Notes: create (internal)" ✅
     Super Admin/Admin/Manager/User; "Notes: view" ✅ all four.
  4. **The product record names notes-create as an explicit `User` capability, unscoped.**
     `.docs/01-product-specification.md:43` — `User`: "View all conversations, reply/retry on
     assigned conversations, use tags, **create notes**". Story 3.1 states internal-note ACs with
     no role or resource restriction; the only restriction on that role row is reply/retry.
  5. **The founder expressly preserved this.** Decision bound "**notes-creation semantics
     unchanged**" (#367 comment `6268859088`); #437 amended the founder-approved **view** wording
     only — nothing touched note creation.
  6. **The code matches every accepted record.** Authenticated-only controller, existence-only
     service check — exactly the frozen-contract surface. No accepted-record boundary is crossed,
     and no plausible attack path crosses one: the write is internal-only (never outbound),
     authorship is audited (`note.created` with the true author).
- **Contrary reading (recorded caveat, not a finding).** The earlier strategist reconciliation read
  `GOV-021`'s capability ✅ as applying *within resource authorization* (formerly reading (ii)):
  notes/tags usable on accessible conversations, preserving an assignment-scoped create for `USER`.
  The founder instead chose universal viewing, and **no approved record resource-qualifies
  notes-create**; the frozen contract's tags/notes asymmetry shows the restriction would have been
  recorded had it existed. If the founder later wants notes-create resource-scoped, that is a
  **new product decision**, not a live finding, and it must not be smuggled in through this ledger.
- **Disposition.** **`not-a-finding (adjudicated)`** — TM-012 leaves the finding set. This is
  **not** a waiver (nothing was granted), **not** a severity reclassification (no finding remains —
  and this is not a reclassification of any revision-1 finding; revision-1 TM-002 bundled this path
  without a split), and **not** an accepted residual (E4 untouched). The row is retained for ID
  stability (TM-013/TM-014 ids and all published cross-references stay unchanged) and is **excluded
  from finding counts**. **No gate effect**: AC-MIG-073-2 is unaffected by this adjudication (its
  state — unmet at the last independently validated revision 4 while TM-011 was open, now pending
  the fresh reviewer validation of TM-011's proposed remediation — is recorded in the report, §3).
  No code change, no waiver, and no residual acceptance is
  involved.
- **Evidence.** Revision `f83863f` (cited files unchanged since `1300436`/`f9436c6` — the delta is
  the five #442 remediation files); files/records cited above;
  frozen rows cited read-only (E2).

### TM-013 — Connector relay/subscribe ops accept any authenticated session (Sev-3, open — new in revision 2)

- **Surface / artifacts.** §4 S5/S6. `YaccWebSocketHandler.handleTextMessage`
  (`YaccWebSocketHandler.java:131-138`) routes `connector.message.received|status.changed|
  message.error|message.ack` from **any authenticated WS session** to `ConnectorRelayService`;
  `connector.subscribe` joins `connector:{platform}` with no role gate (`:205-215`).
  `ConnectorRelayService` (`ConnectorRelayService.java:57-132`) validates only the frozen payload
  shape/platform vocabulary and publishes the **client-supplied** payloads — including `body`,
  `senderId`, `senderName` — into `conversation:{id}` rooms, and broadcasts `connector.status` to
  **all** sessions (`publishToAll`, `:90`). No first-party client emits these ops (grep over
  `packages/frontend/src` and `packages/frontend-angular/src`: 0 matches); they mirror ingest-side
  platform events that normally arrive over TB5 (`GatewayExchange.ingest` — persisted + audited).
  The relay path is **not persisted** — it publishes to rooms only.
- **Applicable approved record.** Frozen rows `WS-OP-CONN-001/002/005/006`
  (`ledger-mig-002-realtime.md:99-104`) declare the ops with **no caller role** — the contract is
  silent, which is not an approval of any-session access but also not a documented policy the code
  violates. Integration *administration* is SUPER_ADMIN-only (`@PreAuthorize` matrix, S1.2), which
  bounds profile management, not the relay ops. The role matrix makes `USER` (the self-registration
  default) the least-privileged role — and it reaches these ops.
- **Impact.** Any authenticated session can inject spoofed realtime content into any conversation
  room — fake inbound messages attributed to arbitrary platform senders (client-chosen
  `senderName`/`senderId`/`body`), fake delivery acks/errors, and fake platform status broadcasts
  visible to every connected operator. Deception/confusion impact on the realtime channel;
  transient (non-persisted; a reload shows DB truth); ingestion integrity (TB5) is unaffected.
- **Disposition.** **Remains a finding** — a write/spoofing surface the view policy does not settle
  (TM-001's resolved-policy disposition covers receiving room content, not emitting into it).
- **Severity rationale.** Sev-3 (candidate, recorded for reviewer confirmation): exploitation
  requires authentication; impact is transient/non-persisted; no documented policy is breached
  (frozen ops declare no caller role), so neither Sev-2 clause cleanly applies. The reviewer may
  weigh the operator-deception impact differently (up to Sev-2) — recorded here with reasoning, not
  asserted.
- **Evidence.** Revision `f83863f` (cited files unchanged since `1300436`/`f9436c6` — the delta is
  the five #442 remediation files); files cited above; frozen rows
  cited read-only (E2).
- **Routing.** E1 note → tech-lead: caller-role gating (or narrowing the ops to a server-internal
  path) is a remediation decision touching frozen-documented surface (E2). Related but distinct
  from the nine *unimplemented* frozen inbound ops pending the separate founder decision — those
  are `conversation.updated`/`message.sent|failed|retry`/`message.received.ack`/`reaction.*`, not
  these four relay ops. **Does not block cutover by itself (Sev-3).**

### TM-014 — Ephemeral presence/typing fan-out trusts client-declared identity (Sev-4, open — new in revision 2, widened in revision 4)

- **Surface / artifacts.** §4 S5. `WebSocketTypingService.onTypingStarted/Stopped/Timeout`
  (`WebSocketTypingService.java:44-88`) accepts client-supplied `conversationId`/`userId`/`name`
  and fans out to the `conversation:{id}` room, excluding only the sender's session id. The global
  **presence** plane is equally client-declared: `WebSocketPresenceService`
  (`WebSocketPresenceService.java:58-88,130-146`) publishes `presence.updated` / `user.online` /
  `user.offline` / `user.status` from client-supplied payloads through `publisher.publishToAll`
  (baseline `socket.broadcast.emit`, GOV-014:150-157; frozen `WS-OP-PRES-001..004`), and the
  `online.users` roster replies with session-registry user ids. The
  authenticated handshake identity (`RealtimeSession` — verified `userId`/`email`/`name` attached by
  `WebSocketHandshakeAuthInterceptor`) is **not** used in the fan-out payloads. Frozen
  `WS-OP-TYPE-001..004` and `WS-OP-PRES-001..004` define the payloads with client-declared identity
  (baseline parity).
- **Scope note (revision 4).** TM-014 covers **identity spoofing** only — the client-declared
  `userId`/`name` on the typing fan-out and the client-declared identity on the global presence
  broadcast. Conversation-scoped typing **receipt** is a separate disposition: **TM-015**
  (adjudicated `not-a-finding`).
- **Impact.** An authenticated session can display any user's typing indicator in any room it has
  joined (with TM-001's open join: any room) and spoof presence/status on the team-wide global
  broadcast — spoofed identity, UI-level deception; transient, no
  persisted-data or confidentiality impact.
- **Disposition.** **Remains a finding** (spoofing/hardening): documented-by-design wire posture
  (the frozen payload shape itself carries client-declared identity), baseline parity, no AC-2
  class impact.
- **Severity rationale.** Sev-4: documented design posture with no plausible
  confidentiality/integrity impact on platform data under the stated envelope (same class as
  TM-008). Hardening direction (server-side identity binding at fan-out) noted for tech-lead.
- **Evidence.** Revision `f83863f` (cited files unchanged since `1300436`/`f9436c6` — the delta is
  the five #442 remediation files); files cited above.
- **Routing.** tech-lead hardening backlog; no code change in MIG-073 (E5). **Does not block
  cutover (Sev-4).**

### TM-015 — Conversation-scoped typing receipt by any authenticated room subscriber — adjudicated **not a finding** (tech-lead, 2026-10-20)

- **Observed behavior.** §4 S5. `subscribe.conversation` joins `conversation:{id}` unconditionally
  (`YaccWebSocketHandler.java:177-188`, room join `:184` — no role, assignment, or existence
  check); the room then carries the typing fan-out (`WebSocketTypingService.java:52/:65/:82` —
  `typing.started`/`typing.stopped` with client-declared `userId`/`name`). Any authenticated
  session that knows a conversation id can therefore receive conversation-scoped typing activity
  for it. **Presence is not part of this flow**: presence events are published through
  `publisher.publishToAll` (`WebSocketPresenceService.java:58-88`; baseline `socket.broadcast.emit`,
  GOV-014:150-157; frozen `WS-OP-PRES-001..004` — "broadcast all except sender"), so no room join
  gates them. Typing and presence are not backlog-eligible (`WebSocketBacklogService.
  ELIGIBLE_EVENTS` excludes both) — ephemeral, never replayed.
- **Applicable accepted records (verified directly).**
  - Founder decision 2026-10-18 (#367 comment `6268859088`) names **messages, status, notes** as
    the view classes; it is silent on typing receipt.
  - The product records accept typing as a conversation-view behavior **with no role or resource
    qualifier**: `.docs/01-product-specification.md` §5.6 (L187-189, "Typing indicators in
    conversation view") and Story 9.2 (L797-805); Story 9.1 (L786-795) accepts team-wide presence.
  - The frozen target documents the unqualified join (`asyncapi.yaml:369-375` — "Join
    `conversation:{conversationId}` room") and the room fan-out (`WS-OP-TYPE-001..004`); the Node
    baseline is parity (`conversation.controller.ts:107`, `typing.controller.ts:22`).
- **Adjudication reasoning.** No accepted record establishes a **receipt restriction** for typing;
  the positive approvals point the other way — the typing indicator is an accepted conversation-view
  behavior, and the founder's universal view approves every conversation view for every active
  authenticated identity, the conversation room being that view's push channel. Frozen silence is
  not an approval of any-session access (same reading as TM-013), but a finding requires a
  **documented boundary the behavior crosses**, and none exists here — in contrast to TM-011,
  where the product record explicitly bounds reply and the frozen contract omits the bound. The
  residual signal is ephemeral activity metadata (who is typing where), client-declared and
  spoofable by any authenticated session (TM-014), and strictly weaker than the conversation
  content the same principal may view.
- **Caveat (recorded, not converted into a finding).** The product spec is internally inconsistent
  about whether typing/presence are P0 or deferred (L78-80 and L638-639 defer them; L97 and
  §5.6/Stories 9.1/9.2 accept them). That is a feature-scope inconsistency; it does **not**
  restrict who may receive typing, and this issue does not adjudicate product scope. If the
  founder later wants typing receipt restricted, that is a **new product decision** plus a bounded
  hardening issue — it must not be smuggled in through this ledger (mirrors the TM-012 caveat).
- **Disposition.** **`not-a-finding (adjudicated)`** — excluded from finding counts; the row is
  retained for ID stability (TM-001..TM-014 ids and all published cross-references stay
  unchanged). This is **not** a waiver, **not** a severity reclassification, and **not** an
  accepted residual (E4 untouched). No code change is involved. **No gate effect**: AC-MIG-073-2
  is unaffected by this adjudication (its state — unmet at the last independently validated
  revision 4 while TM-011 was open, now pending the fresh reviewer validation of TM-011's proposed
  remediation — is recorded in the report, §3).
- **Evidence.** Revision `f83863f` (cited files unchanged since `1300436`/`f9436c6` — the delta is
  the five #442 remediation files); files/records cited above;
  frozen rows cited read-only (E2).

### TM-003 — Helm env injection does not match the Spring env contract (Sev-3, open)

- **Surface / artifacts.** §4 S7/S11: `deploy/helm/yacc-backend/templates/deployment.yaml` vs
  `services/backend-java/src/main/resources/application.yml`.
- **Facts (each verified at revision `1300436`; byte-identical at `f9436c6` and at `f83863f` —
  the #442 remediation touched no chart/env file).**
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

## 3. Dated finding report — the AC-MIG-073-3 record (final re-assessment)

**Report date**: 2026-10-20 · **Revision of record**: `origin/dev` @
`f83863ffa5d06521bcd0d68f5d49876151a9e235` (PR #443 merge — the #442 TM-011 remediation; the
`f9436c6 → f83863f` delta is exactly the five authorized remediation files) · **Ledger revision**: 5
(final re-assessment at the merged remediation: TM-011 recorded `remediated (proposed)` on merged
commit/test/contract evidence, pending independent validation; revision 4 = review-loop-3
adjudication #367 comment `6291375868`: TM-001 narrowed; TM-015 typing receipt adjudicated
not-a-finding; presence flow corrected; revision 3 = TM-012 not-a-finding adjudication; revision 2
= re-assessment at the merged founder shared-view policy baseline; revision 1 = 2026-10-19 @
`1300436`)

| Severity | Open | Remediated | Accepted-residual | Resolved-policy (candidate) | Total |
|---|---|---|---|---|---|
| Sev-1 | **0** | 0 | 0 | 0 | 0 |
| Sev-2 | 0 *†* | **1** (TM-011 — **proposed**) | 0 | 2 (TM-001, TM-002) | 3 |
| Sev-3 | 5 (TM-003…TM-006, TM-013; TM-005 capture half `unverified`) | 0 | 0 | 0 | 5 |
| Sev-4 | 5 (TM-007…TM-010, TM-014) | 0 | 0 | 0 | 5 |
| **Total** | **10** *†* | **1 (proposed)** | **0** | **2** | **13** |

Not-a-finding (adjudicated): **2 (TM-012, TM-015)** — retained for ID stability, excluded from
totals (**15 ledger rows**).

† *TM-011's `remediated` status is a builder proposal grounded in merged evidence (PR #443, merge
commit `f83863f`; guard, test, and frozen reconciliation cited in §2 TM-011) — it is **not** an
adjudication and no independent reviewer has validated it at this head. If validation rejects any
element, TM-011 returns to `open` and the open Sev-2 count is 1. At the last independently
validated revision (4), the open Sev-2 count was 1 (TM-011).*

- **Statement of outcome.** At this revision the review records **zero open Sev-1 findings** and
  **no independently validated open Sev-2**: the authorized TM-011 remediation (assignment-bound
  `USER` send guard + minimal frozen reconciliation) was implemented and independently reviewed in
  #442, merged via PR #443 to `dev` @ `f83863f`, and is recorded here as
  **`remediated (proposed)`** — with the explicit caveat above that this is a proposal, not a
  settled disposition. TM-012 is adjudicated not-a-finding. Two revision-1 findings (TM-001,
  TM-002) are re-dispositioned `resolved-policy (candidate)` on evidence — the documented
  boundaries they depended on were changed by the founder's shared-view decision merged via #437 —
  and two new findings (TM-013, TM-014) plus the TM-011/TM-012 split complete the assessment of the
  surfaces the view policy does not settle. In revision 4, TM-001 was **narrowed** to the
  founder-named content classes (typing receipt adjudicated separately as the non-finding
  **TM-015**), and the presence flow statement was corrected — presence is a global broadcast
  (`publishToAll`), not room-scoped. In revision 5, every non-TM-011 disposition was re-assessed at
  the new revision and is unchanged.
- **AC-MIG-073-2 is not declared by the builder — in either direction.** This report does not
  assert the gate met (the `remediated` status is proposed, not adjudicated; the two
  `resolved-policy` dispositions are candidate outcomes whose effect on the open count is a
  decision, not an observation) and does not assert it unmet at this revision (the merged evidence
  may satisfy the gate). Per the re-assessment activation guardrail (#367 body §4), whether
  TM-011's remediation plus the policy-resolved dispositions satisfy AC-MIG-073-2 — or any further
  action (E1) is required — is the **fresh independent reviewer assessment's and tech-lead's**
  decision recorded at the exact updated head. The AC-MIG-073-2 checkbox remains unchecked on
  #367, and this report must not be read as asserting either a passing or a finally-failing AC-2
  outcome.
- **No waiver was granted.** No finding was waived and no severity was reclassified to pass AC-2.
  The adjudicated non-findings (TM-012, TM-015) are evidence-based dispositions, not waivers.
  The founder's shared-view decision is a product-policy correction (#437), not a waiver, not
  residual-risk acceptance, and it does not by itself close any finding. The founder's PR #443
  formal-approval waiver is an approval-gate action bound to that exact PR head — it is **not** a
  security waiver and has no AC-2, TM-011-disposition, or cutover effect. No remediation was
  performed inside MIG-073 (out of scope; stops E1/E5): the authorized Option A remediation
  ("fix + reconcile", 2026-10-20) was implemented, reviewed, and merged in
  [#442](https://github.com/csim-sg/yacc/issues/442) / PR #443, not here.
- **Final security posture (pending the fresh reviewer action).** At this record the posture is:
  zero open Sev-1; one Sev-2 finding whose remediation has merged but awaits independent
  validation; five open Sev-3 and five open Sev-4 findings routed to tech-lead decisions/backlog
  (none cutover-blocking by itself); two candidate policy-resolved dispositions awaiting
  adjudication; zero accepted residuals; zero waivers. **No cutover claim is made**: MIG-072's
  blocker state is not lifted or confirmed by this document — the fresh independent reviewer
  assessment at the exact head of this PR must validate (or reject) the TM-011 remediation evidence
  and settle the candidate dispositions, and tech-lead must record the AC-MIG-073-2 outcome before
  any gate state changes.
- **No residual risk was accepted here.** `accepted-residual` is founder-only (guardrail 3 / stop
  E4); the count is zero. TM-008 and TM-007 are recorded `open` with founder-visibility notes.
- **Evidence honesty.** Findings are grounded in merged source/config/contract artifacts at the
  revision above; the re-anchor is explicit (the `f9436c6 → f83863f` delta is exactly the five #442
  remediation files — verified; earlier anchors were unchanged from revision 1 through the #437
  merge); no runtime or environment evidence exists
  or is claimed (no functioning staging deploy path — the Java `deploy` job reports `success` with
  deploy steps skipped when `KUBE_CONFIG_STAGING` is unset). TM-005's log-capture half is explicitly
  `unverified` (E6). The #442/#443 verification records (focused integration test, `contractTest`,
  full `check` incl. JaCoCo ≥85%, 558 tests / 0 failures, green PR CI) are cited as evidence of
  record from those issues — **not** re-run by this docs-only issue. **Presence-flow correction
  (revision 4):** the earlier statement that presence
  was "per-user/room-scoped as designed" was inaccurate — presence events are global broadcasts
  (`WebSocketPresenceService` `publishToAll`, `:58-88`; baseline `socket.broadcast.emit`,
  GOV-014:150-157; frozen `WS-OP-PRES-001..004` declare "broadcast all except sender"), while
  backlog replay remains per-user. Both artifacts are corrected; no finding, severity, or count
  depends on the corrected wording (TM-014 widened to presence identity; typing receipt is TM-015).
  Inventory correction recorded: the reproducible counts at all anchors (`1300436`, `f9436c6`,
  `f83863f`) are
  **349** Java files and **42** `@PreAuthorize` gates (threat-model §3.3); the revision-1 report's
  341/43 was a counting error, corrected at revision 2 — no severity or disposition depends on it.
- **Severity scope.** Sev-1/Sev-2 definitions are the threat-model document's §5, scoped to
  threat-model findings; the phase/test-wide taxonomy and the ledger-wide zero-open report remain
  MIG-091's (#366, AC-MIG-091-4/5). Findings TM-001/TM-002/TM-011 and the adjudicated
  TM-012/TM-015 rows
  are **not** asserted to be
  MIG-091 ledger rows; TM-009 carries only an E7 routing note.
- **Re-review note (from the issue's dependency-semantics record).** If the MIG-071 drill (#362)
  later changes a reviewed control, a targeted re-review of that surface is required against
  AC-MIG-073-2 — recorded here as the standing note; no AC text changes.
