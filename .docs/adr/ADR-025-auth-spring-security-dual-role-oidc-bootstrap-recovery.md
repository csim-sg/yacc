# ADR-025: Auth Architecture — Spring Security + Dual-Role OIDC + Bootstrap/Recovery

**Status:** Accepted
**Date:** 2026-09-24
**Owner:** Tech-lead (technical author), Founder (decision authority)
**Type:** Architecture / Security
**Supersedes:** ADR-006 (BetterAuth client implementation)

## Context

The founder fixed: YACC is both an OIDC relying party (RP) and an OIDC authorization server (AS); full reset; deterministic first-run Super Admin bootstrap + founder-controlled recovery with no surviving POC identities. BetterAuth is TypeScript-only and is replaced. The current auth contract is incoherent (frontend calls non-existent `/simple-auth/*`; `User.id`/role casing drift; `routingControllersAuth.ts` crypto-couples JWT to `BETTER_AUTH_SECRET`).

## Decision

- **Framework:** Spring Security filter chain. Resource-server for inbound JWT; `oauth2Login` for RP; Spring Authorization Server (embedded in the single backend) for AS — no Keycloak/broker.
- **AS policy:** issuer/discovery URLs; JWKS signing + rotation; grants (authorization-code + refresh minimum; client-credentials only if a machine client is named); registered-client policy (YACC frontend unless a third-party client is named); consent/claims model; token/refresh/revocation lifecycle; stateless JWT access default.
- **RBAC:** 4 roles (SUPER_ADMIN/ADMIN/MANAGER/USER) + status (active/inactive/suspended) enforcement.
- **No bespoke token crypto:** unwind `BETTER_AUTH_SECRET` coupling.

### Bootstrap and recovery (founder decision resolved)

1. **Deterministic first-run Super Admin bootstrap:** on startup, if no `SUPER_ADMIN` exists, create exactly one from `BOOTSTRAP_SUPER_ADMIN_EMAIL` + a one-time initial credential (env/secret), mark forced-password-change-on-first-login, audit-log. Idempotent and deterministic.
2. **Founder-controlled recovery:** out-of-band, manual, founder-owned (founder-held `RECOVERY_KEY`); not reachable via the normal API; forces a fresh credential (never restores an old one); audit-logged on every use. KISS default: env-gated restart flag (`RECOVERY_MODE=once` + `RECOVERY_KEY`), not a new public endpoint.
3. **No surviving POC identities:** full reset deletes all POC users/hashes/OIDC links/sessions/tokens; bootstrap creates a brand-new control identity.

## Alternatives Considered

- **Keycloak:** rejected — second service conflicts with single-instance constraint.
- **Stateful server session:** rejected as default — stateless JWT is simpler and matches the current Bearer model; revisit only if revocation SLO requires it.
- **Preserve POC identities:** rejected by founder (full reset).

## Consequences

- BetterAuth removed; frontend auth adapts (reconcile API clients, forced re-login, single auth contract).
- Bootstrap-from-empty and recovery drill are acceptance gates (AC-08).

## Standards Alignment

- ISO 27001 (access control, identity management); OAuth 2.0 / OIDC core.
