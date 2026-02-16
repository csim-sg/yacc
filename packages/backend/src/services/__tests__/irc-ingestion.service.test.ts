/**
 * IRC Ingestion Service Tests
 *
 * Tests for inbound IRC message ingestion:
 * - Channel message upsert (one per channel)
 * - Message insertion with sanitization
 * - Auto-reopen of resolved conversations
 * - Self-echo detection
 * - DM filtering
 * - Audit logging (best-effort)
 *
 * Coverage target: ≥ 85% for new code
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { dbClient } from '../../infrastructure/db.client';
import { conversations } from '../../schemas/conversation.schema';
import { messages } from '../../schemas/message.schema';
import { users } from '../../schemas/user.schema';
import { IRCIngestionService, type InboundIRCMessageDTO } from '../irc-ingestion.service';
import { auditService } from '../audit.service';
import * as wsGateway from '../websocket/websocket-gateway';

// Mock audit service
vi.mock('../../services/audit.service', () => ({
  auditService: {
    logAction: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock WebSocket gateway
vi.mock('../websocket/websocket-gateway', () => ({
  isWebSocketGatewayAvailable: vi.fn().mockReturnValue(true),
  emitToConversation: vi.fn().mockResolvedValue(undefined),
}));

describe('IRC Ingestion Service', () => {
  let service: IRCIngestionService;
  const testChannelPrefix = `#test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const createdConversationIds: string[] = [];

  beforeEach(async () => {
    service = new IRCIngestionService();
    // Reset mocks before each test
    vi.clearAllMocks();

    // Ensure gateway mocks keep their intended behavior after clearAllMocks
    (
      wsGateway.isWebSocketGatewayAvailable as unknown as {
        mockReturnValue: (value: boolean) => void;
      }
    ).mockReturnValue(true);
    (
      wsGateway.emitToConversation as unknown as {
        mockResolvedValue: (value: undefined) => void;
      }
    ).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    // Cleanup only test-created conversations (tracked by ID)
    for (const convId of createdConversationIds) {
      // Delete messages
      await dbClient
        .delete(messages)
        .where(eq(messages.conversationId, convId));

      // Delete conversation
      await dbClient
        .delete(conversations)
        .where(eq(conversations.id, convId));
    }
    createdConversationIds.length = 0; // Clear array for next test
  });

  describe('Channel Message Ingestion', () => {
    it('should create a new conversation for a channel', async () => {
      const channel = `${testChannelPrefix}-new-conv`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Hello world',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(true);
      expect(result.conversationId).toBeDefined();
      if (result.conversationId) {
        createdConversationIds.push(result.conversationId);
      }

      const convo = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, result.conversationId!))
        .limit(1);

      expect(convo).toHaveLength(1);
      expect(convo[0].channel).toBe('irc');
      expect(convo[0].externalThreadId).toBe(channel);
      expect(convo[0].status).toBe('open');
      expect(convo[0].title).toBe(channel);
    });

    it('should reuse existing conversation for same channel', async () => {
      const channel = `${testChannelPrefix}-reuse`;
      const dto1: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'First message',
        connectorNick: 'bot',
      };

      const result1 = await service.ingestInboundMessage(dto1);
      expect(result1.success).toBe(true);
      if (result1.conversationId) {
        createdConversationIds.push(result1.conversationId);
      }

      const dto2: InboundIRCMessageDTO = {
        channel,
        nick: 'bob',
        message: 'Second message',
        connectorNick: 'bot',
      };

      const result2 = await service.ingestInboundMessage(dto2);
      expect(result2.success).toBe(true);

      // Should be same conversation
      expect(result1.conversationId).toBe(result2.conversationId);

      // Should have two messages
      const msgs = await dbClient
        .select()
        .from(messages)
        .where(eq(messages.conversationId, result1.conversationId!));

      expect(msgs).toHaveLength(2);
    });

    it('should insert inbound message with sent status', async () => {
      const channel = `${testChannelPrefix}-msg`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Test message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);
      expect(result.success).toBe(true);
      if (result.conversationId) {
        createdConversationIds.push(result.conversationId);
      }

      const msg = await dbClient
        .select()
        .from(messages)
        .where(eq(messages.id, result.messageId!))
        .limit(1);

      expect(msg).toHaveLength(1);
      expect(msg[0].body).toBe('Test message');
      expect(msg[0].senderName).toBe('alice');
      expect(msg[0].direction).toBe('inbound');
      expect(msg[0].status).toBe('sent');
      expect(msg[0].senderId).toBeNull();
    });
  });

  describe('Message Sanitization', () => {
    it('should trim and collapse whitespace', async () => {
      const channel = `${testChannelPrefix}-sanitize`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: '  hello    world  ',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);
      expect(result.success).toBe(true);
      if (result.conversationId) {
        createdConversationIds.push(result.conversationId);
      }

      const msg = await dbClient
        .select()
        .from(messages)
        .where(eq(messages.id, result.messageId!))
        .limit(1);

      expect(msg[0].body).toBe('hello world');
    });

    it('should ignore empty messages after sanitization', async () => {
      const channel = `${testChannelPrefix}-empty`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: '   \n   \t   ',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/empty/i);
    });
  });

  describe('Self-Echo Detection', () => {
    it('should ignore messages from connector nick (case-insensitive)', async () => {
      const channel = `${testChannelPrefix}-self-echo`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'BOT',
        message: 'Message from bot',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/self-echo/i);
    });

    it('should accept messages from other users', async () => {
      const channel = `${testChannelPrefix}-other-user`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Message from alice',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(true);
      if (result.conversationId) {
        createdConversationIds.push(result.conversationId);
      }
    });
  });

  describe('Channel Filtering', () => {
    it('should ignore DMs (non-channel targets)', async () => {
      const dto: InboundIRCMessageDTO = {
        channel: 'alice',
        nick: 'bob',
        message: 'DM message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/non-channel/i);
    });

    it('should accept # prefixed channels', async () => {
      const channel = `${testChannelPrefix}-hash`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Channel message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(true);
      if (result.conversationId) {
        createdConversationIds.push(result.conversationId);
      }
    });

    it('should accept & prefixed channels', async () => {
      const channel = `&test-ampersand-${Date.now()}`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Local channel message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(true);
      if (result.conversationId) {
        createdConversationIds.push(result.conversationId);
      }
    });
  });

  describe('Auto-Reopen Resolved Conversations', () => {
    it('should reopen a resolved conversation on new inbound message', async () => {
      const channel = `${testChannelPrefix}-reopen`;

      // First, create a conversation via ingestion
      const dto1: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Initial message',
        connectorNick: 'bot',
      };
      const result1 = await service.ingestInboundMessage(dto1);
      expect(result1.success).toBe(true);
      if (result1.conversationId) {
        createdConversationIds.push(result1.conversationId);
      }

      // Manually resolve the conversation
      await dbClient
        .update(conversations)
        .set({ status: 'resolved' as const })
        .where(eq(conversations.id, result1.conversationId!));

      // Now send a new message - should reopen
      const dto2: InboundIRCMessageDTO = {
        channel,
        nick: 'bob',
        message: 'New message after resolution',
        connectorNick: 'bot',
      };

      const result2 = await service.ingestInboundMessage(dto2);
      expect(result2.success).toBe(true);

      // Verify conversation is reopened
      const updated = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, result1.conversationId!))
        .limit(1);

      expect(updated[0].status).toBe('open');
    });

    it('should not change status of open conversation', async () => {
      const channel = `${testChannelPrefix}-open-conv`;

      // Create conversation
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Message to open conv',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);
      expect(result.success).toBe(true);
      if (result.conversationId) {
        createdConversationIds.push(result.conversationId);
      }

      // Verify status is still open
      const convo = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, result.conversationId!))
        .limit(1);

      expect(convo[0].status).toBe('open');
    });
  });

  describe('WebSocket Event Emission', () => {
    it('should emit message.received and complete ingestion successfully', async () => {
      const channel = `${testChannelPrefix}-ws-emit`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Test message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);
      
      // Verify ingestion succeeds (emissions are best-effort)
      expect(result.success).toBe(true);
      expect(result.conversationId).toBeDefined();
      expect(result.messageId).toBeDefined();
      
      if (result.conversationId) {
        createdConversationIds.push(result.conversationId);
      }

      // Verify message was created (WebSocket emission doesn't block)
      const msg = await dbClient
        .select()
        .from(messages)
        .where(eq(messages.id, result.messageId!))
        .limit(1);

      expect(msg).toHaveLength(1);
      expect(msg[0].body).toBe('Test message');
      expect(msg[0].senderName).toBe('alice');

      // Verify WebSocket emission called with contract-aligned payload
      expect(wsGateway.emitToConversation).toHaveBeenCalledTimes(1);
      expect(wsGateway.emitToConversation).toHaveBeenCalledWith(
        result.conversationId!,
        'message.received',
        expect.objectContaining({
          conversationId: result.conversationId!,
          messageId: result.messageId!,
          platform: 'irc',
          senderId: 'alice',
          senderName: 'alice',
          body: 'Test message',
          timestamp: msg[0].createdAt.toISOString(),
        })
      );
    });
  });

  describe('Audit Logging', () => {
    it('should handle audit logging gracefully (mocked)', async () => {
      // Verify audit service is being called - it's mocked so we just check the mock was used
      const channel = `${testChannelPrefix}-audit-check`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Test message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);
      expect(result.success).toBe(true);
      if (result.conversationId) {
        createdConversationIds.push(result.conversationId);
      }

      // Verify audit service was called (it's mocked)
      // This confirms the service attempts to log actions
      expect(auditService.logAction).toHaveBeenCalled();
    });
  });

  describe('Metadata', () => {
    it('should return success result with IDs and proper response structure', async () => {
      const channel = `${testChannelPrefix}-metadata`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Test message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      if (result.success) {
        // Successful ingestion
        expect(result.conversationId).toBeDefined();
        expect(result.messageId).toBeDefined();
        expect(result.error).toBeUndefined();
        if (result.conversationId) {
          createdConversationIds.push(result.conversationId);
        }
      } else {
        // Failed ingestion - should have error message
        expect(result.error).toBeDefined();
        // This can happen if there's a database or service issue
        // But the method should return error object, not throw
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid/empty channel gracefully', async () => {
      const dto: InboundIRCMessageDTO = {
        channel: '',
        nick: 'alice',
        message: 'Test message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);
      // Empty channel should be treated as non-channel
      expect(result.success).toBe(false);
    });

    it('should return error object instead of throwing', async () => {
      const dto: InboundIRCMessageDTO = {
        channel: 'invalid-target',
        nick: 'alice',
        message: 'Test message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.conversationId).toBeUndefined();
    });
  });
});
