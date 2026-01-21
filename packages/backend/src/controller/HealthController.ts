/**
 * Health Check Controller
 *
 * Provides health check endpoints for monitoring and Kubernetes probes
 * Checks PostgreSQL, Redis, and R2 connectivity
 */

import { checkDatabaseConnection } from '../infrastructure/db/client';
import { checkRedisHealth } from '../infrastructure/redis';
import { checkR2Health, isR2Configured } from '../infrastructure/r2';
import logger from '../utils/logger';

// ============================================
// Health Status Types
// ============================================

/**
 * Overall health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Dependency health status
 */
interface DependencyHealth {
  name: string;
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

/**
 * Service-Level Objective (SLO) thresholds
 */
interface HealthSLO {
  maxLatencyMs: number;
  errorThresholdPercent: number;
}

// Default SLOs
const DEFAULT_SLO: HealthSLO = {
  maxLatencyMs: 1000, // 1 second max latency
  errorThresholdPercent: 5, // 5% error rate threshold
};

/**
 * Complete health response
 */
interface HealthResponse {
  status: HealthStatus;
  uptime: number;
  timestamp: string;
  dependencies: {
    postgresql: DependencyHealth;
    redis: DependencyHealth;
    r2: DependencyHealth;
  };
  slo?: {
    latencyMs: number;
    errorRatePercent: number;
    withinThreshold: boolean;
  };
}

/**
 * Liveness probe response (is process running)
 */
interface LivenessResponse {
  status: 'alive' | 'dead';
  timestamp: string;
}

/**
 * Readiness probe response (can handle traffic)
 */
interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  timestamp: string;
  dependencies: {
    postgresql: boolean;
    redis: boolean;
    r2: boolean;
  };
}

// ============================================
// Health Check Implementation
// ============================================

/**
 * Check PostgreSQL health
 */
async function checkPostgreSQL(): Promise<DependencyHealth> {
  const startTime = Date.now();

  try {
    const isHealthy = await checkDatabaseConnection();
    const latencyMs = Date.now() - startTime;

    if (isHealthy) {
      logger.debug('PostgreSQL health check passed', { latencyMs });

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
    logger.error('PostgreSQL health check failed', { error: errorMessage });

    return {
      name: 'postgresql',
      status: 'down',
      error: errorMessage,
    };
  }
}

/**
 * Check Redis health
 */
async function checkRedis(): Promise<DependencyHealth> {
  const startTime = Date.now();

  try {
    const isHealthy = await checkRedisHealth();
    const latencyMs = Date.now() - startTime;

    if (isHealthy) {
      logger.debug('Redis health check passed', { latencyMs });

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
    logger.error('Redis health check failed', { error: errorMessage });

    return {
      name: 'redis',
      status: 'down',
      error: errorMessage,
    };
  }
}

/**
 * Check R2 health
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

    const isHealthy = await checkR2Health();
    const latencyMs = Date.now() - startTime;

    if (isHealthy) {
      logger.debug('R2 health check passed', { latencyMs });

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
    logger.error('R2 health check failed', { error: errorMessage });

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
): HealthSLO['errorRatePercent' | 'latencyMs' | 'withinThreshold'] {
  const latencyMs = Math.max(...dependencies.map((d) => d.latencyMs || 0));
  const upCount = dependencies.filter((d) => d.status === 'up').length;
  const errorRatePercent = ((dependencies.length - upCount) / dependencies.length) * 100;

  const withinThreshold = latencyMs <= DEFAULT_SLO.maxLatencyMs &&
                        errorRatePercent <= DEFAULT_SLO.errorThresholdPercent;

  return {
    latencyMs,
    errorRatePercent,
    withinThreshold,
  };
}

// ============================================
// Endpoints
// ============================================

/**
 * GET /health - Complete health check with dependencies and SLOs
 */
export async function getHealth(): Promise<HealthResponse> {
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

    logger.info('Health check completed', {
      status,
      postgresql: postgresql.status,
      redis: redis.status,
      r2: r2.status,
      slo,
    });

    return {
      status,
      uptime,
      timestamp: new Date().toISOString(),
      dependencies: {
        postgresql,
        redis,
        r2,
      },
      slo,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Health check failed', { error: errorMessage });

    // Return unhealthy status on error
    return {
      status: 'unhealthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: {
        postgresql: { name: 'postgresql', status: 'down', error: errorMessage },
        redis: { name: 'redis', status: 'down', error: errorMessage },
        r2: { name: 'r2', status: 'down', error: errorMessage },
      },
    };
  }
}

/**
 * GET /health/live - Liveness probe (is process running)
 */
export async function getLiveness(): Promise<LivenessResponse> {
  // Simple liveness check - just returns alive if process is running
  // Kubernetes will restart pod if this returns non-200

  logger.debug('Liveness probe');

  return {
    status: 'alive',
    timestamp: new Date().toISOString(),
  };
}

/**
 * GET /health/ready - Readiness probe (can handle traffic)
 */
export async function getReadiness(): Promise<ReadinessResponse> {
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

    logger.info('Readiness probe completed', {
      postgresql: postgresqlReady ? 'up' : 'down',
      redis: redisReady ? 'up' : 'down',
      r2: r2Ready ? 'up' : 'down',
      allReady,
    });

    return {
      status: allReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      dependencies: {
        postgresql: postgresqlReady,
        redis: redisReady,
        r2: r2Ready,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Readiness probe failed', { error: errorMessage });

    return {
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      dependencies: {
        postgresql: false,
        redis: false,
        r2: false,
      },
    };
  }
}

// ============================================
// Export
// ============================================

export type { HealthStatus, HealthResponse, LivenessResponse, ReadinessResponse };
export { getHealth, getLiveness, getReadiness };
