/**
 * Health Response Types
 * Response shapes for health check endpoints
 */

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface DependencyHealth {
  name: string;
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

export interface HealthSLO {
  latencyMs: number;
  errorRatePercent: number;
  withinThreshold: boolean;
}

export interface HealthResponse {
  status: HealthStatus;
  uptime: number;
  timestamp: string;
  dependencies: {
    postgresql: DependencyHealth;
    redis: DependencyHealth;
    r2: DependencyHealth;
  };
  slo?: HealthSLO;
}

export interface LivenessResponse {
  status: 'alive' | 'dead';
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  timestamp: string;
  dependencies: {
    postgresql: boolean;
    redis: boolean;
    r2: boolean;
  };
}
