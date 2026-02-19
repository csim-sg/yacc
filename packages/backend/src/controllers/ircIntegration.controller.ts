/**
 * IRC Integration Controller
 *
 * Handles IRC integration endpoints.
 * Implements INT-009: GET /integrations/irc/status endpoint.
 *
 * RBAC: admin+ only (uses @Authorized decorator)
 */

import type { IRCConnectionStatusModel } from '@yacc/common/types/irc-integration.types';
import type { Request, Response } from 'express';
import { Controller, Get, Res, Req, Authorized } from 'routing-controllers';
import { logger } from '../infrastructure/logger';
import { ircIntegrationService } from '../services/ircIntegration.service';
import type { AuthUser } from '../types/auth.types';

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
   * GET /api/integrations/irc/status
   *
   * Get current IRC connection status
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
