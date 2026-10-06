/**
 * Socket.io connection parameters (T3 §5.4 — verified live values).
 *
 * These are the handshake/transport parameters the single socket entry
 * (`WebSocketClientService`) wires 1:1 with the React client:
 *
 * - Handshake auth carries `{ token: '' }` on the live path today (the
 *   React client is constructed without a token and nothing calls
 *   `updateAuthToken`). Token-capture semantics (U6) are resolved in
 *   ANG-004 against this baseline — the seam accepts the token value as
 *   a parameter so that decision cannot leak into services.
 * - Rooms: `user:{userId}`, `conversation:{conversationId}` —
 *   `conversation.updated` / `message.received` are room-scoped;
 *   `message.sent` / `message.failed` / `presence.updated` are global
 *   (T3-G5/G4 context).
 * - Reconnection is socket.io-native; the React-configured delay sequence
 *   `[1000, 2000, 4000, 8000, 30000]` ms with 10 attempts and a 10s
 *   connection timeout is ported verbatim (the `.docs/02` "5 attempts,
 *   1s→60s" table is stale — T3-G6).
 * - Server heartbeat: 60s ping interval (`wsConstants.ts`).
 * - Correlation: `X-Request-ID` per connection (same header as HTTP).
 * - Inbound-only: no client→server events exist or are defined (T2 B14,
 *   T3-G10; ARCH-005 boundary 2).
 */

/** Configured reconnection delay sequence (ms) — React `lib/socket.ts:77`. */
export const WS_RECONNECTION_DELAYS_MS: readonly number[] = [1000, 2000, 4000, 8000, 30000];

/** Maximum socket.io reconnection attempts. */
export const WS_MAX_RECONNECTION_ATTEMPTS = 10;

/** Socket.io connection timeout (ms). */
export const WS_CONNECTION_TIMEOUT_MS = 10000;

/** Server heartbeat / ping interval (ms) — backend `wsConstants.ts`. */
export const WS_PING_INTERVAL_MS = 60000;

/** Transports requested by the React client, in order. */
export const WS_TRANSPORTS: readonly string[] = ['websocket', 'polling'];

/** Room-name prefixes (server-side convention; documented for the harness). */
export const WS_ROOM_PREFIXES = {
  user: 'user:',
  conversation: 'conversation:',
} as const;

/** Handshake auth payload — the live path sends an empty token (§5.4, U6). */
export interface WsHandshakeAuth {
  token: string;
}

/** Handshake correlation header — same format as the HTTP `X-Request-ID`. */
export const WS_CORRELATION_HEADER = 'X-Request-ID';
