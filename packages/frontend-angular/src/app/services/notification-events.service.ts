import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { WebSocketClientService } from './websocket-client.service';
import { NotificationsStore } from './notifications.store';

/**
 * Notification-domain real-time handler (the React
 * `event-handlers/notification.handler` port, with the B6 fix the
 * Angular store already encodes: ONE state location).
 *
 * `notification.received` (the only wired notification channel — the
 * wsGateway enveloped emit) writes the frozen payload straight into the
 * `NotificationsStore` (cap/newest-first/persist are the store's).
 *
 * U1 DISPOSITION (recorded, never silently resolved): the sibling
 * channels `notification.deleted` / `notification.read` /
 * `notification.dismissed` are frozen `retained-no-emitter`
 * (parity-of-absence) — NO listener is registered for them and no
 * coverage is claimed; whether the backend ever emits any notification
 * channel is an OPEN founder product decision. This handler encodes the
 * frozen wire truth only.
 */
@Injectable({ providedIn: 'root' })
export class NotificationEventsService {
  private readonly client = inject(WebSocketClientService);
  private readonly notifications = inject(NotificationsStore);

  /** Subscribe the handler set; returns the teardown subscription. */
  bind(): Subscription {
    return this.client.on$('notification.received').subscribe((payload) => {
      this.notifications.addNotification({
        id: payload.id,
        userId: payload.userId,
        type: payload.type,
        conversationId: payload.conversationId,
        actorId: payload.actorId,
        actorName: payload.actorName,
        message: payload.message,
        isRead: payload.isRead,
        createdAt: payload.createdAt,
      });
    });
  }
}
