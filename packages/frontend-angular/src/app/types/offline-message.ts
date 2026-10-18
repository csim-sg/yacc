/**
 * Offline-queue message row (React `types/websocket.types.ts`
 * `OfflineMessage` port — client-internal queue state, not a wire
 * contract).
 */
export interface OfflineMessage {
  /** Temporary id until the server confirms creation. */
  tempId: string;
  conversationId: string;
  body: string;
  /** Milliseconds since epoch. */
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}
