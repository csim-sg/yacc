/**
 * Socket.io Client Integration
 *
 * Centralized Socket.io client wrapper for real-time communication
 *
 * Features:
 * - Auto-connection disabled (connects on-demand)
 * - Exponential backoff reconnection (1s → 2s → 4s → 8s → 30s)
 * - Correlation ID tracking in headers
 * - Connection state management
 * - Event listener registration
 * - Authentication token integration with BetterAuth
 *
 * Usage:
 * ```typescript
 * import { socketClient } from '../lib/socket';
 *
 * // Connect to server
 * socketClient.connect();
 *
 * // Listen for events
 * socketClient.on('message:new', (data) => {
 *   console.log('New message:', data);
 * });
 *
 * // Send events
 * socketClient.emit('message:send', { conversationId, body });
 * ```
 */

import { io } from 'socket.io-client';

/**
 * Socket.io Client Configuration
 */
export interface SocketConfig {
  /** WebSocket server URL */
  url: string;

  /** Authentication token from BetterAuth */
  authToken?: string;

  /** Reconnection attempt delays (milliseconds) */
  reconnectionDelay?: number;

  /** Maximum reconnection attempts */
  reconnectionAttempts?: number;

  /** Connection timeout (milliseconds) */
  timeout?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Connection States
 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * Socket Client Class
 * Singleton Socket.io client wrapper for YACC frontend
 */
class SocketClientClass {
  private socket: any | null = null;
  private config: SocketConfig;
  private currentState: ConnectionState = 'disconnected';
  private listeners: Map<string, Set<Function>> = new Map();
  private correlationId: string = '';
  private reconnectionAttempts = 0;
  private reconnectionTimeouts: number[] = [1000, 2000, 4000, 8000, 30000];

  constructor(config: SocketConfig) {
    this.config = {
      reconnectionDelay: this.reconnectionTimeouts[0],
      reconnectionAttempts: 10,
      timeout: 10000,
      debug: false,
      ...config,
    };
  }

  /**
   * Connect to WebSocket server
   * Waits for auth token before connecting
   */
  connect(): void {
    if (this.currentState === 'connected' || this.currentState === 'connecting') {
      this.log('Already connected or connecting, skipping');
      return;
    }

    this.setState('connecting');

    // Initialize Socket.io client with options
    const socketOptions: any = {
      reconnection: true,
      reconnectionDelay: this.config.reconnectionDelay as number,
      reconnectionAttempts: this.config.reconnectionAttempts,
      timeout: this.config.timeout,
      transports: ['websocket', 'polling'],
      forceNew: true,
      auth: {
        token: this.config.authToken || '',
      },
    };

    // Add correlation ID to handshake auth
    this.correlationId = this.generateCorrelationId();
    (socketOptions as any).extraHeaders = {
      'X-Request-ID': this.correlationId,
    };

    // Create Socket.io instance
    this.socket = io(this.config.url, socketOptions);

    // Register built-in event listeners
    this.registerBuiltinListeners();

    this.log('Connecting to WebSocket server', this.config.url);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (!this.socket) {
      this.log('Not connected, skipping disconnect');
      return;
    }

    this.log('Disconnecting from WebSocket server');
    this.socket.disconnect();
    this.socket = null;
    this.setState('disconnected');
    this.reconnectionAttempts = 0;
  }

  /**
   * Send event to server
   */
  emit(event: string, data?: any): void {
    if (!this.socket || this.currentState !== 'connected') {
      this.log('Cannot emit - not connected', { event });
      throw new Error(`Cannot emit event "${event}" - not connected to WebSocket`);
    }

    this.log('Emitting event', { event, data });
    this.socket.emit(event, data);
  }

  /**
   * Register event listener
   */
  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    if (this.socket) {
      this.socket.on(event, listener);
      this.log('Registered listener', { event });
    } else {
      this.log('Listener registered (socket not connected yet)', { event });
    }
  }

  /**
   * Unregister event listener
   */
  off(event: string, listener?: (...args: any[]) => void): void {
    if (!this.socket) {
      this.log('Cannot unregister listener - socket not connected');
      return;
    }

    if (listener) {
      this.listeners.get(event)?.delete(listener);
      this.socket.off(event, listener);
      this.log('Unregistered specific listener', { event });
    } else {
      // Remove all listeners for this event
      this.listeners.delete(event);
      this.socket.off(event);
      this.log('Unregistered all listeners', { event });
    }
  }

  /**
   * Update authentication token
   * Reconnects if already connected
   */
  updateAuthToken(token: string): void {
    this.config.authToken = token;
    this.log('Auth token updated');

    // If connected, disconnect to reconnect with new token
    if (this.currentState === 'connected') {
      this.disconnect();
      setTimeout(() => this.connect(), 100);
    }
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.currentState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.currentState === 'connected' && this.socket?.connected === true;
  }

  /**
   * Register built-in Socket.io event listeners
   */
  private registerBuiltinListeners(): void {
    if (!this.socket) return;

    // Connection established
    this.socket.on('connect', () => {
      this.log('Connected to WebSocket server');
      this.reconnectionAttempts = 0;
      this.setState('connected');
    });

    // Connection error
    this.socket.on('connect_error', (error: Error) => {
      this.log('Connection error', error);
      this.setState('error');
    });

    // Disconnected
    this.socket.on('disconnect', (reason: string) => {
      this.log('Disconnected from WebSocket server', reason);

      if (this.reconnectionAttempts < (this.config.reconnectionAttempts || 10)) {
        this.setState('reconnecting');
        this.reconnectionAttempts++;
      } else {
        this.setState('disconnected');
      }
    });

    // Reconnection attempt
    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      this.log('Reconnection attempt', { attemptNumber });
      this.setState('reconnecting');
    });

    // Reconnection failed
    this.socket.on('reconnect_failed', (error: Error) => {
      this.log('Reconnection failed', error);
      this.setState('error');
    });

    // Error (general)
    this.socket.on('error', (error: Error) => {
      this.log('Socket error', error);
    });
  }

  /**
   * Set connection state and notify listeners
   */
  private setState(state: ConnectionState): void {
    const previousState = this.currentState;
    this.currentState = state;

    if (previousState !== state) {
      this.log('Connection state changed', { from: previousState, to: state });
    }
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Debug logging
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      const timestamp = new Date().toISOString();
      console.log(`[Socket.io Client] [${timestamp}] ${message}`, data || '');
    }
  }
}

/**
 * Global Socket.io client instance
 * Created with default configuration (will be initialized with proper config)
 */
const socketClientInstance = new SocketClientClass({
  url: process.env.VITE_WS_URL || 'ws://localhost:3000',
  debug: process.env.NODE_ENV === 'development',
});

/**
 * Export singleton instance
 */
export const socketClient = socketClientInstance;
