import { appConfig } from '../config/appConfig';
import { IRCConnector } from '../connectors/irc.connector';
import { TelegramConnector } from '../connectors/telegram.connector';
import { logger } from '../infrastructure/logger';
import { connectorManager } from './connector-manager';
import { connectorStatusWiring } from './connector-status-wiring.service';
import { resolveIrcConfig, IrcProfileResolutionError } from './ircProfileResolution.service';

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

  // IRC: INT-010 DB-first gating logic
  // Resolve IRC config using DB-first rules:
  // - If ANY DB profiles exist (enabled OR disabled) → use DB only
  // - If >1 profiles and none active → 409 irc_profile_not_selected (surface to operator)
  // - If 1 profile and none active → implicit selection
  // - If 0 profiles → allow env fallback
  try {
    const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';
    const resolvedConfig = await resolveIrcConfig(DEFAULT_TENANT_ID);

    const irc = new IRCConnector();
    irc.setConfig({
      platform: 'irc',
      server: resolvedConfig.server,
      port: resolvedConfig.port,
      nick: resolvedConfig.nick,
      password: resolvedConfig.password,
      channels: resolvedConfig.channels,
      profileId: resolvedConfig.profileId, // Pass profile ID for profile-scoped conversation mapping
    });

    connectorManager.registerConnector('irc', irc);

    // Wire status events so connector updates ircStatusClient
    connectorStatusWiring.wire();

    irc.connect().catch((error) => {
      logger.error(
        {
          platform: 'irc',
          profileId: resolvedConfig.profileId,
          error: error instanceof Error ? error.message : String(error),
        },
        'IRC connector failed to connect (will retry with backoff)'
      );
    });

    logger.info(
      { platform: 'irc', profileId: resolvedConfig.profileId, source: resolvedConfig.source },
      'IRC connector initialized (DB-first resolution)'
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
        // Return early; do not start connector
        return;
      }
      // Other resolution errors (500)
      logger.error(
        {
          platform: 'irc',
          code: error.code,
          error: error.message,
        },
        'IRC connector initialization failed (resolution error)'
      );
      return;
    }

    // Unexpected error
    logger.error(
      {
        platform: 'irc',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'IRC connector initialization failed (unexpected error)'
    );
  }
}
