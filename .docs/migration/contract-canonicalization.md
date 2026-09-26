---
doc_id: CONTRACT-CANONICALIZATION
version: 1.0.0
spec: "https://github.com/Antpolis/documentation/blob/master/02-Architecture-Landscape/projects/yacc/spec/SPEC-002-java-spring-backend-migration.md"
milestone: "https://github.com/csim-sg/yacc/milestone/3"
task: "https://github.com/csim-sg/yacc/issues/338"
baseline_revision: 98db628d78c79578dd11eb0476fab812d81fed32
binding_contract:
  rest: ".docs/migration/openapi.yaml (v1.0.0-mig-003-canonical)"
  realtime: ".docs/migration/asyncapi.yaml (v1.0.0-mig-003-canonical) + .docs/migration/schemas/*.json"
  ledger: ".docs/migration/ledger-mig-003-reconciled.md (LEDGER-MIG-003-RECONCILED, 156 rows)"
created: 2026-09-26
durable_context:
  - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-023-contract-source-openapi-asyncapi.md"
  - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-024-java-spring-backend-replacement-architecture.md"
  - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-025-auth-spring-security-dual-role-oidc-bootstrap-recovery.md"
  - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-026-raw-spring-websocket-resilience.md"
  - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-028-async-processing-quartz-db-dlq.md"
  - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-029-jvm-deployment-envelope-observability.md"
---

# MIG-003 — Contract Canonicalization Record

This record resolves every divergence flagged by the MIG-001/MIG-002 captures into ONE
frozen contract target. With MIG-003 the following are binding for all later phases
(MIG-010..091); the two capture ledgers remain as baseline provenance only:

- **REST contract:** `.docs/migration/openapi.yaml`
- **Real-time contract:** `.docs/migration/asyncapi.yaml` + `.docs/migration/schemas/*.json`
- **Binding atomic ledger:** `.docs/migration/ledger-mig-003-reconciled.md`
  (156 rows = 70 REST + 86 real-time; supersedes `ledger-mig-001-rest.md` and
  `ledger-mig-002-realtime.md` as the binding scope source; no row added, removed, or
  duplicated — the reconciliation only freezes target behavior on rows the captures
  explicitly deferred to MIG-003)

Baseline for every decision below: revision `98db628` (branch `dev`), verified in source.

---

## 1. Auth contract canonicalization (AC-MIG-003-2)

### 1.1 Resolved drift (verified in frontend source @98db628)

`rg -n "simple-auth|User.id|super_admin|SUPER_ADMIN" packages/frontend/src` confirms:

| Drift | POC frontend (`auth.service.ts`) | POC frontend (`api/schemas.ts`) | Canonical contract |
|---|---|---|---|
| `User.id` type | `number` | `z.string().uuid()` | **`string` (uuid)** — matches the PostgreSQL uuid PK and `UserResponse` in `openapi.yaml`; the `number` in `auth.service.ts` was never the wire shape |
| Role casing | lowercase `'super_admin' \| 'admin' \| 'manager' \| 'user'` | uppercase `z.enum(['SUPER_ADMIN','ADMIN','MANAGER','USER'])` | **lowercase on the wire** — `openapi.yaml` `UserRole` enum `[super_admin, admin, manager, user]`, verified against the DB enum at capture (ledger note 6). Uppercase `SUPER_ADMIN/ADMIN/MANAGER/USER` in ADR-025 names the Spring role *authorities*, not the wire values; the DTO/JSON enum stays lowercase |
| Login/logout/session endpoints | `POST/GET /simple-auth/login`, `/simple-auth/logout`, `/simple-auth/session` | — | **`/simple-auth/*` does not exist on the backend** (backend mounts `/api/auth/*` only). Removed from the contract entirely; the canonical auth surface is §1.4 below |

### 1.2 Canonical user object

`UserResponse` (already in `openapi.yaml` components, unchanged):
`{ id: uuid, email, name, role: super_admin|admin|manager|user, status: active|inactive|suspended, emailVerified?, image?, createdAt, updatedAt }`.
This is the single user shape for every auth and users response. The frontend
`auth.service.ts` / `api/schemas.ts` drift is reconciled to it in MIG-034 (frontend
adaptation); no backend or frontend code changes in MIG-003.

### 1.3 `/simple-auth/*` incoherence — resolution

The POC `auth.service.ts` calls `/simple-auth/login|logout|session`, which exist nowhere
in `packages/backend` (only `/api/auth/*` is mounted). Canonical resolution: the
`/simple-auth/*` surface is **deleted from the frontend target**; its three call sites map
to the canonical endpoints in §1.4 (`login → POST /api/auth/sign-in/email`,
`logout → POST /api/auth/sign-out`, `session → GET /api/auth/get-session`). MIG-034
implements the removal; the contract carries no `/simple-auth/*` path.

### 1.4 Canonical `/api/auth/*` endpoint map

The baseline `ALL /api/auth/*` wildcard (ledger row REST-AUTH-004) delegates to BetterAuth.
Per ADR-025 the wildcard is replaced by explicit Spring Security + Spring Authorization
Server endpoints. The **wire sub-path mapping is frozen** to exactly the sub-paths the POC
frontend consumes (verified in `lib/apiClient.ts` + `contexts/AuthContext.tsx`), now
enumerated as explicit operations in `openapi.yaml`:

| Canonical endpoint | Replaces (baseline BetterAuth sub-path) | Ledger row | Purpose |
|---|---|---|---|
| `POST /api/auth/sign-in/email` | itself (was explicit) | REST-AUTH-003 | Email/password sign-in |
| `POST /api/auth/sign-up/email` | `sign-up/email` (wildcard) | REST-AUTH-004 | Self-registration → creates `USER` only (SPEC-002 FR-04); no role field accepted |
| `POST /api/auth/sign-out` | `sign-out` (wildcard) | REST-AUTH-004 | Revoke/invalidates token grant |
| `GET /api/auth/get-session` | `get-session` (wildcard) | REST-AUTH-004 | Current user from Bearer JWT |
| `POST /api/auth/refresh-token` | `refresh-token` (wildcard) | REST-AUTH-004 | Refresh-grant rotation (ADR-025 stateless access + refresh default) |
| `POST /api/auth/forgot-password` | itself (was explicit) | REST-AUTH-001 | Unchanged (rate limited, anti-enumeration) |
| `POST /api/auth/reset-password` | itself (was explicit) | REST-AUTH-002 | Unchanged (rate limited, anti-enumeration) |

No other `/api/auth/*` sub-path is part of the canonical contract.

### 1.5 Canonical auth response DTOs

Frozen for MIG-030/MIG-033/MIG-034 (token *claims and lifecycle* remain ADR-025/MIG-033
implementation detail; only the wire DTO is frozen here):

- `POST /api/auth/sign-in/email` → `200 { user: UserResponse, accessToken: string (JWT), refreshToken: string }`
- `POST /api/auth/sign-up/email` → `201 { user: UserResponse, accessToken, refreshToken }` (role always `user`)
- `GET /api/auth/get-session` → `200 { user: UserResponse }`; `401` when no/invalid token
- `POST /api/auth/refresh-token` → `200 { accessToken, refreshToken }` (rotated); `401` on invalid refresh grant
- `POST /api/auth/sign-out` → `200 { success: true }`

Bearer header contract unchanged: `Authorization: Bearer <accessToken>`; the
`BETTER_AUTH_SECRET` crypto-coupling is unwound server-side (ADR-025) and is invisible to
the wire contract. Any deviation needed by MIG-030..034 is a contract-change finding
against this record — not silent drift.

---

## 2. Single canonical API-client surface (AC-MIG-003-1)

Baseline has TWO HTTP clients in `packages/frontend/src`:

1. `lib/apiClient.ts` — fetch wrapper with Authorization injection, 401 refresh-queue,
   retry/backoff, timeout; hardcoded BetterAuth endpoint knowledge.
2. `api/client.ts` — fetch wrapper with correlation-ID injection (`X-Request-ID`),
   30s timeout, `ApiError`, TanStack-Query-oriented.

**Canonical target (binding for MIG-034):** ONE HTTP client.

- Base: the `api/client.ts` pattern (fetch-based, no Axios, correlation-ID injection,
  typed `ApiError`) **extended with** the `lib/apiClient.ts` capabilities the product
  needs: auth-token injection, single-flight 401 → `refresh-token` re-auth queue, and
  request timeout.
- Types: generated from `openapi.yaml` (openapi-typescript per ADR-023) — no hand-written
  request/response interfaces, no `@yacc/common` Zod contract dependency (SPEC-002 AC-07).
- `lib/apiClient.ts` is retired in MIG-034; all services call the single client.
- Auth-token storage keys and the `yacc_token` localStorage key are MIG-034 implementation
  detail, not contract.

## 3. Single canonical socket-stack surface (AC-MIG-003-1)

Baseline has TWO socket stacks in `packages/frontend/src`:

1. `lib/socket.ts` — socket.io-client singleton (reconnect delays 1000/2000/4000/8000/30000 ms,
   10 attempts — captured as WS-BHV-012).
2. `services/websocket/` — `WebSocketClient` + `WebSocketConnectionManager` +
   `WebSocketEventHandler` + `WebSocketLogger` (also socket.io-client based).

**Canonical target (binding for MIG-052):** ONE raw-WebSocket client.

- Transport: browser-native WebSocket against the raw Spring WS endpoint (ADR-026);
  socket.io-client is dropped entirely (SPEC-002 FR-06, AC-07).
- Behavior contract (frozen here, implemented in MIG-052): handshake auth token, the
  captured reconnect/backoff ladder (1s/2s/4s/8s/30s, 10 attempts), application-level
  heartbeat handling (`system.heartbeat`), backlog replay consumption, presence/typing
  emitters, and one event router consuming generated AsyncAPI types (ADR-023).
- Both baseline stacks are retired in MIG-052; exactly one connection and one event
  router exist at runtime.

---

## 4. Real-time contract canonicalization (resolves MIG-002 capture notes)

### 4.1 Envelope — one outbound frame (resolves note 1)

Every **server→client** emission carries the `{event, data, timestamp}` envelope
(`schemas/envelope.schema.json`), verbatim per ADR-026. The baseline split (wsGateway
emits enveloped; socket-controller handlers emit bare) is resolved to the enveloped shape
uniformly; the Java target has ONE emit path. Channel `message` payloads in
`asyncapi.yaml` describe the envelope's `data` member. **Client→server** (publish)
messages remain bare payloads — the envelope is outbound-only.

### 4.2 Event-name set — one canonical constant set (resolves note 2)

The union of the `@yacc/common` contract set (20 constants) and the backend runtime
`websockets/wsConstants.ts` set (13 constants, 10 shared) is **23 named constants**.
Java implements exactly this ONE set (no `@yacc/common`/backend duplication):

conversation.updated, conversation.reopened, message.received, message.sent,
message.failed, notification.received, notification.deleted, notification.read,
notification.dismissed, presence.updated, typing.started, typing.stopped, user.online,
user.offline, system.connection.established, system.reconnection.started,
system.reconnection.failed, system.heartbeat, system.error,
system.backlog.replay.started, system.backlog.replay.completed, message.retry.scheduled,
queue.message.dlq.

Wire name = contract name (raw WS event literal); no mapping layer at runtime.

### 4.3 Literal ↔ constant mapping (resolves note 3)

- `connection.established` (raw, emitted by TWO baseline paths — WS-RAW-001) → canonical
  `system.connection.established` (WS-EVT-014). Target: exactly ONE connect-time emit per
  session, contract name, enveloped. The duplicate emit path is deduplicated.
- `error` (raw, `{message}` on handler failure — WS-RAW-017) → canonical `system.error`
  (WS-EVT-018), enveloped, `data` = `SystemPayload { type: 'error', timestamp,
  error: { code, message } }` (`schemas/system-payload.schema.json`).
- The five SystemEvents with zero baseline wiring (WS-EVT-015/016/017/019/020) are emitted
  by the target because ADR-026 re-implements reconnect/heartbeat/backlog as
  application-level behavior — those rows already define the emitting target; nothing new
  is added here.

### 4.4 Defined-not-wired notification events — disposition (founder-visible scope note)

Baseline has zero wiring (no emitter, no consumer) for `notification.deleted` (WS-EVT-007),
`notification.read` (WS-EVT-008), and `notification.dismissed` (WS-QEV-003). Disposition
frozen by MIG-003: **retained-no-emitter (parity-of-absence)**.

- All three channels stay in the frozen AsyncAPI contract and all three ledger rows stay
  in the reconciled ledger (no surface change in either direction).
- Target behavior: nothing emits them; MIG-052 contract-conformance tests assert the
  corresponding paths (`DELETE /api/notifications/:id`, `PATCH /api/notifications/:id`,
  mark-all-read) emit no such events.
- **Founder-visible scope note:** wiring any of the three in Java is NEW wire behavior —
  a scope change requiring a new founder decision per the SPEC-002 completion boundary.
  Dropping the channels would likewise alter the frozen surface. Retention changes
  nothing and is the only disposition that requires no founder decision now.

### 4.5 Presence payload — one shape (resolves note 4)

Four baseline emit shapes exist for `presence.updated`; the canonical target is the
Zod-validated runtime shape emitted by 3 of the 4 paths
(`PresenceUpdatedPayloadSchema`, `websocket.types.ts:101`):

```
{ userId: uuid, status: 'online' | 'offline', lastSeen: date-time }
```

The divergent disconnect broadcast (`websocket.server.ts:158`, `{userId, isOnline,
timestamp}`) is canonicalized to the same three-field shape
(`status: 'online'|'offline'`, `lastSeen`); the `isOnline` variant is retired.
`schemas/presence-updated.schema.json` is updated accordingly. The `@yacc/common`
`PresencePayload` consumer type (`userName`/`lastSeenAt`/`typingIn?`/`away`) is NOT wire
truth and is not part of the contract; the frontend consumer reconciles to the canonical
shape in MIG-052.

### 4.6 Transport

Baseline transport was Socket.io (websocket transport forced). The frozen target transport
is raw WebSocket (ADR-026): JSON text frames only, no Socket.io/STOMP/SockJS/broker,
polling fallback removed. `asyncapi.yaml` server protocol is updated to `ws` with the
baseline noted in the description.

---

## 5. REST canonicalization resolutions (resolves MIG-001 capture notes)

| Capture note | Frozen resolution |
|---|---|
| Note 1 — `@Controller` (non-Json) routes hand-write JSON | Wire shapes as captured are the parity target; Java centralizes on `@RestController` + `@ControllerAdvice`. No contract change. |
| Note 2 — trailing slash `GET /api/conversations/` | Normalized to `/api/conversations` in `openapi.yaml` (already done at capture). Frozen. |
| Note 3 — two POST/PATCH assign routes | Both stay separate rows (REST-CONV-005 PATCH admin/super_admin; REST-ASSIGN-001 POST manager+). Not merged. |
| Note 4 — duplicate queue/DLQ surfaces (`/api/dlq/*` vs `/api/queue/dlq/*`) | Both surfaces stay frozen rows. Consolidation is a scope change requiring a new founder decision. |
| Note 5 — `REST-QUEUE-006` BullMQ job identity | Wire contract frozen: `jobId` is an opaque string path param; response shape unchanged; Quartz job identity substitutes 1:1 for the BullMQ jobId and `job.state` preserves the baseline state vocabulary via the MIG-063 Quartz mapping (backoff 1m/5m/30m). |
| Note 6 — enum inventories | Frozen as captured (roles lowercase super_admin/admin/manager/user; statuses active/inactive/suspended; conversation status open/pending/resolved; priority low/normal/high/urgent; message status pending/sent/failed; direction inbound/outbound; IRC connected/retrying/disconnected/failed; bulk assign/tag/status). |
| REST-XSRV-003 rate limits ("limits frozen in MIG-003") | Frozen from `middleware/rateLimit.middleware.ts` @98db628: **loginRateLimiter = 5 requests / 15 min** on `POST /api/auth/sign-in/email`; **passwordResetRateLimiter = 3 requests / 60 min** on forgot-password + reset-password. (`apiRateLimiter` 100/15min is defined but unused on auth routes and is not part of the contract.) |
| REST-HEALTH-001..003 probe mapping ("exact mapping frozen in MIG-003") | Wire paths preserved verbatim: `ALL /health`, `ALL /health/live`, `ALL /health/ready`. Implemented via Actuator health groups / equivalent mappings (ADR-029); readiness dependency set drops Redis (ADR-028). |
| REST-XSRV-001 pagination envelope | Frozen as captured: `{data, page, limit, total}`, page 1-indexed on the wire. |

---

## 6. What MIG-003 does NOT change

- No row is added to, removed from, or duplicated in the atomic ledger (156 rows in,
  156 rows out — verified).
- No Java or frontend implementation code is written (out of scope: MIG-034/MIG-040/MIG-050/MIG-052).
- No rate limit, pagination, envelope, or event-shape value is approximated; every frozen
  value cites its baseline source above.
- Founder-fixed decisions are not reopened (§4.4 records the only founder-adjacent note,
  and it requires no decision now).

## 7. Verification evidence

- Drift confirmation: `rg -n "simple-auth|User.id|super_admin|SUPER_ADMIN" packages/frontend/src`
  (output recorded in the MIG-003 PR description; drift is resolved at the contract layer
  here and in frontend code by MIG-034).
- Ledger integrity: ID-set comparison `LEDGER-MIG-001-REST` (70) ∪ `LEDGER-MIG-002-REALTIME`
  (86) vs `LEDGER-MIG-003-RECONCILED` = identical 156 unique IDs, no duplicates.
- YAML validity: both contract files parse as YAML; all local `$ref`s resolve; the asyncapi
  server protocol is `ws`; all 40 outbound operations carry the canonical `enveloped`
  annotation and 13 channels carry explicit `x-disposition` decisions.
