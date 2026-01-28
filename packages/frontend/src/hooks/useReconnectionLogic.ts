/**
 * useReconnectionLogic Hook
 * Manages exponential backoff reconnection logic
 *
 * Features:
 * - Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s
 * - Jitter (±25%) to prevent thundering herd
 * - Max 5 reconnection attempts
 * - Tracks reconnect state in Zustand store
 * - Manual retry button support
 */

import { useEffect, useRef, useCallback } from 'react';
import { useWebSocketStore } from '../stores/websocket.store';
import { logger } from '../lib/logger';

// Backoff sequence in milliseconds
const BACKOFF_SEQUENCE = [
  1000, // 1s
  2000, // 2s
  4000, // 4s
  8000, // 8s
  16000, // 16s
  32000, // 32s
  60000, // 60s (max)
];

const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Calculate exponential backoff delay with jitter
 * Jitter: delay * (0.75 + 0.5 * Math.random())
 * Range: 75% to 125% of base delay
 */
function calculateBackoffDelay(attemptNumber: number): number {
  const baseDelay = BACKOFF_SEQUENCE[Math.min(attemptNumber, BACKOFF_SEQUENCE.length - 1)];
  const jitter = 0.75 + 0.5 * Math.random();
  return Math.floor(baseDelay * jitter);
}

interface UseReconnectionLogicReturn {
  /**
   * Current reconnection attempt number (0-based)
   */
  attemptNumber: number;

  /**
   * Whether reconnection is in progress
   */
  isReconnecting: boolean;

  /**
   * Whether max attempts reached
   */
  maxAttemptsReached: boolean;

  /**
   * Milliseconds until next retry
   */
  nextRetryIn: number | null;

  /**
   * Manually trigger reconnection attempt
   */
  retryConnection: () => void;

  /**
   * Reset reconnection state
   */
  resetReconnection: () => void;
}

/**
 * Hook to manage WebSocket reconnection logic
 * Provides exponential backoff with jitter
 *
 * @returns Reconnection state and control functions
 *
 * @example
 * ```tsx
 * function App() {
 *   const {
 *     isReconnecting,
 *     attemptNumber,
 *     maxAttemptsReached,
 *     retryConnection,
 *   } = useReconnectionLogic();
 *
 *   return (
 *     <>
 *       {isReconnecting && (
 *         <div>Reconnecting... Attempt {attemptNumber} of {MAX_RECONNECT_ATTEMPTS}</div>
 *       )}
 *       {maxAttemptsReached && (
 *         <button onClick={retryConnection}>Retry Connection</button>
 *       )}
 *     </>
 *   );
 * }
 * ```
 */
export function useReconnectionLogic(): UseReconnectionLogicReturn {
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const { connectionState, reconnectAttempts, setReconnectAttempts } = useWebSocketStore();

  const isReconnecting = connectionState === 'reconnecting';
  const maxAttemptsReached = reconnectAttempts >= MAX_RECONNECT_ATTEMPTS;
  const nextRetryDelay = isReconnecting && !maxAttemptsReached
    ? calculateBackoffDelay(reconnectAttempts)
    : null;

  /**
   * Schedule next reconnection attempt
   */
  const scheduleNextAttempt = useCallback(() => {
    if (maxAttemptsReached) {
      logger.warn('[ReconnectionLogic] Max reconnection attempts reached', {
        maxAttempts: MAX_RECONNECT_ATTEMPTS,
      });
      return;
    }

    const delay = calculateBackoffDelay(reconnectAttempts);
    const nextAttempt = reconnectAttempts + 1;

    logger.info('[ReconnectionLogic] Scheduling reconnection attempt', {
      attempt: nextAttempt,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
      delayMs: delay,
    });

    reconnectTimer.current = setTimeout(() => {
      logger.debug('[ReconnectionLogic] Executing scheduled reconnection attempt', {
        attempt: nextAttempt,
      });

      // TODO: Trigger actual socket reconnection
      // webSocketService.connect() or socket.connect()

      setReconnectAttempts(nextAttempt);
    }, delay);
  }, [reconnectAttempts, maxAttemptsReached, setReconnectAttempts]);

  /**
   * Manually retry connection (resets attempt counter)
   */
  const retryConnection = useCallback(() => {
    logger.info('[ReconnectionLogic] Manual reconnection retry requested');

    // Clear any pending timer
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    // Reset attempts and reconnect immediately
    setReconnectAttempts(0);

    // TODO: Trigger immediate socket reconnection
    // webSocketService.connect() or socket.connect()
  }, [setReconnectAttempts]);

  /**
   * Reset reconnection state on successful connection
   */
  const resetReconnection = useCallback(() => {
    logger.info('[ReconnectionLogic] Resetting reconnection state');

    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    setReconnectAttempts(0);
  }, [setReconnectAttempts]);

  // Schedule next attempt when entering reconnecting state
  useEffect(() => {
    if (isReconnecting && !maxAttemptsReached) {
      scheduleNextAttempt();
    }

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [isReconnecting, maxAttemptsReached, scheduleNextAttempt]);

  // Reset on successful connection
  useEffect(() => {
    if (connectionState === 'connected') {
      resetReconnection();
    }
  }, [connectionState, resetReconnection]);

  return {
    attemptNumber: reconnectAttempts + 1,
    isReconnecting,
    maxAttemptsReached,
    nextRetryIn: nextRetryDelay,
    retryConnection,
    resetReconnection,
  };
}
