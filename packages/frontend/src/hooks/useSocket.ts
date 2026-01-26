/**
 * useSocket Hook
 *
 * React hook for Socket.io client integration
 * Provides connection state and management methods
 *
 * Features:
 * - Connection state (isConnected, error)
 * - Connect/disconnect methods
 * - Event emission
 * - Automatic cleanup on unmount
 *
 * Usage:
 * ```typescript
 * import { useSocket } from '../hooks/useSocket';
 *
 * function MyComponent() {
 *   const { isConnected, error, connect, disconnect, emit } = useSocket();
 *
 *   return (
 *     <div>
 *       {error && <div className="error">{error}</div>}
 *       <button onClick={connect} disabled={isConnected}>
 *         {isConnected ? 'Connected' : 'Connect'}
 *       </button>
 *       <button onClick={disconnect} disabled={!isConnected}>
 *         Disconnect
 *       </button>
 *       <button onClick={() => emit('message:send', { body: 'Hello' })}>
 *         Send Message
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { socketClient } from '../lib/socket';

/**
 * Hook return type
 */
interface UseSocketReturn {
  /** Connection state */
  isConnected: boolean;

  /** Connection error if any */
  error: string | null;

  /** Connect to WebSocket server */
  connect: () => void;

  /** Disconnect from WebSocket server */
  disconnect: () => void;

  /** Emit event to server */
  emit<T extends keyof ReturnType<typeof socketClient.emit>>(
    event: T,
    data?: Parameters<ReturnType<typeof socketClient.emit>[T]>
  ): void;

  /** Register event listener */
  on<T extends keyof ReturnType<typeof socketClient.on>>(
    event: T,
    listener: Parameters<ReturnType<typeof socketClient.on>[T]>
  ): void;

  /** Unregister event listener */
  off<T extends keyof ReturnType<typeof socketClient.off>>(
    event: T,
    listener?: Parameters<ReturnType<typeof socketClient.off>[T]>
  ): void;
}

/**
 * useSocket Hook
 *
 * Manages Socket.io client connection and event handling
 *
 * @returns Hook object with connection state and methods
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { isConnected, error, connect, disconnect, emit } = useSocket();
 *
 *   return (
 *     <div>
 *       {error && <div className="error">{error}</div>}
 *       <button onClick={connect} disabled={isConnected}>
 *         {isConnected ? 'Connected' : 'Connect'}
 *       </button>
 *       <button onClick={disconnect} disabled={!isConnected}>
 *         Disconnect
 *       </button>
 *       <button onClick={() => emit('message:send', { body: 'Hello' })}>
 *         Send Message
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSocket(): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectionStateRef = useRef<'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('disconnected');

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
    event: keyof ReturnType<typeof socketClient.emit>,
    data?: Parameters<ReturnType<typeof socketClient.emit>[typeof event]>
  ): void => {
    setError(null);
    try {
      socketClient.emit(event as any, data);
    } catch (err) {
      console.error('[useSocket] Emit error:', err);
      setError(err instanceof Error ? err.message : 'Failed to emit event');
    }
  }, []);

  // Register event listener
  const on = useCallback((
    event: keyof ReturnType<typeof socketClient.on>,
    listener: Parameters<ReturnType<typeof socketClient.on>[typeof event]>
  ): void => {
    try {
      socketClient.on(event as any, listener);
    } catch (err) {
      console.error('[useSocket] Register listener error:', err);
      setError(err instanceof Error ? err.message : 'Failed to register listener');
    }
  }, []);

  // Unregister event listener
  const off = useCallback((
    event: keyof ReturnType<typeof socketClient.off>,
    listener?: Parameters<ReturnType<typeof socketClient.off>[typeof event]>
  ): void => {
    try {
      socketClient.off(event as any, listener as any);
    } catch (err) {
      console.error('[useSocket] Unregister listener error:', err);
      setError(err instanceof Error ? err.message : 'Failed to unregister listener');
    }
  }, []);

  // Listen for connection state changes from Socket.io client
  useEffect(() => {
    socketClient.on('connection:state', (data: any) => {
      connectionStateRef.current = data.state;
      setIsConnected(data.state === 'connected');
      setError(null);

      console.log('[useSocket] Connection state:', data.state);
    });

    socketClient.on('connect_error', (err: Error) => {
      console.error('[useSocket] Connection error:', err);
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
    off,
  };
}
