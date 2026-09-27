-- V2 — websocket_backlog (MIG-020 AC-MIG-020-3; ADR-028).
--
-- Durable re-home of the POC's Redis WS event backlog
-- (packages/backend/src/services/websocket/event-backlog.service.ts, keys
-- `ws:backlog:{userId}`, 1h rolling window). One row per stored event,
-- mirroring the POC BacklogEntry shape: event name, optional conversation
-- scope, JSON payload, emission time and 1h expiry. Replay reads by user
-- ordered by emission; a scheduled sweep deletes expired rows (behavior and
-- replay semantics arrive with MIG-051 — this migration is the table only).

CREATE TABLE "websocket_backlog" (
    "id" bigserial PRIMARY KEY,
    "user_id" text NOT NULL,
    "event_name" varchar(100) NOT NULL,
    "conversation_id" uuid,
    "payload" jsonb NOT NULL,
    "emitted_at" timestamp DEFAULT now() NOT NULL,
    "expires_at" timestamp NOT NULL
);

CREATE INDEX "websocket_backlog_user_id_emitted_at_idx" ON "websocket_backlog" ("user_id", "emitted_at");
CREATE INDEX "websocket_backlog_expires_at_idx" ON "websocket_backlog" ("expires_at");
