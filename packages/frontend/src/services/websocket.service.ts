/**
 * WebSocket Service
 *
 * High-level WebSocket wrapper that:
 * - Manages Socket.io connection lifecycle
 * - Synchronizes connection state with Zustand store
 * - Provides type-safe event emission and listening
 * - Handles authentication token updates
 * - Manages reconnection attempts
 *
 * This service acts as a bridge between the low-level Socket.io client
 * and the Zustand store, ensuring state consistency across the app.
 */

import { socketClient } from '../lib/socket';
import { useWebSocketStore } from '../stores/websocket.store';
import type { ConnectionState } from '../types/websocket.types';
import { logger } from '../lib/logger';

class WebSocketService {
  private initialized = false;
  private stateMonitorInterval: number | null = null;

  /**
   * Initialize the WebSocket service
   * Sets up event listeners to sync with Zustand store
   * Must be called once, typically in App.tsx useEffect
   */
  initialize(): void {
    if (this.initialized) {
      logger.warn('[WebSocketService] Already initialized, skipping');
      return;
    }

    logger.info('[WebSocketService] Initializing');

    this.setupConnectionStateMonitoring();
    this.setupEventListeners();

    this.initialized = true;
  }

  /**
   * Connect to WebSocket server
   * Called after authentication is successful
   */
  connect(): void {
    if (!this.initialized) {
      logger.warn('[WebSocketService] Not initialized yet, initializing first');
      this.initialize();
    }

    logger.info('[WebSocketService] Connecting');
    const store = useWebSocketStore.getState();
    store.setConnectionState('connecting');

    try {
      socketClient.connect();
    } catch (error) {
      logger.error('[WebSocketService] Connect error', error);
      store.setConnectionState('error');
      if (error instanceof Error) {
        store.setLastErrorMessage(error.message);
      }
    }
  }

  /**
   * Disconnect from WebSocket server
   * Called on logout
   */
  disconnect(): void {
    logger.info('[WebSocketService] Disconnecting');
    const store = useWebSocketStore.getState();
    store.setConnectionState('disconnected');

    try {
      socketClient.disconnect();
    } catch (error) {
      logger.error('[WebSocketService] Disconnect error', error);
    }
  }

  /**
   * Update authentication token
   * Called when token is refreshed
   */
  updateAuthToken(token: string): void {
    logger.info('[WebSocketService] Updating auth token');
    socketClient.updateAuthToken(token);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return socketClient.isConnected();
  }

  /**
   * Emit event to server
   */
  emit<T = any>(event: string, data?: T): void {
    try {
      socketClient.emit(event, data);
    } catch (error) {
      logger.error('[WebSocketService] Emit error', { event, error });
      throw error;
    }
  }

  /**
   * Register event listener
   * Automatically unregisters on component unmount (must be managed by caller)
   */
  on(event: string, listener: (...args: any[]) => void): void {
    socketClient.on(event, listener);
  }

  /**
   * Unregister event listener
   */
  off(event: string, listener?: (...args: any[]) => void): void {
    socketClient.off(event, listener);
  }

  /**
   * Set up periodic connection state monitoring
   * Syncs Socket.io client state with Zustand store
   */
  private setupConnectionStateMonitoring(): void {
    // Update store every 2 seconds to reflect true connection state
    this.stateMonitorInterval = window.setInterval(() => {
      const state = socketClient.getState();
      const store = useWebSocketStore.getState();

      // Map socket state to our ConnectionState type
      let connectionState: ConnectionState;
      switch (state) {
        case 'connected':
          connectionState = 'connected';
          break;
        case 'connecting':
          connectionState = 'connecting';
          break;
        case 'reconnecting':
          connectionState = 'reconnecting';
          break;
        case 'error':
          connectionState = 'error';
          break;
        case 'disconnected':
        default:
          connectionState = 'disconnected';
          break;
      }

      // Only update if state changed
      if (store.connectionState !== connectionState) {
        store.setConnectionState(connectionState);
        if (connectionState === 'connected') {
          store.setLastConnectTime(new Date().toISOString());
        }
      }
    }, 2000);
  }

  /**
   * Set up built-in Socket.io event listeners
   * These handle the connection lifecycle
   */
  private setupEventListeners(): void {
    const store = useWebSocketStore.getState();

    // Connection established
    socketClient.on('connect', () => {
      logger.info('[WebSocketService] Socket connected');
      store.setConnectionState('connected');
      store.setLastConnectTime(new Date().toISOString());
      store.setReconnectAttempts(0);
    });

    // Connection error
    socketClient.on('connect_error', (error: Error) => {
      logger.error('[WebSocketService] Connection error', error);
      store.setConnectionState('error');
      store.setLastErrorMessage(error?.message || 'Connection error');
    });

    // Disconnected
    socketClient.on('disconnect', (reason: string) => {
      logger.warn('[WebSocketService] Disconnected', { reason });
      const attempts = store.reconnectAttempts;
      if (attempts < store.maxReconnectAttempts) {
        store.setConnectionState('reconnecting');
      } else {
        store.setConnectionState('disconnected');
      }
    });

    // Reconnection attempt
    socketClient.on('reconnect_attempt', (attemptNumber: number) => {
      logger.info('[WebSocketService] Reconnect attempt', { attemptNumber });
      store.setConnectionState('reconnecting');
      store.setReconnectAttempts(attemptNumber);
    });

    // Reconnection failed
    socketClient.on('reconnect_failed', (error: Error) => {
      logger.error('[WebSocketService] Reconnect failed', error);
      store.setConnectionState('disconnected');
      store.setLastErrorMessage('Failed to reconnect after max attempts');
    });

    // Generic error
    socketClient.on('error', (error: Error) => {
      logger.error('[WebSocketService] Socket error', error);
      store.setLastErrorMessage(error?.message || 'Socket error');
    });
  }

  /**
   * Cleanup on unmount
   */
  destroy(): void {
    logger.info('[WebSocketService] Destroying');
    if (this.stateMonitorInterval !== null) {
      clearInterval(this.stateMonitorInterval);
      this.stateMonitorInterval = null;
    }
    this.initialized = false;
  }
}

/**
 * Singleton WebSocket service instance
 */
export const webSocketService = new WebSocketService();
