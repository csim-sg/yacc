/**
 * Telegram Adapter Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { OutboundMessagePayload } from '../../types/gateway.types';
import { TelegramAdapter, type TelegramAdapterConfig } from '../telegram.adapter';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TelegramAdapter', () => {
  let adapter: TelegramAdapter;
  const testConfig: TelegramAdapterConfig = {
    botToken: '123456789:ABCdefGHIjklMNOpqrSTUvwxyz1234567890',
    botName: 'TestBot',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new TelegramAdapter();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should have correct platform name', () => {
      expect(adapter.platform).toBe('telegram');
    });

    it('should start with disconnected status', () => {
      expect(adapter.status).toBe('disconnected');
    });
  });

  describe('setConfig', () => {
    it('should store configuration', () => {
      adapter.setConfig(testConfig);
      expect(() => adapter.setConfig(testConfig)).not.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return unhealthy when disconnected', async () => {
      const result = await adapter.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.details).toContain('disconnected');
    });
  });

  describe('send', () => {
    it('should return error when not configured', async () => {
      const payload: OutboundMessagePayload = {
        conversationId: 'test-conv-id',
        body: 'Hello',
        userId: 'user-1',
      };

      const result = await adapter.send(payload);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return error when not connected', async () => {
      adapter.setConfig(testConfig);
      const payload: OutboundMessagePayload = {
        conversationId: 'test-conv-id',
        body: 'Hello',
        userId: 'user-1',
        metadata: { recipientId: '-1001234567890' },
      };

      const result = await adapter.send(payload);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
    });
  });

  describe('events', () => {
    it('should emit adapter:disconnected on disconnect', async () => {
      const disconnectHandler = vi.fn();
      adapter.on('adapter:disconnected', disconnectHandler);

      await adapter.disconnect();

      expect(disconnectHandler).toHaveBeenCalledWith({ reason: 'manual' });
    });
  });
});
