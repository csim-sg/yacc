/**
 * Gateway Exchange Service
 *
 * Unified orchestration point for inbound/outbound message flow.
 *
 * Responsibilities:
 * - Register and manage platform adapters
 * - Handle inbound messages from adapters (persist, notify, audit)
 * - Handle outbound messages to adapters (enqueue, retry, status)
 * - Error handling with DLQ and circuit breaker
 *
 * @see ADR-005 Addendum-2 - Gateway-Exchange
 */

import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';
import type { PlatformAdapter } from '../infrastructure/types/adapter.interface';
import { conversations } from '../schemas/conversation.schema';
import { messages } from '../schemas/message.schema';
import type {
  AdapterStatus,
  HealthCheckResult,
  InboundMessageEvent,
  OutboundMessagePayload,
  Platform,
  SendResult,
} from '../types/gateway.types';
import type { MessageReceivedPayload } from '../types/websocket.types';
import { auditService } from './audit.service';
import { conversationService } from './conversation.service';
import { dlqService } from './dlq.service';
import { emitToConversation, isWebSocketGatewayAvailable } from './websocket/websocket-gateway';

/**
 * Circuit breaker configuration
 */
const CIRCUIT_BREAKER_THRESHOLD = 5;

/**
 * Gateway Exchange
 *
 * Central hub for message orchestration between platforms and YACC.
 */
export class GatewayExchange {
  private adapters: Map<Platform, PlatformAdapter> = new Map();
  private consecutiveFailures: Map<Platform, number> = new Map();

  /**
   * Register a platform adapter
   *
   * Subscribes to adapter events and adds to registry.
   *
   * @param adapter - Platform adapter to register
   */
  registerAdapter(adapter: PlatformAdapter): void {
    const platform = adapter.platform;

    if (this.adapters.has(platform)) {
      logger.warn({ platform }, 'Overwriting existing adapter registration');
    }

    // Subscribe to adapter events
    adapter.on('message:inbound', (event: InboundMessageEvent) => {
      this.handleInbound(event).catch((error) => {
        logger.error(
          {
            platform: event.platform,
            error: error instanceof Error ? error.message : String(error),
            correlationId: event.correlationId,
          },
          'Error handling inbound message event'
        );
      });
    });

    adapter.on('adapter:connected', () => {
      logger.info({ platform }, 'Adapter connected');
      this.consecutiveFailures.set(platform, 0);
    });

    adapter.on('adapter:disconnected', ({ reason }: { reason: string }) => {
      logger.warn({ platform, reason }, 'Adapter disconnected');
    });

    adapter.on('adapter:error', (error: Error) => {
      logger.error(
        { platform, error: error.message },
        'Adapter error'
      );
    });

    this.adapters.set(platform, adapter);
    this.consecutiveFailures.set(platform, 0);

    logger.info({ platform }, 'Adapter registered with gateway');
  }

  /**
   * Get adapter by platform
   *
   * @param platform - Platform name
   * @returns Adapter or undefined if not registered
   */
  getAdapter(platform: Platform): PlatformAdapter | undefined {
    return this.adapters.get(platform);
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Handle inbound message from platform
   *
   * Flow:
   * 1. Validate event
   * 2. Upsert conversation
   * 3. Create message (with idempotency check)
   * 4. Emit WebSocket event
   * 5. Log audit trail
   * 6. Reset failure counter on success
   *
   * On error:
   * - Log to DLQ
   * - Increment failure counter
   * - Trigger circuit breaker if threshold reached
   */
  async handleInbound(event: InboundMessageEvent): Promise<void> {
    const correlationId = event.correlationId || randomUUID();

    try {
      logger.debug(
        {
          platform: event.platform,
          externalThreadId: event.externalThreadId,
          correlationId,
        },
        'Processing inbound message'
      );

      // Step 1: Validate event
      this.validateInboundEvent(event);

      // Step 2: Get or create conversation
      const conversationId = await this.upsertConversation(event);

      // Step 3: Create message (with idempotency check)
      const message = await this.createInboundMessage(event, conversationId, correlationId);

      if (!message) {
        // Duplicate message, skip
        logger.debug(
          { correlationId, externalThreadId: event.externalThreadId },
          'Duplicate message detected, skipping'
        );
        return;
      }

      // Step 4: Emit WebSocket event
      await this.emitWebSocketEvent(conversationId, message.id, event);

      // Step 5: Log audit trail (best-effort)
      await this.logAuditEvent(message.id, conversationId, event, correlationId);

      // Step 6: Reset failure counter on success
      this.consecutiveFailures.set(event.platform, 0);

      logger.info(
        {
          platform: event.platform,
          conversationId,
          messageId: message.id,
          correlationId,
        },
        'Inbound message processed successfully'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(
        {
          platform: event.platform,
          error: errorMessage,
          correlationId,
        },
        'Failed to process inbound message'
      );

      // Log to DLQ
      await this.logToDLQ(event, errorMessage, correlationId);

      // Increment failure counter
      const failureCount = (this.consecutiveFailures.get(event.platform) || 0) + 1;
      this.consecutiveFailures.set(event.platform, failureCount);

      // Check circuit breaker
      if (failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
        await this.triggerCircuitBreaker(event.platform, failureCount);
      }
    }
  }

  /**
   * Handle outbound message to platform
   *
   * Flow:
   * 1. Get conversation to determine platform
   * 2. Look up adapter
   * 3. Call adapter.send()
   * 4. Update message status based on result
   * 5. Return result
   */
  async handleOutbound(
    payload: OutboundMessagePayload,
    messageId: string
  ): Promise<SendResult> {
    const correlationId = payload.correlationId || randomUUID();

    try {
      logger.debug(
        {
          conversationId: payload.conversationId,
          messageId,
          correlationId,
        },
        'Processing outbound message'
      );

      // Step 1: Get conversation to determine platform
      const conversation = await dbClient.query.conversations.findFirst({
        where: eq(conversations.id, payload.conversationId),
      });

      if (!conversation) {
        throw new Error(`Conversation not found: ${payload.conversationId}`);
      }

      const platform = conversation.channel as Platform;

      // Step 2: Look up adapter
      const adapter = this.adapters.get(platform);
      if (!adapter) {
        throw new Error(`No adapter registered for platform: ${platform}`);
      }

      // Step 3: Call adapter.send()
      const result = await adapter.send(payload);

      // Step 4: Update message status based on result
      if (result.success) {
        await dbClient
          .update(messages)
          .set({
            status: 'sent',
            externalMessageId: result.externalMessageId,
            updatedAt: new Date(),
          })
          .where(eq(messages.id, messageId));

        // Reset failure counter on success
        this.consecutiveFailures.set(platform, 0);

        logger.info(
          {
            conversationId: payload.conversationId,
            messageId,
            platform,
            externalMessageId: result.externalMessageId,
            correlationId,
          },
          'Outbound message sent successfully'
        );
      } else {
        await dbClient
          .update(messages)
          .set({
            status: 'failed',
            updatedAt: new Date(),
            metadata: {
              error: result.error,
              correlationId,
            },
          })
          .where(eq(messages.id, messageId));

        // Increment failure counter
        const failureCount = (this.consecutiveFailures.get(platform) || 0) + 1;
        this.consecutiveFailures.set(platform, failureCount);

        // Check circuit breaker
        if (failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
          await this.triggerCircuitBreaker(platform, failureCount);
        }

        logger.warn(
          {
            conversationId: payload.conversationId,
            messageId,
            platform,
            error: result.error,
            correlationId,
          },
          'Outbound message failed'
        );
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(
        {
          conversationId: payload.conversationId,
          messageId,
          error: errorMessage,
          correlationId,
        },
        'Failed to process outbound message'
      );

      // Update message status to failed
      await dbClient
        .update(messages)
        .set({
          status: 'failed',
          updatedAt: new Date(),
          metadata: {
            error: errorMessage,
            correlationId,
          },
        })
        .where(eq(messages.id, messageId));

      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: errorMessage,
          retryable: true,
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get adapter status for a platform
   */
  getAdapterStatus(platform: Platform): AdapterStatus | undefined {
    return this.adapters.get(platform)?.status;
  }

  /**
   * Get health check for all adapters
   */
  async healthCheckAll(): Promise<Record<Platform, HealthCheckResult>> {
    const results: Record<Platform, HealthCheckResult> = {} as Record<Platform, HealthCheckResult>;

    for (const [platform, adapter] of this.adapters) {
      try {
        results[platform] = await adapter.healthCheck();
      } catch (error) {
        results[platform] = {
          healthy: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return results;
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Validate inbound event structure
   */
  private validateInboundEvent(event: InboundMessageEvent): void {
    if (!event.platform) {
      throw new Error('Missing platform in inbound event');
    }
    if (!event.externalThreadId) {
      throw new Error('Missing externalThreadId in inbound event');
    }
    if (!event.sender?.externalUserId) {
      throw new Error('Missing sender.externalUserId in inbound event');
    }
    if (!event.body || event.body.trim().length === 0) {
      throw new Error('Missing or empty body in inbound event');
    }
    if (!event.receivedAt) {
      throw new Error('Missing receivedAt in inbound event');
    }
  }

  /**
   * Get or create conversation for inbound event
   */
  private async upsertConversation(event: InboundMessageEvent): Promise<string> {
    // Build where clause based on platform and profile
    const whereConditions = [eq(conversations.channel, event.platform), eq(conversations.externalThreadId, event.externalThreadId)];
    
    if (event.ircProfileId !== undefined) {
      whereConditions.push(eq(conversations.ircProfileId, event.ircProfileId));
    }

    // Check for existing conversation
    const existing = await dbClient
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(...whereConditions))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    // Create new conversation
    const result = await dbClient
      .insert(conversations)
      .values({
        channel: event.platform,
        externalThreadId: event.externalThreadId,
        ircProfileId: event.ircProfileId ?? null,
        title: event.externalThreadId,
        status: 'open',
        priority: 'normal',
        metadata: { source: `${event.platform}_adapter` },
      })
      .returning({ id: conversations.id });

    if (!result[0]) {
      throw new Error(`Failed to create conversation for ${event.platform}:${event.externalThreadId}`);
    }

    return result[0].id;
  }

  /**
   * Create inbound message with idempotency check
   */
  private async createInboundMessage(
    event: InboundMessageEvent,
    conversationId: string,
    _correlationId: string
  ): Promise<{ id: string } | null> {
    // Use conversationService.createMessage which handles auto-reopen
    const { message } = await conversationService.createMessage({
      conversationId,
      senderName: event.sender.displayName,
      body: event.body,
      direction: 'inbound',
      status: 'sent', // Inbound messages are already "sent" (delivered)
    });

    return message;
  }

  /**
   * Emit WebSocket event for inbound message
   */
  private async emitWebSocketEvent(
    conversationId: string,
    messageId: string,
    event: InboundMessageEvent
  ): Promise<void> {
    try {
      if (!isWebSocketGatewayAvailable()) {
        logger.debug({ conversationId }, 'WebSocket gateway not available, skipping event');
        return;
      }

      const payload: MessageReceivedPayload = {
        messageId,
        conversationId,
        platform: event.platform,
        senderId: event.sender.externalUserId,
        body: event.body,
        senderName: event.sender.displayName,
        timestamp: event.receivedAt.toISOString(),
      };

      await emitToConversation(conversationId, 'message.received', payload);

      logger.debug(
        { conversationId, messageId },
        'WebSocket event emitted for inbound message'
      );
    } catch (error) {
      logger.warn(
        {
          conversationId,
          messageId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to emit WebSocket event (non-blocking)'
      );
      // Don't throw - WebSocket failures shouldn't block ingestion
    }
  }

  /**
   * Log audit event for inbound message
   */
  private async logAuditEvent(
    messageId: string,
    conversationId: string,
    event: InboundMessageEvent,
    correlationId: string
  ): Promise<void> {
    try {
      await auditService.logAction({
        actorId: undefined, // System actor
        action: 'message.ingested',
        entityType: 'message',
        entityId: messageId,
        metadata: {
          conversationId,
          platform: event.platform,
          externalThreadId: event.externalThreadId,
          senderId: event.sender.externalUserId,
          correlationId,
        },
        correlationId,
      });
    } catch (error) {
      logger.warn(
        {
          messageId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to log audit event (non-blocking)'
      );
      // Don't throw - audit failures shouldn't block ingestion
    }
  }

  /**
   * Log error to dead letter queue
   */
  private async logToDLQ(
    event: InboundMessageEvent,
    errorMessage: string,
    correlationId: string
  ): Promise<void> {
    try {
      // Create a minimal payload for DLQ entry
      // Note: Inbound event DLQ entries don't have a messageId yet since message creation failed
      // We create a placeholder UUID for the FK constraint
      const placeholderId = randomUUID();

      await dlqService.moveToDLQ(
        placeholderId,
        '', // No conversationId yet since upsert may have failed
        {
          messageId: placeholderId,
          conversationId: '',
          recipientId: event.externalThreadId,
          body: event.body,
          direction: 'inbound' as const,
          platformType: event.platform,
          retryCount: 0,
          correlationId,
          metadata: {
            senderId: event.sender.externalUserId,
            senderName: event.sender.displayName,
            rawPayload: event.rawPayload,
          },
        },
        'INBOUND_MESSAGE_FAILED',
        errorMessage,
        {
          correlationId,
          ircProfileId: event.ircProfileId,
          externalThreadId: event.externalThreadId,
        }
      );
    } catch (dlqError) {
      logger.error(
        {
          originalError: errorMessage,
          dlqError: dlqError instanceof Error ? dlqError.message : String(dlqError),
          correlationId,
        },
        'Failed to log to DLQ'
      );
    }
  }

  /**
   * Trigger circuit breaker for a platform
   */
  private async triggerCircuitBreaker(
    platform: Platform,
    failureCount: number
  ): Promise<void> {
    logger.error(
      { platform, failureCount, threshold: CIRCUIT_BREAKER_THRESHOLD },
      'Circuit breaker triggered - disconnecting adapter'
    );

    const adapter = this.adapters.get(platform);
    if (adapter) {
      try {
        await adapter.disconnect();
        logger.info({ platform }, 'Adapter disconnected due to circuit breaker');
      } catch (error) {
        logger.error(
          {
            platform,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to disconnect adapter during circuit breaker'
        );
      }
    }
  }
}

/**
 * Singleton instance for use across the application
 */
export const gatewayExchange = new GatewayExchange();
