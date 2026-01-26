/**
 * useSocket Hook
 *
 * React hook for Socket.io client integration
 * Provides Socket.io client connection state and event handling
 *
 * Features:
 * - Connection state management (disconnected/connecting/connected)
 * - Error state tracking
 * - Connect/disconnect methods
 * - Event emission
 * - Automatic cleanup on unmount
 *
 * Usage:
 * ```typescript
 * import { useSocket } from '../hooks/useSocket';
 *
 * function MyComponent() {
 *   const { isConnected, error, connect, disconnect, emit, on } = useSocket();
 *
 *   return (
 *     <div>
 *       {isConnected ? 'Connected' : 'Disconnected'}
 *       {error && <div className="error">{error}</div>}
 *       <button onClick={connect}>Connect</button>
 *       <button onClick={disconnect}>Disconnect</button>
 *       <button onClick={() => emit('message:send', { body: 'Hello' })}>
 *         Send Message
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { socketClient } from '../lib/socket';

/**
 * Hook return type
 */
export interface UseSocketReturn {
  /** Connection state */
  isConnected: boolean;

  /** Connection error if any */
  error: string | null;

  /** Connect to WebSocket server */
  connect: () => void;

  /** Disconnect from WebSocket server */
  disconnect: () => void;

  /** Emit event to server */
  emit: (event: string, data?: any) => void;

  /** Register event listener */
  on: (event: string, listener: (...args: any[]) => void;
}

/**
 * useSocket Hook
 *
 * Manages Socket.io client connection and provides methods to interact with it
 *
 * @returns UseSocketReturn object with socket methods and state
 */
export function useSocket(): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connect to WebSocket server
  const connect = useCallback(() => {
    setError(null);
    try {
      socketClient.connect();
    } catch (err) {
      console.error('[useSocket] Connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, []);

  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    try {
      socketClient.disconnect();
    } catch (err) {
      console.error('[useSocket] Disconnect error:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }, []);

  // Emit event to server
  const emit = useCallback((
    event: string,
    data?: any
  ) => {
    setError(null);
    try {
      socketClient.emit(event, data);
    } catch (err) {
      console.error('[useSocket] Emit error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send event');
    }
  }, []);

  // Register event listener
  const on = useCallback((
    event: string,
    listener: (...args: any[]) => void
  ) => {
    if (typeof event !== 'string') {
      console.error('[useSocket] Event name must be a string:', event);
      return;
    }

    try {
      socketClient.on(event, listener);
    } catch (err) {
      console.error('[useSocket] Register listener error:', err);
      setError(err instanceof Error ? err.message : 'Failed to register listener');
    }
  }, []);

  // Listen for connection state changes
  useEffect(() => {
    socketClient.on('connection:state', (data: any) => {
      setIsConnected(data.state === 'connected');
      setError(null);
    });

    socketClient.on('connect_error', (err: Error) => {
      setError(err.message);
    });

    // Clean up listeners on unmount
    return () => {
      socketClient.off('connection:state');
      socketClient.off('connect_error');
    };
  }, []);

  return {
    isConnected,
    error,
    connect,
    disconnect,
    emit,
    on,
  };
}
