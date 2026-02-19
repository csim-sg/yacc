/**
 * IRC Profile Controller
 *
 * REST endpoints for IRC connection profile management
 * RBAC:
 * - Super Admin: CRUD, activate, disable, delete, test
 * - Admin + Manager: read-only
 * - User: no access
 *
 * See INT-010: IRC tenant-owned DB connection profiles
 */

import {
  JsonController,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Res,
  Req,
  HttpCode,
} from 'routing-controllers';
import type { Request, Response } from 'express';
import {
  createIrcProfile,
  listIrcProfiles,
  getIrcProfile,
  updateIrcProfile,
  activateIrcProfile,
  disableIrcProfile,
  deleteIrcProfile,
  recordTestResult,
} from '../services/ircProfile.service';
import type {
  CreateIrcProfileRequest,
  UpdateIrcProfileRequest,
  IrcProfileResponse,
  TestConnectionResult,
} from '../types/ircProfile.types';
import { IrcProfileErrorCode } from '../types/ircProfile.types';
import type { User } from '../schemas/user.schema';
import { logger } from '../infrastructure/logger';

/**
 * Custom Request type with user context
 */
type AuthRequest = Request & {
  user?: User;
};

/**
 * Default tenant ID (MVP single-tenant)
 */
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';

@JsonController('/api/integrations/irc/profiles')
export class IrcProfileController {
  /**
   * Create a new IRC profile
   * POST /api/integrations/irc/profiles
   * Super Admin only
   */
  @Post('')
  @HttpCode(201)
  async createProfile(
    @Body() body: CreateIrcProfileRequest,
    @Req() req: AuthRequest,
    @Res() res: Response
  ): Promise<Response> {
    try {
      // Auth check: Super Admin only
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Forbidden',
          code: IrcProfileErrorCode.FORBIDDEN,
        });
      }

      // Validate request body
      if (!body.name || body.name.trim().length === 0) {
        return res.status(400).json({ error: 'Profile name is required' });
      }
      if (!body.config || !body.config.server || !body.config.username) {
        return res.status(400).json({
          error: 'Config must include server and username',
        });
      }
      if (!Array.isArray(body.config.channels) || body.config.channels.length === 0) {
        return res.status(400).json({
          error: 'Config must include at least one channel',
        });
      }

      const profile = await createIrcProfile(DEFAULT_TENANT_ID, body, user);
      return res.status(201).json(profile);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to create IRC profile');

      // Handle specific error codes
      if (error.code === IrcProfileErrorCode.PROFILE_LIMIT_EXCEEDED) {
        return res.status(409).json({
          error: 'IRC profile limit exceeded',
          code: error.code,
        });
      }

      if (error.code === IrcProfileErrorCode.ENCRYPTION_KEY_MISSING) {
        return res.status(400).json({
          error: 'Encryption key not configured',
          code: error.code,
        });
      }

      return res.status(500).json({ error: 'Failed to create profile' });
    }
  }

  /**
   * List all IRC profiles for tenant
   * GET /api/integrations/irc/profiles
   * Admin+ only
   */
  @Get('')
  async listProfiles(
    @Req() req: AuthRequest,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // RBAC: admin, manager, super_admin can read
      if (!['admin', 'manager', 'super_admin'].includes(user.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          code: IrcProfileErrorCode.FORBIDDEN,
        });
      }

      const profiles = await listIrcProfiles(DEFAULT_TENANT_ID);
      return res.status(200).json(profiles);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to list IRC profiles');
      return res.status(500).json({ error: 'Failed to list profiles' });
    }
  }

  /**
   * Get a single IRC profile
   * GET /api/integrations/irc/profiles/:id
   * Admin+ only
   */
  @Get('/:id')
  async getProfile(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // RBAC: admin, manager, super_admin can read
      if (!['admin', 'manager', 'super_admin'].includes(user.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          code: IrcProfileErrorCode.FORBIDDEN,
        });
      }

      const profileId = parseInt(id, 10);
      if (isNaN(profileId)) {
        return res.status(400).json({ error: 'Invalid profile ID' });
      }

      const profile = await getIrcProfile(DEFAULT_TENANT_ID, profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      return res.status(200).json(profile);
    } catch (error: any) {
      logger.error({ err: error, profileId: id }, 'Failed to get IRC profile');
      return res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  /**
   * Update an IRC profile
   * PUT /api/integrations/irc/profiles/:id
   * Super Admin only
   */
  @Put('/:id')
  async updateProfile(
    @Param('id') id: string,
    @Body() body: UpdateIrcProfileRequest,
    @Req() req: AuthRequest,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Auth check: Super Admin only
      if (user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Forbidden',
          code: IrcProfileErrorCode.FORBIDDEN,
        });
      }

      const profileId = parseInt(id, 10);
      if (isNaN(profileId)) {
        return res.status(400).json({ error: 'Invalid profile ID' });
      }

      const profile = await updateIrcProfile(
        DEFAULT_TENANT_ID,
        profileId,
        body,
        user
      );
      return res.status(200).json(profile);
    } catch (error: any) {
      logger.error({ err: error, profileId: id }, 'Failed to update IRC profile');

      if (error.statusCode === 404) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      if (error.code === IrcProfileErrorCode.ENCRYPTION_KEY_MISSING) {
        return res.status(400).json({
          error: 'Encryption key not configured',
          code: error.code,
        });
      }

      return res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  /**
   * Activate an IRC profile (one active per integration)
   * POST /api/integrations/irc/profiles/:id/activate
   * Super Admin only
   */
  @Post('/:id/activate')
  @HttpCode(200)
  async activateProfile(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Auth check: Super Admin only
      if (user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Forbidden',
          code: IrcProfileErrorCode.FORBIDDEN,
        });
      }

      const profileId = parseInt(id, 10);
      if (isNaN(profileId)) {
        return res.status(400).json({ error: 'Invalid profile ID' });
      }

      const profile = await activateIrcProfile(
        DEFAULT_TENANT_ID,
        profileId,
        user
      );
      return res.status(200).json(profile);
    } catch (error: any) {
      logger.error({ err: error, profileId: id }, 'Failed to activate IRC profile');

      if (error.statusCode === 404) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      if (error.code === IrcProfileErrorCode.CANNOT_ACTIVATE_DISABLED) {
        return res.status(409).json({
          error: 'Cannot activate a disabled profile',
          code: error.code,
        });
      }

      return res.status(500).json({ error: 'Failed to activate profile' });
    }
  }

  /**
   * Disable an IRC profile
   * POST /api/integrations/irc/profiles/:id/disable
   * Super Admin only
   */
  @Post('/:id/disable')
  @HttpCode(200)
  async disableProfile(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Auth check: Super Admin only
      if (user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Forbidden',
          code: IrcProfileErrorCode.FORBIDDEN,
        });
      }

      const profileId = parseInt(id, 10);
      if (isNaN(profileId)) {
        return res.status(400).json({ error: 'Invalid profile ID' });
      }

      const profile = await disableIrcProfile(
        DEFAULT_TENANT_ID,
        profileId,
        user
      );
      return res.status(200).json(profile);
    } catch (error: any) {
      logger.error({ err: error, profileId: id }, 'Failed to disable IRC profile');

      if (error.statusCode === 404) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      return res.status(500).json({ error: 'Failed to disable profile' });
    }
  }

  /**
   * Delete an IRC profile
   * DELETE /api/integrations/irc/profiles/:id
   * Super Admin only
   * Rejects with 409 if profile is active
   */
  @Delete('/:id')
  @HttpCode(204)
  async deleteProfile(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Auth check: Super Admin only
      if (user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Forbidden',
          code: IrcProfileErrorCode.FORBIDDEN,
        });
      }

      const profileId = parseInt(id, 10);
      if (isNaN(profileId)) {
        return res.status(400).json({ error: 'Invalid profile ID' });
      }

      await deleteIrcProfile(DEFAULT_TENANT_ID, profileId, user);
      return res.status(204).send();
    } catch (error: any) {
      logger.error({ err: error, profileId: id }, 'Failed to delete IRC profile');

      if (error.statusCode === 404) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      if (error.code === IrcProfileErrorCode.CANNOT_DELETE_ACTIVE) {
        return res.status(409).json({
          error: 'Cannot delete an active profile',
          code: error.code,
        });
      }

      return res.status(500).json({ error: 'Failed to delete profile' });
    }
  }

  /**
   * Test IRC connection for a profile
   * POST /api/integrations/irc/profiles/:id/test
   * Super Admin only
   * No side effects - no running connection created
   */
  @Post('/:id/test')
  @HttpCode(200)
  async testConnection(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Auth check: Super Admin only
      if (user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Forbidden',
          code: IrcProfileErrorCode.FORBIDDEN,
        });
      }

      const profileId = parseInt(id, 10);
      if (isNaN(profileId)) {
        return res.status(400).json({ error: 'Invalid profile ID' });
      }

      // Get profile
      const profile = await getIrcProfile(DEFAULT_TENANT_ID, profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Perform test connection (10 second timeout, no side effects)
      const result: TestConnectionResult = {
        passed: false,
        reason: 'Test not implemented yet',
      };

      // TODO: Implement actual connection test using IrcConnector
      // For now, record the test result (even though it's not truly tested)
      await recordTestResult(DEFAULT_TENANT_ID, profileId, result.passed, user);

      return res.status(200).json(result);
    } catch (error: any) {
      logger.error({ err: error, profileId: id }, 'Failed to test IRC connection');

      if (error.statusCode === 404) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      return res.status(500).json({
        passed: false,
        reason: 'Test connection failed',
      });
    }
  }
}
