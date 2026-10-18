/**
 * Raw WebSocket connection parameters (R1 target — frozen contract).
 *
 * These are the transport constants the single raw-WebSocket entry
 * (`WebSocketClientService`) implements, re-pointed from the superseded
 * Node Socket.io handshake (ANG-002 baseline) to the frozen
 * `asyncapi.yaml` + Java raw Spring WebSocket service (ADR-026; SPEC-003
 * §Java Baseline Approval AD-2/R1; `contract-canonicalization.md` §3 —
 * the canonical client behavior contract):
 *
 * - Transport: browser-native `WebSocket`, JSON text frames only.
 *   No Socket.io client library, no STOMP/SockJS, no SSE/`EventSource`/
 *   long-poll fallback (founder-fixed; ADR-026).
 * - Endpoint: the Java service upgrade path `/ws`
 *   (`RealtimeProperties.WebSocket.DEFAULT_PATH`). The base URL source is
 *   `environment.wsUrl` (build-time file replacement; no runtime env).
 * - Handshake auth: the bearer access token rides the upgrade request's
 *   `token` query parameter (the raw-WS equivalent of the Socket.io
 *   `handshake.auth.token`; browsers cannot set headers on an upgrade —
 *   same wire decision as the Java `WebSocketHandshakeAuthInterceptor`).
 *   Token capture semantics are U6 → ANG-004 (`TokenStorageService`).
 * - Correlation: the captured per-connection `X-Request-ID` header has NO
 *   raw-WebSocket equivalent — the browser WS API cannot set custom
 *   headers on an upgrade. HTTP correlation is unchanged (the ANG-005
 *   interceptor); the WS upgrade carries only the auth token. Recorded
 *   disposition, not silently dropped (see `contracts/manifest.md`).
 * - Reconnect/backoff: application-owned (no socket.io Manager). The
 *   captured ladder 1s/2s/4s/8s/30s with 10 attempts is preserved
 *   verbatim (WS-BHV-012; the canonicalized rung list below; the
 *   divergent React `useReconnectionLogic` schedule 1s..60s × 5 with
 *   jitter is NOT ported). After the 5th rung the last delay repeats
 *   until the attempt budget is spent; exhaustion is terminal until a
 *   manual retry (W19).
 * - Heartbeat: the server broadcasts `system.heartbeat` every 60s
 *   (application level — `WS_PING_INTERVAL_MS` documents the frozen
 *   interval; the client never sends pings, inbound-only).
 * - Rooms (`user:{userId}`, `conversation:{conversationId}`) are
 *   server-side fan-out conventions; the client joins no rooms (the
 *   frozen client→server `subscribe.*` channels are not implemented —
 *   the verified frontend surface is inbound-only, T2 B14 / T3-G10).
 */

/** Java raw-WS upgrade path (backend `RealtimeProperties` default). */
export const WS_ENDPOINT_PATH = '/ws';

/** Application-owned reconnect ladder (ms) — captured rungs, in order. */
export const WS_RECONNECT_DELAYS_MS: readonly number[] = [1000, 2000, 4000, 8000, 30000];

/** Maximum application-owned reconnect attempts before terminal state. */
export const WS_MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Handshake timeout (ms) — the captured Socket.io `timeout` option,
 * re-implemented: an upgrade not `OPEN` within this window is closed and
 * the reconnect ladder takes over.
 */
export const WS_CONNECTION_TIMEOUT_MS = 10000;

/** Server heartbeat interval (ms) — frozen WS-BHV-010 reference value. */
export const WS_PING_INTERVAL_MS = 60000;

/** Typing auto-clear window (ms) — React `typing.handler` parity. */
export const WS_TYPING_CLEAR_MS = 5000;

/** Room-name prefixes (server-side convention; documented for the harness). */
export const WS_ROOM_PREFIXES = {
  user: 'user:',
  conversation: 'conversation:',
} as const;
