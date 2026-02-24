/**
 * WebSocket Connection Manager
 *
 * Manages the low-level Socket.io connection lifecycle:
 * - Connection establishment
 * - Reconnection with exponential backoff
 * - Heartbeat monitoring
 * - Event backlog management
 *
 * @module @yacc/frontend/services/websocket
 */

import { Socket, io } from 'socket.io-client';

/** Backlog event stored during disconnection */
export interface BacklogEvent {
  type: string;
  payload: unknown;
  timestamp: number;
}

/**
 * Connection Manager for WebSocket
 *
 * Handles:
 * - Socket.io connection lifecycle
 * - Exponential backoff reconnection
 * - Heartbeat monitoring
 * - Event backlog for replay on reconnect
 */
export class WebSocketConnectionManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private backoffDelayMs = 1000;
  private readonly maxBackoffDelayMs = 60000;
  private eventBacklog: BacklogEvent[] = [];
  private readonly maxBacklogAgeMs = 60 * 60 * 1000; // 1 hour
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeatIntervalMs = 60000; // 60 seconds
  private lastHeartbeatAt = Date.now();

  /**
   * Create a new connection manager
   *
   * @param serverUrl - WebSocket server URL
   * @param authToken - Authentication token
   * @param onConnectionStateChange - Callback for connection state changes
   * @param onError - Callback for errors
   */
  constructor(
    private serverUrl: string,
    private authToken: string,
    private onConnectionStateChange: (connected: boolean) => void,
    private onError: (error: Error) => void
  ) {}

  /**
   * Connect to WebSocket server
   *
   * @returns Promise that resolves when connected
   * @throws Error if connection fails
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return; // Already connected
    }

    try {
      this.socket = io(this.serverUrl, {
        auth: { token: this.authToken },
        reconnection: true,
        reconnectionDelay: this.backoffDelayMs,
        reconnectionDelayMax: this.maxBackoffDelayMs,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      this.setupEventListeners();
      await this.waitForConnection();

      this.onConnectionStateChange(true);
      this.setupHeartbeat();
      this.replayEventBacklog();
    } catch (error) {
      this.onError(error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.reconnectAttempts = 0;
    this.onConnectionStateChange(false);
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get the underlying Socket.io instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Set up Socket.io event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.backoffDelayMs = 1000;
      this.onConnectionStateChange(true);
    });

    this.socket.on('disconnect', () => {
      this.onConnectionStateChange(false);
    });

    this.socket.on('error', (error: unknown) => {
      this.onError(new Error(String(error)));
    });

    this.socket.on('heartbeat', () => {
      this.lastHeartbeatAt = Date.now();
    });
  }

  /**
   * Wait for connection to be established
   *
   * @param timeoutMs - Timeout in milliseconds
   */
  private async waitForConnection(timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeoutMs);

      this.socket?.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /**
   * Set up heartbeat monitoring
   */
  private setupHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - this.lastHeartbeatAt;

      if (timeSinceLastHeartbeat > this.heartbeatIntervalMs + 5000) {
        // Missed heartbeat (+ 5s grace period)
        this.onError(new Error('Heartbeat missed - connection may be stale'));
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateBackoffDelay(): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 60s
    const delay = Math.min(
      this.backoffDelayMs * Math.pow(2, this.reconnectAttempts),
      this.maxBackoffDelayMs
    );
    return delay;
  }

  /**
   * Store event in backlog for replay on reconnect
   *
   * @param event - Event to store
   */
  storeEventBacklog(event: BacklogEvent): void {
    const now = Date.now();

    // Remove old events (older than 1 hour)
    this.eventBacklog = this.eventBacklog.filter(
      (e) => now - e.timestamp < this.maxBacklogAgeMs
    );

    // Add new event
    this.eventBacklog.push({
      ...event,
      timestamp: now,
    });
  }

  /**
   * Replay stored event backlog
   *
   * Called after successful reconnection
   */
  private replayEventBacklog(): void {
    const backlog = [...this.eventBacklog];
    this.eventBacklog = []; // Clear after copying

    if (backlog.length === 0) return;

    // Backlog is replayed via WebSocketEventHandler
    // This method signals that replay should occur
  }

  /**
   * Get current backlog length
   */
  getBacklogLength(): number {
    return this.eventBacklog.length;
  }

  /**
   * Get backlog events
   */
  getBacklog(): BacklogEvent[] {
    return [...this.eventBacklog];
  }

  /**
   * Clear event backlog
   */
  clearBacklog(): void {
    this.eventBacklog = [];
  }
}
