/**
 * WebSocket Client
 *
 * High-level WebSocket client that combines:
 * - ConnectionManager for lifecycle
 * - EventHandler for pub/sub
 * - Logger for observability
 *
 * @module @yacc/frontend/services/websocket
 */

import { WebSocketConnectionManager } from './WebSocketConnectionManager';
import { WebSocketEventHandler, type EventCallback } from './WebSocketEventHandler';
import { WebSocketLogger } from './WebSocketLogger';

/**
 * WebSocket Client
 *
 * Main entry point for WebSocket operations.
 * Provides a clean API for connecting, subscribing, and emitting events.
 */
export class WebSocketClient {
  private connectionManager: WebSocketConnectionManager;
  private eventHandler: WebSocketEventHandler;
  private logger: WebSocketLogger;

  /**
   * Create a new WebSocket client
   *
   * @param serverUrl - WebSocket server URL
   * @param authToken - Authentication token
   * @param userId - Optional user ID for logging
   */
  constructor(serverUrl: string, authToken: string, userId?: string) {
    this.logger = new WebSocketLogger(userId);

    this.connectionManager = new WebSocketConnectionManager(
      serverUrl,
      authToken,
      (connected) => this.onConnectionStateChange(connected),
      (error) => this.onError(error)
    );

    this.eventHandler = new WebSocketEventHandler();
  }

  // ========================================================================
  // Connection Lifecycle
  // ========================================================================

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    this.logger.logConnectionAttempt(1);
    const startTime = Date.now();

    try {
      await this.connectionManager.connect();
      const duration = Date.now() - startTime;
      this.logger.logConnectionSuccess(duration);

      // Set socket ID in logger
      const socket = this.connectionManager.getSocket();
      if (socket?.id) {
        this.logger.setSocketId(socket.id);
      }

      // Setup event listeners after connection
      this.setupSocketListeners();
    } catch (error) {
      this.logger.logConnectionFailure(error as Error, 1);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.connectionManager.disconnect();
    this.logger.logDisconnect();
    this.eventHandler.unsubscribeAll();
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  // ========================================================================
  // Event Subscription API
  // ========================================================================

  /**
   * Subscribe to an event type
   *
   * @param eventType - Event type to subscribe to
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  subscribe<T = unknown>(
    eventType: string,
    callback: EventCallback<T>
  ): () => void {
    return this.eventHandler.subscribe(eventType, callback);
  }

  /**
   * Unsubscribe from an event type
   *
   * @param eventType - Event type
   * @param callback - Callback to remove
   */
  unsubscribe(eventType: string, callback: EventCallback): void {
    this.eventHandler.unsubscribe(eventType, callback);
  }

  /**
   * Unsubscribe all handlers
   *
   * @param eventType - Optional event type (clears all if not provided)
   */
  unsubscribeAll(eventType?: string): void {
    this.eventHandler.unsubscribeAll(eventType);
  }

  // ========================================================================
  // Emission API
  // ========================================================================

  /**
   * Emit an event to the server
   *
   * @param eventType - Event type
   * @param payload - Event payload
   */
  emit(eventType: string, payload: unknown): void {
    const socket = this.connectionManager.getSocket();
    if (!socket || !this.isConnected()) {
      this.logger.logEventError(eventType, new Error('Not connected'));
      return;
    }

    socket.emit(eventType, payload);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Setup socket event listeners
   *
   * Forwards all socket events to the event handler
   */
  private setupSocketListeners(): void {
    const socket = this.connectionManager.getSocket();
    if (!socket) return;

    // Listen to all events and forward to event handler
    socket.onAny((eventType: string, payload: unknown) => {
      const payloadSize = JSON.stringify(payload).length;
      this.logger.logEventReceived(eventType, payloadSize);

      const startTime = Date.now();
      this.eventHandler.emit(eventType, payload);
      const duration = Date.now() - startTime;

      const handlerCount = this.eventHandler.getSubscriberCount(eventType);
      this.logger.logEventProcessed(eventType, duration, handlerCount);

      // Store in backlog for reconnection
      this.connectionManager.storeEventBacklog({
        type: eventType,
        payload,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Handle connection state changes
   */
  private onConnectionStateChange(connected: boolean): void {
    if (connected) {
      const socket = this.connectionManager.getSocket();
      if (socket?.id) {
        this.logger.setSocketId(socket.id);
      }
    }

    // Emit connection state change event
    this.eventHandler.emit('system.connection.state', { connected });
  }

  /**
   * Handle errors
   */
  private onError(error: Error): void {
    this.logger.logEventError('websocket', error);
    this.eventHandler.emit('system.error', { error: error.message });
  }

  // ========================================================================
  // Context Management
  // ========================================================================

  /**
   * Set user ID for logging context
   */
  setUserId(userId: string): void {
    this.logger.setUserId(userId);
  }

  /**
   * Get current connection manager (for advanced use)
   */
  getConnectionManager(): WebSocketConnectionManager {
    return this.connectionManager;
  }

  /**
   * Get current event handler (for advanced use)
   */
  getEventHandler(): WebSocketEventHandler {
    return this.eventHandler;
  }

  /**
   * Get current logger (for advanced use)
   */
  getLogger(): WebSocketLogger {
    return this.logger;
  }
}

/**
 * Factory function to create WebSocket client
 *
 * @param serverUrl - WebSocket server URL
 * @param authToken - Authentication token
 * @param userId - Optional user ID
 * @returns WebSocketClient instance
 */
export const createWebSocketClient = (
  serverUrl: string,
  authToken: string,
  userId?: string
): WebSocketClient => new WebSocketClient(serverUrl, authToken, userId);
