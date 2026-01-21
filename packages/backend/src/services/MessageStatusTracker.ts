/**
 * Message Status Tracker Service
 *
 * Tracks message delivery status (pending → sent → failed)
 * Emits WebSocket events for real-time updates
 */

import type { MessageDirection } from '@yacc/common/types/connector.types';
import logger from '../utils/logger';

// ============================================
// Message Status Enum
// ============================================

export type MessageStatus = 'pending' | 'sent' | 'failed';

// ============================================
// Message Status Events
// ============================================

/**
 * Store message status update
 */
export interface MessageStatusUpdate {
  messageId: string;
  conversationId: string;
  status: MessageStatus;
  platform: 'telegram' | 'irc';
  previousStatus?: MessageStatus;
  error?: string;
  timestamp: Date;
}

/**
 * Message status event for WebSocket
 */
export interface MessageStatusEvent {
  event: 'message_sent' | 'message_failed' | 'message.received';
  data: {
    messageId: string;
    conversationId: string;
    status: MessageStatus;
    platform: 'telegram' | 'irc';
    direction: MessageDirection;
    timestamp: Date;
    error?: string;
    previousStatus?: MessageStatus;
  };
}

// ============================================
// WebSocket Service (Placeholder)
// ============================================

/**
 * WebSocket service for emitting message status events
 * TODO: Implement when WebSocket server is set up
 */
export class WebSocketService {
  /**
   * Emit message status event
   */
  static emitMessageStatus(event: MessageStatusEvent): void {
    logger.debug('Emitting message status event', {
      event: event.event,
      messageId: event.data.messageId,
      status: event.data.status,
      platform: event.data.platform,
    });

    // TODO: Emit via Socket.io
    // socket.emit(`message_${event.event}`, event.data);
  }

  /**
   * Emit generic notification event
   */
  static emitNotification(type: string, data: Record<string, unknown>): void {
    logger.debug('Emitting notification event', { type, data });

    // TODO: Emit via Socket.io
    // socket.emit('notification', { type, data });
  }
}

// ============================================
// Status Transitions
// ============================================

/**
 * Get next status after a failure
 */
export function getNextStatusAfterFailure(currentStatus: MessageStatus): MessageStatus {
  switch (currentStatus) {
    case 'pending':
      return 'pending'; // Still pending, will retry
    case 'failed':
      return 'pending'; // Reset to pending for retry
    case 'sent':
      return 'sent'; // Already sent, no change
    default:
      return 'pending';
  }
}

/**
 * Check if message status can be updated
 */
export function canUpdateStatus(from: MessageStatus, to: MessageStatus): boolean {
  const validTransitions: Record<MessageStatus, MessageStatus[]> = {
    pending: ['pending'],
    sent: ['pending'], // Can be retried after failure
    failed: ['pending'], // Can be retried after failure
  };

  return validTransitions[to]?.includes(from) || false;
}

// ============================================
// Export
// ============================================

export {
  MessageStatus,
  MessageStatusUpdate,
  MessageStatusEvent,
  WebSocketService,
  getNextStatusAfterFailure,
  canUpdateStatus,
};
