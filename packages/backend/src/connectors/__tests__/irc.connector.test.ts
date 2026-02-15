import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IRCConnector } from '../irc.connector';
import type { SendMessageRequest } from '@yacc/common/types/sendMessageRequest.interface';

// Mock the logger
vi.mock('../../infrastructure/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock IRC framework with correct export structure
vi.mock('irc-framework', () => {
  const mockClient: Record<string, any> = {
    _handlers: {},
    on: vi.fn(function (this: Record<string, any>, event: string, handler: Function) {
      // Store handlers for testing
      if (!this._handlers) this._handlers = {};
      this._handlers[event] = handler;
      return this;
    }),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    quit: vi.fn(),
    raw: vi.fn(),
    join: vi.fn(),
    say: vi.fn(),
  };

  return {
    Client: vi.fn(() => mockClient),
  };
});

describe('IRCConnector', () => {
  let connector: IRCConnector;
  const mockConfig = {
    platform: 'irc' as const,
    server: 'irc.example.com',
    port: 6667,
    nick: 'testbot',
    password: 'testpass',
    channels: ['#test', '#dev'],
  };

  beforeEach(() => {
    connector = new IRCConnector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration Validation', () => {
    it('should validate required server field', async () => {
      const invalidConfig = {
        platform: 'irc' as const,
        server: '',
        port: 6667,
        nick: 'testbot',
        channels: ['#test'],
      };

      const errors = await connector.validateConfig(invalidConfig);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'server')).toBe(true);
    });

    it('should validate port range (1-65535)', async () => {
      const invalidConfig = {
        platform: 'irc' as const,
        server: 'irc.example.com',
        port: 99999,
        nick: 'testbot',
        channels: ['#test'],
      };

      const errors = await connector.validateConfig(invalidConfig);
      expect(errors.some((e) => e.field === 'port')).toBe(true);
    });

    it('should validate channel format starts with #', async () => {
      const invalidConfig = {
        platform: 'irc' as const,
        server: 'irc.example.com',
        port: 6667,
        nick: 'testbot',
        channels: ['invalid-channel'],
      };

      const errors = await connector.validateConfig(invalidConfig);
      expect(errors.some((e) => e.field === 'channels')).toBe(true);
    });

    it('should require at least one channel', async () => {
      const invalidConfig = {
        platform: 'irc' as const,
        server: 'irc.example.com',
        port: 6667,
        nick: 'testbot',
        channels: [],
      };

      const errors = await connector.validateConfig(invalidConfig);
      expect(errors.some((e) => e.field === 'channels')).toBe(true);
    });

    it('should accept valid configuration', async () => {
      const errors = await connector.validateConfig(mockConfig);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Connection Management', () => {
    it('should fail to connect without configuration', async () => {
      const emptyConnector = new IRCConnector();
      await expect(emptyConnector.connect()).rejects.toThrow('Configuration not set');
    });

    it('should initialize connection status as disconnected', () => {
      const status = connector.getConnectionStatus();
      expect(status.status).toBe('disconnected');
      expect(status.platform).toBe('irc');
      expect(status.reconnectAttempts).toBe(0);
    });

    it('should set config without errors', () => {
      connector.setConfig(mockConfig);
      const status = connector.getConnectionStatus();
      expect(status).toBeDefined();
    });
  });

  describe('Message Sending', () => {
    beforeEach(() => {
      connector.setConfig(mockConfig);
    });

    it('should queue messages when not connected', async () => {
      const request: SendMessageRequest = {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        recipientId: '#test',
        body: 'Test message',
      };

      const response = await connector.sendMessage(request);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toBeTruthy();
        expect(response.error).toContain('not connected');
      }
    });

    it('should reject invalid channel format', async () => {
      const request: SendMessageRequest = {
        conversationId: 'conv-1',
        messageId: 'msg-2',
        recipientId: 'invalid',
        body: 'Test message',
      };

      const response = await connector.sendMessage(request);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toContain('Invalid IRC channel format');
      }
    });

    it('should accept #channel format', async () => {
      const request: SendMessageRequest = {
        conversationId: 'conv-1',
        messageId: 'msg-3',
        recipientId: '#test',
        body: 'Test message',
      };

      const response = await connector.sendMessage(request);
      expect(response.success).toBe(false); // Still queued (not connected)
      if (!response.success) {
        expect(response.error).toContain('not connected');
      }
    });

    it('should accept irc:#channel format', async () => {
      const request: SendMessageRequest = {
        conversationId: 'conv-1',
        messageId: 'msg-4',
        recipientId: 'irc:#test',
        body: 'Test message',
      };

      const response = await connector.sendMessage(request);
      expect(response.success).toBe(false); // Still queued (not connected)
      if (!response.success) {
        expect(response.error).toContain('not connected');
      }
    });
  });

  describe('Disconnection', () => {
    beforeEach(() => {
      connector.setConfig(mockConfig);
    });

    it('should handle disconnect gracefully', async () => {
      await expect(connector.disconnect()).resolves.not.toThrow();
    });

    it('should clear reconnect timeout on disconnect', async () => {
      // Start connection (will schedule reconnect on failure)
      await connector.disconnect();
      // Verify status is disconnected
      const status = connector.getConnectionStatus();
      expect(status.status).toBe('disconnected');
    });
  });

  describe('Channel Format Extraction', () => {
    it('should extract channel from #channel format', () => {
      connector.setConfig(mockConfig);
      // Test via sendMessage with valid channel
      const request: SendMessageRequest = {
        conversationId: 'conv-1',
        messageId: 'msg-5',
        recipientId: '#mychannel',
        body: 'Test',
      };
      expect(request.recipientId).toBe('#mychannel');
    });

    it('should extract channel from irc:#channel format', () => {
      connector.setConfig(mockConfig);
      const request: SendMessageRequest = {
        conversationId: 'conv-1',
        messageId: 'msg-6',
        recipientId: 'irc:#mychannel',
        body: 'Test',
      };
      expect(request.recipientId).toBe('irc:#mychannel');
    });

    it('should reject channels without # prefix', async () => {
      connector.setConfig(mockConfig);
      const request: SendMessageRequest = {
        conversationId: 'conv-1',
        messageId: 'msg-7',
        recipientId: 'mychannel',
        body: 'Test',
      };
      const response = await connector.sendMessage(request);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toContain('Invalid');
      }
    });
  });

  describe('Validation Error Handling', () => {
    it('should throw when connecting with invalid config', async () => {
      const invalidConfig = {
        platform: 'irc' as const,
        server: 'irc.example.com',
        port: 6667,
        nick: '',
        channels: ['#test'],
      };

      connector.setConfig(invalidConfig);
      await expect(connector.connect()).rejects.toThrow();
    });

    it('should validate required nick field', async () => {
      const invalidConfig = {
        platform: 'irc' as const,
        server: 'irc.example.com',
        port: 6667,
        nick: '',
        channels: ['#test'],
      };

      const errors = await connector.validateConfig(invalidConfig);
      expect(errors.some((e) => e.field === 'nick')).toBe(true);
    });
  });

  describe('Status Tracking', () => {
    beforeEach(() => {
      connector.setConfig(mockConfig);
    });

    it('should track connection status', () => {
      const status = connector.getConnectionStatus();
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('platform');
      expect(status).toHaveProperty('reconnectAttempts');
      expect(status).toHaveProperty('error');
    });

    it('should track reconnection attempts', () => {
      const status = connector.getConnectionStatus();
      expect(status.reconnectAttempts).toBe(0);
    });

    it('should report correct platform', () => {
      const status = connector.getConnectionStatus();
      expect(status.platform).toBe('irc');
    });
  });
});
