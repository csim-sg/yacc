/**
 * WebSocket Logger
 *
 * Structured logging for WebSocket events:
 * - Connection lifecycle events
 * - Reconnection events
 * - Event processing metrics
 * - Heartbeat monitoring
 *
 * @module @yacc/frontend/services/websocket
 */

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

/**
 * Logger for WebSocket events
 *
 * Emits structured JSON logs for all WebSocket operations.
 * Can be extended to send logs to external services.
 */
export class WebSocketLogger {
  private socketId: string | null = null;
  private userId: string | null = null;

  /**
   * Create a new WebSocket logger
   *
   * @param userId - Optional user ID for context
   * @param socketId - Optional socket ID for context
   */
  constructor(userId?: string, socketId?: string) {
    this.userId = userId || null;
    this.socketId = socketId || null;
  }

  // ========================================================================
  // Lifecycle Events
  // ========================================================================

  /**
   * Log connection attempt
   */
  logConnectionAttempt(attemptNumber: number): void {
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
    this.log({
      level: 'info',
      event: 'connection.success',
      duration_ms: durationMs,
    });
  }

  /**
   * Log connection failure
   */
  logConnectionFailure(error: Error, attemptNumber: number): void {
    this.log({
      level: 'error',
      event: 'connection.failure',
      error: {
        code: error.name,
        message: error.message,
      },
      tags: { attempt_number: attemptNumber },
    });
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
    this.log({
      level: 'info',
      event: 'reconnection.success',
      tags: { attempt_number: attemptNumber },
    });
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
    this.log({
      level: 'debug',
      event: 'event.processed',
      duration_ms: durationMs,
      tags: {
        event_type: eventType,
        handler_count: handlerCount,
      },
    });
  }

  /**
   * Log event processing error
   */
  logEventError(eventType: string, error: Error): void {
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
    this.log({
      level: 'info',
      event: 'backlog.replay',
      duration_ms: durationMs,
      tags: { backlog_size: eventCount },
    });
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
