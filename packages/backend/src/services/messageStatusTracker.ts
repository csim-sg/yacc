/**
 * Message Status Tracker Service
 *
 * Tracks message delivery status (pending → sent → failed)
 * Persists status to database and emits WebSocket events for real-time updates
 */

import { eq } from 'drizzle-orm';
import type { Platform } from '@yacc/common/types/platform.type';
import { dbClient } from '../infrastructure/db.client';
import { messages } from '../schemas/message.schema';
import { logger } from '../infrastructure/logger';
// TODO: Import enqueueRetry when messageStatusTracker is fully integrated with message service
// import { enqueueRetry } from '../infrastructure/queues.client';
import { MessageEvents } from '../websockets/wsConstants';

// ============================================
// Message Status Enum
// ============================================

export type MessageStatus = 'pending' | 'sent' | 'failed';

// ============================================
// Message Status Events
// ============================================

/**
 * Message status update
 */
export interface MessageStatusUpdate {
  messageId: string;
  conversationId: string;
  status: MessageStatus;
  platform: Platform;
  previousStatus?: MessageStatus;
  error?: string;
  timestamp: Date;
}

/**
 * Message status event for WebSocket (standardized dot notation)
 */
export interface MessageStatusEvent {
  event: 'message.received' | 'message.sent' | 'message.failed';
  data: {
    messageId: string;
    conversationId: string;
    status: MessageStatus;
    platform: Platform;
    direction: 'inbound' | 'outbound';
    timestamp: Date;
    error?: string;
    previousStatus?: MessageStatus;
  };
}

// ============================================
// Status Transition State Machine
// ============================================

/**
 * Valid status transitions based on current status
 * Pending → Sent (success)
 * Pending → Failed (failure)
 * Failed → Pending (retry)
 * Sent → No transitions (terminal)
 */
const VALID_TRANSITIONS: Record<MessageStatus, MessageStatus[]> = {
  pending: ['sent', 'failed'],
  sent: [], // Terminal state - no further transitions
  failed: ['pending'], // Can retry from failed
};

/**
 * Check if status transition is valid
 */
export function canTransitionTo(from: MessageStatus, to: MessageStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}

/**
 * Get next status after failure
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

// ============================================
// Message Status Tracker
// ============================================

/**
 * Class to track and manage message status lifecycle
 */
class MessageStatusTrackerService {
  /**
   * Track received message (inbound from platform)
   */
  async trackReceivedMessage(update: MessageStatusUpdate): Promise<void> {
    try {
      logger.debug({ 
        messageId: update.messageId,
        platform: update.platform,
      });

      // Persist status to database
      await db
        .update(messages)
        .set({ status: 'pending', updatedAt: new Date() })
        .where(eq(messages.id, update.messageId));

      // Emit WebSocket event
      this.emitMessageStatus({
        event: MessageEvents.MESSAGE_RECEIVED,
        data: {
          messageId: update.messageId,
          conversationId: update.conversationId,
          status: 'pending',
          platform: update.platform,
          direction: 'inbound',
          timestamp: update.timestamp,
        },
      });
    } catch (error) {
      logger.error({ 
        messageId: update.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Track sent message (outbound successfully delivered)
   */
  async trackSentMessage(update: MessageStatusUpdate): Promise<void> {
    try {
      logger.debug({ 
        messageId: update.messageId,
        platform: update.platform,
      });

      // Get current status from database
      const currentMessage = await db
        .select({ status: messages.status })
        .from(messages)
        .where(eq(messages.id, update.messageId))
        .limit(1);

      const currentStatus: MessageStatus | undefined = currentMessage[0]?.status as MessageStatus | undefined;

      // Validate status transition
      if (currentStatus && !canTransitionTo(currentStatus, 'sent')) {
        logger.warn({ 
          messageId: update.messageId,
          from: currentStatus,
          to: 'sent',
        });
        return;
      }

      // Persist status to database
      await db
        .update(messages)
        .set({ status: 'sent', updatedAt: new Date() })
        .where(eq(messages.id, update.messageId));

      // Emit WebSocket event
      this.emitMessageStatus({
        event: MessageEvents.MESSAGE_SENT,
        data: {
          messageId: update.messageId,
          conversationId: update.conversationId,
          status: 'sent',
          platform: update.platform,
          direction: 'outbound',
          timestamp: update.timestamp,
          previousStatus: currentStatus,
        },
      });
    } catch (error) {
      logger.error({ 
        messageId: update.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Track failed message (outbound delivery failed)
   * Enqueues for retry if retryable
   */
  async trackFailedMessage(update: MessageStatusUpdate): Promise<void> {
    try {
      logger.debug({ 
        messageId: update.messageId,
        platform: update.platform,
        error: update.error,
      });

      // Get current status from database
      const currentMessage = await db
        .select({ status: messages.status })
        .from(messages)
        .where(eq(messages.id, update.messageId))
        .limit(1);

      const currentStatus: MessageStatus | undefined = currentMessage[0]?.status as MessageStatus | undefined;

      // Validate status transition
      if (currentStatus && !canTransitionTo(currentStatus, 'failed')) {
        logger.warn({ 
          messageId: update.messageId,
          from: currentStatus,
          to: 'failed',
        });
        return;
      }

      // Persist status to database
      await db
        .update(messages)
        .set({
          status: 'failed',
          updatedAt: new Date(),
          metadata: {
            lastError: update.error,
          },
        })
        .where(eq(messages.id, update.messageId));

      // Determine next status for retry
      const nextStatus = getNextStatusAfterFailure(currentStatus || 'pending');

      // Emit WebSocket event
      this.emitMessageStatus({
        event: MessageEvents.MESSAGE_FAILED,
        data: {
          messageId: update.messageId,
          conversationId: update.conversationId,
          status: 'failed',
          platform: update.platform,
          direction: 'outbound',
          timestamp: update.timestamp,
          error: update.error,
          previousStatus: currentStatus,
        },
      });

      // Enqueue for retry (only if retryable)
      await this.enqueueRetryIfNeeded(update, nextStatus);
    } catch (error) {
      logger.error({ 
        messageId: update.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Enqueue message for retry if it's retryable
   */
  private async enqueueRetryIfNeeded(
    update: MessageStatusUpdate,
    nextStatus: MessageStatus
  ): Promise<void> {
    try {
      // Only retry if next status is pending
      if (nextStatus !== 'pending') {
        logger.debug({ 
          messageId: update.messageId,
          status: update.status,
        });
        return;
      }

      // TODO: Enqueue for retry - requires full message context (body, direction, recipientId)
      // This needs to be implemented when messageStatusTracker is integrated with message service
      // await enqueueRetry({
      //   messageId: update.messageId,
      //   conversationId: update.conversationId,
      //   platformType: update.platform as 'telegram' | 'irc' | 'internal',
      //   direction: 'outbound',
      //   body: '', // Need to fetch from database
      //   recipientId: '', // Need to get from conversation context
      //   retryCount: 1,
      //   lastError: update.error,
      // });

      // logger.info({ 
      //   messageId: update.messageId,
      //   conversationId: update.conversationId,
      //   platform: update.platform,
      // });
    } catch (error) {
      logger.error({ 
        messageId: update.messageId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to enqueue message for retry');
    }
  }

  /**
   * Emit message status event via WebSocket
   * Socket.io server integration will be implemented in Phase 2
   * For now, we only log the event (WebSocket not yet initialized)
   */
  private emitMessageStatus(event: MessageStatusEvent): void {
    logger.debug({ 
      event: event.event,
      messageId: event.data.messageId,
      status: event.data.status,
      platform: event.data.platform,
    });

    // Socket.io server integration will be implemented in Phase 2
    // When implemented, this will emit to connected clients:
    // socket.emit(`message.${event.event}`, event.data);
  }
}

// Singleton instance
const tracker = new MessageStatusTrackerService();

// ============================================
// Public API
// ============================================

export const MessageStatusTracker = {
  trackReceivedMessage: (update: MessageStatusUpdate) =>
    tracker.trackReceivedMessage(update),
  trackSentMessage: (update: MessageStatusUpdate) =>
    tracker.trackSentMessage(update),
  trackFailedMessage: (update: MessageStatusUpdate) =>
    tracker.trackFailedMessage(update),
};

