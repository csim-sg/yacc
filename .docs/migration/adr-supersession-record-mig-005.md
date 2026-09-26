---
record_id: ADR-SUPERSESSION-MIG-005
version: 1.0.0
spec: "https://github.com/Antpolis/documentation/blob/master/02-Architecture-Landscape/projects/yacc/spec/SPEC-002-java-spring-backend-migration.md"
milestone: "https://github.com/csim-sg/yacc/milestone/3"
task: "https://github.com/csim-sg/yacc/issues/339"
baseline_revision: 9728901 (dev, post-Phase-0 merge)
recorded_at: 2026-09-26
durable_context:
  - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-023-contract-source-openapi-asyncapi.md"
  - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-024-java-spring-backend-replacement-architecture.md"
  - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-025-auth-spring-security-dual-role-oidc-bootstrap-recovery.md"
  - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-026-raw-spring-websocket-resilience.md"
  - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-029-jvm-deployment-envelope-observability.md"
  - "https://github.com/csim-sg/yacc/blob/dev/.docs/adr/ADR-030-java-package-layout.md"
---

# MIG-005 — ADR Supersession & Java Replacement Acceptance Record

Consolidated, explicit record of every ADR supersession, amendment, exclusion, and
acceptance executed by MIG-005 (#339) under SPEC-002. No founder-fixed decision is
reopened; every change below only records an already-approved SPEC-002 architecture
direction (SPEC-002 §Architecture Notes) on the affected ADR. Decision content of every
affected ADR is retained unchanged — status headers carry the lifecycle annotation and a
dated note links the successor.

## 1. Accepted as final (verified, no file change needed)

| ADR | Status | Note |
|---|---|---|
| **ADR-023** — Contract Source: OpenAPI 3.1 + AsyncAPI/JSON Schema | Accepted | Confirmed final in MIG-005. Supersedes ADR-020 (declared in the ADR). Operationalized by MIG-003: `.docs/migration/openapi.yaml`, `asyncapi.yaml`, `contract-canonicalization.md`, binding ledger `ledger-mig-003-reconciled.md`. |
| **ADR-024** — Java/Spring Backend Replacement Architecture | Accepted | Confirmed final in MIG-005. Parent decision for the Java guardrail set; concretized by ADR-030 (below). |

## 2. Accepted in MIG-005

| ADR | Status change | Note |
|---|---|---|
| **ADR-030** — Java Package Layout + Guardrail Codification | Proposed (draft) → **Accepted** | Acceptance was scheduled in MIG-005 per AC-MIG-004-3 (MIG-004 #337). Title drops "(Draft)". Binding for all MIG-010..091 implementation; the companion guardrails doc `.docs/architecture/004-java-backend-guardrails.md` is binding with it. |

## 3. Superseded (explicit, never silent)

| Superseded ADR | Superseded by | Reason |
|---|---|---|
| **ADR-020** — Zod Schemas as Single Source of Truth for API Validation | **ADR-023** | Java/Spring cannot consume TypeScript Zod schemas; a TS-only contract source guarantees drift. OpenAPI 3.1 + AsyncAPI/JSON Schema are the language-neutral contract source; `@yacc/common` Zod is removed at decommission (MIG-080). Status line + dated supersession note added. |
| **ADR-006** — Auth Client Implementation Strategy (custom fetch + BetterAuth endpoints) | **ADR-025** | BetterAuth is TypeScript-only and is replaced by Spring Security + Spring Authorization Server (dual-role OIDC). The POC custom auth client pattern is replaced by ONE canonical API client over generated OpenAPI types (MIG-003 §2). Status line + dated supersession note added. |
| **ADR-012** — Socket-Controllers Adoption for WebSocket Event Handling | **ADR-026** | Socket.io + socket-controllers is replaced by raw Spring WebSocket + session registry (no STOMP/SockJS/broker); socket-controllers has no Java equivalent. The real-time wire contract is frozen in `.docs/migration/asyncapi.yaml` (MIG-003). Status line + dated supersession note added. |

## 4. Amended (status retained; dated amendment note added)

| ADR | Status | Amendment |
|---|---|---|
| **ADR-019** — K3s + Helm CI/CD Deployment | Accepted (amended) | K3s + Helm remains the target. Amendments: Redis removed from the Helm dependency set (ADR-028); pod envelope re-specified ≥1Gi/2Gi (ADR-029); probes remap to `/actuator/health/*` with wire paths `/health`, `/health/live`, `/health/ready` preserved (ADR-029 + MIG-003 §5); JVM/Temurin 21 image envelope, non-root, read-only root FS (ADR-029). Frontend-out-of-Helm unchanged. |
| **ADR-004** — Logging and Observability Strategy (Pino) | Accepted (amended) | Pino stays for the Node POC until decommission; the Java target uses SLF4J/logback JSON + MDC + Micrometer (ADR-029/TR-07) preserving the baseline pino JSON field shape. Requirements (structured JSON, correlation IDs, audit, <5ms) carry over; only the library mapping changes. |
| **ADR-021** — Lenient JSON Schema Validation for Routing Rules | Approved (re-expressed) | Behavior preserved verbatim in Java: lenient rule JSON + strict referenced-entity validation + test endpoint + execution logs — frozen as REST-RULES-001..005 (REST-RULES-002 re-expresses this ADR; MIG-041 contract tests cover leniency). Policy unchanged, not reopened. |

## 5. Explicitly excluded (status retained; dated exclusion note added)

| ADR | Status | Exclusion |
|---|---|---|
| **ADR-018** — Bun Runtime Migration | Proposed (excluded) | Founder excluded Bun from SPEC-002 (Non-Goals). The Node backend it targets is itself replaced by Java (ADR-024) and decommissioned (MIG-080), mooting the ADR. Not superseded by anything; must not be implemented without a new founder decision. |

## 6. Vault mirror reconciliation (carried from Phase 0 merge gate)

- Vault `02-Architecture-Landscape/projects/yacc/architecture/java-backend-guardrails.md`
  line 38: two-digit heading `ADR-24` corrected to `ADR-024` (repo canonical source was
  already fixed in 7dd3473; vault reconciliation was deferred to MIG-005/MIG-090 per the
  Phase 0 merge-gate record).
- Vault ADR-030 mirror (`adr/ADR-030-java-package-layout.md`) status flipped
  Proposed → Accepted to match the repo canonical source.

## 7. Verification

- Status-field review: `ADR-023` and `ADR-024` read **Accepted** (issue verification
  command); ADR-030 reads **Accepted**; ADR-020/006/012 read **Superseded** with named
  successors; ADR-019/004/021 and ADR-018 carry dated amendment/exclusion notes.
- Every superseded/amended/excluded ADR is listed above with its reason — no silent
  changes; no ADR decision content was altered.
