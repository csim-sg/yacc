# ADR-026: Raw Spring WebSocket Transport + Resilience Model

**Status:** Accepted
**Date:** 2026-09-24
**Owner:** Tech-lead (technical author), Founder (decision authority)
**Type:** Architecture
**Supersedes:** ADR-012 (socket-controllers adoption)

## Context

The founder fixed raw Spring WebSocket (no STOMP/SockJS/Socket.io/broker). The current surface: 6 socket controllers, 19 event constants, `{event,data,timestamp}` envelope, rooms, 1h backlog replay, 60s heartbeat, reconnect/backoff, auth middleware, correlationId. Socket.io's HTTP long-polling fallback is dropped.

## Decision

- **Transport:** raw WebSocket via Spring `WebSocketHandler` + a session registry keyed by (userId, conversationId). No STOMP/SockJS/broker.
- **Envelope:** preserve `{event,data,timestamp}`.
- **Re-implement (behavior-tested):** heartbeat (60s), exponential-backoff reconnect, backlog replay (1h), presence/typing, auth on handshake.
- **Resilience ownership:** heartbeat/reconnect/backoff are the application's responsibility (no Socket.io-provided fallback).

## Alternatives Considered

- **STOMP over WebSocket:** rejected — adds a broker abstraction + client dependency for no single-tenant gain.
- **SockJS:** rejected — adds fallback complexity; raw WS is the KISS target and frontend rewrites either way.
- **netty-socketio:** rejected — retains a Socket.io dependency and does not match "Spring WebSocket" direction.

## Consequences

- Frontend drops `socket.io-client` (both stacks) and adopts a single raw-WS client + event router.
- Network-resilience regression risk (lost polling fallback) is an accepted, behavior-tested tradeoff.

## Standards Alignment

- TOGAF: application architecture (real-time).
- AWS Well-Architected: reliability (reconnect/backoff).
