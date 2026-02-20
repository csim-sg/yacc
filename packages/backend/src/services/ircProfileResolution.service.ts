/**
 * IRC Profile Resolution Service
 *
 * Implements INT-010 runtime env gating:
 * - DB-first resolution: if ANY DB profiles exist for tenant, use only DB profiles
 * - Env fallback: only if zero DB profiles exist
 * - Implicit single profile: if >1 DB profiles and none active → 409 irc_profile_not_selected
 * - Returns resolved IRC config for connector initialization
 *
 * This service enforces the gating logic used by IRC connector at runtime.
 */

import { and, eq } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { integrationConnectionProfiles } from '../schemas/integrationConnectionProfile.schema';
import { appConfig } from '../config/appConfig';
import { logger } from '../infrastructure/logger';
import { EncryptionService } from './encryption.service';

/**
 * Resolved IRC configuration (decrypted, ready for connector)
 */
export interface ResolvedIrcConfig {
  server: string;
  port: number;
  nick: string;
  password?: string;
  channels: string[];
  profileId?: number; // Set if resolved from DB profile
  source: 'db' | 'env';
}

/**
 * Error for profile resolution failures
 */
export class IrcProfileResolutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'IrcProfileResolutionError';
  }
}

/**
 * Resolve IRC configuration for connector initialization
 *
 * Rules:
 * 1. If ANY DB profiles exist → use DB only
 *    - If exactly 1 active profile → use it
 *    - If 0 active profiles and >1 total → 409 irc_profile_not_selected
 *    - If 0 active profiles and 1 total → use it implicitly
 * 2. If zero DB profiles → use env (if complete)
 * 3. If zero DB profiles and env incomplete → 409 irc_not_configured
 *
 * @param tenantId - Tenant to resolve config for
 * @returns Resolved config or throws IrcProfileResolutionError
 */
export async function resolveIrcConfig(
  tenantId: string
): Promise<ResolvedIrcConfig> {
  try {
    // Check for DB profiles (ANY profiles: enabled OR disabled)
    // INT-010: DB-first gating requires checking ALL profiles, not just enabled ones
    // CRITICAL: DB-first requires DB query to succeed; env fallback ONLY if zero profiles exist
    let dbProfiles: typeof integrationConnectionProfiles.$inferSelect[] = [];
    
    try {
      dbProfiles = await dbClient
        .select()
        .from(integrationConnectionProfiles)
        .where(
          and(
            eq(integrationConnectionProfiles.tenantId, tenantId),
            eq(integrationConnectionProfiles.integrationType, 'irc')
            // Do NOT filter by isEnabled; check ALL profiles (enabled or disabled)
          )
        );
    } catch (dbError) {
      // If DB query fails, FAIL CLOSED (return 500)
      // Env fallback is ONLY allowed when DB query SUCCEEDS and profile count is zero
      const error = dbError instanceof Error ? dbError.message : 'Unknown error';
      logger.error(
        { tenantId, error },
        'IRC profile resolution: DB access failed (fail closed, no env fallback)'
      );
      throw new IrcProfileResolutionError(
        'Failed to access IRC profile database',
        'irc_profile_resolution_failed',
        500
      );
    }

    logger.debug(
      { tenantId, dbProfileCount: dbProfiles.length },
      'IRC profile resolution: checking DB profiles (enabled OR disabled)'
    );

    // DB-first: if ANY profiles exist (enabled or disabled), use DB only
    if (dbProfiles.length > 0) {
      // Find active profile
      const activeProfile = dbProfiles.find((p) => p.isActive);

      if (activeProfile) {
        // Use active profile
        logger.info(
          { tenantId, profileId: activeProfile.id, profileName: activeProfile.name },
          'IRC profile resolution: using active DB profile'
        );

        return resolveProfileToConfig(activeProfile);
      }

      // No active profile: check if we can use single profile implicitly
      if (dbProfiles.length === 1) {
        // Single profile (enabled or disabled): use implicitly
        logger.info(
          { tenantId, profileId: dbProfiles[0].id, profileName: dbProfiles[0].name },
          'IRC profile resolution: using single DB profile implicitly'
        );

        return resolveProfileToConfig(dbProfiles[0]);
      }

      // Multiple profiles, none active: error (must select one)
      logger.warn(
        { tenantId, dbProfileCount: dbProfiles.length },
        'IRC profile resolution: multiple profiles exist but none active'
      );

      throw new IrcProfileResolutionError(
        `IRC has ${dbProfiles.length} profiles but none is active. Set one as active via API.`,
        'irc_profile_not_selected',
        409
      );
    }

    // DB: zero profiles → try env fallback
    logger.debug(
      { tenantId },
      'IRC profile resolution: no DB profiles, checking env'
    );

    // Env fallback validation
    if (
      !appConfig.IRC_SERVER ||
      !appConfig.IRC_USERNAME ||
      !appConfig.IRC_CHANNELS
    ) {
      logger.warn(
        { tenantId },
        'IRC profile resolution: no DB profiles and env incomplete'
      );

      throw new IrcProfileResolutionError(
        'IRC not configured. Create a profile via API or set environment variables (IRC_SERVER, IRC_USERNAME, IRC_CHANNELS).',
        'irc_not_configured',
        409
      );
    }

    // Parse env channels
    const channels = appConfig.IRC_CHANNELS.split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0 && c.startsWith('#'));

    if (channels.length === 0) {
      logger.warn(
        { tenantId },
        'IRC profile resolution: env channels incomplete or invalid'
      );

      throw new IrcProfileResolutionError(
        'IRC_CHANNELS must contain valid channel names (comma-separated, starting with #)',
        'irc_not_configured',
        409
      );
    }

    logger.info(
      { tenantId, source: 'env' },
      'IRC profile resolution: using env fallback'
    );

    return {
      server: appConfig.IRC_SERVER,
      port: appConfig.IRC_PORT,
      nick: appConfig.IRC_USERNAME,
      password: appConfig.IRC_PASSWORD,
      channels,
      source: 'env',
    };
  } catch (error) {
    // Re-throw typed errors as-is
    if (error instanceof IrcProfileResolutionError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      { tenantId, error: message },
      'IRC profile resolution failed'
    );

    throw new IrcProfileResolutionError(
      `Failed to resolve IRC configuration: ${message}`,
      'internal_error',
      500
    );
  }
}

/**
 * Convert database profile to IRC config (decrypts secrets)
 */
function resolveProfileToConfig(
  profile: typeof integrationConnectionProfiles.$inferSelect
): ResolvedIrcConfig {
  // Decrypt credentials
  let password: string | undefined;
  if (profile.encryptedCredentials) {
    try {
      password = EncryptionService.decrypt(profile.encryptedCredentials);
    } catch (error) {
      logger.error(
        { profileId: profile.id, error },
        'Failed to decrypt IRC profile credentials'
      );
      throw new IrcProfileResolutionError(
        'Failed to decrypt profile credentials',
        'encryption_error',
        500
      );
    }
  }

  // Parse config
  const config = JSON.parse(profile.config) as {
    server: string;
    username: string;
    channels: string[];
    port?: number;
  };

  return {
    server: config.server,
    port: config.port || 6667,
    nick: config.username,
    password,
    channels: config.channels,
    profileId: profile.id,
    source: 'db',
  };
}
