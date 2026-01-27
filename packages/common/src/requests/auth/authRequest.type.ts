import type { Request } from 'express';

/**
 * Auth Request Type
 * Extended Express Request with authentication metadata
 */
export interface AuthRequestType extends Request {
  correlationId?: string;
  headers: {
    authorization?: string;
  };
}
