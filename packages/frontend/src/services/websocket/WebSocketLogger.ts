/**
 * WebSocket Logger
 *
 * Structured logging for WebSocket events with metrics emission:
 * - Connection lifecycle events
 * - Reconnection events
 * - Event processing metrics
 * - Heartbeat monitoring
 * - SLO tracking
 *
 * @module @yacc/frontend/services/websocket
 */

import type { MetricsSink, MetricsSinkTags } from '../observability/MetricsSink';
import { SLOMonitor, type SLOMetrics } from '../observability/SLOMonitor';

/** Log levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured log entry */
export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  service: string;
  event: string;
  userId?: string;
  socketId?: string;
  duration_ms?: number;
  tags?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
}

/** SLO Thresholds from GOV-006 */
const SLO_THRESHOLDS = {
  connectionSuccessRate: 0.99, // Alert at 99%
  eventLatencyP95: 100, // Alert at 100ms
  reconnectionSuccessRate: 0.90, // Alert at 90%
  backlogReplayDuration: 5000, // Alert at 5s
} as const;

/**
 * Logger for WebSocket events
 *
 * Emits structured JSON logs for all WebSocket operations.
 * Integrates with MetricsSink for observability and SLOMonitor for tracking.
 */
export class WebSocketLogger {
  private socketId: string | null = null;
  private userId: string | null = null;
  private sloMonitor: SLOMonitor;
  private metricsSink: MetricsSink | null;

  /**
   * Create a new WebSocket logger
   *
   * @param userId - Optional user ID for context
   * @param socketId - Optional socket ID for context
   * @param metricsSink - Optional metrics sink for observability
   */
  constructor(
    userId?: string,
    socketId?: string,
    metricsSink?: MetricsSink
  ) {
    this.userId = userId || null;
    this.socketId = socketId || null;
    this.metricsSink = metricsSink || null;
    this.sloMonitor = new SLOMonitor();
  }

  // ========================================================================
  // Lifecycle Events
  // ========================================================================

  /**
   * Log connection attempt
   */
  logConnectionAttempt(attemptNumber: number): void {
    const tags: MetricsSinkTags = { attempt_number: attemptNumber };
    this.metricsSink?.counter('ws.connection.attempt', 1, tags);

    this.sloMonitor.recordConnectionAttempt();

    this.log({
      level: 'info',
      event: 'connection.attempt',
      tags: { attempt_number: attemptNumber },
    });
  }

  /**
   * Log successful connection
   */
  logConnectionSuccess(durationMs: number): void {
    const tags: MetricsSinkTags = { duration_ms: durationMs };
    this.metricsSink?.counter('ws.connection.success', 1, tags);

    this.sloMonitor.recordConnectionSuccess();

    this.log({
      level: 'info',
      event: 'connection.success',
      duration_ms: durationMs,
    });

    this.checkSLOBreach();
  }

  /**
   * Log connection failure
   */
  logConnectionFailure(error: Error, attemptNumber: number): void {
    const tags: MetricsSinkTags = {
      error_type: error.name,
      error_message: error.message,
      attempt_number: attemptNumber,
    };
    this.metricsSink?.counter('ws.connection.failure', 1, tags);

    this.sloMonitor.recordConnectionFailure();

    this.log({
      level: 'error',
      event: 'connection.failure',
      error: {
        code: error.name,
        message: error.message,
      },
      tags: { attempt_number: attemptNumber },
    });

    this.checkSLOBreach();
  }

  /**
   * Log disconnection
   */
  logDisconnect(): void {
    this.log({
      level: 'info',
      event: 'connection.disconnect',
    });
  }

  // ========================================================================
  // Reconnection Events
  // ========================================================================

  /**
   * Log reconnection attempt
   */
  logReconnectionAttempt(attemptNumber: number, backoffDelayMs: number): void {
    const tags: MetricsSinkTags = {
      attempt_number: attemptNumber,
      backoff_delay_ms: backoffDelayMs,
    };
    this.metricsSink?.counter('ws.reconnection.attempt', 1, tags);

    this.sloMonitor.recordReconnectionAttempt();

    this.log({
      level: 'info',
      event: 'reconnection.attempt',
      tags: {
        attempt_number: attemptNumber,
        backoff_delay_ms: backoffDelayMs,
      },
    });
  }

  /**
   * Log successful reconnection
   */
  logReconnectionSuccess(attemptNumber: number): void {
    const tags: MetricsSinkTags = { attempt_number: attemptNumber };
    this.metricsSink?.counter('ws.reconnection.success', 1, tags);

    this.sloMonitor.recordReconnectionSuccess();

    this.log({
      level: 'info',
      event: 'reconnection.success',
      tags: { attempt_number: attemptNumber },
    });

    this.checkSLOBreach();
  }

  /**
   * Log failed reconnection
   */
  logReconnectionFailed(): void {
    this.log({
      level: 'error',
      event: 'reconnection.failed',
    });
  }

  // ========================================================================
  // Event Processing
  // ========================================================================

  /**
   * Log event received from server
   */
  logEventReceived(eventType: string, payloadSize: number): void {
    const tags: MetricsSinkTags = {
      event_type: eventType,
      payload_size_bytes: payloadSize,
    };
    this.metricsSink?.counter('ws.event.received', 1, tags);

    this.log({
      level: 'debug',
      event: 'event.received',
      tags: {
        event_type: eventType,
        payload_size_bytes: payloadSize,
      },
    });
  }

  /**
   * Log event processed
   */
  logEventProcessed(
    eventType: string,
    durationMs: number,
    handlerCount: number
  ): void {
    const tags: MetricsSinkTags = {
      event_type: eventType,
      handler_count: handlerCount,
      duration_ms: durationMs,
    };
    this.metricsSink?.histogram('ws.event.processed', durationMs, tags);

    this.sloMonitor.recordEventLatency(durationMs);

    this.log({
      level: 'debug',
      event: 'event.processed',
      duration_ms: durationMs,
      tags: {
        event_type: eventType,
        handler_count: handlerCount,
      },
    });

    this.checkSLOBreach();
  }

  /**
   * Log event processing error
   */
  logEventError(eventType: string, error: Error): void {
    const tags: MetricsSinkTags = {
      event_type: eventType,
      error_type: error.name,
    };
    this.metricsSink?.counter('ws.event.error', 1, tags);

    this.log({
      level: 'error',
      event: 'event.error',
      tags: { event_type: eventType },
      error: {
        code: error.name,
        message: error.message,
      },
    });
  }

  // ========================================================================
  // Backlog Events
  // ========================================================================

  /**
   * Log backlog replay
   */
  logBacklogReplayed(eventCount: number, durationMs: number): void {
    const tags: MetricsSinkTags = {
      backlog_size: eventCount,
      replay_duration_ms: durationMs,
    };
    this.metricsSink?.counter('ws.backlog.replay', 1, tags);

    this.sloMonitor.recordBacklogReplay(eventCount, durationMs);

    this.log({
      level: 'info',
      event: 'backlog.replay',
      duration_ms: durationMs,
      tags: { backlog_size: eventCount },
    });

    // Alert if backlog replay exceeds 5s
    if (durationMs > SLO_THRESHOLDS.backlogReplayDuration) {
      console.warn(
        `[SLO] Backlog replay took ${durationMs}ms for ${eventCount} events (target: <${SLO_THRESHOLDS.backlogReplayDuration}ms)`
      );
    }
  }

  // ========================================================================
  // Heartbeat Events
  // ========================================================================

  /**
   * Log missed heartbeat
   */
  logHeartbeatMissed(timeSinceLastMs: number): void {
    this.log({
      level: 'warn',
      event: 'heartbeat.missed',
      tags: { time_since_last_ms: timeSinceLastMs },
    });
  }

  // ========================================================================
  // SLO Monitoring
  // ========================================================================

  /**
   * Get current SLO metrics
   *
   * @returns Current SLO metrics snapshot
   */
  getSLOMetrics(): SLOMetrics {
    return this.sloMonitor.getMetrics();
  }

  /**
   * Check for SLO breaches and emit warnings
   */
  private checkSLOBreach(): void {
    const metrics = this.sloMonitor.getMetrics();

    // Connection success rate check
    if (metrics.connectionSuccessRate < SLO_THRESHOLDS.connectionSuccessRate) {
      console.warn(
        `[SLO] Connection success rate ${(metrics.connectionSuccessRate * 100).toFixed(2)}% below threshold (${SLO_THRESHOLDS.connectionSuccessRate * 100}%)`
      );
    }

    // Event latency P95 check
    if (metrics.eventLatencyP95 > SLO_THRESHOLDS.eventLatencyP95) {
      console.warn(
        `[SLO] Event latency P95 ${metrics.eventLatencyP95.toFixed(0)}ms above threshold (${SLO_THRESHOLDS.eventLatencyP95}ms)`
      );
    }

    // Reconnection success rate check
    if (metrics.reconnectionSuccessRate < SLO_THRESHOLDS.reconnectionSuccessRate) {
      console.warn(
        `[SLO] Reconnection success rate ${(metrics.reconnectionSuccessRate * 100).toFixed(2)}% below threshold (${SLO_THRESHOLDS.reconnectionSuccessRate * 100}%)`
      );
    }
  }

  // ========================================================================
  // Context Management
  // ========================================================================

  /**
   * Set user ID for logging context
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Set socket ID for logging context
   */
  setSocketId(socketId: string): void {
    this.socketId = socketId;
  }

  /**
   * Get current socket ID
   */
  getSocketId(): string | null {
    return this.socketId;
  }

  /**
   * Get SLO monitor instance (for testing)
   */
  getSLOMonitor(): SLOMonitor {
    return this.sloMonitor;
  }

  /**
   * Destroy the logger and clean up resources
   */
  destroy(): void {
    this.sloMonitor.destroy();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Emit structured log
   *
   * In production, this would send to a logging service.
   * Currently logs to console as JSON.
   */
  private log(event: Partial<StructuredLog>): void {
    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level: event.level || 'info',
      service: 'websocket',
      event: event.event || 'unknown',
      userId: this.userId || undefined,
      socketId: this.socketId || undefined,
      ...event,
    };

    // Remove undefined values
    const cleanLog = Object.fromEntries(
      Object.entries(log).filter(([, v]) => v !== undefined)
    );

    // Log as JSON (structured logging)
    // In production, this would go to a logging service
    console.log(JSON.stringify(cleanLog));
  }
}
