/**
 * IRC Integration Controller
 *
 * Handles IRC integration endpoints.
 * Implements:
 * - INT-006: POST /api/integrations/irc/config - Save IRC configuration
 * - INT-007: POST /api/integrations/irc/connect - Manual connect
 * - INT-008: POST /api/integrations/irc/test - Test connection
 * - INT-009: GET /integrations/irc/status - Get connection status
 *
 * RBAC: super_admin only for INT-006, 007, 008
 *       admin+ for INT-009
 */

import type { IRCConnectionStatusModel } from '@yacc/common/types/irc-integration.types';
import type { Request, Response } from 'express';
import { Controller, Get, Post, Res, Req, Authorized, Body } from 'routing-controllers';
import { logger } from '../infrastructure/logger';
import { auditService } from '../services/audit.service';
import { ircConfigService } from '../services/ircConfig.service';
import { ircIntegrationService } from '../services/ircIntegration.service';
import type { AuthUser } from '../types/auth.types';
import type {
  IRCConfigRequest,
  IRCConfigResponse,
  IRCConnectResponse,
  IRCTestRequest,
  IRCTestResponse,
  IntegrationErrorResponse,
} from '../types/ircIntegration.types';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
  user?: AuthUser;
}

interface StatusResponse {
  data: IRCConnectionStatusModel;
}

@Controller('/api/integrations/irc')
export class IRCIntegrationController {
  /**
   * POST /api/integrations/irc/config
   *
   * Save IRC configuration (INT-006)
   * RBAC: super_admin only
   *
   * Request: { server, port, username, password?, channels[] }
   * Validation:
   * - server: non-empty string
   * - port: 1-65535
   * - username: non-empty string
   * - channels: array of min 1, each starts with '#'
   *
   * Response 200: { data: { server, port, username, channels, hasPassword, updatedAt } }
   * Errors:
   * - 400: validation_error
   * - 403: forbidden
   */
  @Post('/config')
  @Authorized(['super_admin'])
  public async saveConfig(
    @Req() req: AuthenticatedRequest,
    @Body() body: IRCConfigRequest,
    @Res() res: Response
  ): Promise<Response> {
    const correlationId = req.correlationId || '';
    const userId = req.user?.id || '';

    try {
      logger.info(
        { correlationId, userId, platform: 'irc', method: 'saveConfig' },
        'IRC config save request received'
      );

      // Save config
      const result = await ircConfigService.saveConfig(userId, body);

      // Audit log
      await auditService.logAction({
        actorId: userId,
        action: 'integration.irc.config_updated',
        entityType: 'integration',
        entityId: 'irc',
        metadata: {
          server: body.server,
          port: body.port,
          username: body.username,
          channels: body.channels,
          passwordChanged: !!body.password,
        },
        correlationId,
      });

      logger.info(
        { correlationId, userId, platform: 'irc', method: 'saveConfig' },
        'IRC config saved successfully'
      );

      return res.status(200).json({
        data: result,
      } as IRCConfigResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        { correlationId, userId, platform: 'irc', method: 'saveConfig', error: message },
        'IRC config save failed'
      );

      if (message.includes('required') || message.includes('must be')) {
        return res.status(400).json({
          code: 'validation_error',
          message,
        } as IntegrationErrorResponse);
      }

      return res.status(500).json({
        code: 'internal_error',
        message: 'Failed to save IRC configuration',
      });
    }
  }

  /**
   * POST /api/integrations/irc/connect
   *
   * Manual connect to IRC server (INT-007)
   * RBAC: super_admin only
   *
   * Uses stored config (DB) else env fallback.
   * If neither exists => 409 { code: 'irc_not_configured' }
   *
   * Idempotent: if already connected/connecting, returns 200 with current status
   * Request body is ignored; side effect sets status='retrying' with attemptCount=0
   *
   * Response 200: { data: IRCConnectionStatusModel }
   * Error 409: irc_not_configured
   */
  @Post('/connect')
  @Authorized(['super_admin'])
  public async connect(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<Response> {
    const correlationId = req.correlationId || '';
    const userId = req.user?.id || '';

    try {
      logger.info(
        { correlationId, userId, platform: 'irc', method: 'connect' },
        'IRC manual connect request received'
      );

      // Check and prepare connection (sets status to retrying with attemptCount=0)
      const config = await ircConfigService.checkAndPrepareConnect();
      if (!config) {
        logger.warn(
          { correlationId, userId, platform: 'irc', method: 'connect' },
          'IRC not configured'
        );

        // Audit log
        await auditService.logAction({
          actorId: userId,
          action: 'integration.irc.connect_requested',
          entityType: 'integration',
          entityId: 'irc',
          metadata: { source: 'none', reconnect: false, configured: false },
          correlationId,
        });

        return res.status(409).json({
          code: 'irc_not_configured',
          message: 'IRC is not configured. Save configuration first.',
        } as IntegrationErrorResponse);
      }

      // Get current status (now set to retrying with attemptCount=0)
      const status = ircIntegrationService.getConnectionStatus();

      // Audit log
      await auditService.logAction({
        actorId: userId,
        action: 'integration.irc.connect_requested',
        entityType: 'integration',
        entityId: 'irc',
        metadata: { source: config.source, reconnect: status.status !== 'disconnected' },
        correlationId,
      });

      logger.info(
        { correlationId, userId, platform: 'irc', method: 'connect', source: config.source, status: status.status },
        'IRC manual connect initiated'
      );

      return res.status(200).json({
        data: status,
      } as IRCConnectResponse);
    } catch (error) {
      logger.error(
        {
          correlationId,
          userId,
          platform: 'irc',
          method: 'connect',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'IRC connect failed'
      );

      return res.status(500).json({
        code: 'internal_error',
        message: 'Failed to connect to IRC server',
      });
    }
  }

  /**
   * POST /api/integrations/irc/test
   *
   * Test IRC connection without side effects (INT-008)
   * RBAC: super_admin only
   *
   * Body-first test: validate server/port/username (password optional)
   * If body omitted entirely, use stored config (DB else env); if none => 409
   *
   * Use temporary test client; must not modify live connector state
   * Timeout: hard 10s
   *
   * Response 200: { data: { success: boolean, message: string } } sanitized
   * Error 409: irc_not_configured
   */
  @Post('/test')
  @Authorized(['super_admin'])
  public async test(
    @Req() req: AuthenticatedRequest,
    @Body() body: IRCTestRequest | undefined,
    @Res() res: Response
  ): Promise<Response> {
    const correlationId = req.correlationId || '';
    const userId = req.user?.id || '';

    try {
      logger.info(
        { correlationId, userId, platform: 'irc', method: 'test' },
        'IRC connection test request received'
      );

      const result = await ircConfigService.testConnection(body);

      if (!result.success && result.source === 'db') {
        // Audit log (not configured)
        await auditService.logAction({
          actorId: userId,
          action: 'integration.irc.test_requested',
          entityType: 'integration',
          entityId: 'irc',
          metadata: { source: result.source, configured: false },
          correlationId,
        });

        return res.status(409).json({
          code: 'irc_not_configured',
          message: result.message,
        } as IntegrationErrorResponse);
      }

      // Audit log (test result)
      await auditService.logAction({
        actorId: userId,
        action: 'integration.irc.test_requested',
        entityType: 'integration',
        entityId: 'irc',
        metadata: { source: result.source, success: result.success },
        correlationId,
      });

      if (result.success) {
        await auditService.logAction({
          actorId: userId,
          action: 'integration.irc.test_result',
          entityType: 'integration',
          entityId: 'irc',
          metadata: { success: true, reason: 'Connection successful' },
          correlationId,
        });
      } else {
        await auditService.logAction({
          actorId: userId,
          action: 'integration.irc.test_result',
          entityType: 'integration',
          entityId: 'irc',
          metadata: { success: false, reason: result.message },
          correlationId,
        });
      }

      logger.info(
        { correlationId, userId, platform: 'irc', method: 'test', success: result.success },
        'IRC connection test completed'
      );

      return res.status(200).json({
        data: {
          success: result.success,
          message: result.message,
        },
      } as IRCTestResponse);
    } catch (error) {
      logger.error(
        {
          correlationId,
          userId,
          platform: 'irc',
          method: 'test',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'IRC connection test failed'
      );

      return res.status(500).json({
        code: 'internal_error',
        message: 'Connection test failed',
      });
    }
  }

  /**
   * GET /api/integrations/irc/status
   *
   * Get current IRC connection status (INT-009)
   *
   * RBAC: admin+ (super_admin, admin)
   * - Returns 403 Forbidden for non-admin users
   *
   * Response: 200 OK
   * ```json
   * {
   *   "data": {
   *     "status": "connected" | "retrying" | "disconnected" | "failed",
   *     "attemptCount": 0-5,
   *     "lastChangedAt": "2026-02-19T15:30:00.000Z",
   *     "lastConnectedAt": "2026-02-19T15:25:00.000Z" | null,
   *     "lastError": "error message" | null,
   *     "reconnectIncidentId": "uuid" (optional)
   *   }
   * }
   * ```
   *
   * Works even when IRC is unconfigured (returns meaningful status).
   * Does not expose configuration secrets.
   */
  @Get('/status')
  @Authorized(['admin', 'super_admin'])
  public async getStatus(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const correlationId = req.correlationId || '';

      logger.info(
        { correlationId, userId: req.user?.id, platform: 'irc' },
        'IRC status endpoint called'
      );

      const status = ircIntegrationService.getConnectionStatus();

      logger.debug(
        {
          correlationId,
          userId: req.user?.id,
          platform: 'irc',
          status: status.status,
          attemptCount: status.attemptCount,
        },
        'IRC status retrieved successfully'
      );

      return res.status(200).json({
        data: status,
      } as StatusResponse);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: req.user?.id,
          platform: 'irc',
        },
        'Failed to retrieve IRC status'
      );

      return res.status(500).json({
        code: 'internal_error',
        message: 'Failed to retrieve IRC status',
      });
    }
  }
}
