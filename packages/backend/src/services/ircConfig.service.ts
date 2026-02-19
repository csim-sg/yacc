/**
 * IRC Configuration Service
 *
 * Handles:
 * - INT-006: Save/upsert IRC configuration (encrypted password)
 * - INT-007: Initiate manual connection using stored/env config
 * - INT-008: Test connection without side effects
 *
 * Architecture:
 * - DB-encrypted-at-rest (primary source of truth)
 * - Env fallback (backward compatibility, read-only)
 * - Never returns/logs plaintext passwords
 */

import { eq } from 'drizzle-orm';
import { appConfig } from '../config/appConfig';
import { dbClient } from '../infrastructure/db.client';
import { ircStatusClient } from '../infrastructure/ircStatus.client';
import { logger } from '../infrastructure/logger';
import { integrationConfigs } from '../schemas/integrationConfig.schema';
import type { IRCConfigRequest, IRCConfigResponseData } from '../types/ircIntegration.types';
import { EncryptionService } from './encryption.service';
import { connectorManager } from './connector-manager';
import { IRCConnector } from '../connectors/irc.connector';
import { connectorStatusWiring } from './connector-status-wiring.service';
import {
  resolveIrcConfig,
  IrcProfileResolutionError,
} from './ircProfileResolution.service';

/**
 * Typed errors for INT-008 validation and connection issues
 */
type TestConnectionError = 
  | { type: 'validation_error'; message: string }
  | { type: 'not_configured'; message: string }
  | { type: 'timeout'; message: string }
  | { type: 'internal_error'; message: string };

class TestConnectionFailedError extends Error {
  constructor(public errorInfo: TestConnectionError) {
    super(errorInfo.message);
    this.name = 'TestConnectionFailedError';
  }
}

class EncryptionKeyMissingError extends Error {
  public readonly code = 'encryption_key_missing';

  constructor(message: string) {
    super(message);
    this.name = 'EncryptionKeyMissingError';
  }
}

export class IRCConfigService {
  /**
   * Save IRC configuration to database (upsert)
   * Encrypts password at rest
   *
   * @param userId - User ID who is saving the config (for audit trail)
   * @param request - Config request (server, port, username, password?, channels[])
   * @returns Saved configuration (without password)
   */
  async saveConfig(
    userId: string,
    request: IRCConfigRequest
  ): Promise<IRCConfigResponseData> {
    logger.info(
      { userId, platform: 'irc', method: 'saveConfig' },
      'IRC configuration save initiated'
    );

    // Validate input
    this.validateConfigRequest(request);

    // Encrypt password if provided
    let passwordEncrypted: string | null = null;
    let hasPassword = false;
    let passwordUpdatedAt: Date | null = null;

    if (request.password && request.password.trim().length > 0) {
      // Check if encryption key is available
      if (!EncryptionService.isEncryptionAvailable()) {
        logger.error(
          { userId, platform: 'irc', method: 'saveConfig' },
          'Cannot save password: encryption key missing'
        );
        throw new EncryptionKeyMissingError(
          'Encryption key missing; cannot save password. Set INTEGRATION_CREDENTIALS_ENCRYPTION_KEY environment variable.'
        );
      }

      passwordEncrypted = EncryptionService.encrypt(request.password);
      if (!passwordEncrypted) {
        logger.error(
          { userId, platform: 'irc', method: 'saveConfig' },
          'Password encryption returned null'
        );
        throw new Error('Failed to encrypt password');
      }

      hasPassword = true;
      passwordUpdatedAt = new Date();

      logger.debug(
        { userId, platform: 'irc', method: 'saveConfig', encrypted: true },
        'Password encrypted for storage'
      );
    }

    // Normalize and deduplicate channels
    const channelsList = this.normalizeChannels(request.channels);
    const channelsJson = JSON.stringify(channelsList);

    try {
      // Upsert: use onConflictDoUpdate for atomic operation (ACID compliant)
      const result = await dbClient
        .insert(integrationConfigs)
        .values({
          platform: 'irc',
          server: request.server,
          port: request.port,
          username: request.username,
          passwordEncrypted,
          hasPassword,
          passwordUpdatedAt,
          channels: channelsJson,
          updatedByUserId: userId,
        })
        .onConflictDoUpdate({
          target: integrationConfigs.platform,
          set: {
            server: request.server,
            port: request.port,
            username: request.username,
            passwordEncrypted,
            hasPassword,
            passwordUpdatedAt,
            channels: channelsJson,
            updatedByUserId: userId,
            updatedAt: new Date(),
          },
        })
        .returning();

      logger.info(
        { userId, platform: 'irc', method: 'saveConfig', server: request.server, port: request.port, channelCount: channelsList.length },
        'IRC configuration saved successfully'
      );

      return {
        server: result[0].server,
        port: result[0].port,
        username: result[0].username,
        channels: channelsList,
        hasPassword: result[0].hasPassword,
        updatedAt: result[0].updatedAt.toISOString(),
      };
    } catch (error) {
      logger.error(
        {
          userId,
          platform: 'irc',
          method: 'saveConfig',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to save IRC configuration'
      );
      throw error;
    }
  }

  /**
   * Get stored IRC configuration (DB or env fallback)
   * Uses INT-010 DB-first resolution logic
   * Returns null if neither DB nor env config exists, or throws on resolution conflict
   *
   * @returns Config object with decrypted password, or null if not configured
   */
  async getStoredConfig(): Promise<{
    server: string;
    port: number;
    username: string;
    password?: string;
    channels: string[];
    source: 'db' | 'env';
  } | null> {
    const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';

    try {
      // Use INT-010 resolution logic (DB-first)
      const resolved = await resolveIrcConfig(DEFAULT_TENANT_ID);

      return {
        server: resolved.server,
        port: resolved.port,
        username: resolved.nick,
        password: resolved.password,
        channels: resolved.channels,
        source: resolved.source,
      };
    } catch (error) {
      // If profile resolution error (409), re-throw as-is (will be handled by caller)
      if (error instanceof IrcProfileResolutionError) {
        if (error.statusCode === 409) {
          // Not configured yet, return null (allows fallback)
          logger.debug(
            { method: 'getStoredConfig', code: error.code },
            'IRC not yet configured'
          );
          return null;
        }
        throw error;
      }

      logger.error(
        {
          platform: 'irc',
          method: 'getStoredConfig',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to retrieve IRC configuration'
      );
      throw error;
    }
  }

  /**
   * Check and prepare IRC connection
   * Sets status to 'retrying' with attemptCount=0 for manual initiation
   * Always resets status and initiates connection (manual connect semantics)
   *
   * @returns Config object if available, null otherwise
   */
  async checkAndPrepareConnect(): Promise<{
    server: string;
    port: number;
    username: string;
    password?: string;
    channels: string[];
    source: 'db' | 'env';
  } | null> {
    try {
      const config = await this.getStoredConfig();

      if (!config) {
        logger.warn(
          { platform: 'irc', method: 'checkAndPrepareConnect' },
          'Cannot connect: no IRC configuration found'
        );
        return null;
      }

      logger.info(
        { platform: 'irc', method: 'checkAndPrepareConnect', source: config.source },
        'IRC connection preparation initiated'
      );

      // Manual connect: ALWAYS set status to 'retrying' with attemptCount=0
      // This applies even if already connected/retrying (enforces manual semantics)
      ircStatusClient.setManualRetrying();

      logger.debug(
        { platform: 'irc', method: 'checkAndPrepareConnect' },
        'Status set to retrying with attemptCount=0 (manual connect)'
      );

      // Initiate actual connection via connectorManager
      await this.initiateConnectorConnection(config);

      logger.info(
        { platform: 'irc', method: 'checkAndPrepareConnect' },
        'IRC connection initiated'
      );

      return config;
    } catch (error) {
      logger.error(
        {
          platform: 'irc',
          method: 'checkAndPrepareConnect',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to prepare IRC connection'
      );
      throw error;
    }
  }

  /**
   * Initiate actual IRC connector connection via connectorManager
   * Creates/registers IRC connector if needed, applies config, and calls connect()
   * Handles config changes with controlled reconnect
   * Ensures status wiring is active (idempotent, safe to call multiple times)
   */
  private async initiateConnectorConnection(config: {
    server: string;
    port: number;
    username: string;
    password?: string;
    channels: string[];
    source: 'db' | 'env';
  }): Promise<void> {
    try {
      let ircConnector = connectorManager.getConnector('irc') as IRCConnector | undefined;

      // Create and register connector if not exists
      if (!ircConnector) {
        logger.info(
          { platform: 'irc', method: 'initiateConnectorConnection' },
          'Creating and registering IRC connector'
        );
        ircConnector = new IRCConnector();
        connectorManager.registerConnector('irc', ircConnector);
      }

      // Wire status events so connector updates ircStatusClient
      // Idempotent: safe to call even if already wired (startup path or INT-007 path)
      connectorStatusWiring.wire();

      // Configure connector with stored config
      ircConnector.setConfig({
        platform: 'irc',
        server: config.server,
        port: config.port,
        nick: config.username,
        password: config.password,
        channels: config.channels,
      });

      // Initiate connection (non-blocking; connector handles reconnect logic)
      ircConnector.connect().catch((error) => {
        logger.error(
          {
            platform: 'irc',
            method: 'initiateConnectorConnection',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'IRC connector connection failed (will retry with backoff)'
        );
      });

      logger.debug(
        { platform: 'irc', method: 'initiateConnectorConnection' },
        'IRC connector connection initiated (non-blocking)'
      );
    } catch (error) {
      logger.error(
        {
          platform: 'irc',
          method: 'initiateConnectorConnection',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to initiate connector connection'
      );
      throw error;
    }
  }

  /**
   * Test IRC connection without modifying live connector state
   * Uses body-first validation, then stored config fallback
   * Timeout: hard 10 seconds
   *
   * Throws TestConnectionFailedError with typed errorInfo for HTTP error mapping
   * On success, returns { success: true, message: string, source }
   *
   * @param testRequest - Optional test request (body-first)
   * @returns { success: true, message: string, source } on success
   * @throws TestConnectionFailedError for validation, not_configured, timeout, or internal errors
   */
  async testConnection(
    testRequest?: { server?: string; port?: number; username?: string; password?: string }
  ): Promise<{ success: boolean; message: string; source: 'body' | 'db' | 'env' }> {
    let source: 'body' | 'db' | 'env' = 'db';
    
    try {
      let config:
        | { server: string; port: number; username: string; password?: string; source: 'body' | 'db' | 'env' }
        | null = null;

      // Body-first test (strict validation)
      if (testRequest && (testRequest.server || testRequest.port || testRequest.username)) {
        // Partial body provided: validate all required fields
        if (!testRequest.server || !testRequest.port || !testRequest.username) {
          throw new TestConnectionFailedError({
            type: 'validation_error',
            message: 'Body test mode: server, port, and username are all required',
          });
        }

        // Validate port range
        if (testRequest.port < 1 || testRequest.port > 65535) {
          throw new TestConnectionFailedError({
            type: 'validation_error',
            message: 'Port must be between 1 and 65535',
          });
        }

        config = {
          server: testRequest.server,
          port: testRequest.port,
          username: testRequest.username,
          password: testRequest.password,
          source: 'body',
        };
        source = 'body';

        logger.debug(
          { platform: 'irc', method: 'testConnection', source: 'body' },
          'Testing with body-provided config'
        );
      } else {
        // Empty body: use stored config (DB or env)
        const storedConfig = await this.getStoredConfig();
        if (!storedConfig) {
          throw new TestConnectionFailedError({
            type: 'not_configured',
            message: 'IRC not configured. Provide server, port, and username in request body or save config first.',
          });
        }

        config = {
          server: storedConfig.server,
          port: storedConfig.port,
          username: storedConfig.username,
          password: storedConfig.password,
          source: storedConfig.source,
        };
        source = storedConfig.source as 'db' | 'env';

        logger.debug(
          { platform: 'irc', method: 'testConnection', source },
          'Testing with stored config'
        );
      }

      logger.info(
        { platform: 'irc', method: 'testConnection', server: config.server, port: config.port, source },
        'IRC connection test initiated'
      );

      // Test connection with hard 10s timeout
      const result = await this.createAndTestTemporaryClient(config);
      return {
        ...result,
        source,
      };
    } catch (error) {
      // Re-throw typed TestConnectionFailedError as-is
      if (error instanceof TestConnectionFailedError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Categorize error type
      let errorType: TestConnectionError['type'] = 'internal_error';
      if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
        errorType = 'timeout';
      }

      logger.error(
        {
          platform: 'irc',
          method: 'testConnection',
          error: errorMessage,
          errorType,
        },
        'IRC connection test failed'
      );

      throw new TestConnectionFailedError({
        type: errorType,
        message: errorMessage.includes('timed out')
          ? 'Connection test timed out (10s limit exceeded)'
          : 'Connection test failed',
      });
    }
  }

  /**
   * Create temporary IRC client and test connection with hard 10s timeout
   * Uses irc-framework (same library as live connector)
   * Does not modify live connector state
   *
   * @returns Promise resolving to { success: boolean, message: string }
   */
  private async createAndTestTemporaryClient(config: {
    server: string;
    port: number;
    username: string;
    password?: string;
  }): Promise<{ success: boolean; message: string }> {
    // Import at method level to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Client: IRCClient } = require('irc-framework');

    // Create timeout promise (10 seconds)
    const timeoutPromise = new Promise<{ success: boolean; message: string }>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Connection test timed out (10s limit)'));
      }, 10000);
    });

    // Create connection test promise
    const connectionPromise = new Promise<{ success: boolean; message: string }>((resolve, reject) => {
      try {
        const testClient = new IRCClient();

        let registered = false;
        let testCompleted = false;

        const cleanup = () => {
          try {
            testClient.quit('Test complete');
          } catch (err) {
            logger.debug({ error: err }, 'Error during test client cleanup');
          }
        };

        const finalize = (result: { success: boolean; message: string }) => {
          if (!testCompleted) {
            testCompleted = true;
            cleanup();
            resolve(result);
          }
        };

        // Register event handler BEFORE connecting
        testClient.on('registered', () => {
          registered = true;
          finalize({
            success: true,
            message: `Successfully connected to ${config.server}:${config.port}`,
          });
        });

        testClient.on('error', (error: { message: string }) => {
          if (!testCompleted) {
            testCompleted = true;
            cleanup();
            reject(
              new Error(
                `IRC connection error: ${(error.message || '').substring(0, 100)}`
              )
            );
          }
        });

        testClient.on('close', () => {
          if (!registered && !testCompleted) {
            testCompleted = true;
            reject(new Error('IRC connection closed without registration'));
          }
        });

        // Connect with proper settings for test
        testClient.connect({
          host: config.server,
          port: config.port,
          nick: config.username,
          password: config.password,
          gecos: 'IRC Test Client',
          tls: config.port === 6697 || config.port === 994,
        });

        // Fallback timeout to ensure hard 10s limit
        setTimeout(() => {
          if (!testCompleted) {
            testCompleted = true;
            cleanup();
            reject(new Error('Connection test timed out (10s hard limit exceeded)'));
          }
        }, 10000);
      } catch (error) {
        reject(
          new Error(
            `Failed to create IRC test client: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    });

    // Race between connection test and timeout
    return Promise.race([connectionPromise, timeoutPromise]);
  }

  /**
   * Validate IRC config request
   * @throws Error with validation details
   */
  private validateConfigRequest(request: IRCConfigRequest): void {
    if (!request.server || request.server.trim().length === 0) {
      throw new Error('Server is required');
    }

    if (request.port < 1 || request.port > 65535) {
      throw new Error('Port must be between 1 and 65535');
    }

    if (!request.username || request.username.trim().length === 0) {
      throw new Error('Username is required');
    }

    if (!Array.isArray(request.channels) || request.channels.length === 0) {
      throw new Error('At least one channel is required');
    }

    for (const channel of request.channels) {
      if (!channel.startsWith('#')) {
        throw new Error(`Channel must start with '#': ${channel}`);
      }
    }
  }

  /**
   * Normalize and deduplicate channels
   * - Trim whitespace
   * - Lowercase channel names (IRC convention)
   * - Remove duplicates
   */
  private normalizeChannels(channels: string[]): string[] {
    const normalized = channels
      .map((c) => c.trim().toLowerCase())
      .filter((c) => c.startsWith('#') && c.length > 1);

    // Remove duplicates
    return [...new Set(normalized)];
  }
}

export const ircConfigService = new IRCConfigService();
export { TestConnectionFailedError };
export type { TestConnectionError };
