/**
 * IRC Ingestion Service
 *
 * Handles inbound IRC message ingestion:
 * - Upserts conversation (one per channel)
 * - Inserts inbound messages
 * - Auto-reopens resolved conversations
 * - Emits WebSocket events for real-time updates
 * - Triggers routing rules evaluation
 * - Logs audit trail
 *
 * Design:
 * - Does NOT block on rule evaluation errors (best-effort)
 * - Does NOT block on audit log errors (best-effort)
 * - Uses system actor (actorId=null) for connector-triggered actions
 */

import { dbClient } from '../infrastructure/db.client';
import { conversations } from '../schemas/conversation.schema';
import { messages } from '../schemas/message.schema';
import { auditService } from './audit.service';
import { logger } from '../infrastructure/logger';
import { eq, and } from 'drizzle-orm';
import type { IRCMessageEvent } from 'irc-framework';
import { getWebSocketGateway, isWebSocketGatewayAvailable } from './websocket/websocket-gateway';

/**
 * DTO for inbound IRC message
 */
export interface InboundIRCMessageDTO {
  channel: string; // e.g., '#channel'
  nick: string; // Sender nick
  message: string; // Message body (raw from IRC)
  connectorNick: string; // Configured connector nick (for self-echo detection)
}

/**
 * Response from ingestion
 */
export interface IngestionResult {
  success: boolean;
  conversationId?: string;
  messageId?: string;
  error?: string;
}

/**
 * IRC Ingestion Service
 */
export class IRCIngestionService {
  /**
   * Sanitize inbound message body
   * Removes excessive whitespace and control characters
   */
  private sanitizeMessageBody(body: string): string {
    // Remove leading/trailing whitespace
    let sanitized = body.trim();

    // Replace excessive whitespace with single space
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Remove control characters (except newlines for multi-line support)
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Check if this is a self-echo (message from connector's own nick)
   */
  private isSelfEcho(nick: string, connectorNick: string): boolean {
    return nick.toLowerCase() === connectorNick.toLowerCase();
  }

  /**
   * Check if target is a channel (not a DM)
   * Channels start with # or &
   */
  private isChannel(target: string): boolean {
    return target.startsWith('#') || target.startsWith('&');
  }

  /**
   * Find or create a conversation for this IRC channel
   */
  private async upsertConversation(channel: string): Promise<string> {
    // Query for existing conversation
    const existing = await dbClient
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.channel, 'irc'),
          eq(conversations.externalThreadId, channel)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    // Create new conversation
    const result = await dbClient
      .insert(conversations)
      .values({
        channel: 'irc' as const,
        externalThreadId: channel,
        title: channel, // Use channel name as title
        status: 'open' as const,
        priority: 'normal' as const,
        metadata: { source: 'irc_connector' },
      })
      .returning({ id: conversations.id });

    if (!result[0]) {
      throw new Error(`Failed to create conversation for channel ${channel}`);
    }

    return result[0].id;
  }

  /**
   * Auto-reopen a resolved conversation to 'open'
   * Returns true if conversation was reopened, false if already open
   */
  private async autoReopenConversation(conversationId: string): Promise<boolean> {
    const existing = await dbClient
      .select({ status: conversations.status })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!existing[0]) {
      logger.warn({ conversationId }, 'Conversation not found for auto-reopen check');
      return false;
    }

    if (existing[0].status !== 'resolved') {
      return false; // Already open or pending, no reopen needed
    }

    // Update to open
    await dbClient
      .update(conversations)
      .set({ status: 'open' as const, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    // Log auto-reopen in audit trail (system actor)
    await auditService.logAction({
      actorId: undefined, // System actor
      action: 'conversation.reopened',
      entityType: 'conversation',
      entityId: conversationId,
      metadata: {
        reason: 'inbound_message_received',
        trigger: 'irc_connector',
      },
    }).catch((err) => {
      logger.warn(
        { conversationId, error: err instanceof Error ? err.message : String(err) },
        'Failed to log auto-reopen audit event'
      );
      // Don't throw - audit failure shouldn't stop ingestion
    });

    return true;
  }

  /**
   * Insert inbound message
   */
  private async insertMessage(
    conversationId: string,
    senderName: string,
    body: string
  ): Promise<string> {
    const result = await dbClient
      .insert(messages)
      .values({
        conversationId,
        senderId: null, // External sender, no user account
        senderName,
        body,
        status: 'sent', // Inbound messages are already "sent" (delivered)
        direction: 'inbound',
        externalMessageId: undefined,
        metadata: { source: 'irc_connector' },
      })
      .returning({ id: messages.id });

    if (!result[0]) {
      throw new Error('Failed to insert message');
    }

    return result[0].id;
  }

  /**
   * Emit WebSocket events for inbound message
   * Best-effort: doesn't throw on emission failures
   *
   * Note: Currently emits via raw Socket.io since message.received is not in typed gateway
   * This matches the pattern used by ConnectorController
   */
  private async emitWebSocketEvents(
    conversationId: string,
    messageId: string,
    senderName: string
  ): Promise<void> {
    try {
      if (!isWebSocketGatewayAvailable()) {
        logger.debug({ conversationId }, 'WebSocket gateway not available yet');
        return;
      }

      const gateway = getWebSocketGateway();
      const room = `conversation:${conversationId}`;

      // Get Socket.io server instance for raw event emission
      const server = gateway.getServer();

      // Emit message.received event (matches frontend listener)
      // Note: Using raw Socket.io emission for now; typed gateway will be updated in future
      server.to(room).emit('message.received', {
        conversationId,
        messageId,
        platform: 'irc',
        senderId: senderName, // External sender, use nick as ID
        senderName,
        body: '', // Body is in the message record, not WebSocket event
        timestamp: new Date().toISOString(),
      });

      logger.debug(
        { conversationId, messageId, room },
        'Emitted message.received event to conversation'
      );
    } catch (error) {
      logger.warn(
        { conversationId, messageId, error: error instanceof Error ? error.message : String(error) },
        'Failed to emit WebSocket events (continuing with ingestion)'
      );
      // Don't throw - WebSocket failures shouldn't block ingestion
    }
  }

  /**
   * Trigger routing rules evaluation (best-effort)
   * Currently deferred as rules engine is not yet available
   */
  private async evaluateRoutingRules(conversationId: string): Promise<void> {
    // Phase 2: Implement rules engine integration
    // For now, defer this to avoid creating new architecture
    logger.debug(
      { conversationId },
      'Routing rules evaluation deferred for Phase 2'
    );
  }

  /**
   * Main ingestion method: process inbound IRC message
   */
  async ingestInboundMessage(dto: InboundIRCMessageDTO): Promise<IngestionResult> {
    const { channel, nick, message: rawMessage, connectorNick } = dto;

    try {
      // Step 1: Validate channel (must be channel, not DM)
      if (!this.isChannel(channel)) {
        logger.debug(
          { channel, nick },
          'Ignoring non-channel message (DM or server message)'
        );
        return {
          success: false,
          error: 'DM or non-channel message (deferred to Phase 2)',
        };
      }

      // Step 2: Check for self-echo
      if (this.isSelfEcho(nick, connectorNick)) {
        logger.debug(
          { channel, nick, connectorNick },
          'Ignoring self-echo message'
        );
        return {
          success: false,
          error: 'Self-echo detected (connector nick matches sender)',
        };
      }

      // Step 3: Sanitize message body
      const sanitizedBody = this.sanitizeMessageBody(rawMessage);
      if (sanitizedBody.length === 0) {
        logger.debug({ channel, nick }, 'Ignoring empty message after sanitization');
        return {
          success: false,
          error: 'Message body is empty after sanitization',
        };
      }

      // Step 4: Upsert conversation
      const conversationId = await this.upsertConversation(channel);
      logger.debug({ conversationId, channel }, 'Conversation upserted');

      // Step 5: Auto-reopen if resolved
      const wasReopened = await this.autoReopenConversation(conversationId);
      if (wasReopened) {
        logger.info({ conversationId, channel }, 'Conversation auto-reopened');
      }

      // Step 6: Insert message
      const messageId = await this.insertMessage(conversationId, nick, sanitizedBody);
      logger.debug({ conversationId, messageId, nick }, 'Message inserted');

      // Step 7: Emit WebSocket events (best-effort)
      await this.emitWebSocketEvents(conversationId, messageId, nick);

      // Step 8: Trigger routing rules (best-effort, deferred)
      await this.evaluateRoutingRules(conversationId);

      // Step 9: Log ingestion event (best-effort)
      await auditService.logAction({
        actorId: undefined, // System actor
        action: 'message.ingested',
        entityType: 'message',
        entityId: messageId,
        metadata: {
          conversationId,
          channel,
          senderNick: nick,
          trigger: 'irc_connector',
        },
      }).catch((err) => {
        logger.warn(
          { messageId, error: err instanceof Error ? err.message : String(err) },
          'Failed to log message ingestion audit event'
        );
        // Don't throw
      });

      logger.info(
        { conversationId, messageId, channel, nick },
        'Inbound IRC message ingested successfully'
      );

      return {
        success: true,
        conversationId,
        messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { channel, nick, error: errorMessage },
        'Failed to ingest inbound IRC message'
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

/**
 * Export singleton instance
 */
export const ircIngestionService = new IRCIngestionService();
