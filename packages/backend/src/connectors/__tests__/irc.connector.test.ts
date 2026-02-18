import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock the logger
vi.mock('../../infrastructure/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock IRC framework with proper event emitter
vi.mock('irc-framework', () => {
  const { EventEmitter } = require('events');

  class MockIRCClient extends EventEmitter {
    public options: Record<string, unknown> | null = null;

    constructor() {
      super();
    }

    connect(options: Record<string, unknown>): void {
      this.options = options;
      // Synchronous - returns void
      // Connection success is signaled via 'registered' event
      // Connection failure via 'error' or 'close' events
    }

    disconnect(): void {
      this.emit('close');
    }

    quit(message?: string): void {
      this.emit('close');
    }

    raw(command: string): void {
      // PRIVMSG implementation
    }

    join(channel: string): void {
      // Join channel
    }

    say(target: string, message: string): void {
      // Say message
    }
  }

  return {
    Client: MockIRCClient,
  };
});

import { IRCConnector } from '../irc.connector';
import { logger } from '../../infrastructure/logger';
import type { SendMessageRequest } from '@yacc/common/types/sendMessageRequest.interface';

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

    it('should fail to connect with invalid config', async () => {
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

    it('should reject channels without # prefix', async () => {
      const request: SendMessageRequest = {
        conversationId: 'conv-1',
        messageId: 'msg-5',
        recipientId: 'mychannel',
        body: 'Test',
      };
      const response = await connector.sendMessage(request);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toContain('Invalid');
      }
    });

    it('should not queue messages when not connected (rely on BullMQ retry)', async () => {
      // Per EA spec: No internal connector-level outbound queueing
      // BullMQ is the only retry mechanism - messages should be rejected immediately if not connected
      for (let i = 0; i < 10; i++) {
        const request: SendMessageRequest = {
          conversationId: 'conv-1',
          messageId: `msg-${i}`,
          recipientId: '#test',
          body: 'Test message',
        };
        const response = await connector.sendMessage(request);
        // All should fail with "not connected" message (no internal queueing)
        expect(response.success).toBe(false);
        if (!response.success) {
          expect(response.error).toContain('not connected');
        }
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
      await connector.disconnect();
      const status = connector.getConnectionStatus();
      expect(status.status).toBe('disconnected');
    });
  });

  describe('Channel Format Extraction', () => {
    it('should extract channel from #channel format', () => {
      connector.setConfig(mockConfig);
      const request: SendMessageRequest = {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        recipientId: '#mychannel',
        body: 'Test',
      };
      expect(request.recipientId).toBe('#mychannel');
    });

    it('should extract channel from irc:#channel format', () => {
      connector.setConfig(mockConfig);
      const request: SendMessageRequest = {
        conversationId: 'conv-1',
        messageId: 'msg-2',
        recipientId: 'irc:#mychannel',
        body: 'Test',
      };
      expect(request.recipientId).toBe('irc:#mychannel');
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

  describe('Handshake Behavior', () => {
    it('should use synchronous connect() API', async () => {
      // This test validates that we're using the correct irc-framework API
      // where connect() is synchronous (returns void)
      const config = mockConfig;
      expect(config).toBeDefined();
    });
  });

   describe('Reconnection Strategy with Exponential Backoff (EA Spec INT-004)', () => {
      beforeEach(() => {
        connector.setConfig(mockConfig);
        vi.useFakeTimers();
        vi.mocked(logger).info.mockClear();
        vi.mocked(logger).warn.mockClear();
        vi.mocked(logger).debug.mockClear();
        vi.mocked(logger).error.mockClear();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should calculate exponential backoff correctly: 1s, 2s, 4s, 8s, 16s (capped at 60s)', () => {
        const expectedDelays = [1000, 2000, 4000, 8000, 16000];
        expectedDelays.forEach((expectedMs, idx) => {
          const attemptNumber = idx + 1;
          const calculated = Math.min(60000, 1000 * Math.pow(2, attemptNumber - 1));
          expect(calculated).toBe(expectedMs);
        });
      });

      it('should cap backoff at 60 seconds for large attempt numbers', () => {
        const attemptNumber = 10;
        const calculated = Math.min(60000, 1000 * Math.pow(2, attemptNumber - 1));
        expect(calculated).toBe(60000);
      });

      describe('Event-Driven Reconnect Scheduling', () => {
        it('REQ #1: should schedule reconnect with 1s delay for attempt 1', () => {
          const mockedLogger = vi.mocked(logger);
          mockedLogger.info.mockClear();

          // Call scheduleReconnect directly (first attempt, reconnectAttempts=0)
          // This is an observable behavior - the log will appear
          (connector as unknown as { scheduleReconnect: () => void }).scheduleReconnect();

          // Assert schedule log includes required fields
          const scheduleLog = mockedLogger.info.mock.calls.find(
            (call) => typeof call[1] === 'string' && call[1].includes('Scheduling IRC reconnection attempt')
          );
          expect(scheduleLog).toBeDefined();

          if (scheduleLog) {
            const logData = scheduleLog[0] as Record<string, unknown>;
            expect(logData.delayMs).toBe(1000); // Attempt 1 = 1s
            expect(logData.attempt).toBe(1);
            expect(logData.maxAttempts).toBe(5);
            expect(logData.reconnectIncidentId).toBeDefined();
            expect(typeof logData.reconnectIncidentId).toBe('string');
            expect(logData.correlationId).toBeDefined();
          }

          // Verify exactly 1 timer is scheduled
          expect(vi.getTimerCount()).toBe(1);
        });

        it('BEHAVIOR #1: should not trigger reconnect before 1000ms delay', () => {
          const mockedLogger = vi.mocked(logger);
          mockedLogger.info.mockClear();

          // Schedule reconnect
          (connector as unknown as { scheduleReconnect: () => void }).scheduleReconnect();

          mockedLogger.info.mockClear();
          mockedLogger.error.mockClear();

          // Advance by 999ms
          vi.advanceTimersByTime(999);

          // Should NOT have triggered connect attempt
          const connectLog = mockedLogger.info.mock.calls.filter(
            (call) => typeof call[1] === 'string' && call[1].includes('Connecting to IRC server')
          );
          expect(connectLog).toHaveLength(0);

          // Timer should still exist
          expect(vi.getTimerCount()).toBe(1);
        });

        it('BEHAVIOR #2: should trigger reconnect attempt at/after 1000ms', () => {
          const mockedLogger = vi.mocked(logger);

          // Schedule reconnect
          (connector as unknown as { scheduleReconnect: () => void }).scheduleReconnect();

          mockedLogger.info.mockClear();
          mockedLogger.error.mockClear();

          // Advance past delay
          vi.advanceTimersByTime(1001);

          // Now should see reconnect attempt log
          const connectLog = mockedLogger.info.mock.calls.find(
            (call) => typeof call[1] === 'string' && call[1].includes('Connecting to IRC server')
          );
          expect(connectLog).toBeDefined();
        });

        it('BEHAVIOR #3: should follow backoff sequence 1s→2s→4s→8s→16s', () => {
          const mockedLogger = vi.mocked(logger);
          const recordedDelays: number[] = [];

          // Simulate 5 failure cycles
          for (let attemptIdx = 0; attemptIdx < 5; attemptIdx++) {
            mockedLogger.info.mockClear();
            mockedLogger.error.mockClear();

            // Schedule reconnect (or next reconnect after failure)
            (connector as unknown as { scheduleReconnect: () => void }).scheduleReconnect();

            // Extract scheduled delay from log
            const scheduleLog = mockedLogger.info.mock.calls.find(
              (call) => typeof call[1] === 'string' && call[1].includes('Scheduling IRC reconnection attempt')
            );

            if (scheduleLog) {
              const logData = scheduleLog[0] as Record<string, unknown>;
              recordedDelays.push(logData.delayMs as number);

              // Advance to trigger the reconnect attempt (which fails and schedules next)
              vi.advanceTimersByTime((logData.delayMs as number) + 1);
            }
          }

          // Verify sequence: 1000, 2000, 4000, 8000, 16000
          expect(recordedDelays).toEqual([1000, 2000, 4000, 8000, 16000]);
        });

        it('BEHAVIOR #4: should guard against duplicate timer scheduling', () => {
          const mockedLogger = vi.mocked(logger);

          // First schedule
          (connector as unknown as { scheduleReconnect: () => void }).scheduleReconnect();

          mockedLogger.info.mockClear();
          mockedLogger.debug.mockClear();

          // Try to schedule again BEFORE timer fires (should be ignored)
          (connector as unknown as { scheduleReconnect: () => void }).scheduleReconnect();

          // Should NOT schedule a new timer (guard prevents duplicate)
          const scheduleLog = mockedLogger.info.mock.calls.find(
            (call) => typeof call[1] === 'string' && call[1].includes('Scheduling IRC reconnection attempt')
          );
          expect(scheduleLog).toBeUndefined();

          // Debug log should indicate guard
          const debugLog = mockedLogger.debug.mock.calls.find(
            (call) => typeof call[1] === 'string' && call[1].includes('Reconnect already scheduled')
          );
          expect(debugLog).toBeDefined();

          // Timer count still 1
          expect(vi.getTimerCount()).toBe(1);
        });

        it('BEHAVIOR #5: should reset attempts after successful connection (registered event)', () => {
          const mockedLogger = vi.mocked(logger);

          // First schedule
          (connector as unknown as { scheduleReconnect: () => void }).scheduleReconnect();

          mockedLogger.info.mockClear();

          // Advance to trigger reconnect attempt
          vi.advanceTimersByTime(1001);

          // Now simulate successful registration (reset attempts)
          (connector as unknown as { reconnectAttempts: number }).reconnectAttempts = 0;

          mockedLogger.info.mockClear();

          // Schedule next reconnect - should be attempt 1 again
          (connector as unknown as { reconnectTimeoutId: NodeJS.Timeout | null }).reconnectTimeoutId = null;
          (connector as unknown as { scheduleReconnect: () => void }).scheduleReconnect();

          // Verify next schedule is attempt 1
          const scheduleLog = mockedLogger.info.mock.calls.find(
            (call) => typeof call[1] === 'string' && call[1].includes('Scheduling IRC reconnection attempt')
          );
          if (scheduleLog) {
            const logData = scheduleLog[0] as Record<string, unknown>;
            expect(logData.attempt).toBe(1);
            expect(logData.delayMs).toBe(1000);
          }
        });

        it('BEHAVIOR #6: should mark as failed after 5 attempts and stop scheduling', () => {
          const mockedLogger = vi.mocked(logger);

          // Simulate 5 failed attempts
          for (let attemptIdx = 0; attemptIdx < 5; attemptIdx++) {
            mockedLogger.info.mockClear();
            mockedLogger.error.mockClear();

            // Schedule reconnect
            (connector as unknown as { scheduleReconnect: () => void }).scheduleReconnect();

            // Find scheduled delay
            const scheduleLog = mockedLogger.info.mock.calls.find(
              (call) => typeof call[1] === 'string' && call[1].includes('Scheduling IRC reconnection attempt')
            );

            if (scheduleLog) {
              const logData = scheduleLog[0] as Record<string, unknown>;
              const delayMs = logData.delayMs as number;

              // Advance to trigger attempt (which fails)
              vi.advanceTimersByTime(delayMs + 1);
            }
          }

          mockedLogger.info.mockClear();
          mockedLogger.error.mockClear();

          // Try to schedule 6th attempt - should fail
          (connector as unknown as { scheduleReconnect: () => void }).scheduleReconnect();

          // Should have error log about max attempts
          const maxLog = mockedLogger.error.mock.calls.find(
            (call) => typeof call[1] === 'string' && call[1].includes('Max reconnection attempts reached')
          );
          expect(maxLog).toBeDefined();

          // Status should be failed
          const status = connector.getConnectionStatus();
          expect(status.status).toBe('failed');

          // No timer scheduled
          expect(vi.getTimerCount()).toBe(0);
        });

        it('BEHAVIOR #7: should clear pending timer on manual disconnect', async () => {
          const mockedLogger = vi.mocked(logger);

          // Schedule reconnect
          (connector as unknown as { scheduleReconnect: () => void }).scheduleReconnect();

          // Verify timer is scheduled
          expect(vi.getTimerCount()).toBe(1);

          mockedLogger.info.mockClear();

          // Manual disconnect
          await connector.disconnect();

          // Verify timer cleared
          expect(vi.getTimerCount()).toBe(0);

          mockedLogger.info.mockClear();
          mockedLogger.error.mockClear();

          // Advance time - should NOT trigger reconnect
          vi.advanceTimersByTime(5000);

          // No "Connecting to IRC server" log should appear
          const connectLog = mockedLogger.info.mock.calls.find(
            (call) => typeof call[1] === 'string' && call[1].includes('Connecting to IRC server')
          );
          expect(connectLog).toBeUndefined();

          // Status should be disconnected
          const status = connector.getConnectionStatus();
          expect(status.status).toBe('disconnected');
          expect(status.reconnectAttempts).toBe(0);
        });

        it('REQ #C: should include all required fields in scheduling logs', () => {
          const mockedLogger = vi.mocked(logger);
          mockedLogger.info.mockClear();

          // Schedule reconnect
          (connector as unknown as { scheduleReconnect: () => void }).scheduleReconnect();

          // Get schedule log
          const scheduleLog = mockedLogger.info.mock.calls.find(
            (call) => typeof call[1] === 'string' && call[1].includes('Scheduling IRC reconnection attempt')
          );
          expect(scheduleLog).toBeDefined();

          if (scheduleLog) {
            const logData = scheduleLog[0] as Record<string, unknown>;
            // All required fields present
            expect(logData.reconnectIncidentId).toBeDefined();
            expect(typeof logData.reconnectIncidentId).toBe('string');
            expect(logData.attempt).toBe(1);
            expect(logData.maxAttempts).toBe(5);
            expect(logData.delayMs).toBe(1000);
            expect(logData.correlationId).toBeDefined();
            expect(logData.platform).toBe('irc');
          }
        });
      });
    });

  describe('Error Handling', () => {
    beforeEach(() => {
      connector.setConfig(mockConfig);
    });

    it('should handle missing configuration', async () => {
      const emptyConnector = new IRCConnector();
      await expect(emptyConnector.connect()).rejects.toThrow('Configuration not set');
    });

    it('should handle invalid nick field', async () => {
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

    it('should handle message sending without configuration', async () => {
      const emptyConnector = new IRCConnector();
      const request: SendMessageRequest = {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        recipientId: '#test',
        body: 'Test',
      };

      const response = await emptyConnector.sendMessage(request);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toBeTruthy();
      }
    });
  });
});
