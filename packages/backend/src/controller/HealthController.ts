/**
 * Health Check Controller
 *
 * Provides simple health check endpoints for monitoring application health
 */

import logger from '../utils/logger';

// ============================================
// Health Check Response
// ============================================

export interface HealthResponse {
  status: 'ok' | 'error';
  uptime: number;
}

// ============================================
// Health Check
// ============================================

/**
 * Simple health check endpoint
 * GET /health
 * Returns: { status: 'ok', timestamp, uptime }
 */
export async function getHealth(): Promise<HealthResponse> {
  logger.debug('Health check requested');
  
  const startTime = process.env.START_TIME ? parseInt(process.env.START_TIME, 10) : Date.now();
  const uptime = Math.floor((Date.now() - startTime) / 1000); // Seconds
  
  logger.info('Health check completed', {
    status: 'ok',
    uptime: uptime,
  });
  
  return {
    status: 'ok',
    timestamp: new Date(),
    uptime: uptime,
  };
}
