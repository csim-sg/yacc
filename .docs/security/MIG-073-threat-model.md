# MIG-073 — Java/Spring Security Threat Model

**Issue**: csim-sg/yacc#367 (MIG-073) · **Spec**: SPEC-002 (AC-03, AC-04, AC-09) · **Milestone**: #3
**Date**: 2026-10-19 (review performed 2026-10-18/19) · **Author**: builder (managed do-tasks pass) · **Method owner**: `security-review` skill
**Reviewed revision**: `origin/dev` @ `13004361ffb278f865182b4e515f38e02158bc97` (PR #407 merge; local `dev` identical)
**Companion artifact**: [MIG-073-findings-ledger.md](MIG-073-findings-ledger.md) (finding → remediation ledger + dated finding report)

---

## 1. Purpose and outcome

This document is the STRIDE threat model of the complete merged Java/Spring security surface of
`services/backend-java` and its deployment envelope (`deploy/helm/yacc-backend`). It satisfies the
authoring half of AC-MIG-073-1 (every named surface documented by concrete artifact) and states the
Sev-1/Sev-2 severity definitions that scope AC-MIG-073-2 for **threat-model findings**.

Findings, severities, statuses, and the dated finding report live in the companion ledger. The review
outcome is **not** a zero-open-Sev-1/2 state at this revision: two Sev-2 findings are recorded
`open` and route to tech-lead under escalation stop E1. No waiver was granted, no severity was
reclassified, and no remediation was performed inside MIG-073 (fixes are separate issues by scope).

## 2. Scope of review (issue Scope, verified against merged code)

| # | Scope item (issue #367) | Verdict against `dev` @ `1300436` |
|---|---|---|
| 1 | Dual-role OIDC (RP + embedded AS, Spring Authorization Server) | Implemented — §4 S2, S3 |
| 2 | Four-role RBAC + status enforcement | Implemented — §4 S1; findings TM-001/TM-002 |
| 3 | Token/refresh lifecycle | Implemented — §4 S1, S3 |
| 4 | Key rotation (JWKS) | Implemented — §4 S3.4 |
| 5 | Consent/claims/scopes | Implemented — §4 S3 |
| 6 | Deterministic first-run bootstrap + founder-controlled recovery | Implemented — §4 S4 |
| 7 | Secrets handling | Implemented — §4 S7; findings TM-003/TM-004 |
| 8 | Telegram/IRC connector credential handling | Implemented — §4 S6; findings TM-004/TM-006 |
| 9 | Raw WebSocket auth | Implemented — §4 S5; findings TM-001/TM-005 |
| 10 | Cloudflare R2 | **Configured-but-unused** — §4 S9 (E3 documentation, no inferred integration) |
| 11 | SMTP/SendGrid integration | Implemented (live) — §4 S8 |
| 12 | Audit coverage | Implemented — §4 S10; finding TM-009 |

Out of scope (issue): implementing fixes; post-cutover roll-forward findings; decommission (MIG-080).
Node-era packages (`packages/backend`, `packages/common`) are reviewed only where the Java service
reuses their behavior as the frozen-contract baseline (ADR-023); they are not the review target.

## 3. Method, trust boundaries, evidence posture

### 3.1 Method

STRIDE per surface (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service,
Elevation of privilege). Each surface in §4 lists its artifacts, entry points, and the STRIDE
disposition table: **M** = mitigated by a named control (with the enforcing artifact), **F-TM-n** =
recorded finding (ledger), **N/A** = not applicable with reason. Static review of merged
source/config/contract artifacts only — no runtime, staging, or cluster evidence exists and none is
claimed (the Java staging deploy job reports `success` with all deploy steps skipped when
`KUBE_CONFIG_STAGING` is unset). Every ledger claim requiring a live environment is marked
`unverified`/`deferred` there (stop E6).

### 3.2 Trust boundaries

```
 External users/browsers            External IdP (founder-named)        Telegram / IRC networks
        │  HTTPS (ingress, TLS terminates outside pod)     │                       │
        ▼                                                  ▼                       ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│  Pod envelope (ADR-029): non-root uid 1000, read-only rootfs, dropped capabilities     │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Spring Boot 8080                                                                 │  │
│  │  TB1: unauthenticated wire  ── permitAll set (§4 S1.3) ──▶ auth services          │  │
│  │  TB2: bearer JWT         ── resource-server chain ──▶ /api/** (RBAC + resource)   │  │
│  │  TB3: WS upgrade ?token= ── handshake interceptor ──▶ /ws frames (rooms)          │  │
│  │  TB4: AS endpoints       ── AS chain (@Order 1) ──▶ /oauth2/*, /userinfo, discovery│  │
│  │  TB5: connector ingress  ── Telegram long-poll / IRC socket ──▶ GatewayExchange    │  │
│  │  TB6: egress             ── SMTP / SendGrid HTTPS ──▶ auth email flows             │  │
│  └─────────────────────────────────────────────────────────────────────────────────┘  │
│   env: K8s Secrets (bootstrap/recovery/token/encryption/email [+ R2, unused])          │
└───────────────────────────────────────────────────────────────────────────────────────┐
        ▼ JDBC (PostgreSQL 15; Flyway schema; AES-256-GCM credential columns)
   PostgreSQL (trust boundary TB7: DB compromise ⇒ credential ciphertext + hashes, no keys)
```

Trust boundaries: **TB1** anonymous→authenticated (public auth endpoints), **TB2** token→identity
(resource server), **TB3** browser upgrade→WS session, **TB4** OAuth client→AS, **TB5** platform
network→ingest, **TB6** service→email provider, **TB7** service→database, **TB8** cluster→pod
(K8s Secrets → env). Process-local state (in-memory AS grant store, WS registry, rate-limit windows)
is bounded by the single-instance envelope (ADR-024/ADR-029) and is not a trust boundary.

### 3.3 Reproducible inventory commands

Recorded per the issue Verification section (run at the review worktree, `dev` @ `1300436`):

```bash
git rev-parse origin/dev                                  # 13004361ffb278f865182b4e515f38e02158bc97
find services/backend-java/src/main/java/com/yacc -name '*.java' | sort      # 341 files, §4 inventory source
grep -rn "@PreAuthorize" services/backend-java/src/main/java --include='*.java'   # 43 RBAC gates (§4 S1.2)
grep -rnE "@(Request|Get|Post|Put|Patch|Delete)Mapping" services/backend-java/src/main/java \
      --include='*Controller.java'                        # full route map (§4 S1.3)
grep -rn "permitAll" services/backend-java/src/main/java/com/yacc/api/auth/AuthSecurityConfig.java
grep -nE "YACC_[A-Z_]+|RECOVERY_[A-Z]+" services/backend-java/src/main/resources/application.yml
grep -nE "secretKeyRef|name: [A-Z_]+" deploy/helm/yacc-backend/templates/deployment.yaml
grep -rniE "cloudflare|r2|amazon|s3client" services/backend-java/src/main \
      services/backend-java/build.gradle.kts              # only the word "draws" matches ⇒ no R2/S3 client
grep -n -i "attachment" .docs/migration/openapi.yaml      # attachmentIds (message body) only; no attachment route
```

## 4. Surface inventory and STRIDE analysis

Every entry names its artifact(s). Route = frozen wire path; key = config key / env var.

### S1 — Identity fabric: password authn, tokens, RBAC, status enforcement (MIG-030)

**Artifacts.** `api/auth/AuthController.java` (routes below); `service/AuthenticationService.java`;
`service/JwtTokenService.java`; `service/TokenAuthenticationService.java`;
`service/BearerTokenAuthenticationConverter.java`; `service/SessionService.java`;
`service/YaccUserDetailsService.java`; `api/auth/AuthSecurityConfig.java`;
`api/auth/ForcedPasswordChangeFilter.java`; `api/auth/PasswordResetRateLimitFilter.java`;
`api/auth/RestAuthenticationEntryPoint.java`; `api/auth/RestAccessDeniedHandler.java`;
`api/auth/AuthUser.java`; `entity/User.java`; `entity/Session.java`; `entity/UserRole.java`;
`entity/UserStatus.java`; `api/auth/AuthProperties.java` (record `Token`);
`application.yml` `yacc.auth.token.*` (keys `signing-key` ← `YACC_AUTH_TOKEN_SIGNING_KEY`,
`access-ttl: 30m`, `refresh-ttl: 30d`).

**Flows and properties.**

- **S1.1 Credential sign-in / registration.** Routes `POST /api/auth/sign-in/email`,
  `POST /api/auth/sign-up/email` (both in the permitAll set). `AuthenticationService.signUp`
  hard-assigns `UserRole.USER` (`AuthenticationService.java:130-136`) — no self-elevation at
  registration. BCrypt hashing (`AuthSecurityConfig.passwordEncoder`, `$2a/$2b` compatible).
- **S1.2 RBAC matrix.** `entity/UserRole.java` defines exactly `SUPER_ADMIN`, `ADMIN`, `MANAGER`,
  `USER` (PG enum `user_role`); no role inheritance. Method security (`@EnableMethodSecurity`) with
  43 `@PreAuthorize` gates across `UsersController` (all 4 mutations SUPER_ADMIN-only),
  `AuditLogsQueryController`, `ConversationAuditController`, `ConversationsController`,
  `BulkActionController`, `AssignmentController` (in-code USER deny), `QueueController`,
  `DlqController`, `RoutingRulesController`, `IrcProfileController`, `IrcIntegrationController`.
  Resource-level check `ConversationAccessService.canAccess` (user ⇒ assigned-only, fail-closed for
  unknown roles) is applied at `ConversationTagController.addTag/removeTag` and
  `MessageController.retry`. **Finding TM-002**: the conversation-content read paths (list/detail,
  message list/status, notes) are authenticated-only and do not apply the resource check — ledger.
  `GET /api/users/roles` (`UsersController.java:93`) has no `@PreAuthorize` and returns static role
  labels only (`RolesResponse.defaults()`) — no identity data; documented, no finding.
- **S1.3 Public wire surface (permitAll, `AuthSecurityConfig.authorizeHttpRequests`).**
  Exactly: `/health`, `/health/**`, `/actuator/health/**`, `/actuator/prometheus`, `/error`,
  `realtimeProperties.websocket().path()` (`/ws`), `/api/auth/sign-in/email`,
  `/api/auth/sign-up/email`, `/api/auth/refresh-token`, `/api/auth/forgot-password`,
  `/api/auth/reset-password`, `/api/auth/verify-email`; plus `/api/auth/oidc/**` only when the RP is
  enabled (S2). Everything else: `anyRequest().authenticated()`. **Finding TM-007**:
  `/actuator/prometheus` is unauthenticated scrape surface (frozen ADR-029 path) — ledger.
- **S1.4 Token fabric.** RS256 access tokens, `JwtTokenService` (base64 PKCS#8 RSA ≥2048-bit,
  fail-closed construction `parseKey`; public key CRT-derived; keyID `yacc-access-token`); claims
  `iss` (`yacc` or the AS issuer), `sub`, `sid`, `email`, `role` (informational — authorities always
  re-resolve from the DB via `TokenAuthenticationService.requireActive`). Decoder: signature +
  `JwtTimestampValidator(Duration.ZERO)` + dual-issuer allow-list validator
  (`JwtTokenService.issuerValidator`) — zero clock skew, fail-closed issuer set.
- **S1.5 Refresh-grant lifecycle.** `SessionService`: 256-bit `SecureRandom` opaque grants persisted
  as `session` rows; rotation = delete+issue in one transaction (`rotate`); single-grant revoke
  (`revoke(sessionId, ownerId)` — ownership-filtered); `revokeAllForUser` on credential replacement.
  Sign-out revokes the grant named by the presented token's `sid` claim
  (`AuthController.sessionIdOf`). Access TTL 30m / refresh TTL 30d (`AuthProperties.Token`).
- **S1.6 Status + forced-password-change enforcement.** `BearerTokenAuthenticationConverter` →
  `TokenAuthenticationService.authenticate` per request: unknown identity or status ≠ `ACTIVE` ⇒ 401.
  `ForcedPasswordChangeFilter`: identities flagged `must_change_password` are 403-denied everywhere
  except `/api/auth/*`, `/health`, `/actuator` (`ALLOWED_PREFIXES`). Same seam backs the WS
  handshake (S5) and the AS grant store (S3).
- **S1.7 Credential-recovery flows.** Routes `POST /api/auth/forgot-password`,
  `POST /api/auth/reset-password`, `POST /api/auth/verify-email` (permitAll);
  `PasswordResetRateLimitFilter` — fixed-window 3 req/h/IP on exactly those two reset routes, 429 +
  `RateLimit-*` headers; constant anti-enumeration 200 answer (`FORGOT_PASSWORD_RESPONSE`);
  256-bit single-use tokens stored as bcrypt digests (`PasswordResetService`,
  `EmailVerificationService`; format gate `[0-9a-f]{64}`; race-lost consumption ⇒ generic 400).
  Successful reset/verify clears `must_change_password` and revokes all grants.
  **Finding TM-010**: rate limiter keys on `request.getRemoteAddr()` with in-memory state — proxy
  topology caveat — ledger.
- **S1.8 CSRF / sessions.** CSRF disabled and `STATELESS` sessions on the API chain — every
  authentication is Bearer-token-carried, never cookie-authenticated
  (`AuthSecurityConfig` javadoc; consistent with the AS chain, S3).

| STRIDE | Disposition |
|---|---|
| Spoofing | **M** — signature + issuer allow-list + expiry enforced by `JwtTokenService` decoder on every request; DB-resolved authorities (role claim never authoritative). Registration cannot mint privileged roles (S1.1). |
| Tampering | **M** — token integrity by RS256; grant rows opaque random, server-side only; bcrypt digests for reset/verify tokens. |
| Repudiation | **M** — login failure/reset issuance/rotation audited (S10); `SecurityAuditEventListener` records Spring auth events. |
| Info disclosure | **F-TM-002** (read paths without resource check); **M** otherwise — error bodies are the frozen generic 401/403 JSON (`RestAuthenticationEntryPoint`/`RestAccessDeniedHandler`); anti-enumeration constant answers (S1.7). |
| DoS | **F-TM-010** (rate limiter topology caveat); **M** otherwise — bcrypt cost bounds brute force; stateless verification is O(1). |
| Elevation | **M** — `@PreAuthorize` matrix + USER-only registration + in-code USER denies; SUPER_ADMIN provisioning only via bootstrap/recovery (S4). |

### S2 — OIDC relying party (MIG-032)

**Artifacts.** `api/auth/OAuth2LoginConfig.java` (whole `@Configuration` behind
`@ConditionalOnProperty(yacc.auth.oauth2.enabled=true)`; default off — `application.yml`
`enabled: ${YACC_AUTH_OAUTH2_ENABLED:false}`); `service/YaccOidcUserService.java`;
`service/OidcIdentityService.java`; `api/auth/OidcLoginSuccessHandler.java`;
`api/auth/OidcLoginFailureHandler.java`; `api/auth/YaccOidcUser.java`; `entity/Account.java`;
`api/auth/AuthProperties.java` record `OAuth2.Registration` (keys
`yacc.auth.oauth2.registrations.<id>.*` ← env `YACC_AUTH_OAUTH2_REGISTRATIONS_<ID>_*`).

**Flows and properties.** Public RP surface `/api/auth/oidc/**` exists only when enabled
(`OAuth2LoginConfig.PUBLIC_MATCHER`; the chain is byte-identical with the flag off). Registrations
are validated eagerly and fail-closed: blank id/secret/**issuer**/authorization/token/JWKS URIs all
fail startup (`requireNonNull`) — the required `issuer-uri` closes the foreign-`iss` gap (code
comment "Review Loop 1, finding 1"). ID-token signature/issuer/audience/timestamp validation is the
standard `OidcUserService` path. Identity resolution (`OidcIdentityService.resolve`) is the fixed
six-rule set: existing link → verified-email deterministic link (requires
`emailVerified == true`, else `unverified_external_email` deny) → USER-only provisioning with an
unusable random local credential → ACTIVE-status enforcement at every rule → audit on every outcome
(`user.oidc.linked`, `user.oidc.provisioned`, `user.login.failed`); wire denials are the uniform
`invalid_identity` 401 (anti-enumeration). Success completes with the canonical session contract
(refresh grant + RS256 access token) via `OidcLoginSuccessHandler`; failure answers the frozen 401
body.

| STRIDE | Disposition |
|---|---|
| Spoofing | **M** — standard IdP token validation + required issuer binding; link/provision requires a *verified* external email; subject keying is (registrationId, subject). |
| Tampering | **M** — links are server-side `account` rows keyed by IdP subject; no client-asserted identity enters the resolution. |
| Repudiation | **M** — every outcome (link, provision, deny+reason) audited. |
| Info disclosure | **M** — uniform denial body; reasons audit-only. |
| DoS | **M** — disabled by default; IdP availability is external. |
| Elevation | **M** — provisioning is hard-locked to `UserRole.USER`; privileged grants remain SUPER_ADMIN-only paths (S4). Residual: the deterministic verified-email link rule trusts the configured IdP's `email_verified` claim — founder controls the IdP allow-list (config-only surface; no finding: trust is explicit and configuration-owned). |

### S3 — Embedded OIDC authorization server (MIG-033)

**Artifacts.** `api/auth/AuthorizationServerConfig.java` (AS chain, `@Order(1)`, endpoints matcher
only: `/oauth2/authorize`, `/oauth2/token`, `/oauth2/jwks`, `/oauth2/revoke`, `/oauth2/consent`,
`/.well-known/openid-configuration`, `/userinfo` — framework-served, no hand-rolled controllers);
`api/auth/AsClientPolicy.java` (implements `RegisteredClientRepository`);
`api/auth/AsOidcTokenCustomizer.java`; `api/auth/AsStatusEnforcingAuthorizationService.java`;
`api/auth/AsPublicClientAuthenticationProvider.java`; `api/auth/AsRefreshTokenGenerator.java`;
`api/auth/AsRefreshTokenSerializationFilter.java`; `api/auth/AsClientAuthenticationConverter.java`;
`api/auth/AsUserInfoProjection.java`; `api/auth/AuthProperties.java` records `As`/`AsClient` (keys
`yacc.auth.as.issuer` ← `YACC_AUTH_AS_ISSUER`; `yacc.auth.as.clients.yacc-frontend.*` ←
`YACC_AUTH_AS_CLIENT_YACC_FRONTEND_*`).

**Flows and properties.**

- **S3.1 Client policy.** Public SPA clients only: `ClientAuthenticationMethod.NONE`, authorization
  code + `requireProofKey(true)` (PKCE S256 mandatory), `requireAuthorizationConsent(true)`,
  exact-match redirect URIs (fail-closed, no wildcards), `openid` scope mandatory, refresh grant;
  client-credentials deliberately absent (`AsClientPolicy`; no machine client is named).
- **S3.2 Resource-owner authentication at the AS.** The authorization endpoint authenticates the
  user with the ordinary MIG-030 bearer token via an explicit `BearerTokenAuthenticationFilter`
  positioned before the endpoint filter, sharing `JwtTokenService.jwtDecoder` and the
  status-enforcing converter — inactive/suspended identities are denied at the AS exactly as on REST
  (`AuthorizationServerConfig.authorizationServerSecurityFilterChain`).
- **S3.3 Token issuance.** One format (RS256 JWT) from the shared `JWKSource` (`jwkSource` bean ←
  `JwtTokenService.signingKey()`); refresh tokens for public clients via `AsRefreshTokenGenerator`
  (framework default starves them); TTLs reuse `yacc.auth.token`; `reuseRefreshTokens(false)` =
  rotate-on-use. Claims via `AsOidcTokenCustomizer` (role/email on access+ID; `name`,
  `email_verified`, `must_change_password` scope-gated on the ID token). UserInfo projection is
  scope-filtered from the authorization's ID token (`AsUserInfoProjection`).
- **S3.4 Key rotation (JWKS).** `YACC_AUTH_TOKEN_SIGNING_KEY` rotates AS signing **and**
  resource-server verification together (single `signingKey()` source; `AuthorizationServerConfig`
  javadoc; rotation covered by merged tests `AuthorizationServerConfigTest` etc.). The JWKS endpoint
  publishes the public half only (`ImmutableJWKSet` over the same `RSAKey`).
- **S3.5 Refresh/revoke replay safety.** `AsRefreshTokenSerializationFilter` holds a 64-stripe lock
  keyed by token hash across the whole refresh operation ⇒ a replayed rotation-on-use token
  deterministically answers `invalid_grant`. `AsStatusEnforcingAuthorizationService.findByToken`
  re-loads the grant owner through `TokenAuthenticationService.requireActive` ⇒ grants of
  non-ACTIVE owners resolve to `null` (refresh/code ⇒ `invalid_grant`; revocation ⇒ RFC 7009 §2.2
  no-op; userinfo refused). `AsPublicClientAuthenticationProvider` authenticates the public client
  by registered id for refresh/revoke only when `additionalParameters` is empty (PKCE code exchanges
  stay with the framework provider). **Finding TM-008**: client-id-only public-client
  authentication is the standard OAuth 2.1 SPA posture with the named compensating controls —
  ledger (Sev-4).
- **S3.6 Grant store.** `InMemoryOAuth2AuthorizationService` wrapped by the status seam —
  process-local: a restart invalidates outstanding AS dances (availability by design; the durable
  session contract is the `session` table, S1.5). CSRF disabled on the AS chain — token/PKCE-bound,
  never cookie-authenticated.

| STRIDE | Disposition |
|---|---|
| Spoofing | **M** — PKCE mandatory; consent always; exact redirect URIs; resource owner via bearer seam; public-client refresh bound to token possession + rotation (**F-TM-008**, standard posture). |
| Tampering | **M** — single signing key source; server-side client policy (no dynamic registration). |
| Repudiation | **M** — refresh/deny paths audited via the shared seams; consent decisions are framework-consent-page flows. |
| Info disclosure | **M** — JWKS public half only; UserInfo scope-filtered; status of accounts never a token claim (`AsOidcTokenCustomizer` javadoc). |
| DoS | **N/A** — in-process stores bound memory by design (single instance); lock stripes bounded (64). |
| Elevation | **M** — status seam denies suspended owners at refresh/revoke/userinfo (fail-closed resolution); no client-credentials grant ⇒ no machine escalation path. |

### S4 — Deterministic bootstrap + founder-controlled recovery (MIG-030)

**Artifacts.** `service/SuperAdminBootstrap.java`; `service/SuperAdminProvisioner.java`;
`service/SuperAdminRecovery.java`; `common/seed/DeterministicSeed.java`;
`common/seed/E2EFixtureSeed.java`; `common/seed/E2EFixtureSeedProperties.java`;
`api/auth/AuthProperties.java` records `Bootstrap`/`Recovery` (keys `yacc.auth.bootstrap.*` ←
`YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL`, `YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL`;
`yacc.auth.recovery.{mode,key,key-hash}` ← `RECOVERY_MODE`, `RECOVERY_KEY`,
`YACC_RECOVERY_KEY_HASH`); `entity/User.mustChangePassword`.

**Flows and properties.** Bootstrap runs only when no `SUPER_ADMIN` exists; idempotent; fail-closed
on missing config or a bootstrap email already owned by another identity; creates exactly one
SUPER_ADMIN, ACTIVE, email-verified, `must_change_password=true`, one-time env-delivered credential;
audited (`bootstrap.super_admin.created`). Recovery (`SuperAdminRecovery`, `@Order(0)`, before
bootstrap): armed only by `RECOVERY_MODE=once` for that startup (any other value ⇒ startup
refusal); requires `RECOVERY_KEY` whose SHA-256 digest equals the founder-pinned
`YACC_RECOVERY_KEY_HASH` compared with `MessageDigest.isEqual` (constant-time); fail-closed on
blank/mismatched material; re-provisions with a **fresh** credential (never restores an old one) +
forced password change; audited (`recovery.super_admin.reprovisioned`); log instructs unsetting
`RECOVERY_MODE`. Determinism: identity UUID = UUIDv3 over `bootstrap:` + lowercase email
(`SuperAdminProvisioner.deterministicId`; documented "identifier derivation only, not a security
control"). The E2E fixture seed is triple-gated (`e2e` profile + `yacc.e2e.seed-enabled=true` +
loopback-only effective JDBC URL; `E2EFixtureSeed`), fails closed on any unmet gate, and never
creates a privileged identity.

| STRIDE | Disposition |
|---|---|
| Spoofing | **M** — recovery knowledge is a founder-held preimage (SHA-256 pin, constant-time compare); no API/endpoint exists (env-gated restart flag only). |
| Tampering | **M** — both runners fail closed rather than boot half-configured; provisioning always ends `must_change_password=true` before any platform use (`ForcedPasswordChangeFilter`). |
| Repudiation | **M** — bootstrap and every recovery use audited with actor = self. |
| Info disclosure | **M** — credentials live only in env/Secret at startup; never logged (`SuperAdminProvisioner` hashes; logs carry ids only). |
| DoS | **M** — wrong-armed recovery refuses startup (fail-closed) instead of a degraded boot. |
| Elevation | **M** — exactly two provisioning paths, both founder-material-gated; no endpoint surface; UUIDv3 derivation is documented non-security. |

### S5 — Raw WebSocket real-time plane (MIG-050/MIG-051/MIG-062)

**Artifacts.** `api/realtime/RealtimeWebSocketConfig.java` (handler+interceptor registration;
`setAllowedOrigins` from `RealtimeProperties`); `api/realtime/WebSocketHandshakeAuthInterceptor.java`;
`api/realtime/YaccWebSocketHandler.java`; `api/realtime/WebSocketSessionRegistry.java`;
`api/realtime/RealtimeRooms.java`; `api/realtime/WebSocketEventPublisher.java`;
`api/realtime/WebSocketBacklogService.java`; `api/realtime/WebSocketPresenceService.java`;
`api/realtime/WebSocketTypingService.java`; `api/realtime/WebSocketReconnectService.java`;
`api/realtime/WebSocketHeartbeatService.java`; `api/realtime/ConnectorRelayService.java`;
`api/realtime/RealtimeProperties.java` (keys `yacc.realtime.websocket.path` ←
`YACC_REALTIME_WS_PATH` (default `/ws`), `allowed-origins` ← `YACC_REALTIME_WS_ALLOWED_ORIGINS`);
`api/connector/GatewayExchange.java` (room publishes).

**Flows and properties.** The upgrade path is permitAll at the servlet chain because the access
token arrives as the `token` query parameter (`WebSocketHandshakeAuthInterceptor.TOKEN_PARAMETER`);
the interceptor is the auth gate: missing/invalid/expired token or non-ACTIVE identity ⇒ 401 before
any session exists (same seam as REST: `JwtTokenService.decodeAccessToken` +
`TokenAuthenticationService.authenticate`). The handler registers the authenticated identity, joins
the personal room `user:{userId}`, and demuxes the frozen inbound ops; malformed/unknown frames ⇒
`system.error` (`bad_frame`/`unknown_event`/`transport_error`); `connector.*` relay payloads are
platform-validated (`platformOf` allows exactly `telegram|irc`). Room namespaces are
`user:{userId}`, `conversation:{conversationId}`, `connector:{platform}` (`RealtimeRooms`).
**Finding TM-001**: `subscribe.conversation` joins the conversation room with no resource-level
authorization while those rooms carry content-bearing events (full inbound message bodies via
`GatewayExchange.publishMessageReceived` — `MessageReceivedPayload` includes `event.body()` — plus
`ConnectorRelayService` conversation-room publishes and typing events); `MESSAGE_SENT` is
broadcast to all sessions (`publishToAll`), making conversation IDs discoverable to every connected
identity. **Finding TM-005**: the token-in-query transport can leak bearer tokens into ingress
access logs — ledger (`unverified` for the log-capture half, E6). Backlog replay is per-user
(1h window, `user:{userId}`-keyed stores) — no cross-user replay found.

| STRIDE | Disposition |
|---|---|
| Spoofing | **M** — authenticated upgrade only (401 otherwise); identity attached server-side at handshake; unregistered sessions denied at the frame layer. |
| Tampering | **M** — frames are JSON-parsed server-side; ops are a closed enum; platform allow-list on connector ops. |
| Repudiation | **M** — ingestion audited (`message.ingested`, S10); frame errors surfaced to the sender. |
| Info disclosure | **F-TM-001** (room join without resource check); **F-TM-005** (token in query). Backlog, presence, typing are otherwise per-user/room-scoped as designed. |
| DoS | **M** — bounded registry, idempotent unregister; per-frame parse errors answered, connection-level faults closed (`handleTransportError`); in-memory state matches the single-instance envelope. |
| Elevation | **F-TM-001** (see above — an authenticated `user`-role session can receive conversation content beyond its assignment boundary). |

### S6 — Telegram/IRC connectors + integration administration (MIG-060/MIG-061/MIG-062)

**Artifacts.** Telegram: `api/connector/TelegramConnector.java`,
`TelegramCredentialsResolver.java`, `TelegramCredentials.java`, `TelegramUpdateReceiver.java`,
`TelegramInboundMessage.java`, `TelegramConnectorProperties.java` (key
`yacc.connector.telegram.base-url` ← `YACC_CONNECTOR_TELEGRAM_BASE_URL`, default
`https://api.telegram.org`). IRC: `IrcConnector.java`, `IrcConnectionConfigResolver.java`,
`IrcProtocolClient.java`, `IrcConnectionConfig.java`, `IrcConnectorProperties.java` (keys
`yacc.connector.irc.connect-timeout-ms` / `reconnect-base-delay-ms` / `reconnect-max-delay-ms`),
`IrcMessageReceiver.java`, `IrcLine.java`. Shared gateway:
`GatewayExchange.java`, `GatewayHook(s).java`, `GatewayRedeliveryHandler.java`,
`ConnectorCircuitBreaker.java`, `ConnectorBreakerErrorHook.java`, `ConnectorRegistry.java`,
`ConnectorRegistration.java`, `ConnectorStatusBroadcaster.java`, `PlatformConnector.java`,
`ConnectorInboundMessage/OutboundMessage/SendResult/Health/Status.java`. Integration REST:
`api/integration/IrcProfileController.java`, `IrcIntegrationController.java`,
`IrcProfileService.java`, `IrcConfigService.java`, `SanitizedResult.java` (SUPER_ADMIN-only per
`@PreAuthorize` matrix, S1.2).

**Flows and properties.** Credential resolution is DB-first with **no env fallback** (both
resolvers' contracts): Telegram bot token and IRC server/port/nick/password live in
`integration_connection_profiles` / `integration_configs` rows, credentials AES-256-GCM ciphertext
(`EncryptionService`), decrypted only at connect time, validated (token format gate), and
fail-closed on absent/tampered/malformed material (connector refuses to connect; logs carry profile
id + reason only — never secret material). Profile administration: 0..10 IRC profiles per tenant,
single active, disable-clears-active, no secrets in responses (`ProfileResponse`), side-effect-free
stored-credential tests, every mutation audited. Egress: Telegram over HTTPS (Bot API origin,
config-overridable for tests). **Finding TM-006**: `IrcProtocolClient` uses a plain `Socket` — no
TLS support — so IRC credentials and message traffic transit in cleartext against plaintext
endpoints (baseline-inherited; operator can point the profile at a TLS-terminating endpoint, but
the client itself cannot negotiate TLS) — ledger.

| STRIDE | Disposition |
|---|---|
| Spoofing | **M** — platform identity is the configured credential; inbound events validated fail-closed (`GatewayExchange.validateInbound`); no trust in inbound `senderName`. |
| Tampering | **M** — credentials ciphertext-authenticated (GCM); tampered ⇒ refuse connect; DLQ preserves failed ingests. |
| Repudiation | **M** — ingest/delivery audited; DLQ + retry ledger retained (ADR-028). |
| Info disclosure | **F-TM-006** (plaintext IRC transport); **M** otherwise (no secret in logs/responses; error messages carry no material). |
| DoS | **M** — circuit breaker per platform (fail-fast), bounded reconnect backoff (1s→60s, max 5), connect deadline 30s. |
| Elevation | **M** — administration is SUPER_ADMIN-only (S1.2); connector runtime holds no privileged YACC authority beyond ingest/dispatch. |

### S7 — Secrets, crypto, and configuration material

**Artifacts.** `service/EncryptionService.java` (AES-256-GCM, 128-bit tag, fresh 12-byte
`SecureRandom` IV per encrypt, `base64(iv‖ct‖tag)`, fail-closed eager key validation);
`api/integration/EncryptionProperties.java` (key `yacc.integration.encryption.master-key` ←
`YACC_INTEGRATION_ENCRYPTION_MASTER_KEY`; "carries exactly one active key; rotation is re-keyed at
reset/rotation time by the ops contract — MIG-071 owns rotation drills");
`application.yml` (every secret env-bound, no defaults: `YACC_AUTH_TOKEN_SIGNING_KEY`,
`YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL`, `RECOVERY_KEY`, `YACC_RECOVERY_KEY_HASH`,
`YACC_AUTH_EMAIL_SENDGRID_API_KEY`, `YACC_SMTP_*`, `YACC_INTEGRATION_ENCRYPTION_MASTER_KEY`,
`YACC_AUTH_OAUTH2_REGISTRATIONS_<ID>_*`); `deploy/helm/yacc-backend/**` (env injection);
`entity/PasswordResetToken.java`, `entity/Verification.java` (bcrypt token digests);
`entity/IntegrationConnectionProfile.encryptedCredentials`.

**Flows and properties.** No secret has a code default; blank required material fails startup
(fail-closed) in `JwtTokenService`, `EncryptionService`, `SuperAdminBootstrap/Recovery`,
`OAuth2LoginConfig`/`AsClientPolicy` (when enabled). Secrets are never logged (resolver/sender code
paths reviewed: messages carry ids/reasons only). DB compromise (TB7) yields ciphertext + bcrypt
hashes but no keys (keys live in pod env only). **Findings TM-003/TM-004**: the Helm injection set
does not match the Spring env contract (wrong/missing names ⇒ fail-closed boot/recovery refusal at
deploy time) and mounts unconsumed secret material (`TELEGRAM_BOT_TOKEN`, `IRC_PASSWORD`,
`CLOUDFLARE_R2_*`) into the pod env — ledger.

| STRIDE | Disposition |
|---|---|
| Spoofing | **M** — key material possession is the identity of the deployment (RS256 + AES-GCM). |
| Tampering | **M** — GCM authentication on every credential read; fail-closed decode. |
| Repudiation | **M** — secret-bearing operations audited (recovery, profile writes). |
| Info disclosure | **F-TM-003**, **F-TM-004** (deployment wiring); **M** in code (no defaults, no logging, no plaintext fallback). |
| DoS | **M** — fail-closed startup on missing keys (never silent-unencrypted operation). |
| Elevation | **M** — no secret material reaches token/authority decisions other than through S1–S6 seams. |

### S8 — Auth email delivery: SMTP + SendGrid (live integrations)

**Artifacts.** `service/AuthEmailService.java`; `service/AuthEmailConfig.java` (provider selection
`smtp|sendgrid`, default `smtp`); `service/SmtpAuthEmailSender.java`; `service/SendGridAuthEmailSender.java`;
`service/AuthEmailSender.java` (interface); `application.yml` `yacc.auth.email.*` (`from` ←
`YACC_AUTH_EMAIL_FROM`, `provider` ← `YACC_AUTH_EMAIL_PROVIDER`, `send-grid-api-key` ←
`YACC_AUTH_EMAIL_SENDGRID_API_KEY`, `base-url` ← `YACC_AUTH_EMAIL_BASE_URL`, `max-send-attempts: 3`,
`retry-backoff: 500ms`) + `spring.mail.*` (`YACC_SMTP_HOST/PORT/USERNAME/PASSWORD`); management
`management.health.mail.enabled: false` (SMTP reachability must not fail readiness).

**Flows and properties.** Action links carry the single-use 256-bit token to
`{base-url}`-derived frontend routes; send failures retry (3 attempts) then audit
(`email.send_failed`) — never crash the flow; the provider API key is env/Secret-only and never
logged. SendGrid egress is HTTPS with `Authorization: Bearer` (`SendGridAuthEmailSender`).

| STRIDE | Disposition |
|---|---|
| Spoofing | **M** — sender identity is configured (`from`); providers authenticated by credential. |
| Tampering | **N/A** — transport to provider; token integrity is server-side (bcrypt digests). |
| Repudiation | **M** — send attempts/failures audited. |
| Info disclosure | **M** — tokens travel only inside emailed action links (the flow's purpose); key never logged; **note**: link recipient channel security is email-transport-inherent (documented posture, no finding). |
| DoS | **M** — bounded retries; mail health excluded from readiness (no cascade). |
| Elevation | **N/A** — no authority decisions in this surface. |

### S9 — Object storage (Cloudflare R2): configured-but-unused

**Artifacts (the complete set).** `deploy/helm/yacc-backend/values.yaml` (`secrets.cloudflareR2`:
`existingSecret: yacc-cloudflare-secrets`, keys `r2-endpoint`/`r2-access-key`/`r2-secret-key`/
`r2-bucket`/`cdn-url`); `values-dev.yaml` + `values-staging.yaml` (same block);
`deploy/helm/yacc-backend/templates/deployment.yaml` (env `CLOUDFLARE_R2_ENDPOINT`,
`CLOUDFLARE_R2_ACCESS_KEY`, `CLOUDFLARE_R2_SECRET_KEY`, `CLOUDFLARE_R2_BUCKET` from secret
`yacc-cloudflare-secrets`, keys `R2_ENDPOINT`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/
`R2_BUCKET_NAME`, all `optional: true`); `deploy/helm/yacc-backend/README.md` (r2 keys).

**Negative evidence (E3).** No R2/S3/AWS/Cloudflare client, dependency, endpoint, or property exists
anywhere in `services/backend-java` (`build.gradle.kts` has no AWS/S3 dependency; source grep hits
only the English word "draws"). The frozen `openapi.yaml` defines **no attachment route** — the only
match is `attachmentIds` inside the message-send body (`openapi.yaml:2123`). The `entity/Attachment.java`
data model exists with no consuming endpoint. Honest surface: **credential material declared and
mounted but never consumed by any code path** (issue guardrail; E3 documentation, not an inferred
integration). Finding TM-004 covers the mounted-unused-material exposure; no attachment flow is
modeled because none exists.

| STRIDE | Disposition |
|---|---|
| All categories | **N/A** for the modeled system — no code path touches R2. Exposure of the mounted material is **F-TM-004** (pod-env secret surface). If attachment support lands later, this surface must be modeled afresh (out of scope, E5). |

### S10 — Audit coverage

**Artifacts.** `service/AuditPersistence.java` (interface); `service/JpaAuditPersistence.java`;
`service/LoggingAuditPersistence.java`; `service/SecurityAuditEventListener.java` (Spring security
events → audit); `api/audit/AuditLogsQueryController.java` (`GET /api/audit-logs`,
`GET /api/audit-logs/conversations/{conversationId}`, `POST /api/audit-logs/export` — export
SUPER_ADMIN/ADMIN only), `ConversationAuditController.java` (`GET
/api/conversations/{conversationId}/audit-logs`), `AuditRecord.java`, `AuditExportRow.java`,
`AuditFilters.java`, `Export*.java`; `entity/AuditLog.java`; producers: recovery/bootstrap
(S4), OIDC identity resolution (S2), password-reset/verification (S1.7), ingestion/delivery (S6).

**Flows and properties.** Records persist to `audit_logs` (UUID entity ids, JSON metadata);
query/export are RBAC-gated (S1.2); auth-event listeners make deny≠login truthful. **Finding
TM-009**: persistence is deliberately best-effort — failures are logged, never rethrown, and records
with non-UUID `entityId` are dropped (both exact baseline parity, `JpaAuditPersistence` javadoc) ⇒
audit completeness degrades silently under DB failure — ledger (Sev-4, E7 routing note to #366).

| STRIDE | Disposition |
|---|---|
| Spoofing | **M** — audit writes are server-side only; actor from the authenticated principal. |
| Tampering | **N/A** — no update/delete path on `audit_logs` in the service surface. |
| Repudiation | **F-TM-009** (best-effort persistence + drop rules); **M** otherwise (deny/login and credential events covered). |
| Info disclosure | **M** — audit reads RBAC-gated (SUPER_ADMIN/ADMIN/MANAGER; export admin-only). |
| DoS | **M** — best-effort design prevents audit failure from cascading into request failures (the flip side of TM-009). |
| Elevation | **N/A** — no authority decisions here. |

### S11 — Deployment envelope (Docker + Helm)

**Artifacts.** `services/backend-java/Dockerfile` (multi-stage; Temurin 21 JRE; non-root dedicated
`yacc` uid/gid 1000, no sudo group; writable emptyDir targets `/tmp`, `/app/heap-dumps`,
`/app/logs`); `deploy/helm/yacc-backend/templates/deployment.yaml` (`podSecurityContext` fsGroup
1000 + `RuntimeDefault` seccomp; `securityContext` `runAsNonRoot`, read-only rootfs, `drop: ALL`,
no privilege escalation; probes `/health/live`, `/health/ready`; `ServiceAccount`);
`templates/configmap.yaml` (non-sensitive config only); `templates/service.yaml`, `ingress.yaml`,
`serviceaccount.yaml`; `values*.yaml` (1Gi/2Gi envelope; `SPRING_PROFILES_ACTIVE: production`).

| STRIDE | Disposition |
|---|---|
| Spoofing/Tampering | **M** — immutable image, read-only rootfs, checksum-annotated config; secret material only via K8s Secret refs. |
| Repudiation | **M** — structured JSON logs to stdout (ADR-029) with correlation ids. |
| Info disclosure | **F-TM-003/F-TM-004** (env wiring), **F-TM-005** (ingress log capture, `unverified`); probes expose liveness/readiness state only. |
| DoS | **M** — resource envelope + `-XX:+ExitOnOutOfMemoryError` (fail-fast restart). |
| Elevation | **M** — non-root, all capabilities dropped, no service-account escalation modeled (default SA; no RBAC grants in chart). |

### S12 — Data layer (Flyway + JPA + Quartz)

**Artifacts.** `db/migration/V1__baseline.sql`, `V2__websocket_backlog.sql`,
`V3__user_must_change_password.sql`, `V4__quartz_job_store.sql`; `application.yml` (`flyway`
locations; `hibernate.ddl-auto: validate`; Hikari `stringtype: unspecified`, session `timezone=UTC`);
`repository/*.java` (Spring Data, derived queries — no native SQL); `entity/*.java` (enum
AttributeConverters); Quartz JDBC store (non-clustered, single instance — `application.yml` block
comment warns a second instance must not share the tables).

| STRIDE | Disposition |
|---|---|
| Spoofing | **N/A** — no identity semantics in the data layer. |
| Tampering | **M** — Flyway-only schema changes; Hibernate validates mappings; parameter binding via JPA (no string-concatenated SQL in the service surface). |
| Repudiation | **M** — `audit_logs` table retained (S10). |
| Info disclosure | **M** — credentials/tokens encrypted or hashed at rest (S7); DB contract via `DATABASE_URL` secret. |
| DoS | **M** — pooled connections; single-instance Quartz assumption documented. |
| Elevation | **N/A** — authorization lives in S1. |

## 5. Severity definitions (scope: threat-model findings)

These definitions are stated here per the issue guardrail and scope **only** the findings in the
companion ledger. The phase/test-wide severity taxonomy and the ledger-wide zero-open report remain
MIG-091's (#366, AC-MIG-091-4) — no duplicate taxonomy is created (stop E7).

- **Sev-1** — Exploitable **without authentication** by a remote attacker, or a break of the
  identity/token/key fabric itself: authentication bypass, token forgery/acceptance, secret or
  private-key material exposure, privilege escalation across identities (e.g., to SUPER_ADMIN), or
  injection crossing a trust boundary into execution.
- **Sev-2** — An **authenticated** principal can exceed their authorization boundary with real
  confidentiality/integrity impact on platform data (RBAC/assignment bypass, cross-scope data
  access), or a security control demonstrably fails to enforce its documented policy where a
  plausible attack path exists. Sev-1/Sev-2 findings block cutover (no waiver; E1).
- **Sev-3** — Weakness with materially restricted preconditions (network position, pod/cluster
  access, operator error) or a fail-closed availability/config defect in a security-relevant
  control; remediation strongly recommended, not cutover-blocking by itself.
- **Sev-4** — Hardening opportunity or documented-by-design posture with no plausible
  confidentiality/integrity impact under the stated deployment envelope.

## 6. Outcome

- Findings: **10** (0 × Sev-1, **2 × Sev-2 open**, 4 × Sev-3, 4 × Sev-4 — none remediated, none
  accepted-residual at this revision). Details, evidence, and routing:
  [MIG-073-findings-ledger.md](MIG-073-findings-ledger.md).
- **AC-MIG-073-2 is not met at this revision** (two open Sev-2 findings). Per escalation stop E1:
  the findings are recorded `open`, no waiver was granted, no severity was reclassified, no
  remediation was performed in MIG-073; the outcome routes to tech-lead (remediation issue and/or
  amended acceptance path is a tech-lead/founder decision) and is recorded as **blocking for
  MIG-072 cutover** until resolved and re-reviewed to `pass`.
- Configured-but-unused surfaces (R2; the dead connector/env secret mounts) are documented as such
  with negative evidence (§4 S9; TM-004) — not modeled as integrations.
- Runtime/environment claims: none. Items requiring a live environment are marked `unverified`/
  `deferred` in the ledger (E6).
- Residual-risk acceptance is founder-only (E4); no finding in this ledger is marked
  `accepted-residual`, and none may be without founder action.
