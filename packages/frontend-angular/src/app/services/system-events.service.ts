import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { WebSocketClientService } from './websocket-client.service';
import { WebSocketStateService } from './websocket-state.service';

/**
 * System-channel real-time handler — the seven `system.*` channels the
 * frozen target wires (ADR-026 application-level resilience;
 * `contract-canonicalization.md` §4.3). No React parity exists (the
 * baseline heartbeat was Socket.io engine-level): this handler encodes
 * the frozen wire truth with MINIMAL state:
 *
 * - `system.heartbeat` → liveness timestamp on the client (the client
 *   records it while routing; the reconnect ladder owns transport
 *   health — no watchdog is invented).
 * - `system.error` → the `WebSocketStateService` last-error row.
 * - `system.connection.established` / `system.reconnection.started` /
 *   `system.reconnection.failed` / `system.backlog.replay.started` /
 *   `system.backlog.replay.completed` → consumed by the client's event
 *   router (frozen-envelope + payload validation) only — no store
 *   writes, because no React store row exists to mirror and none is
 *   invented. Backlog-replay CONSUMPTION is the message/conversation
 *   handlers continuing to apply replayed frames idempotently (message
 *   id dedup); no separate replay UI state is invented here.
 */
@Injectable({ providedIn: 'root' })
export class SystemEventsService {
  private readonly client = inject(WebSocketClientService);
  private readonly websocketState = inject(WebSocketStateService);

  /** Subscribe the handler set; returns the teardown subscription. */
  bind(): Subscription {
    return this.client.on$('system.error').subscribe((payload) => {
      this.websocketState.setLastErrorMessage(payload.error?.message ?? payload.type);
    });
  }
}
