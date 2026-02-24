/**
 * Integrations Runtime Service
 *
 * Unified orchestration for platform adapters.
 * Uses new adapter infrastructure (DEV-005/DEV-006 refactoring).
 *
 * @see ADR-005 Addendum-2 - Gateway-Exchange Pattern
 */

import { appConfig } from '../config/appConfig';
import { IRCAdapter, type IRCAdapterConfig } from '../infrastructure/irc.adapter';
import { logger } from '../infrastructure/logger';
import { TelegramAdapter, type TelegramAdapterConfig } from '../infrastructure/telegram.adapter';
import type { Platform } from '../types/gateway.types';
import { gatewayExchange } from './gateway-exchange';
import { resolveIrcConfig, IrcProfileResolutionError } from './ircProfileResolution.service';

/**
 * Adapter Registry
 *
 * Manages platform adapter instances for the application.
 * Provides registration, retrieval, and health check capabilities.
 */
class AdapterRegistry {
  private adapters: Map<Platform, IRCAdapter | TelegramAdapter> = new Map();

  /**
   * Register an adapter
   */
  register(platform: Platform, adapter: IRCAdapter | TelegramAdapter): void {
    if (this.adapters.has(platform)) {
      logger.warn({ platform }, 'Overwriting existing adapter in registry');
    }
    this.adapters.set(platform, adapter);
    logger.info({ platform }, 'Adapter registered in registry');
  }

  /**
   * Get adapter by platform
   */
  getAdapter(platform: Platform): IRCAdapter | TelegramAdapter | undefined {
    return this.adapters.get(platform);
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): Array<IRCAdapter | TelegramAdapter> {
    return Array.from(this.adapters.values());
  }

  /**
   * Check if adapter is registered
   */
  hasAdapter(platform: Platform): boolean {
    return this.adapters.has(platform);
  }

  /**
   * Get list of registered platforms
   */
  getPlatforms(): Platform[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Health check all adapters
   */
  async checkHealth(): Promise<Record<Platform, { healthy: boolean; details?: string }>> {
    const results: Record<Platform, { healthy: boolean; details?: string }> = {} as Record<Platform, { healthy: boolean; details?: string }>;

    for (const [platform, adapter] of this.adapters) {
      try {
        results[platform] = await adapter.healthCheck();
      } catch (error) {
        results[platform] = {
          healthy: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return results;
  }

  /**
   * Disconnect all adapters
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.adapters.entries()).map(
      async ([platform, adapter]) => {
        try {
          await adapter.disconnect();
          logger.info({ platform }, 'Adapter disconnected');
        } catch (error) {
          logger.error(
            { platform, error: error instanceof Error ? error.message : String(error) },
            'Error disconnecting adapter'
          );
        }
      }
    );

    await Promise.all(disconnectPromises);
    logger.info('All adapters disconnected');
  }
}

/**
 * Singleton adapter registry
 */
export const adapterRegistry = new AdapterRegistry();

/**
 * Initialize integrations runtime
 *
 * Sets up platform adapters and registers them with gateway-exchange.
 * This replaces the old connector-based approach with the new adapter pattern.
 */
export async function initializeIntegrationsRuntime(): Promise<void> {
  logger.info('Initializing integrations runtime with adapter pattern');

  // Telegram Adapter
  if (appConfig.TELEGRAM_BOT_TOKEN) {
    const telegramAdapter = new TelegramAdapter();
    const telegramConfig: TelegramAdapterConfig = {
      botToken: appConfig.TELEGRAM_BOT_TOKEN,
    };

    telegramAdapter.setConfig(telegramConfig);

    // Register with adapter registry
    adapterRegistry.register('telegram', telegramAdapter);

    // Register with gateway-exchange (wires up event listeners)
    gatewayExchange.registerAdapter(telegramAdapter);

    // Connect adapter
    telegramAdapter.connect().catch((error) => {
      logger.error(
        {
          platform: 'telegram',
          error: error instanceof Error ? error.message : String(error),
        },
        'Telegram adapter failed to connect (will not block startup)'
      );
    });

    logger.info({ platform: 'telegram' }, 'Telegram adapter initialized');
  } else {
    logger.info({ platform: 'telegram' }, 'Telegram adapter skipped (missing TELEGRAM_BOT_TOKEN)');
  }

  // IRC Adapter - DB-first gating logic
  // Resolve IRC config using DB-first rules:
  // - If ANY DB profiles exist (enabled OR disabled) → use DB only
  // - If >1 profiles and none active → 409 irc_profile_not_selected (surface to operator)
  // - If 1 profile and none active → implicit selection
  // - If 0 profiles → allow env fallback
  try {
    const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';
    const resolvedConfig = await resolveIrcConfig(DEFAULT_TENANT_ID);

    const ircAdapter = new IRCAdapter();
    const ircConfig: IRCAdapterConfig = {
      server: resolvedConfig.server,
      port: resolvedConfig.port,
      nick: resolvedConfig.nick,
      password: resolvedConfig.password,
      channels: resolvedConfig.channels,
      profileId: resolvedConfig.profileId,
    };

    ircAdapter.setConfig(ircConfig);

    // Register with adapter registry
    adapterRegistry.register('irc', ircAdapter);

    // Register with gateway-exchange (wires up event listeners)
    gatewayExchange.registerAdapter(ircAdapter);

    // Connect adapter
    ircAdapter.connect().catch((error) => {
      logger.error(
        {
          platform: 'irc',
          profileId: resolvedConfig.profileId,
          error: error instanceof Error ? error.message : String(error),
        },
        'IRC adapter failed to connect (will retry with backoff)'
      );
    });

    logger.info(
      { platform: 'irc', profileId: resolvedConfig.profileId, source: resolvedConfig.source },
      'IRC adapter initialized (DB-first resolution)'
    );
  } catch (error) {
    if (error instanceof IrcProfileResolutionError) {
      if (error.statusCode === 409) {
        // 409 conflict: multiple profiles or not configured
        // Do NOT swallow; surface to operator
        logger.error(
          {
            platform: 'irc',
            code: error.code,
            message: error.message,
          },
          'IRC startup blocked by profile resolution conflict (409)'
        );
        // Return early; do not start adapter
        return;
      }
      // Other resolution errors (500)
      logger.error(
        {
          platform: 'irc',
          code: error.code,
          error: error.message,
        },
        'IRC adapter initialization failed (resolution error)'
      );
      return;
    }

    // Unexpected error
    logger.error(
      {
        platform: 'irc',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'IRC adapter initialization failed (unexpected error)'
    );
  }

  logger.info(
    { platforms: adapterRegistry.getPlatforms() },
    'Integrations runtime initialized'
  );
}

/**
 * Shutdown integrations runtime
 *
 * Gracefully disconnects all adapters.
 */
export async function shutdownIntegrationsRuntime(): Promise<void> {
  logger.info('Shutting down integrations runtime');
  await adapterRegistry.disconnectAll();
}
