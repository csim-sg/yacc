/**
 * IRC Profile Service
 *
 * Handles CRUD operations for IRC connection profiles with enforced constraints:
 * - Cap: 0..10 profiles per tenant
 * - Active: at most one active per (tenant, integration)
 * - Enabling/disabling constraints
 * - Encryption/decryption of credentials
 *
 * Architecture:
 * - DB-first: profiles from DB take priority
 * - Env fallback: only used if zero DB profiles exist
 * - Secrets: encrypted at rest, never in responses/logs
 *
 * See INT-010: IRC tenant-owned DB connection profiles
 */

import { eq, and } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';
import { integrationConnectionProfiles } from '../schemas/integrationConnectionProfile.schema';
import type { User } from '../schemas/user.schema';
import type {
  CreateIrcProfileRequest,
  UpdateIrcProfileRequest,
  IrcProfileResponse,
  IrcProfileWithSecrets,
  IrcProfileConfig,
  IrcProfileSecrets} from '../types/ircProfile.types';
import {
  IrcProfileErrorCode
} from '../types/ircProfile.types';
import { IrcProfileError } from '../types/ircProfileError.types';
import { auditService } from './audit.service';
import { EncryptionService } from './encryption.service';

/**
 * Hard cap for IRC profiles (MVP constraint)
 */
const IRC_PROFILE_CAP = 10;

/**
 * Default tenant ID (MVP single-tenant)
 */
const _DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Create a new IRC profile
 * Enforces: cap limit, encryption of credentials, unique constraint
 */
export async function createIrcProfile(
  tenantId: string,
  req: CreateIrcProfileRequest,
  createdBy: User
): Promise<IrcProfileResponse> {
  // Enforce cap: count all existing profiles (enabled + disabled)
  const existingProfiles = await dbClient
    .select()
    .from(integrationConnectionProfiles)
    .where(
      and(
        eq(integrationConnectionProfiles.tenantId, tenantId),
        eq(integrationConnectionProfiles.integrationType, 'irc')
      )
    );

  if (existingProfiles.length >= IRC_PROFILE_CAP) {
    throw new IrcProfileError(
      `IRC profile limit exceeded (cap: ${IRC_PROFILE_CAP})`,
      IrcProfileErrorCode.PROFILE_LIMIT_EXCEEDED,
      409
    );
  }

  // Encrypt credentials
  let encryptedCredentials: string;
  try {
    const secrets = { password: req.password || '' };
    const encrypted = EncryptionService.encryptJSON(secrets);
    if (!encrypted) {
      throw new Error('Encryption returned null (key not initialized)');
    }
    encryptedCredentials = encrypted;
  } catch (error) {
    logger.error({ err: error }, 'Failed to encrypt IRC profile credentials');
    throw new IrcProfileError(
      'Failed to encrypt credentials',
      IrcProfileErrorCode.ENCRYPTION_KEY_MISSING,
      400
    );
  }

  // Serialize config
  const configStr = JSON.stringify(req.config);

  // Insert profile
  const inserted = await dbClient
    .insert(integrationConnectionProfiles)
    .values({
      tenantId,
      integrationType: 'irc',
      name: req.name,
      isEnabled: true,
      isActive: false, // Profiles start inactive; user can activate after testing
      encryptedCredentials,
      config: configStr,
      createdByUserId: createdBy.id,
      updatedByUserId: createdBy.id,
    })
    .returning();

  const profileId = inserted[0].id;
  logger.info({ profileId, profileName: req.name }, 'IRC profile created');

  // Log audit event (no secrets in metadata, don't await to avoid blocking response)
  void auditService.logAction({
    actorId: createdBy.id,
    action: 'create',
    entityType: 'integration',
    entityId: `irc-profile-${profileId}`,
    metadata: {
      profileName: req.name,
      server: req.config.server,
      username: req.config.username,
      channels: req.config.channels,
    },
  });

  return toResponseNoSecrets(inserted[0]);
}

/**
 * List all IRC profiles for a tenant
 */
export async function listIrcProfiles(
  tenantId: string
): Promise<IrcProfileResponse[]> {
  const profiles = await dbClient
    .select()
    .from(integrationConnectionProfiles)
    .where(
      and(
        eq(integrationConnectionProfiles.tenantId, tenantId),
        eq(integrationConnectionProfiles.integrationType, 'irc')
      )
    );

  // Decryption not needed for list response (no secrets included)
  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    isEnabled: p.isEnabled,
    isActive: p.isActive,
    config: JSON.parse(p.config) as IrcProfileConfig,
    hasPassword: !!p.encryptedCredentials && p.encryptedCredentials.length > 0,
    lastTestedAt: p.lastTestedAt?.toISOString(),
    lastTestPassed: p.lastTestPassed ?? undefined,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

/**
 * Get a single IRC profile by ID
 */
export async function getIrcProfile(
  tenantId: string,
  profileId: number
): Promise<IrcProfileResponse | null> {
  const profile = await dbClient
    .select()
    .from(integrationConnectionProfiles)
    .where(
      and(
        eq(integrationConnectionProfiles.tenantId, tenantId),
        eq(integrationConnectionProfiles.integrationType, 'irc'),
        eq(integrationConnectionProfiles.id, profileId)
      )
    )
    .limit(1);

  if (profile.length === 0) {
    return null;
  }

  return toResponseNoSecrets(profile[0]);
}

/**
 * Update an IRC profile
 * Cannot change tenantId, integrationType, or createdByUserId
 */
export async function updateIrcProfile(
  tenantId: string,
  profileId: number,
  req: UpdateIrcProfileRequest,
  updatedBy: User
): Promise<IrcProfileResponse> {
  // Fetch current profile
  const current = await dbClient
    .select()
    .from(integrationConnectionProfiles)
    .where(
      and(
        eq(integrationConnectionProfiles.tenantId, tenantId),
        eq(integrationConnectionProfiles.integrationType, 'irc'),
        eq(integrationConnectionProfiles.id, profileId)
      )
    )
    .limit(1);

  if (current.length === 0) {
    throw new IrcProfileError(
      'IRC profile not found',
      IrcProfileErrorCode.FORBIDDEN,
      404
    );
  }

  const profile = current[0];

  // Handle isEnabled change
  if (req.isEnabled !== undefined && req.isEnabled === false && profile.isActive) {
    // Disabling an active profile clears is_active (atomic)
    const updated = await dbClient
      .update(integrationConnectionProfiles)
      .set({
        isEnabled: false,
        isActive: false, // Clear active when disabling
        updatedByUserId: updatedBy.id,
        updatedAt: new Date(),
      })
      .where(eq(integrationConnectionProfiles.id, profileId))
      .returning();

    logger.info({ profileId }, 'IRC profile disabled (active cleared)');

    return toResponseNoSecrets(updated[0]);
  }

  // Build update object
  const updateData: Record<string, string | number | boolean | Date> = {
    updatedByUserId: updatedBy.id,
    updatedAt: new Date(),
  };

  if (req.name !== undefined) {
    updateData.name = req.name;
  }

  if (req.config !== undefined) {
    updateData.config = JSON.stringify({
      ...JSON.parse(profile.config as string),
      ...req.config,
    });
  }

  if (req.password !== undefined) {
    try {
      const secrets = { password: req.password };
      const encrypted = EncryptionService.encryptJSON(secrets);
      if (!encrypted) {
        throw new Error('Encryption returned null');
      }
      updateData.encryptedCredentials = encrypted;
    } catch (error) {
      logger.error({ err: error, profileId }, 'Failed to encrypt IRC profile credentials during update');
      throw new IrcProfileError(
        'Failed to encrypt credentials',
        IrcProfileErrorCode.ENCRYPTION_KEY_MISSING,
        400
      );
    }
  }

  if (req.isEnabled !== undefined) {
    updateData.isEnabled = req.isEnabled;
  }

  const updated = await dbClient
    .update(integrationConnectionProfiles)
    .set(updateData)
    .where(eq(integrationConnectionProfiles.id, profileId))
    .returning();

  logger.info({ profileId }, 'IRC profile updated');

  // Log audit event
  const changes: Record<string, unknown> = {};
  if (req.name !== undefined) changes.name = req.name;
  if (req.config !== undefined) changes.config = req.config;
  if (req.password !== undefined) changes.hasPassword = !!req.password;
  if (req.isEnabled !== undefined) changes.isEnabled = req.isEnabled;

  if (Object.keys(changes).length > 0) {
    void auditService.logAction({
      actorId: updatedBy.id,
      action: 'update',
      entityType: 'integration',
      entityId: `irc-profile-${profileId}`,
      metadata: changes,
    });
  }

  return toResponseNoSecrets(updated[0]);
}

/**
 * Activate an IRC profile (at most one per tenant+integration)
 * Deactivates any currently active profile
 */
export async function activateIrcProfile(
  tenantId: string,
  profileId: number,
  activatedBy: User
): Promise<IrcProfileResponse> {
  // Fetch profile
  const profile = await dbClient
    .select()
    .from(integrationConnectionProfiles)
    .where(
      and(
        eq(integrationConnectionProfiles.tenantId, tenantId),
        eq(integrationConnectionProfiles.integrationType, 'irc'),
        eq(integrationConnectionProfiles.id, profileId)
      )
    )
    .limit(1);

  if (profile.length === 0) {
    throw new IrcProfileError(
      'IRC profile not found',
      IrcProfileErrorCode.FORBIDDEN,
      404
    );
  }

  // Check: cannot activate disabled profile
  if (!profile[0].isEnabled) {
    throw new IrcProfileError(
      'Cannot activate a disabled profile',
      IrcProfileErrorCode.CANNOT_ACTIVATE_DISABLED,
      409
    );
  }

  // Deactivate any currently active profile (atomic transaction)
  await dbClient.transaction(async (tx) => {
    // Deactivate current active (if any)
    await tx
      .update(integrationConnectionProfiles)
      .set({ isActive: false, updatedByUserId: activatedBy.id })
      .where(
        and(
          eq(integrationConnectionProfiles.tenantId, tenantId),
          eq(integrationConnectionProfiles.integrationType, 'irc'),
          eq(integrationConnectionProfiles.isActive, true)
        )
      );

    // Activate target profile
    await tx
      .update(integrationConnectionProfiles)
      .set({
        isActive: true,
        updatedByUserId: activatedBy.id,
        updatedAt: new Date(),
      })
      .where(eq(integrationConnectionProfiles.id, profileId));
  });

  logger.info({ profileId }, 'IRC profile activated');

  // Log audit event
  void auditService.logAction({
    actorId: activatedBy.id,
    action: 'activate',
    entityType: 'integration',
    entityId: `irc-profile-${profileId}`,
  });

  const updated = await dbClient
    .select()
    .from(integrationConnectionProfiles)
    .where(eq(integrationConnectionProfiles.id, profileId))
    .limit(1);

  return toResponseNoSecrets(updated[0]);
}

/**
 * Disable an IRC profile
 * If profile is active, clears active flag
 */
export async function disableIrcProfile(
  tenantId: string,
  profileId: number,
  disabledBy: User
): Promise<IrcProfileResponse> {
  const profile = await dbClient
    .select()
    .from(integrationConnectionProfiles)
    .where(
      and(
        eq(integrationConnectionProfiles.tenantId, tenantId),
        eq(integrationConnectionProfiles.integrationType, 'irc'),
        eq(integrationConnectionProfiles.id, profileId)
      )
    )
    .limit(1);

  if (profile.length === 0) {
    throw new IrcProfileError(
      'IRC profile not found',
      IrcProfileErrorCode.FORBIDDEN,
      404
    );
  }

  const updated = await dbClient
    .update(integrationConnectionProfiles)
    .set({
      isEnabled: false,
      isActive: false, // Clear active when disabling
      updatedByUserId: disabledBy.id,
      updatedAt: new Date(),
    })
    .where(eq(integrationConnectionProfiles.id, profileId))
    .returning();

  logger.info({ profileId, wasActive: profile[0].isActive }, 'IRC profile disabled');

  // Log audit event
  void auditService.logAction({
    actorId: disabledBy.id,
    action: 'disable',
    entityType: 'integration',
    entityId: `irc-profile-${profileId}`,
    metadata: {
      clearedActive: profile[0].isActive,
    },
  });

  return toResponseNoSecrets(updated[0]);
}

/**
 * Delete an IRC profile
 * Rejects with 409 if profile is active
 */
export async function deleteIrcProfile(
  tenantId: string,
  profileId: number,
  deletedBy: User
): Promise<void> {
  const profile = await dbClient
    .select()
    .from(integrationConnectionProfiles)
    .where(
      and(
        eq(integrationConnectionProfiles.tenantId, tenantId),
        eq(integrationConnectionProfiles.integrationType, 'irc'),
        eq(integrationConnectionProfiles.id, profileId)
      )
    )
    .limit(1);

  if (profile.length === 0) {
    throw new IrcProfileError(
      'IRC profile not found',
      IrcProfileErrorCode.FORBIDDEN,
      404
    );
  }

  // Reject delete if profile is active
  if (profile[0].isActive) {
    throw new IrcProfileError(
      'Cannot delete an active profile',
      IrcProfileErrorCode.CANNOT_DELETE_ACTIVE,
      409
    );
  }

  await dbClient
    .delete(integrationConnectionProfiles)
    .where(eq(integrationConnectionProfiles.id, profileId));

  logger.info({ profileId }, 'IRC profile deleted');

  // Log audit event
  void auditService.logAction({
    actorId: deletedBy.id,
    action: 'delete',
    entityType: 'integration',
    entityId: `irc-profile-${profileId}`,
  });
}

/**
 * Get the active IRC profile for a tenant (if one exists)
 * Used by connector startup and message handling
 */
export async function getActiveIrcProfile(
  tenantId: string
): Promise<IrcProfileWithSecrets | null> {
  const active = await dbClient
    .select()
    .from(integrationConnectionProfiles)
    .where(
      and(
        eq(integrationConnectionProfiles.tenantId, tenantId),
        eq(integrationConnectionProfiles.integrationType, 'irc'),
        eq(integrationConnectionProfiles.isActive, true)
      )
    )
    .limit(1);

  if (active.length === 0) {
    return null;
  }

  // Decrypt secrets
  const profile = active[0];
  let decrypted: IrcProfileSecrets;
  try {
    decrypted = EncryptionService.decryptJSON<IrcProfileSecrets>(profile.encryptedCredentials);
  } catch (error) {
    logger.error({ err: error, profileId: profile.id }, 'Failed to decrypt active IRC profile secrets');
    throw new Error('Failed to decrypt profile credentials');
  }

  return {
    id: profile.id,
    tenantId: profile.tenantId,
    integrationType: 'irc',
    name: profile.name,
    isEnabled: profile.isEnabled,
    isActive: profile.isActive,
    config: JSON.parse(profile.config),
    password: decrypted.password || '',
    createdByUserId: profile.createdByUserId || '',
    updatedByUserId: profile.updatedByUserId ?? undefined,
    lastTestedAt: profile.lastTestedAt ?? undefined,
    lastTestPassed: profile.lastTestPassed ?? undefined,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/**
 * Record test connection result
 * Does not create any running connection (no side effects)
 */
export async function recordTestResult(
  tenantId: string,
  profileId: number,
  passed: boolean,
  recordedBy: User
): Promise<void> {
  await dbClient
    .update(integrationConnectionProfiles)
    .set({
      lastTestedAt: new Date(),
      lastTestPassed: passed,
      updatedByUserId: recordedBy.id,
    })
    .where(
      and(
        eq(integrationConnectionProfiles.tenantId, tenantId),
        eq(integrationConnectionProfiles.id, profileId)
      )
    );

  logger.info({ profileId, passed }, 'IRC profile test recorded');

  // Log audit event
  void auditService.logAction({
    actorId: recordedBy.id,
    action: 'test',
    entityType: 'integration',
    entityId: `irc-profile-${profileId}`,
    metadata: {
      testPassed: passed,
    },
  });
}

/**
 * Helper: Convert DB record to response DTO (no secrets)
 */
function toResponseNoSecrets(
  profile: typeof integrationConnectionProfiles.$inferSelect
): IrcProfileResponse {
  return {
    id: profile.id,
    name: profile.name,
    isEnabled: profile.isEnabled,
    isActive: profile.isActive,
    config: JSON.parse(profile.config) as IrcProfileConfig,
    hasPassword: !!profile.encryptedCredentials,
    lastTestedAt: profile.lastTestedAt?.toISOString(),
    lastTestPassed: profile.lastTestPassed ?? undefined,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

/**
 * Validate encryption key is configured
 * Used by profile operations that require encryption
 */
export async function validateEncryptionKeyConfigured(): Promise<void> {
  if (!process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY) {
    throw new IrcProfileError(
      'Encryption key not configured',
      IrcProfileErrorCode.ENCRYPTION_KEY_MISSING,
      400
    );
  }
}
