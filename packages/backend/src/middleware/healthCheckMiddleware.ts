/**
 * Health Check Middleware
 *
 * Request logging for health check endpoints
 * Note: No CORS needed for internal Kubernetes probes
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// ============================================
// Middleware Implementation
// ============================================

/**
 * Health check middleware - logs requests without CORS
 * Kubernetes/lb probes don't use CORS, so we don't add headers
 */
export function healthCheckMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log health check requests
  logger.debug('Health check request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  // No CORS headers needed for internal probes
  // Proceed to next middleware/handler
  next();
}

// ============================================
// Export
// ============================================

export { healthCheckMiddleware };
