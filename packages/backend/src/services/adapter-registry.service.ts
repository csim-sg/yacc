/**
 * Adapter Registry Service
 *
 * Service for managing platform adapter registration and lifecycle.
 * Provides a central registry for all adapters with connection management.
 *
 * Features:
 * - Register adapters by platform type
 * - Connect/disconnect adapters with configuration
 * - Get adapters by type or key
 * - Graceful shutdown for all adapters
 *
 * @see GPA-004 - AdapterRegistry Service
 */

import { logger } from '../infrastructure/logger';
import type {
  BaseAdapterConfig,
  PlatformAdapter,
  PlatformType,
} from '../infrastructure/types/adapter.interface';
import type { Platform } from '../types/gateway.types';

/**
 * Adapter Registry
 *
 * Central registry for managing platform adapters.
 */
export class AdapterRegistry {
  private adapters = new Map<PlatformType, PlatformAdapter>();
  private adaptersByKey = new Map<string, PlatformAdapter>();
  private connectedConfigs = new Map<PlatformType, BaseAdapterConfig>();

  /**
   * Register an adapter instance
   *
   * @param adapter - Platform adapter to register
   *
   * @example
   * registry.register(new TelegramAdapter());
   * registry.register(new IRCAdapter());
   */
  register(adapter: PlatformAdapter): void {
    const platform = adapter.metadata.platform;

    if (this.adapters.has(platform)) {
      logger.warn({ platform }, 'Overwriting existing adapter registration');
    }

    this.adapters.set(platform, adapter);
    logger.info({ platform }, `Registered adapter: ${platform}`);
  }

  /**
   * Connect an adapter with configuration
   *
   * Configures the adapter and establishes connection to the platform.
   *
   * @param config - Adapter configuration
   * @returns true if connected successfully, false otherwise
   *
   * @example
   * const connected = await registry.connect({
   *   id: 'uuid-123',
   *   name: 'Main Telegram',
   *   key: 'telegram-main',
   *   type: 'telegram',
   *   enabled: true,
   *   credentials: { botToken: 'secret' },
   * });
   */
  async connect(config: BaseAdapterConfig): Promise<boolean> {
    const adapter = this.adapters.get(config.type);

    if (!adapter) {
      logger.warn({ platform: config.type }, `No adapter registered for platform: ${config.type}`);
      return false;
    }

    if (!adapter.configure(config)) {
      logger.warn({ platform: config.type }, `Failed to configure adapter: ${config.type}`);
      return false;
    }

    try {
      await adapter.connect();
      this.connectedConfigs.set(config.type, config);

      // Store by key for multi-profile support
      if (config.key) {
        this.adaptersByKey.set(config.key, adapter);
      }

      logger.info({ platform: config.type, key: config.key }, `Connected adapter: ${config.type}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { platform: config.type, error: errorMessage },
        `Failed to connect adapter ${config.type}: ${errorMessage}`
      );
      return false;
    }
  }

  /**
   * Disconnect an adapter by type
   *
   * @param type - Platform type to disconnect
   * @returns true if disconnected successfully, false otherwise
   */
  async disconnect(type: PlatformType): Promise<boolean> {
    const adapter = this.adapters.get(type);

    if (!adapter) {
      logger.warn({ platform: type }, `No adapter registered for platform: ${type}`);
      return false;
    }

    try {
      await adapter.disconnect();
      this.connectedConfigs.delete(type);
      logger.info({ platform: type }, `Disconnected adapter: ${type}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { platform: type, error: errorMessage },
        `Failed to disconnect adapter ${type}: ${errorMessage}`
      );
      return false;
    }
  }

  /**
   * Get an adapter by platform type
   *
   * @param type - Platform type
   * @returns Adapter or undefined if not registered
   */
  get(type: PlatformType): PlatformAdapter | undefined {
    return this.adapters.get(type);
  }

  /**
   * Get an adapter by legacy Platform type (for backward compatibility)
   *
   * @param platform - Platform name (telegram | irc)
   * @returns Adapter or undefined if not registered
   */
  getByPlatform(platform: Platform): PlatformAdapter | undefined {
    return this.adapters.get(platform);
  }

  /**
   * Get an adapter by unique key
   *
   * @param key - Unique adapter key (e.g., "telegram-main")
   * @returns Adapter or undefined if not found
   */
  getByKey(key: string): PlatformAdapter | undefined {
    return this.adaptersByKey.get(key);
  }

  /**
   * Get all registered adapters
   *
   * @returns Array of all registered adapters
   */
  getAll(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get connected adapters only
   *
   * @returns Array of adapters with status 'connected'
   */
  getConnected(): PlatformAdapter[] {
    return this.getAll().filter((adapter) => adapter.status === 'connected');
  }

  /**
   * Get count of registered adapters
   *
   * @returns Number of registered adapters
   */
  getAdapterCount(): number {
    return this.adapters.size;
  }

  /**
   * Check if an adapter is registered
   *
   * @param type - Platform type to check
   * @returns true if registered, false otherwise
   */
  has(type: PlatformType): boolean {
    return this.adapters.has(type);
  }

  /**
   * Get configuration for a connected adapter
   *
   * @param type - Platform type
   * @returns Configuration or undefined if not connected
   */
  getConfig(type: PlatformType): BaseAdapterConfig | undefined {
    return this.connectedConfigs.get(type);
  }

  /**
   * Graceful shutdown of all adapters
   *
   * Disconnects all registered adapters in parallel.
   * Errors are logged but do not prevent other adapters from disconnecting.
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down all adapters...');

    const disconnectPromises = this.getAll().map((adapter) =>
      adapter.disconnect().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
          { platform: adapter.metadata.platform, error: errorMessage },
          `Error disconnecting adapter ${adapter.metadata.platform}: ${errorMessage}`
        );
      })
    );

    await Promise.all(disconnectPromises);

    this.connectedConfigs.clear();
    this.adaptersByKey.clear();

    logger.info('All adapters shut down');
  }

  /**
   * Unregister an adapter by type
   *
   * Removes the adapter from the registry without disconnecting.
   *
   * @param type - Platform type to unregister
   * @returns true if unregistered, false if not found
   */
  unregister(type: PlatformType): boolean {
    const adapter = this.adapters.get(type);

    if (!adapter) {
      return false;
    }

    this.adapters.delete(type);
    this.connectedConfigs.delete(type);

    // Remove from key map
    for (const [key, value] of this.adaptersByKey.entries()) {
      if (value === adapter) {
        this.adaptersByKey.delete(key);
        break;
      }
    }

    logger.info({ platform: type }, `Unregistered adapter: ${type}`);
    return true;
  }

  /**
   * Clear all adapters from the registry
   *
   * Warning: Does not disconnect adapters. Use shutdown() first.
   */
  clear(): void {
    this.adapters.clear();
    this.adaptersByKey.clear();
    this.connectedConfigs.clear();
    logger.info('Cleared all adapters from registry');
  }
}

/**
 * Singleton instance for use across the application
 */
export const adapterRegistry = new AdapterRegistry();
