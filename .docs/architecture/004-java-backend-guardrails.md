# 004 Java Backend Guardrails (Spring — replaces TS guardrails for the Java service)

**Status:** Draft for MIG-004 (#337) — acceptance recorded in MIG-005 (#339)
**Last Updated:** 2026-09-26
**Spec:** SPEC-002 — Java/Spring Backend Migration (TR-01..TR-09; Architecture Notes)
**ADRs:** ADR-023 (contract), ADR-024 (architecture), ADR-025 (auth), ADR-026 (raw WS), ADR-027 (data), ADR-028 (async), ADR-029 (envelope/observability)
**Supersedes for the Java service:** the TypeScript guardrails in `AGENTS.md` (§ Backend Entrypoints & Architecture Guardrails) — those remain authoritative for the Node POC until decommission (MIG-080).

---

## Purpose

The TS guardrails in `AGENTS.md` (flat `src/` folders, no `any`, Drizzle-only, Zod validation, config-vs-infra) do not map to Spring. This document codifies the Java/Spring guardrail set that all MIG-010..091 phases build against. It is deliberately the **simplest correct set** (SPEC-002 KISS constraint): no speculative abstraction, no layering beyond what ADR-024 fixes.

Founder-fixed decisions are **codified here, not reopened**: dual-role OIDC (embedded Spring Authorization Server), raw Spring WebSocket (no STOMP/SockJS/Socket.io/broker), Quartz + DB DLQ (Redis dropped), full reset (no legacy data migration), single backend instance, roll-forward only.

---

## 1. Package layout — package-by-feature (TR-01, ADR-24)

- Top level is **package-by-feature**: `auth`, `user`, `conversation`, `message`, `note`, `tag`, `routingrule`, `notification`, `audit`, `dlq`, `queue`, `integration`, `realtime`, `connector`, `config`, `common`.
- Each feature package has **`controller` / `service` / `repository` / `model`** sub-layers. No deeper nesting.
- **One bounded context per package.** A service may call another package's service only through its public service API; **cross-package service→repository leakage is prohibited** (a service never touches another feature's repository directly).
- No hexagonal/clean-architecture layering, no `domain/`/`application/`/`infrastructure` rings, no shared generic "manager"/"helper" packages. `common` holds only true cross-cutting types/utilities.
- Single Gradle module (ADR-024); no multi-module split unless a reviewed ADR-level finding justifies it.

## 2. Dependency injection — constructor only (TR-02)

Rule: **constructor injection only** — no other form of dependency injection is permitted. Field (`@Autowired` on fields), setter injection, and `@Autowired` on multiple constructors are prohibited. One injected constructor; Spring injects it implicitly (no `@Autowired` annotation needed on the single constructor).
- No service-locator patterns, no `ApplicationContext.getBean()` in application code, no static singletons for dependencies (the POC's exported singletons — `wsGateway`, `dbClient`, `logger` — become injected beans).
- Component scanning is the default wiring; explicit `@Bean` only where §3 requires it.

## 3. Typing — no `Object`, no raw casts (TR-02)

- **No `Object` or raw types in domain code.** DTOs and immutable data are Java `record`s; entities are typed classes. Generics are used concretely (no raw `List`, no `Map<String,Object>` payloads except at documented JSON-boundary edges — e.g. routing-rule lenient JSON per ADR-021, captured as `JsonNode` at the boundary and never leaking into domain types).
- **Bean validation (`@Valid` + jakarta.validation constraints) on all inbound request bodies** — the replacement for the POC's Zod/`ValidateBody` decorators.
- No `any`-equivalents: no reflection-based field access in domain code, no `@JsonRawValue` escape hatches without a documented boundary note.

## 4. Config vs infrastructure (TR-03; mirrors TS guardrail 5 / ADR-005)

- **`@ConfigurationProperties` (typed, prefix-bound) for all environment configuration.** No `@Value` scatter, no static config holders, no `System.getenv()` outside configuration classes. Each feature's config lives in that feature's package (`config` package only for cross-cutting platform config).
- **`@Configuration` + `@Bean` for singleton infrastructure clients** (DataSource, S3/R2 client, mail sender, WS registry beans). Config classes declare beans; they contain no business logic.
- This is the direct translation of the POC's `config/` (plain data) vs `infrastructure/` (singleton clients) split.

## 5. REST — controllers, prefix, error contract (TR-04; mirrors TS guardrails 6+7)

- `@RestController` per feature. **No global route prefix; `/api` is declared at the controller's `@RequestMapping` level** (e.g. `@RequestMapping("/api/users")`) — identical convention to the POC (TS guardrail 7, GH-206 analysis). Health/probes may use unmapped `/actuator/health/*` or a controller-level `/health` mapping (ADR-029).
- **Centralized error contract in one `@ControllerAdvice`** — no per-controller try/catch error shaping. Response error shapes follow the MIG-001/003 captured contract (`{error}` / `{code,message}` families).
- Method-level security (`@PreAuthorize` / security filter chain) replaces `@Authorized` decorators; RBAC roles and status enforcement per ADR-025 (4 roles; inactive/suspended denied).
- Middleware-equivalents (correlationId, request logging, rate limiting) are servlet filters/interceptors registered via configuration — never scattered `app.use`-style registration inside controllers.

## 6. Real-time — raw WebSocket (TR-04; mirrors TS socket-controllers surface)

- **Raw Spring `WebSocketHandler`** + a session registry keyed by **(userId, conversationId)**. **No STOMP, no SockJS, no Socket.io, no message broker** (founder-fixed).
- Auth on handshake: the handshake interceptor validates the token (Spring Security), enforces account status, and attaches the principal before session establishment (parity with `webSocketAuthMiddleware`, ledger row WS-BHV-016).
- Envelope `{event,data,timestamp}` preserved verbatim; heartbeat (60s), reconnect/backoff, backlog replay (PostgreSQL `websocket_backlog`, 1h window), presence/typing are application-owned behaviors (ADR-026, ADR-028; ledger LEDGER-MIG-002-REALTIME).
- One handler + per-feature message-routing (the replacement for 6 socket controllers); the frozen event surface in `asyncapi.yaml` is the contract.

## 7. Data access — Spring Data JPA + Flyway (TR-06 data; mirrors TS guardrail 8)

- **Spring Data JPA repositories + entities; no raw SQL in services** (no `JdbcTemplate` string SQL outside migration tooling). The POC's Drizzle query-builder rule translates to: persistence goes through repositories, query derivation or JPQL/criteria where needed — never string SQL in a service.
- **Flyway** migrations only (single clean `V1` baseline re-expressing all 19 tables; duplicate `0005/0006` numbering resolved; enums → Java enums). No other schema-change mechanism.
- IRC credentials encrypted with `AES/GCM/NoPadding` (fresh key/IV); no POC-format replication (ADR-027).
- Contract source is OpenAPI/AsyncAPI (ADR-023) — **Zod is never imported as the contract**; `@yacc/common` schemas are decommissioned with the POC (MIG-080).

## 8. Auth — Spring Security + dual-role OIDC (TR-05)

- Spring Security filter chain: resource-server for inbound JWT; `oauth2Login` for RP; **embedded Spring Authorization Server** for the AS (no Keycloak/broker).
- No bespoke token crypto (the `BETTER_AUTH_SECRET` coupling is unwound). Deterministic first-run Super Admin bootstrap + founder-controlled recovery (`RECOVERY_MODE=once` + `RECOVERY_KEY`) per ADR-025; audit-logged.
- Self-registration creates `USER` only and cannot self-elevate; status enforcement on every REST and WS entry point.

## 9. Async — Quartz + DB DLQ (TR-06)

- **Quartz (DB-backed, in-process)** for retry scheduling (backoff 1m/5m/30m preserved) + **DB DLQ table** + circuit breaker (threshold 5). **Redis is removed** — no BullMQ, no Redis client, no Redis-based caching for queue semantics; the WS backlog is re-homed to PostgreSQL (§6).

## 10. Observability (TR-07)

- **SLF4J + logback structured JSON** (field-shape parity with pino), **MDC `correlationId`** propagated REST→WS→async, **Micrometer + `/actuator/prometheus`** (MetricsSink 8-metric parity), audit via Spring Security events + the audit table (ADR-029).

## 11. Deployment envelope (TR-08)

- **Temurin 21 JRE** base image; **non-root** (runAsUser 1000, drop ALL capabilities); **read-only root filesystem** (tmpdir, heap dumps, logs on emptyDir); pod envelope **≥1Gi request / 2Gi limit**; probes on `/actuator/health/{liveness,readiness}` (or custom `/health/*`); single replica (ADR-029).

## 12. KISS / review gate (TR-09)

- Simplest correct design; no speculative generalization, indirection, or parameterization for imagined futures. Separation of concerns and correct layer placement are **mandatory review findings** — a reviewer must flag a service reaching into another package's repository, a controller containing persistence logic, or config read outside `@ConfigurationProperties` as blocking findings.

---

## 13. TS guardrail → Java mapping (AC-MIG-004-2)

Every `AGENTS.md` backend guardrail, mapped to its Java equivalent or explicit non-applicability:

| # | AGENTS.md TS guardrail | Java/Spring equivalent | Notes |
|---|---|---|---|
| 1 | Flat `src/` folders (`controllers/`, `services/`, `config/`, `infrastructure/`, …); no nested `api/`/`domain/` layering | **Replaced** — package-by-feature with `controller`/`service`/`repository`/`model` sub-layers (§1, TR-01/ADR-024) | Flat folders → feature packages; the "no deep layering" spirit survives as "no hexagonal rings" |
| 2 | No `any` — proper interfaces, never cast | **Replaced** — no `Object`/raw types/`Map<String,Object>` in domain code; records for DTOs; `JsonNode` only at documented JSON boundaries (§3, TR-02) | |
| 3 | One definition per file (class/interface/service), single responsibility | **Carried over** — one top-level type per file; single-responsibility services (KISS, TR-09) | Java convention + review finding |
| 4 | Index files export consts only; no re-export barrels; no inline arrays in `src/index.ts` | **N/A** — no barrel/index-file concept; Spring component scanning + explicit `@Bean` wiring replaces central export registries (`controllers = [...]` → classpath scanning) | The POC wiring file (`src/index.ts`) has no equivalent; `useExpressServer`/`SocketControllers` bootstrap → Spring Boot auto-configuration |
| 5 | Config vs Infrastructure (ADR-005): plain config data vs singleton clients | **Replaced** — `@ConfigurationProperties` vs `@Configuration`+`@Bean` (§4, TR-03) | Same separation, Spring-native mechanism |
| 6 | Middleware via routing-controllers config, never `app.use()` (ADR-014 exception) | **Replaced** — servlet filters/interceptors + security filter chain registered via configuration; no ad-hoc registration inside controllers (§5) | |
| 7 | No global route prefix; `/api` at controller level | **Carried over verbatim** — `@RequestMapping("/api/…")` per controller, no global servlet prefix (§5, TR-04) | |
| 8 | Drizzle query builder only, no raw SQL; schema source in `@yacc/common` | **Replaced** — Spring Data JPA repositories, no SQL in services; **schema via Flyway**; **contract via OpenAPI/AsyncAPI (ADR-023 supersedes ADR-020)** (§7) | The "schema source in common" half is superseded, not mapped |
| 9 | Zod schemas validate all request payloads (SH-004) | **Replaced** — `@Valid` bean validation + jakarta constraints on request DTOs; contract tests against OpenAPI (§3, §7, TR-02) | |
| 10 | Vitest, ≥85% coverage on new code, co-located/`__tests__/`, mock Telegram/IRC | **Replaced** — JUnit 5 + Testcontainers (PostgreSQL), ≥85% coverage on new code, connectors mocked (Mockito) in unit tests (SPEC-002 Testing Strategy, MIG-014) | Coverage threshold carried over unchanged |

Also superseded for the Java service (context, not numbered guardrails): the POC entrypoint rules (`index.ts` bootstrap split, esbuild `dist/index.js` bundle, pnpm/Turbo filters) — replaced by Spring Boot application bootstrap, Gradle build, and the MIG-013 CI pipeline. Node-side caveats in AGENTS.md (dev-baseline vitest failures, missing `db:migrate` scripts) are POC-only facts with no Java target.

## 14. Non-negotiables carried into review (summary)

1. One bounded context per package; **no cross-package service→repository leakage**.
2. Constructor injection only; no `Object`/raw casts; `@Valid` on all request bodies.
3. `/api` at controller `@RequestMapping`; one `@ControllerAdvice` error contract.
4. Raw `WebSocketHandler` + (userId, conversationId) registry; envelope verbatim.
5. Flyway-only schema changes; JPA repositories only; AES-256-GCM for IRC credentials.
6. Quartz + DB DLQ; **Redis removed**; WS backlog in PostgreSQL.
7. Logback JSON + MDC correlationId + Micrometer parity.
8. Temurin 21, non-root, read-only FS, ≥1Gi/2Gi, actuator probes, single replica.
9. ≥85% coverage on new Java code.

## References

- SPEC-002 §Constraints, §Technical Requirements (TR-01..TR-09), §Architecture Notes
- ADR-023..ADR-029; `ADR-030` (package-layout ADR draft, accepted in MIG-005)
- Ledger: `LEDGER-MIG-001-REST`, `LEDGER-MIG-002-REALTIME` (`.docs/migration/`)
- TS guardrails being replaced: `AGENTS.md` § Backend Entrypoints & Architecture Guardrails
