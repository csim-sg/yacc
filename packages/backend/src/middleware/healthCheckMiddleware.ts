/**
 * Health Middleware
 *
 * Simple middleware to handle health check requests
 */

import logger from '../utils/logger';

// ============================================
// Health Check Middleware
// ============================================

/**
 * Middleware to ensure health check endpoints are accessible
 */
export function healthCheckMiddleware(req: any, res: any, next: any): void {
  // Add CORS headers if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  logger.debug('Health check request', {
    method: req.method,
    path: req.path,
  });
  
  next();
}
