# ADR-028: Async Processing Replacement (Quartz + DB DLQ; Redis dropped)

**Status:** Accepted
**Date:** 2026-09-24
**Owner:** Tech-lead (technical author), Founder (decision authority)
**Type:** Architecture

## Context

The founder chose Quartz, with Redis allowed only if genuinely required for queue semantics. The current async surface: BullMQ retry worker (concurrency 5, backoff 1m/5m/30m) + DLQ table + circuit breaker (threshold 5). **Verified nuance:** Redis has two consumers today — BullMQ (queue semantics) *and* the WS event backlog (`event-backlog.service.ts`, 1h replay, keys `ws:backlog:{userId}`).

## Decision

- **Scheduler:** Quartz (DB-backed, in-process) for retry/DLQ processing; DB DLQ table; circuit breaker (threshold 5). Backoff 1m/5m/30m preserved.
- **Redis removed entirely.** Redis is not required for queue semantics (Quartz is DB-backed), and the WS backlog is not queue semantics.
- **WS backlog re-homed to PostgreSQL:** a `websocket_backlog` table with a 1h rolling window (survives restart, consistent with DB-first single-instance). Not in-memory (avoids losing replay on restart).

## Alternatives Considered

- **Keep Redis + BullMQ:** rejected — founder chose Quartz; Redis adds a second stateful service for no single-instance gain.
- **JobRunr:** rejected — Quartz is the founder-selected, battle-tested default.
- **In-memory WS backlog:** rejected — loses replay on restart; PostgreSQL is the KISS durable choice.

## Consequences

- One fewer infrastructure service (Redis dropped from compose/Helm/CI).
- WS backlog must be re-expressed in PostgreSQL during Phase 5 (MIG-051), not silently dropped.
- BullMQ/Redis test mocks removed; Quartz + DB DLQ tests added.

## Standards Alignment

- TOGAF: application architecture (async).
- AWS Well-Architected: reliability (durable DLQ), cost optimization (fewer services).
