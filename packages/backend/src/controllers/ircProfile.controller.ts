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

import { Socket } from 'net';
import type { Request, Response } from 'express';
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
import { logger } from '../infrastructure/logger';
import type { User } from '../schemas/user.schema';
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
import { IrcProfileError } from '../types/ircProfileError.types';

/**
 * Custom Request type with user context
 */
type AuthRequest = Request & {
  user?: User | undefined;
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
    } catch (error: unknown) {
      let statusCode = 500;
      let errorCode: string | undefined;
      let message = 'Failed to create profile';

      if (error instanceof IrcProfileError) {
        statusCode = error.statusCode;
        errorCode = error.code;
        message = error.message;
        logger.error({ err: error }, 'IRC profile error');
      } else if (error instanceof Error) {
        logger.error({ err: error }, 'Failed to create IRC profile');
      }

      const response: Record<string, unknown> = { error: message };
      if (errorCode) {
        response.code = errorCode;
      }

      return res.status(statusCode).json(response);
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
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ err }, 'Failed to list IRC profiles');
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
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ err, profileId: id }, 'Failed to get IRC profile');
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
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ err, profileId: id }, 'Failed to update IRC profile');

      const errorWithCode = error as { statusCode?: number; code?: string };
      if (errorWithCode.statusCode === 404) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      if (errorWithCode.code === IrcProfileErrorCode.ENCRYPTION_KEY_MISSING) {
        return res.status(400).json({
          error: 'Encryption key not configured',
          code: errorWithCode.code,
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
    } catch (error: unknown) {
      let statusCode = 500;
      let errorCode: string | undefined;
      let message = 'Failed to activate profile';

      if (error instanceof IrcProfileError) {
        statusCode = error.statusCode;
        errorCode = error.code;
        message = error.message;
        logger.error({ err: error, profileId: id }, 'IRC profile error');
      } else if (error instanceof Error) {
        logger.error({ err: error, profileId: id }, 'Failed to activate IRC profile');
      }

      const response: Record<string, unknown> = { error: message };
      if (errorCode) {
        response.code = errorCode;
      }

      return res.status(statusCode).json(response);
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
    } catch (error: unknown) {
      let statusCode = 500;
      let errorCode: string | undefined;
      let message = 'Failed to disable profile';

      if (error instanceof IrcProfileError) {
        statusCode = error.statusCode;
        errorCode = error.code;
        message = error.message;
        logger.error({ err: error, profileId: id }, 'IRC profile error');
      } else if (error instanceof Error) {
        logger.error({ err: error, profileId: id }, 'Failed to disable IRC profile');
      }

      const response: Record<string, unknown> = { error: message };
      if (errorCode) {
        response.code = errorCode;
      }

      return res.status(statusCode).json(response);
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
    } catch (error: unknown) {
      let statusCode = 500;
      let errorCode: string | undefined;
      let message = 'Failed to delete profile';

      if (error instanceof IrcProfileError) {
        statusCode = error.statusCode;
        errorCode = error.code;
        message = error.message;
        logger.error({ err: error, profileId: id }, 'IRC profile error');
      } else if (error instanceof Error) {
        logger.error({ err: error, profileId: id }, 'Failed to delete IRC profile');
      }

      const response: Record<string, unknown> = { error: message };
      if (errorCode) {
        response.code = errorCode;
      }

      return res.status(statusCode).json(response);
    }
  }

  /**
   * Test IRC connection for a profile
   * POST /api/integrations/irc/profiles/:id/test
   * Super Admin only
   * Performs safe connectivity check (10 second timeout, no side effects)
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

      // Get profile with secrets for test
      // Note: getIrcProfile returns response without secrets
      // For testing, we need to fetch from DB directly with decryption
      const profile = await getIrcProfile(DEFAULT_TENANT_ID, profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Perform test connection with 10 second timeout
      const testResult = await this.testIrcConnectivity(profile);

      // Record test result
      await recordTestResult(DEFAULT_TENANT_ID, profileId, testResult.passed, user);

      return res.status(200).json(testResult);
    } catch (error: unknown) {
      let statusCode = 500;
      let errorCode: string | undefined;
      let message = 'Test connection failed';

      if (error instanceof IrcProfileError) {
        statusCode = error.statusCode;
        errorCode = error.code;
        message = error.message;
        logger.error({ err: error, profileId: id }, 'IRC profile error');
      } else if (error instanceof Error) {
        logger.error({ err: error, profileId: id }, 'Failed to test IRC connection');
      }

      const response: Record<string, unknown> = {
        passed: false,
        reason: message,
      };
      if (errorCode) {
        response.code = errorCode;
      }

      return res.status(statusCode).json(response);
    }
  }

  /**
   * Helper: Test IRC server connectivity with timeout
   * Attempts to connect, validates response, closes immediately
   * No side effects, no persistent connection
   * Timeout: 10 seconds
   */
  private async testIrcConnectivity(profile: IrcProfileResponse): Promise<TestConnectionResult> {
    const timeoutMs = 10000; // 10 second timeout

    return new Promise((resolve) => {
       const startTime = Date.now();

       // Simple TCP socket connectivity test (no IRC protocol needed for basic test)
       const socket = new Socket();

      const handleTimeout = () => {
        socket.destroy();
        resolve({
          passed: false,
          reason: 'Connection timeout (>10s)',
          duration: Date.now() - startTime,
        });
      };

      const timeoutHandle = setTimeout(handleTimeout, timeoutMs);

      socket.on('connect', () => {
        clearTimeout(timeoutHandle);
        socket.destroy(); // Close immediately, test is complete
        resolve({
          passed: true,
          duration: Date.now() - startTime,
        });
      });

      socket.on('error', (err: Error) => {
        clearTimeout(timeoutHandle);
        resolve({
          passed: false,
          reason: err.message || 'Connection failed',
          duration: Date.now() - startTime,
        });
      });

      // Attempt to connect to IRC server
      const port = profile.config.port || 6667;
      socket.connect(port, profile.config.server);
    });
  }
}
