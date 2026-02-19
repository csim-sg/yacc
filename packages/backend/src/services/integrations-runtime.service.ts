import { appConfig } from '../config/appConfig';
import { IRCConnector } from '../connectors/irc.connector';
import { TelegramConnector } from '../connectors/telegram.connector';
import { logger } from '../infrastructure/logger';
import { connectorManager } from './connector-manager';
import { connectorStatusWiring } from './connector-status-wiring.service';

export async function initializeIntegrationsRuntime(): Promise<void> {
  // Telegram
  if (appConfig.TELEGRAM_BOT_TOKEN) {
    const telegram = new TelegramConnector();
    telegram.setConfig({
      platform: 'telegram',
      botToken: appConfig.TELEGRAM_BOT_TOKEN,
    });

    connectorManager.registerConnector('telegram', telegram);

    telegram.connect().catch((error) => {
      logger.error(
        {
          platform: 'telegram',
          error: error instanceof Error ? error.message : String(error),
        },
        'Telegram connector failed to connect (will not block startup)'
      );
    });
  } else {
    logger.info({ platform: 'telegram' }, 'Telegram connector skipped (missing TELEGRAM_BOT_TOKEN)');
  }

  // IRC
  if (appConfig.IRC_SERVER && appConfig.IRC_USERNAME) {
    const channels: string[] = (appConfig.IRC_CHANNELS || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    if (channels.length === 0) {
      logger.warn(
        { platform: 'irc' },
        'IRC connector skipped (missing IRC_CHANNELS)'
      );
      return;
    }

    const invalid: string[] = channels.filter((c: string) => !c.startsWith('#'));
    if (invalid.length > 0) {
      logger.warn(
        { platform: 'irc', invalid },
        'IRC connector skipped (IRC_CHANNELS contains invalid channel names)'
      );
      return;
    }

    const irc = new IRCConnector();
    irc.setConfig({
      platform: 'irc',
      server: appConfig.IRC_SERVER,
      port: appConfig.IRC_PORT,
      nick: appConfig.IRC_USERNAME,
      password: appConfig.IRC_PASSWORD,
      channels,
    });

    connectorManager.registerConnector('irc', irc);

    // Wire status events so connector updates ircStatusClient
    connectorStatusWiring.wire();

    irc.connect().catch((error) => {
      logger.error(
        {
          platform: 'irc',
          error: error instanceof Error ? error.message : String(error),
        },
        'IRC connector failed to connect (will retry with backoff)'
      );
    });
  } else {
    logger.info(
      { platform: 'irc' },
      'IRC connector skipped (missing IRC_SERVER or IRC_USERNAME)'
    );
  }
}
