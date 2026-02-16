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
import { conversationService } from './conversation.service';
import { logger } from '../infrastructure/logger';
import { eq, and } from 'drizzle-orm';
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
   * Removes leading/trailing whitespace, collapses consecutive whitespace,
   * and removes control characters
   */
  private sanitizeMessageBody(body: string): string {
    // Remove leading/trailing whitespace
    let sanitized = body.trim();

    // Collapse consecutive whitespace characters (including newlines) to single space
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Remove control characters
    // [\x00-\x08] = null to backspace
    // [\x0B-\x0C] = vertical tab, form feed
    // [\x0E-\x1F] = shift out to unit separator
    // [\x7F] = delete
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
   * Note: This is not 100% concurrent-safe due to TOCTOU race condition between select and insert.
   * In production, use database-level upsert (INSERT ... ON CONFLICT) for true atomic safety.
   * For MVP, this is acceptable as IRC channels are created rarely and conflicts are unlikely.
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

    // Create new conversation (may fail if concurrent request created it)
    try {
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
    } catch (insertError) {
      // If insert failed due to unique constraint (race condition with concurrent request),
      // fetch the newly created conversation
      const errorMsg = insertError instanceof Error ? insertError.message : String(insertError);
      if (!errorMsg.includes('unique') && !errorMsg.includes('duplicate') && !errorMsg.includes('conflict')) {
        // Re-throw if it's not a unique constraint error
        throw insertError;
      }

      logger.debug(
        { channel },
        'Conversation created by concurrent request, fetching it'
      );

      // Fetch the existing conversation (created by concurrent request)
      const concurrent = await dbClient
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.channel, 'irc'),
            eq(conversations.externalThreadId, channel)
          )
        )
        .limit(1);

      if (!concurrent[0]) {
        throw new Error(`Failed to find conversation for channel ${channel} after race condition`);
      }

      return concurrent[0].id;
    }
  }



  /**
   * Emit WebSocket events for inbound message
   * Best-effort: doesn't throw on emission failures
   *
   * Emits via WebSocket backlog mechanism which persists events for clients on reconnect
   */
  private async emitWebSocketEvents(
    conversationId: string,
    messageId: string,
    senderName: string,
    body: string
  ): Promise<void> {
    try {
      if (!isWebSocketGatewayAvailable()) {
        logger.debug({ conversationId }, 'WebSocket gateway not available yet');
        return;
      }

      const gateway = getWebSocketGateway();
      const room = `conversation:${conversationId}`;

      // Emit via Socket.io with full message data
      // WebSocket backlog will persist this for clients on reconnect
      const server = gateway.getServer();
      server.to(room).emit('message.received', {
        conversationId,
        messageId,
        platform: 'irc',
        senderId: senderName, // External sender, use nick as ID
        senderName,
        body, // Include full message body (required by frontend listener)
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

      // Step 5: Insert message and handle auto-reopen (uses ConversationService)
      // This also updates lastActivityAt and handles conversation reopening
      const { message, reopened } = await conversationService.createMessage({
        conversationId,
        senderName: nick,
        body: sanitizedBody,
        direction: 'inbound',
        status: 'sent', // Inbound messages are already "sent" (delivered)
      });

      if (reopened) {
        logger.info({ conversationId, channel }, 'Conversation auto-reopened');
      }

      logger.debug({ conversationId, messageId: message.id, nick }, 'Message inserted');

      // Step 6: Emit WebSocket events (best-effort)
      await this.emitWebSocketEvents(conversationId, message.id, nick, sanitizedBody);

      // Step 7: Trigger routing rules (best-effort, deferred to Phase 2)
      await this.evaluateRoutingRules(conversationId);

      // Step 8: Log ingestion event (best-effort)
      await auditService.logAction({
        actorId: undefined, // System actor
        action: 'message.ingested',
        entityType: 'message',
        entityId: message.id,
        metadata: {
          conversationId,
          channel,
          senderNick: nick,
          trigger: 'irc_connector',
        },
      }).catch((err) => {
        logger.warn(
          { messageId: message.id, error: err instanceof Error ? err.message : String(err) },
          'Failed to log message ingestion audit event'
        );
        // Don't throw
      });

      logger.info(
        { conversationId, messageId: message.id, channel, nick },
        'Inbound IRC message ingested successfully'
      );

      return {
        success: true,
        conversationId,
        messageId: message.id,
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
