/**
 * Connector Factory
 *
 * Factory pattern for creating platform connector instances.
 */

import type { Platform } from '@yacc/common/types/Platform.type';
import type { ConnectorConfig } from '@yacc/common/types/ConnectorConfig.type';
import type { IConnector } from '@yacc/common/types/IConnector.interface';
import type { ValidationError } from '@yacc/common/types/ValidationError.interface';
import { ConnectionError } from '@yacc/common/types/ConnectionError.class';

// ============================================
// Placeholder imports (will be replaced when connectors are implemented)
// ============================================

let TelegramConnectorClass: any;
let IRCConnectorClass: any;

// ============================================
// Connector Factory
// ============================================

/**
 * Factory class for creating connector instances
 */
export class ConnectorFactory {
  /**
   * Create a connector instance for the specified platform
   *
   * @param platform - The platform type ('telegram' | 'irc')
   * @param config - Configuration for the connector
   * @returns Connector instance
   * @throws ConnectionError if platform is not supported
   */
  static createConnector<T extends Platform = Platform>(
    platform: Platform,
    config: ConnectorConfig<T>
  ): IConnector<T> {
    switch (platform) {
      case 'telegram':
        return ConnectorFactory.createTelegramConnector(config as ConnectorConfig<'telegram'>);

      case 'irc':
        return ConnectorFactory.createIRCConnector(config as ConnectorConfig<'irc'>);

      default:
        throw new ConnectionError(
          `Unsupported platform: ${platform}`,
          platform,
          'UNSUPPORTED_PLATFORM'
        );
    }
  }

  /**
   * Create Telegram connector instance
   */
  private static createTelegramConnector(
    config: ConnectorConfig<'telegram'>
  ): IConnector<'telegram'> {
    // Dynamic import to avoid circular dependencies
    // Will be implemented in TG-001
    if (!TelegramConnectorClass) {
      throw new Error('Telegram connector not yet implemented');
    }

    return new TelegramConnectorClass(config);
  }

  /**
   * Create IRC connector instance
   */
  private static createIRCConnector(
    config: ConnectorConfig<'irc'>
  ): IConnector<'irc'> {
    // Dynamic import to avoid circular dependencies
    // Will be implemented in IRC-001
    if (!IRCConnectorClass) {
      throw new Error('IRC connector not yet implemented');
    }

    return new IRCConnectorClass(config);
  }

  /**
   * Get supported platforms
   */
  static getSupportedPlatforms(): Platform[] {
    return ['telegram', 'irc'];
  }

  /**
   * Validate platform config before creating connector
   */
  static async validateConfig<T extends Platform = Platform>(
    platform: Platform,
    config: ConnectorConfig<T>
  ): Promise<true | { field: string; message: string }[]> {
    const connector = ConnectorFactory.createConnector(platform, config);
    const errors: ValidationError[] = await connector.validateConfig(config);

    if (errors.length > 0) {
      return errors.map((e) => ({ field: e.field, message: e.message }));
    }

    return true;
  }

  /**
   * Register connector classes (to be called during app initialization)
   */
  static registerConnectors(telegramConnector: any, ircConnector: any): void {
    TelegramConnectorClass = telegramConnector;
    IRCConnectorClass = ircConnector;
  }
}

// ============================================
// Export
// ============================================

export { ConnectorFactory };
