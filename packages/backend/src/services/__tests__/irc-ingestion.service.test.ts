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
  isWebSocketGatewayAvailable: vi.fn().mockReturnValue(false),
  getWebSocketGateway: vi.fn(),
}));

describe('IRC Ingestion Service', () => {
  let service: IRCIngestionService;
  let testUserId: string;
  let channelCounter = 0;

  beforeEach(async () => {
    service = new IRCIngestionService();
    channelCounter++;

    // Create test user
    testUserId = 'test-user-' + Math.random().toString(36).slice(2, 9);
    await dbClient
      .insert(users)
      .values({
        id: testUserId,
        email: `test-${testUserId}@example.com`,
        name: 'Test User',
        passwordHash: 'hashed',
        emailVerified: true,
      })
      .onConflictDoNothing();
  });

  afterEach(async () => {
    // Cleanup test conversations and messages
    const convos = await dbClient
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.channel, 'irc'));

    for (const convo of convos) {
      // Delete messages
      await dbClient
        .delete(messages)
        .where(eq(messages.conversationId, convo.id));

      // Delete conversation
      await dbClient
        .delete(conversations)
        .where(eq(conversations.id, convo.id));
    }
  });

  describe('Channel Message Ingestion', () => {
    it('should create a new conversation for a channel', async () => {
      const channel = `#test-channel-${channelCounter}`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Hello world',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(true);
      expect(result.conversationId).toBeDefined();

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
      const channel = `#test-reuse-${channelCounter}`;
      const dto1: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'First message',
        connectorNick: 'bot',
      };

      const result1 = await service.ingestInboundMessage(dto1);
      expect(result1.success).toBe(true);

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
      const channel = `#test-msg-${channelCounter}`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Test message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);
      expect(result.success).toBe(true);

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
      const channel = `#test-sanitize-${channelCounter}`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: '  hello    world  ',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);
      expect(result.success).toBe(true);

      const msg = await dbClient
        .select()
        .from(messages)
        .where(eq(messages.id, result.messageId!))
        .limit(1);

      expect(msg[0].body).toBe('hello world');
    });

    it('should ignore empty messages after sanitization', async () => {
      const channel = `#test-empty-${channelCounter}`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: '   \n   \t   ',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('Self-Echo Detection', () => {
    it('should ignore messages from connector nick (case-insensitive)', async () => {
      const channel = `#test-self-echo-${channelCounter}`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'BOT',
        message: 'Message from bot',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(false);
      expect(result.error).toContain('self-echo');
    });

    it('should accept messages from other users', async () => {
      const channel = `#test-other-user-${channelCounter}`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Message from alice',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(true);
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
      expect(result.error).toContain('non-channel');
    });

    it('should accept # prefixed channels', async () => {
      const channel = `#test-hash-${channelCounter}`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Channel message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(true);
    });

    it('should accept & prefixed channels', async () => {
      const channel = `&test-ampersand-${channelCounter}`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Local channel message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(true);
    });
  });

  describe('Auto-Reopen Resolved Conversations', () => {
    it('should reopen a resolved conversation on new inbound message', async () => {
      const channel = `#test-reopen-${channelCounter}`;

      // Create resolved conversation
      const [convo] = await dbClient
        .insert(conversations)
        .values({
          channel: 'irc',
          externalThreadId: channel,
          status: 'resolved' as const,
          priority: 'normal' as const,
        })
        .returning();

      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'New message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);
      expect(result.success).toBe(true);

      // Verify conversation is reopened
      const updated = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, convo.id))
        .limit(1);

      expect(updated[0].status).toBe('open');
    });

    it('should not change status of open conversation', async () => {
      const channel = `#test-open-${channelCounter}`;

      // Create open conversation
      const [convo] = await dbClient
        .insert(conversations)
        .values({
          channel: 'irc',
          externalThreadId: channel,
          status: 'open' as const,
          priority: 'normal' as const,
        })
        .returning();

      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Message to open conv',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);
      expect(result.success).toBe(true);

      // Verify status unchanged
      const updated = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, convo.id))
        .limit(1);

      expect(updated[0].status).toBe('open');
    });
  });

  describe('Audit Logging', () => {
    it('should attempt to log message ingestion (best-effort)', async () => {
      const channel = `#test-audit-${channelCounter}`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Test message',
        connectorNick: 'bot',
      };

      await service.ingestInboundMessage(dto);

      // Verify audit service was called
      expect(auditService.logAction).toHaveBeenCalled();
    });

    it('should not throw if audit logging fails', async () => {
      vi.mocked(auditService.logAction).mockRejectedValueOnce(
        new Error('Audit service error')
      );

      const channel = `#test-audit-fail-${channelCounter}`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Test message',
        connectorNick: 'bot',
      };

      // Should not throw
      const result = await service.ingestInboundMessage(dto);
      expect(result.success).toBe(true);
    });
  });

  describe('Metadata', () => {
    it('should return success result with IDs', async () => {
      const channel = `#test-meta-${channelCounter}`;
      const dto: InboundIRCMessageDTO = {
        channel,
        nick: 'alice',
        message: 'Test message',
        connectorNick: 'bot',
      };

      const result = await service.ingestInboundMessage(dto);

      expect(result.success).toBe(true);
      expect(result.conversationId).toBeDefined();
      expect(result.messageId).toBeDefined();
      expect(result.error).toBeUndefined();
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
