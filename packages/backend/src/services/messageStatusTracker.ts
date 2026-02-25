/**
 * Message Status Tracker Service
 *
 * Tracks message delivery status (pending → sent → failed)
 * Persists status to database and emits WebSocket events for real-time updates
 */

import type { Platform } from '@yacc/common/types/platform.type';
import { eq } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client.js';
import { logger } from '../infrastructure/logger';
import { enqueueRetry } from '../infrastructure/queues.client.js';
import { conversations } from '../schemas/conversation.schema.js';
import { messages } from '../schemas/message.schema.js';
import type { SendMessageJobPayload } from '../types/message-queue.types.js';
import { MessageEvents } from '../websockets/wsConstants.js';
import { dlqService } from './dlq.service.js';

// ============================================
// Message Status Type
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
  retryCount?: number; // Current retry attempt (0-3)
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
      await dbClient
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
      const currentMessage = await dbClient
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
      await dbClient
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
      const currentMessage = await dbClient
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
      await dbClient
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
    * Enqueue message for retry if it's retryable, or move to DLQ if max attempts reached
    */
   private async enqueueRetryIfNeeded(
     update: MessageStatusUpdate,
     nextStatus: MessageStatus
   ): Promise<void> {
     try {
       const retryCount = update.retryCount || 0;
       const MAX_ATTEMPTS = 3;

      // TODO: Enqueue for retry - requires full message context (body, direction, recipientId)
      // This needs to be implemented when messageStatusTracker is integrated with message service
      // await enqueueRetry({
      //   messageId: update.messageId,
      //   conversationId: update.conversationId,
      //   platformType: update.platform as Platform,
      //   direction: 'outbound',
      //   body: '', // Need to fetch from database
      //   recipientId: '', // Need to get from conversation context
      //   retryCount: 1,
      //   lastError: update.error,
      // });
       // If next status is not pending, no retry needed
       if (nextStatus !== 'pending') {
         logger.debug(
           {
             messageId: update.messageId,
             status: update.status,
             nextStatus,
           },
           'No retry needed (terminal status)'
         );
         return;
       }

       // Check if we've exceeded max attempts
       if (retryCount >= MAX_ATTEMPTS) {
         logger.warn(
           {
             messageId: update.messageId,
             conversationId: update.conversationId,
             retryCount,
             maxAttempts: MAX_ATTEMPTS,
           },
           'Max retry attempts reached, moving to DLQ'
         );

         // Fetch message from database for payload
         const message = await dbClient.query.messages.findFirst({
           where: eq(messages.id, update.messageId),
         });

         if (!message) {
           logger.warn(
             {
               messageId: update.messageId,
             },
             'Message not found for DLQ move'
           );
           return;
         }

          // Fetch conversation to get recipient ID for DLQ
          const dlqConversation = await dbClient.query.conversations.findFirst({
            where: eq(conversations.id, update.conversationId),
          });

          // Create payload for DLQ
           const dlqPayload: SendMessageJobPayload = {
             messageId: update.messageId,
             conversationId: update.conversationId,
             recipientId: dlqConversation?.externalThreadId || update.conversationId, // IRC: #channel, Telegram: chat_id
             body: message.body,
             direction: message.direction as 'inbound' | 'outbound',
             platformType: update.platform,
             retryCount: MAX_ATTEMPTS,
             lastError: update.error,
           };

           // Move to DLQ with explicit traceability fields
          // Determine thread type (for IRC: channels start with # or &, otherwise DM)
          const externalThreadType = dlqConversation?.externalThreadId
            ? (dlqConversation.externalThreadId.startsWith('#') || dlqConversation.externalThreadId.startsWith('&')
              ? 'channel'
              : 'dm')
            : undefined;

          await dlqService.moveToDLQ(
            update.messageId,
            update.conversationId,
            dlqPayload,
            'max_retries_exceeded',
            update.error || 'Unknown error after max attempts',
            {
              ircProfileId: dlqConversation?.ircProfileId ?? undefined,
              externalThreadType,
              externalThreadId: dlqConversation?.externalThreadId,
            }
          );

         logger.info(
           {
             messageId: update.messageId,
             conversationId: update.conversationId,
           },
           'Message moved to Dead Letter Queue'
         );

         return;
       }

        // Enqueue for retry (if under max attempts)
        const message = await dbClient.query.messages.findFirst({
          where: eq(messages.id, update.messageId),
        });

        if (!message) {
          logger.warn(
            {
              messageId: update.messageId,
            },
            'Message not found for retry'
          );
          return;
        }

        // Fetch conversation to get recipient ID (IRC channel name or Telegram chat ID)
        const conversation = await dbClient.query.conversations.findFirst({
          where: eq(conversations.id, update.conversationId),
        });

        if (!conversation?.externalThreadId) {
          logger.warn(
            {
              messageId: update.messageId,
              conversationId: update.conversationId,
            },
            'Conversation external thread ID not found for retry'
          );
          return;
        }

        // Create retry job payload with correct recipient ID (IRC channel or Telegram chat ID)
        const metadata = typeof message.metadata === 'object' && message.metadata !== null 
          ? (message.metadata as Record<string, unknown>) 
          : {};
        
        const retryPayload: SendMessageJobPayload = {
          messageId: update.messageId,
          conversationId: update.conversationId,
          recipientId: conversation.externalThreadId, // IRC: #channel, Telegram: chat_id
          body: message.body,
          direction: message.direction as 'inbound' | 'outbound',
          platformType: update.platform,
          retryCount: retryCount + 1,
          lastError: update.error,
          correlationId: metadata.correlationId as string | undefined, // Propagate correlation ID if available
        };

       // Enqueue to retry queue
       const jobId = await enqueueRetry(retryPayload);

       logger.info(
         {
           messageId: update.messageId,
           conversationId: update.conversationId,
           retryCount: retryCount + 1,
           jobId,
         },
         'Message enqueued for retry'
       );
     } catch (error) {
       logger.error(
         {
           messageId: update.messageId,
           error: error instanceof Error ? error.message : String(error),
         },
         'Failed to enqueue message for retry'
       );
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
