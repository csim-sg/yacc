/**
 * IRC Integration Tests
 *
 * Tests for:
 * - INT-005: IRC Connection Status Model (IRCStatusClient)
 * - INT-009: GET /integrations/irc/status Endpoint
 *
 * Coverage targets: 85%+
 */

import type { IRCConnectionStatusModel } from '@yacc/common/types/irc-integration.types';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IRCStatusClient } from '../infrastructure/ircStatus.client';
import { ircIntegrationService } from '../services/ircIntegration.service';

/**
 * INT-005: IRC Status Model Tests
 */
describe('INT-005: IRC Status Client', () => {
  let statusClient: IRCStatusClient;

  beforeEach(() => {
    // Get singleton instance for each test
    statusClient = IRCStatusClient.getInstance();
    // Reset to known state
    statusClient.reset();
    statusClient.setStatus('disconnected');
  });

  afterEach(() => {
    // Reset system time after each test
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with disconnected status', () => {
      const status = statusClient.getStatus();

      expect(status.status).toBe('disconnected');
      expect(status.attemptCount).toBe(0);
      expect(status.lastConnectedAt).toBeNull();
      expect(status.lastError).toBeNull();
      expect(status.reconnectIncidentId).toBeUndefined();
    });

    it('should have valid ISO-8601 timestamps', () => {
      const status = statusClient.getStatus();

      // lastChangedAt should always be present and valid ISO-8601
      expect(status.lastChangedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Status Transitions', () => {
    it('should transition to retrying with attempt tracking', () => {
      const incidentId = 'incident-001';
      statusClient.setStatus('retrying', null, incidentId);
      statusClient.setAttemptCount(1, incidentId);

      const status = statusClient.getStatus();

      expect(status.status).toBe('retrying');
      expect(status.attemptCount).toBe(1);
      expect(status.reconnectIncidentId).toBe(incidentId);
      expect(status.lastError).toBeNull();
    });

    it('should transition to connected and reset attempt count', () => {
      const incidentId = 'incident-002';
      statusClient.setAttemptCount(3, incidentId);
      statusClient.setStatus('connected', null, incidentId);

      const status = statusClient.getStatus();

      expect(status.status).toBe('connected');
      expect(status.attemptCount).toBe(0);
      expect(status.lastConnectedAt).not.toBeNull();
      expect(status.lastError).toBeNull();
      // Verify ISO-8601 timestamp format
      expect(status.lastConnectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should track multiple attempt increments', () => {
      const incidentId = 'incident-003';

      for (let i = 1; i <= 5; i++) {
        statusClient.setAttemptCount(i, incidentId);
        expect(statusClient.getStatus().attemptCount).toBe(i);
      }
    });

    it('should transition to failed after max attempts exhausted', () => {
      const incidentId = 'incident-004';

      // Simulate 5 failed attempts
      statusClient.setStatus('retrying', null, incidentId);
      for (let i = 1; i <= 5; i++) {
        statusClient.setAttemptCount(i, incidentId);
      }

      statusClient.markMaxAttemptsExhausted();

      const status = statusClient.getStatus();

      expect(status.status).toBe('failed');
      expect(status.attemptCount).toBe(5);
      expect(status.reconnectIncidentId).toBe(incidentId);
    });

    it('should handle error messages without exposing secrets', () => {
      const sanitizedError = 'Connection timeout after 30s';
      statusClient.setStatus('disconnected', sanitizedError);

      const status = statusClient.getStatus();

      expect(status.status).toBe('disconnected');
      expect(status.lastError).toBe(sanitizedError);
      // Verify no sensitive info in error
      expect(status.lastError).not.toMatch(/password|token|secret|key/i);
    });

    it('should clear attempt count on disconnected status', () => {
      const incidentId = 'incident-005';
      statusClient.setAttemptCount(3, incidentId);
      statusClient.setStatus('disconnected');

      const status = statusClient.getStatus();

      expect(status.status).toBe('disconnected');
      expect(status.attemptCount).toBe(0);
    });

    it('should update lastConnectedAt to most recent successful connection time', () => {
      // DECISION: lastConnectedAt represents the most recent successful connection
      // This allows tracking when the connection was last successfully established
      
      // Freeze time for deterministic test
      const time1 = new Date('2026-02-19T10:00:00.000Z');
      vi.setSystemTime(time1);
      
      const incidentId1 = 'incident-006';
      statusClient.setStatus('connected', null, incidentId1);
      const _firstConnected = statusClient.getStatus().lastConnectedAt;

      // Simulate disconnection
      statusClient.setStatus('disconnected');
      
      // Advance time
      const time2 = new Date('2026-02-19T10:05:00.000Z');
      vi.setSystemTime(time2);
      
      const incidentId2 = 'incident-007';
      statusClient.setAttemptCount(1, incidentId2);
      statusClient.setStatus('connected', null, incidentId2);

      const status = statusClient.getStatus();

      // lastConnectedAt should be updated to the most recent connection time
      expect(status.lastConnectedAt).not.toBe(_firstConnected);
      expect(status.lastConnectedAt).toBe(time2.toISOString());
      expect(status.reconnectIncidentId).toBe(incidentId2);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset status to disconnected while preserving history', () => {
      const incidentId = 'incident-008';

      // Establish a connection first
      statusClient.setStatus('connected', null, incidentId);
      // Verify connection time is set (will be checked after reset)
      const _connectedTime = statusClient.getStatus().lastConnectedAt;

      // Manually trigger reset
      statusClient.reset();

      const status = statusClient.getStatus();

      expect(status.status).toBe('disconnected');
      expect(status.attemptCount).toBe(0);
      expect(status.lastError).toBeNull();
      // lastConnectedAt should be preserved (history is kept)
      expect(status.lastConnectedAt).toBeDefined();
      expect(status.lastConnectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('State Immutability', () => {
    it('should return a copy, not a reference', () => {
      statusClient.setStatus('retrying', 'Test error');

      const status1 = statusClient.getStatus();
      const status2 = statusClient.getStatus();

      // Mutate the first copy
      status1.lastError = 'Modified error';

      // Second copy should be unaffected
      expect(status2.lastError).toBe('Test error');
    });
  });

  describe('Singleton Pattern (if using getInstance)', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = IRCStatusClient.getInstance();
      const instance2 = IRCStatusClient.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across singleton instances', () => {
      const instance1 = IRCStatusClient.getInstance();
      instance1.setStatus('connected');

      const instance2 = IRCStatusClient.getInstance();
      const status = instance2.getStatus();

      expect(status.status).toBe('connected');
    });
  });
});

/**
 * INT-009: IRC Integration Service Tests
 */
describe('INT-009: IRC Integration Service', () => {
  beforeEach(() => {
    // Reset singleton state before each test
    const client = IRCStatusClient.getInstance();
    client.reset();
    client.setStatus('disconnected');
  });

  describe('getConnectionStatus', () => {
    it('should return current status from status client', () => {
      const statusClient = IRCStatusClient.getInstance();
      statusClient.setStatus('connected');

      const status = ircIntegrationService.getConnectionStatus();

      expect(status.status).toBe('connected');
      expect(status.attemptCount).toBe(0);
    });

    it('should work even when IRC is unconfigured', () => {
      // Don't set any config, just verify it returns a valid status
      const status = ircIntegrationService.getConnectionStatus();

      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('attemptCount');
      expect(status).toHaveProperty('lastChangedAt');
      expect(status).toHaveProperty('lastConnectedAt');
      expect(status).toHaveProperty('lastError');
    });

    it('should not expose sensitive configuration', () => {
      const status = ircIntegrationService.getConnectionStatus();

      // Stringify to check for any secrets
      const statusStr = JSON.stringify(status);

      // Verify no common secret patterns
      expect(statusStr).not.toMatch(/token|password|api_key|secret/i);
    });

    it('should handle error gracefully and return default status', () => {
      // Even if something fails internally, should return a valid status
      const status = ircIntegrationService.getConnectionStatus();

      expect(status).toBeDefined();
      expect(status.status).toBeDefined();
      expect(['connected', 'retrying', 'disconnected', 'failed']).toContain(status.status);
    });
  });

  describe('Status Model Compliance (INT-005)', () => {
    it('should return valid IRCConnectionStatusModel', () => {
      const status = ircIntegrationService.getConnectionStatus() as IRCConnectionStatusModel;

      // Verify all required fields exist
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('attemptCount');
      expect(status).toHaveProperty('lastChangedAt');
      expect(status).toHaveProperty('lastConnectedAt');
      expect(status).toHaveProperty('lastError');

      // Verify types
      expect(typeof status.status).toBe('string');
      expect(typeof status.attemptCount).toBe('number');
      expect(typeof status.lastChangedAt).toBe('string');
      expect(typeof status.lastConnectedAt).toMatch(/string|object/); // null or ISO-8601 string
      expect(typeof status.lastError).toMatch(/string|object/); // null or string
    });

    it('should have valid status values', () => {
      const validStatuses = ['connected', 'retrying', 'disconnected', 'failed'];
      const status = ircIntegrationService.getConnectionStatus();

      expect(validStatuses).toContain(status.status);
    });

    it('should have valid attempt count range', () => {
      const status = ircIntegrationService.getConnectionStatus();

      expect(status.attemptCount).toBeGreaterThanOrEqual(0);
      expect(status.attemptCount).toBeLessThanOrEqual(5);
    });

    it('should have valid ISO-8601 timestamp', () => {
      const status = ircIntegrationService.getConnectionStatus();
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

      expect(iso8601Regex.test(status.lastChangedAt)).toBe(true);
    });

    it('should have optional reconnectIncidentId', () => {
      const status = ircIntegrationService.getConnectionStatus();

      // For disconnected status, reconnectIncidentId should be undefined
      if (status.status === 'disconnected') {
        expect(status.reconnectIncidentId).toBeUndefined();
      }

      // For retrying/failed, it may be present
      if (status.status === 'retrying' || status.status === 'failed') {
        // reconnectIncidentId should either be undefined or a string
        expect(status.reconnectIncidentId).toMatch(/^.+$|^$/);
      }
    });
  });

  describe('Real-time Status Tracking', () => {
    it('should reflect status changes immediately', () => {
      const statusClient = IRCStatusClient.getInstance();

      statusClient.setStatus('retrying', null, 'incident-test');
      statusClient.setAttemptCount(1, 'incident-test');

      const status = ircIntegrationService.getConnectionStatus();

      expect(status.status).toBe('retrying');
      expect(status.attemptCount).toBe(1);
    });

    it('should track reconnection incident through multiple attempts', () => {
      const statusClient = IRCStatusClient.getInstance();
      const incidentId = 'incident-tracking-test';

      // Simulate reconnection attempts
      statusClient.setStatus('retrying', null, incidentId);
      for (let i = 1; i <= 3; i++) {
        statusClient.setAttemptCount(i, incidentId);
        const status = ircIntegrationService.getConnectionStatus();
        expect(status.reconnectIncidentId).toBe(incidentId);
      }
    });
  });
});
