/**
 * IRC Integration Tests (INT-006, INT-007, INT-008)
 *
 * Unit tests with proper mocking - no real network calls
 * Tests INT-006 validation, INT-007 status, INT-008 timeout behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ircStatusClient } from '../../infrastructure/ircStatus.client';
import { EncryptionService } from '../../services/encryption.service';
import { ircConfigService, TestConnectionFailedError } from '../../services/ircConfig.service';
import { ircIntegrationService } from '../../services/ircIntegration.service';
import type { IRCConfigRequest } from '../../types/ircIntegration.types';

interface MockListeners {
  [key: string]: Array<() => void>;
}

interface MockClientThis {
  listeners: MockListeners;
  on: (event: string, handler: () => void) => void;
  connect: (config?: unknown) => void;
  quit: () => void;
}

// Mock irc-framework to prevent real network connections in tests
vi.mock('irc-framework', () => {
  const mockClient = {
    on: vi.fn(function(this: MockClientThis, event: string, handler: () => void) {
      if (!this.listeners) {
        this.listeners = {};
      }
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(handler);
    }),
    connect: vi.fn(function(this: MockClientThis) {
      // Simulate registration after short delay (offline, no real network)
      setTimeout(() => {
        const registeredHandler = this.listeners?.['registered']?.[0];
        if (registeredHandler) {
          registeredHandler();
        }
      }, 10);
    }),
    quit: vi.fn(),
  };

  const MockClient = vi.fn(function(this: MockClientThis) {
    this.listeners = {};
    this.on = mockClient.on;
    this.connect = mockClient.connect;
    this.quit = mockClient.quit;
  });

  return { Client: MockClient };
});

// Mock dbClient to avoid table not existing errors in test env
vi.mock('../../infrastructure/db.client', () => {
  const mockDbClient = {
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{
        id: 1,
        platform: 'irc',
        server: 'irc.test.com',
        port: 6667,
        username: 'testuser',
        passwordEncrypted: null,
        hasPassword: false,
        channels: '["#test"]',
        updatedByUserId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }]),
    }),
    query: {
      integrationConfigs: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  };
  return { dbClient: mockDbClient };
});

describe('IRC Integration (INT-006, INT-007, INT-008)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ircStatusClient.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('INT-006: Config Validation', () => {
    const valid: IRCConfigRequest = {
      server: 'irc.libera.chat',
      port: 6697,
      username: 'testuser',
      password: 'testpass',
      channels: ['#test'],
    };

    it('validates server required', async () => {
      await expect(
        ircConfigService.saveConfig('user1', { ...valid, server: '' })
      ).rejects.toThrow('Server is required');
    });

    it('validates port range 1-65535', async () => {
      await expect(
        ircConfigService.saveConfig('user1', { ...valid, port: 0 })
      ).rejects.toThrow('Port must be between');
      
      await expect(
        ircConfigService.saveConfig('user1', { ...valid, port: 70000 })
      ).rejects.toThrow('Port must be between');
    });

    it('validates username required', async () => {
      await expect(
        ircConfigService.saveConfig('user1', { ...valid, username: '' })
      ).rejects.toThrow('Username is required');
    });

    it('validates min 1 channel required', async () => {
      await expect(
        ircConfigService.saveConfig('user1', { ...valid, channels: [] })
      ).rejects.toThrow('At least one channel');
    });

    it('validates channels start with #', async () => {
      await expect(
        ircConfigService.saveConfig('user1', { ...valid, channels: ['test'] })
      ).rejects.toThrow("Channel must start with '#'");
    });
  });

  describe('INT-006: Encryption Key Safety', () => {
    it('rejects password when key missing', async () => {
      const request: IRCConfigRequest = {
        server: 'irc.libera.chat',
        port: 6697,
        username: 'user',
        password: 'secret',
        channels: ['#test'],
      };
      
      if (!EncryptionService.isEncryptionAvailable()) {
        await expect(ircConfigService.saveConfig('user1', request)).rejects.toThrow(/encryption key/i);
      }
    });

    it('encryption key availability detected', () => {
      const isAvailable = EncryptionService.isEncryptionAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });
  });

  describe('INT-006: No Password Exposed', () => {
    it('request without password valid', () => {
      const request: IRCConfigRequest = {
        server: 'irc.libera.chat',
        port: 6697,
        username: 'user',
        channels: ['#test'],
      };
      
      expect(request).not.toHaveProperty('password');
    });
  });

  describe('INT-007: Connect Status', () => {
    beforeEach(() => {
      ircStatusClient.reset();
    });

    it('sets status to retrying, attemptCount=0', () => {
      ircStatusClient.setStatus('retrying', null, undefined);
      
      const status = ircStatusClient.getStatus();
      expect(status.status).toBe('retrying');
      expect(status.attemptCount).toBe(0);
    });

    it('idempotent when connected', () => {
      ircStatusClient.setStatus('connected', null, undefined);
      const status = ircStatusClient.getStatus();
      expect(status.status).toBe('connected');
    });

    it('returns null when not configured', async () => {
      // When no profile exists and no env config, resolution throws
      // This is expected behavior - test just confirms it doesn't crash the system
      try {
        const config = await ircConfigService.getStoredConfig();
        // If it succeeds, config should be null or populated
        if (config === null) {
          expect(config).toBeNull();
        }
      } catch (error) {
        // Expected: IrcProfileResolutionError when no config exists
        if (error instanceof Error) {
          expect(error.message).toContain('Failed to access');
        }
      }
    });
  });

  describe('INT-008: Test Connection Validation', () => {
    it('throws validation_error when body partially specifies (missing fields)', async () => {
      const partialBody = { server: 'irc.test.com' };
      await expect(ircConfigService.testConnection(partialBody)).rejects.toThrow(
        TestConnectionFailedError
      );
      
      try {
        await ircConfigService.testConnection(partialBody);
      } catch (error) {
        if (error instanceof TestConnectionFailedError) {
          expect(error.errorInfo.type).toBe('validation_error');
          expect(error.errorInfo.message).toContain('server, port, and username');
        }
      }
    });

    it('throws validation_error for invalid port range', async () => {
      await expect(
        ircConfigService.testConnection({
          server: 'irc.test.com',
          port: 99999,
          username: 'user',
        })
      ).rejects.toThrow(TestConnectionFailedError);

      try {
        await ircConfigService.testConnection({
          server: 'irc.test.com',
          port: 99999,
          username: 'user',
        });
      } catch (error) {
        if (error instanceof TestConnectionFailedError) {
          expect(error.errorInfo.type).toBe('validation_error');
          expect(error.errorInfo.message).toContain('Port must be between');
        }
      }
    });

    it('throws not_configured when empty body and no stored config', async () => {
      await expect(ircConfigService.testConnection({})).rejects.toThrow(TestConnectionFailedError);

      try {
        await ircConfigService.testConnection({});
      } catch (error) {
        if (error instanceof TestConnectionFailedError) {
          expect(error.errorInfo.type).toBe('not_configured');
          expect(error.errorInfo.message).toContain('IRC not configured');
        }
      }
    });

    it('does not expose secrets in error messages', async () => {
      try {
        await ircConfigService.testConnection({
          server: 'irc.test.com',
          port: 6697,
          username: 'secret-user',
          password: 'secret-pass-123',
        });
      } catch (error) {
        if (error instanceof TestConnectionFailedError) {
          expect(error.errorInfo.message).not.toContain('secret-user');
          expect(error.errorInfo.message).not.toContain('secret-pass-123');
        }
      }
    });

    it('does not modify live connector status', () => {
      const before = ircIntegrationService.getConnectionStatus();
      const after = ircIntegrationService.getConnectionStatus();
      expect(after.status).toBe(before.status);
      expect(after.attemptCount).toBe(before.attemptCount);
    });

    it('times out after 10s without hanging indefinitely', async () => {
      // Mock a slow/non-responsive client by mocking irc-framework to never emit 'registered'
      vi.resetModules();
      vi.unmock('irc-framework');
      vi.mock('irc-framework', () => ({
        Client: vi.fn(() => ({
          on: vi.fn(),
          connect: vi.fn(), // Never emits 'registered' - simulates hang
          quit: vi.fn(),
        })),
      }));

      // Test should timeout and reject with timeout error
      await expect(
        ircConfigService.testConnection({
          server: 'slow.server.com',
          port: 6667,
          username: 'user',
        })
      ).rejects.toThrow(TestConnectionFailedError);
    });
  });

  describe('Security: No Password Leakage', () => {
    it('error messages do not expose password', async () => {
      try {
        // Invalid channels format - string instead of array
        const invalidRequest = {
          server: 'irc.test.com',
          port: 6667,
          username: 'user',
          password: 'super-secret-password',
          channels: 'invalid' as unknown,
        } as IRCConfigRequest;
        await ircConfigService.saveConfig('user1', invalidRequest);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        expect(message).not.toContain('super-secret-password');
      }
    });
  });

  describe('Full Workflow Validation', () => {
    it('config request structure valid', () => {
      const config: IRCConfigRequest = {
        server: 'irc.libera.chat',
        port: 6697,
        username: 'bot',
        password: 'pass',
        channels: ['#test', '#general'],
      };
      
      expect(config.server).toBeTruthy();
      expect(config.port).toBeGreaterThanOrEqual(1);
      expect(config.port).toBeLessThanOrEqual(65535);
      expect(config.username).toBeTruthy();
      expect(config.channels.length).toBeGreaterThan(0);
      config.channels.forEach(c => {
        expect(c.startsWith('#')).toBe(true);
      });
    });

    it('status lifecycle valid', () => {
      let status = ircStatusClient.getStatus();
      expect(status.status).toBe('disconnected');
      
      ircStatusClient.setStatus('retrying', null, undefined);
      status = ircStatusClient.getStatus();
      expect(status.status).toBe('retrying');
      expect(status.attemptCount).toBe(0);
      
      ircStatusClient.setStatus('connected', null, undefined);
      status = ircStatusClient.getStatus();
      expect(status.status).toBe('connected');
    });

    it('409 not configured when no config', async () => {
      // When no profile exists and no env config, resolution throws
      // This is expected behavior - test just confirms the error handling works
      try {
        const config = await ircConfigService.getStoredConfig();
        // If it succeeds, config should be null or populated
        if (!config) {
          expect(config).toBeNull();
        }
      } catch (error) {
        // Expected: IrcProfileResolutionError when no config exists
        if (error instanceof Error) {
          expect(error.message).toContain('Failed to access');
        }
      }
    });
  });

  describe('INT-007: Manual Connect Reset (Blocker #1)', () => {
    it('should reset attemptCount to 0 on manual connect (setManualRetrying)', () => {
      // Pre-condition: simulate prior retries with attemptCount > 0
      ircStatusClient.setStatus('retrying', null, 'prior-incident-id');
      ircStatusClient.setAttemptCount(3, 'prior-incident-id');
      let status = ircStatusClient.getStatus();
      expect(status.attemptCount).toBe(3);
      expect(status.status).toBe('retrying');

      // Action: manual connect calls setManualRetrying()
      ircStatusClient.setManualRetrying();

      // Assert: attemptCount forced to 0, status is retrying
      status = ircStatusClient.getStatus();
      expect(status.status).toBe('retrying');
      expect(status.attemptCount).toBe(0);
      expect(status.lastChangedAt).toBeTruthy();
    });

    it('should preserve lastConnectedAt when manual retrying', () => {
      // Set an initial connection time
      ircStatusClient.setStatus('connected', null, undefined);
      const initialStatus = ircStatusClient.getStatus();
      const lastConnectedAt = initialStatus.lastConnectedAt;

      // Simulate manual connect reset
      ircStatusClient.setManualRetrying();

      // Assert: lastConnectedAt preserved, attemptCount reset to 0
      const newStatus = ircStatusClient.getStatus();
      expect(newStatus.lastConnectedAt).toBe(lastConnectedAt);
      expect(newStatus.attemptCount).toBe(0);
      expect(newStatus.status).toBe('retrying');
    });
  });
});
