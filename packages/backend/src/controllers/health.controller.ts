/**
 * Health Check Controller
 *
 * Provides health check endpoints for monitoring and Kubernetes probes
 * Checks PostgreSQL, Redis, and R2 connectivity
 * Uses routing-controllers for automatic route registration
 */

import { All, Controller, Req, Res } from 'routing-controllers';
import type { Request, Response } from 'express';
import { dbClient } from '../infrastructure/db.client';
import { redisClient } from '../infrastructure/redis.client';
import { checkR2Health, isR2Configured } from '../infrastructure/r2.client';
import { logger } from '../infrastructure/logger';
import { appConfig } from '../config/appConfig';
import type {
  HealthStatus,
  DependencyHealth,
  HealthSLO,
} from '@yacc/common/responses/health/healthResponse.response';

// ============================================
// Health Check Implementation
// ============================================

/**
 * Check if database is connected
 */
async function checkDatabaseConnection(): Promise<boolean> {
  try {
    // Use Drizzle's query builder for health check
    await dbClient.execute('SELECT 1' as any);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Redis is connected
 */
async function checkRedisHealth(): Promise<boolean> {
  try {
    await redisClient.ping();
    return true;
  } catch {
    return false;
  }
}



/**
 * Default SLO thresholds
 */
const DEFAULT_SLO = {
  maxLatencyMs: 1000,
  errorThresholdPercent: 10,
} as const;

/**
 * Check PostgreSQL health with timeout
 */
async function checkPostgreSQL(): Promise<DependencyHealth> {
  const startTime = Date.now();

  try {
    // Add 5-second timeout to prevent hanging
    const result = await Promise.race([
      checkDatabaseConnection(),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Database health check timeout')), 5000)
      ),
    ]);

    if (result) {
      const latencyMs = Date.now() - startTime;

      logger.debug('PostgreSQL health check passed with %d ms latency', latencyMs);

      return {
        name: 'postgresql',
        status: 'up',
        latencyMs,
      };
    } else {
      throw new Error('Database connection failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('PostgreSQL health check failed: %s', errorMessage);

    return {
      name: 'postgresql',
      status: 'down',
      error: errorMessage,
    };
  }
}

/**
 * Check Redis health with timeout
 */
async function checkRedis(): Promise<DependencyHealth> {
  const startTime = Date.now();

  try {
    // Add 5-second timeout to prevent hanging
    const result = await Promise.race([
      checkRedisHealth(),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Redis health check timeout')), 5000)
      ),
    ]);

    if (result) {
      const latencyMs = Date.now() - startTime;

      logger.debug('Redis health check passed with %d ms latency', latencyMs);

      return {
        name: 'redis',
        status: 'up',
        latencyMs,
      };
    } else {
      throw new Error('Redis connection failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Redis health check failed: %s', errorMessage);

    return {
      name: 'redis',
      status: 'down',
      error: errorMessage,
    };
  }
}

/**
 * Check R2 health with timeout
 */
async function checkR2(): Promise<DependencyHealth> {
  const startTime = Date.now();

  try {
    if (!isR2Configured()) {
      logger.warn('R2 not configured, skipping health check');

      return {
        name: 'r2',
        status: 'up', // Treat as up if not configured
      };
    }

    // Add 5-second timeout to prevent hanging
    const result = await Promise.race([
      checkR2Health(),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('R2 health check timeout')), 5000)
      ),
    ]);

    if (result) {
      const latencyMs = Date.now() - startTime;

      logger.debug('R2 health check passed with %d ms latency', latencyMs);

      return {
        name: 'r2',
        status: 'up',
        latencyMs,
      };
    } else {
      throw new Error('R2 connection failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('R2 health check failed: %s', errorMessage);

    return {
      name: 'r2',
      status: 'down',
      error: errorMessage,
    };
  }
}

/**
 * Calculate overall health status
 */
function calculateOverallHealth(
  postgresql: DependencyHealth,
  redis: DependencyHealth,
  r2: DependencyHealth
): HealthStatus {
  const downCount = [postgresql, redis, r2].filter((d) => d.status === 'down').length;

  if (downCount === 0) {
    return 'healthy';
  } else if (downCount === 1) {
    return 'degraded';
  } else {
    return 'unhealthy';
  }
}

/**
 * Calculate SLO metrics
 */
function calculateSLOs(
  dependencies: DependencyHealth[]
): {
  latencyMs: number;
  errorRatePercent: number;
  withinThreshold: boolean;
} {
  const latencyMs = Math.max(...dependencies.map((d) => d.latencyMs || 0));
  const upCount = dependencies.filter((d) => d.status === 'up').length;
  const errorRatePercent = ((dependencies.length - upCount) / dependencies.length) * 100;

  const withinThreshold =
    latencyMs <= DEFAULT_SLO.maxLatencyMs &&
    errorRatePercent <= DEFAULT_SLO.errorThresholdPercent;

  return {
    latencyMs,
    errorRatePercent,
    withinThreshold,
  };
}

// ============================================
// Controller Class
// ============================================

/**
 * Health Check Controller
 * Routes are automatically registered by routing-controllers based on method names:
 * - GET /health -> getHealth()
 * - GET /health/live -> getHealthLive()
 * - GET /health/ready -> getHealthReady()
 */
@Controller('/health')
export class HealthController {
  /**
   * GET /health - Complete health check with dependencies and SLOs
   */
  @All('/')
  async getHealth(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      // Check all dependencies in parallel
      const [postgresql, redis, r2] = await Promise.all([
        checkPostgreSQL(),
        checkRedis(),
        checkR2(),
      ]);

      const status = calculateOverallHealth(postgresql, redis, r2);

      // Calculate SLOs
      const slo = calculateSLOs([postgresql, redis, r2]);

      // Use process.uptime() instead of env variable
      const uptime = process.uptime();

      logger.info(
        'Health check completed - status: %s, postgres: %s, redis: %s, r2: %s',
        status,
        postgresql.status,
        redis.status,
        r2.status
      );

      // Return health response
      res.status(200).json({
        status,
        uptime,
        timestamp: new Date().toISOString(),
        dependencies: {
          postgresql,
          redis,
          r2,
        },
        slo,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Health check failed: %s', errorMessage);

      // Return unhealthy status on error
      res.status(500).json({
        status: 'unhealthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        dependencies: {
          postgresql: { name: 'postgresql', status: 'down' as const, error: errorMessage },
          redis: { name: 'redis', status: 'down' as const, error: errorMessage },
          r2: { name: 'r2', status: 'down' as const, error: errorMessage },
        },
      });
    }
  }

  /**
   * GET /health/live - Liveness probe (is process running)
   * Kubernetes will restart pod if this returns non-200
   */
  @All('/live')
  async getHealthLive(@Req() req: Request, @Res() res: Response): Promise<void> {
    // Simple liveness check - just returns alive if process is running
    // Kubernetes will restart pod if this fails

    logger.debug('Liveness probe');

    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /health/ready - Readiness probe (can handle traffic)
   * Kubernetes stops sending traffic if this returns not_ready
   */
  @All('/ready')
  async getHealthReady(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      // Check all dependencies are ready
      const [postgresql, redis, r2] = await Promise.all([
        checkPostgreSQL(),
        checkRedis(),
        checkR2(),
      ]);

      const postgresqlReady = postgresql.status === 'up';
      const redisReady = redis.status === 'up';
      const r2Ready = r2.status === 'up';
      const allReady = postgresqlReady && redisReady && r2Ready;

      logger.info(
        'Readiness probe completed - postgres: %s, redis: %s, r2: %s, all_ready: %s',
        postgresqlReady ? 'up' : 'down',
        redisReady ? 'up' : 'down',
        r2Ready ? 'up' : 'down',
        allReady
      );

      res.status(allReady ? 200 : 503).json({
        status: allReady ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        dependencies: {
          postgresql: postgresqlReady,
          redis: redisReady,
          r2: r2Ready,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Readiness probe failed: %s', errorMessage);

      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        dependencies: {
          postgresql: false,
          redis: false,
          r2: false,
        },
      });
    }
  }
}
