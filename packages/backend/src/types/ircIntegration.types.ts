/**
 * IRC Integration Types
 *
 * Request/response types for INT-006, INT-007, INT-008 endpoints.
 */

import type { IRCConnectionStatusModel } from '@yacc/common/types/irc-integration.types';

/**
 * INT-006: POST /api/integrations/irc/config
 * Request body
 */
export interface IRCConfigRequest {
  server: string;
  port: number;
  username: string;
  password?: string;
  channels: string[];
}

/**
 * INT-006: Response data
 * Never returns plaintext password; uses hasPassword flag instead
 */
export interface IRCConfigResponseData {
  server: string;
  port: number;
  username: string;
  channels: string[];
  hasPassword: boolean;
  updatedAt: string;
}

/**
 * INT-006: Response envelope
 */
export interface IRCConfigResponse {
  data: IRCConfigResponseData;
}

/**
 * INT-007: POST /api/integrations/irc/connect
 * Response data - same as INT-009 status model
 */
export interface IRCConnectResponse {
  data: IRCConnectionStatusModel;
}

/**
 * INT-008: POST /api/integrations/irc/test
 * Request body (optional - body-first or fallback to stored config)
 */
export interface IRCTestRequest {
  server?: string;
  port?: number;
  username?: string;
  password?: string;
}

/**
 * INT-008: Response data
 * Sanitized message (no credentials leaked)
 */
export interface IRCTestResponseData {
  success: boolean;
  message: string;
}

/**
 * INT-008: Response envelope
 */
export interface IRCTestResponse {
  data: IRCTestResponseData;
}

/**
 * Error response for all integration endpoints
 */
export interface IntegrationErrorResponse {
  code: string;
  message: string;
}
