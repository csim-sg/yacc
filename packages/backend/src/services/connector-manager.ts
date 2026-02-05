import { logger } from '../config/logging';
import type { BaseConnector } from '../connectors/base/baseConnector';

/**
 * Connector Manager
 *
 * Manages platform connector instances for the message queue processor.
 * Provides registration and retrieval of connectors for different platforms.
 *
 * Supports: Telegram, IRC, Internal
 */

class ConnectorManager {
  private connectors: Map<string, BaseConnector> = new Map();
  private isInitialized = false;

  /**
   * Register a connector for a platform
   */
  registerConnector(platform: string, connector: BaseConnector): void {
    if (this.connectors.has(platform)) {
      logger.warn({ platform }, 'Overwriting existing connector');
    }

    this.connectors.set(platform, connector);
    logger.info({ platform }, 'Connector registered');
  }

  /**
   * Get connector for platform
   */
  getConnector(platform: string): BaseConnector | undefined {
    return this.connectors.get(platform);
  }

  /**
   * Get all registered connectors
   */
  getAllConnectors(): Map<string, BaseConnector> {
    return new Map(this.connectors);
  }

  /**
   * Check if connector is registered
   */
  hasConnector(platform: string): boolean {
    return this.connectors.has(platform);
  }

  /**
   * Get list of supported platforms (currently registered)
   */
  getSupportedPlatforms(): string[] {
    return Array.from(this.connectors.keys());
  }

  /**
   * Initialize all registered connectors
   */
  async initialize(): Promise<void> {
    try {
      const connectorPromises = Array.from(this.connectors.entries()).map(
        async ([platform, connector]) => {
          try {
            logger.info({ platform }, 'Initializing connector...');
            await connector.connect();
            logger.info({ platform }, 'Connector initialized successfully');
          } catch (error) {
            logger.error(
              { platform, error },
              'Failed to initialize connector'
            );
            throw error;
          }
        }
      );

      await Promise.all(connectorPromises);

      this.isInitialized = true;
      logger.info(
        { count: this.connectors.size, platforms: this.getSupportedPlatforms() },
        'All connectors initialized'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to initialize connectors');
      throw error;
    }
  }

  /**
   * Disconnect all registered connectors
   */
  async disconnect(): Promise<void> {
    try {
      const disconnectPromises = Array.from(this.connectors.entries()).map(
        async ([platform, connector]) => {
          try {
            logger.info({ platform }, 'Disconnecting connector...');
            await connector.disconnect();
            logger.info({ platform }, 'Connector disconnected');
          } catch (error) {
            logger.error(
              { platform, error },
              'Error disconnecting connector'
            );
            // Don't throw - continue with other connectors
          }
        }
      );

      await Promise.all(disconnectPromises);

      this.isInitialized = false;
      logger.info('All connectors disconnected');
    } catch (error) {
      logger.error({ error }, 'Error during connector disconnection');
    }
  }

  /**
   * Check if manager is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.connectors.size > 0;
  }

  /**
   * Get manager status
   */
  getStatus(): {
    initialized: boolean;
    connectorCount: number;
    platforms: string[];
  } {
    return {
      initialized: this.isInitialized,
      connectorCount: this.connectors.size,
      platforms: this.getSupportedPlatforms(),
    };
  }
}

// Export singleton instance
export const connectorManager = new ConnectorManager();
