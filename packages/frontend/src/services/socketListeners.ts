/**
 * Socket.io Event Listeners Registration
 *
 * Central place to register all WebSocket event listeners
 * Handlers are imported from individual handler modules
 *
 * This service should be called once during app initialization
 * after WebSocket service is initialized
 */

import { webSocketService } from './websocket.service';
import {
  handleConversationUpdated,
  handleConversationReopened,
} from './event-handlers/conversation.handler';
import {
  handleMessageReceived,
  handleMessageSent,
  handleMessageFailed,
} from './event-handlers/message.handler';
import {
  handleTypingStarted,
  handleTypingStopped,
  clearAllTypingTimeouts,
} from './event-handlers/typing.handler';
import { handlePresenceUpdated } from './event-handlers/presence.handler';
import { handleNotificationReceived } from './event-handlers/notification.handler';
import type {
  ConversationUpdatedEvent,
  ConversationReopenedEvent,
  MessageReceivedEvent,
  MessageSentEvent,
  MessageFailedEvent,
  TypingStartedEvent,
  TypingStoppedEvent,
  PresenceUpdatedEvent,
  NotificationReceivedEvent,
} from '../types/websocket.types';
import { logger } from '../lib/logger';

/**
 * Register all WebSocket event listeners
 * Called during app initialization
 */
export function registerSocketListeners(): void {
  logger.info('[SocketListeners] Registering all WebSocket event listeners');

  // Conversation events
  webSocketService.on('conversation.updated', (event: ConversationUpdatedEvent) => {
    handleConversationUpdated(event);
  });

  webSocketService.on('conversation.reopened', (event: ConversationReopenedEvent) => {
    handleConversationReopened(event);
  });

  // Message events
  webSocketService.on('message.received', (event: MessageReceivedEvent) => {
    handleMessageReceived(event);
  });

  webSocketService.on('message.sent', (event: MessageSentEvent) => {
    handleMessageSent(event);
  });

  webSocketService.on('message.failed', (event: MessageFailedEvent) => {
    handleMessageFailed(event);
  });

  // Typing events
  webSocketService.on('typing.started', (event: TypingStartedEvent) => {
    handleTypingStarted(event);
  });

  webSocketService.on('typing.stopped', (event: TypingStoppedEvent) => {
    handleTypingStopped(event);
  });

  // Presence events
  webSocketService.on('presence.updated', (event: PresenceUpdatedEvent) => {
    handlePresenceUpdated(event);
  });

  // Notification events
  webSocketService.on('notification.received', (event: NotificationReceivedEvent) => {
    handleNotificationReceived(event);
  });

  logger.info('[SocketListeners] All WebSocket event listeners registered');
}

/**
 * Unregister and cleanup listeners
 * Called on app unmount or disconnect
 */
export function unregisterSocketListeners(): void {
  logger.info('[SocketListeners] Unregistering WebSocket event listeners');

  // Unregister conversation listeners
  webSocketService.off('conversation.updated');
  webSocketService.off('conversation.reopened');

  // Unregister message listeners
  webSocketService.off('message.received');
  webSocketService.off('message.sent');
  webSocketService.off('message.failed');

  // Unregister typing listeners
  webSocketService.off('typing.started');
  webSocketService.off('typing.stopped');

  // Cleanup typing timeouts
  clearAllTypingTimeouts();

  // Unregister presence listeners
  webSocketService.off('presence.updated');

  // Unregister notification listeners
  webSocketService.off('notification.received');

  logger.info('[SocketListeners] All WebSocket event listeners unregistered');
}
