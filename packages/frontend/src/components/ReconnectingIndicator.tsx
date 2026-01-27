/**
 * Reconnecting Indicator Component
 * Shows status during WebSocket reconnection attempts
 *
 * Features:
 * - Shows "Reconnecting..." banner on disconnect
 * - Displays attempt number (e.g., "Attempt 2 of 5")
 * - Shows countdown to next retry
 * - Manual retry button after max attempts
 * - Color indicates status (warning → error)
 * - Non-blocking, keyboard accessible
 * - DaisyUI alert styling
 */

import React, { useState, useEffect } from 'react';
import { useReconnectionLogic } from '../hooks/useReconnectionLogic';
import { useWebSocketStore } from '../stores/websocket.store';
import { logger } from '../lib/logger';

const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * ReconnectingIndicator Component
 * Displays reconnection status and allows manual retry
 *
 * @example
 * ```tsx
 * <ReconnectingIndicator />
 * ```
 */
export const ReconnectingIndicator: React.FC = () => {
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const { isReconnecting, attemptNumber, maxAttemptsReached, nextRetryIn, retryConnection } =
    useReconnectionLogic();
  const { connectionState } = useWebSocketStore();

  // Update countdown display
  useEffect(() => {
    if (nextRetryIn === null) {
      setCountdownSeconds(null);
      return;
    }

    const countdown = Math.ceil(nextRetryIn / 1000);
    setCountdownSeconds(countdown);

    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [nextRetryIn]);

  // Don't render if not reconnecting and not failed
  if (!isReconnecting && connectionState !== 'connected' && !maxAttemptsReached) {
    return null;
  }

  // Connection lost (max attempts reached)
  if (maxAttemptsReached) {
    return (
      <div
        className="alert alert-error shadow-lg mb-4"
        role="alert"
        aria-label="Connection lost. Manual reconnection required."
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4v2m0 5v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="font-semibold">Connection Lost</h3>
              <p className="text-sm opacity-80">
                Unable to reconnect after {MAX_RECONNECT_ATTEMPTS} attempts. Please check your
                connection and try again.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              logger.info('[ReconnectingIndicator] Manual retry requested');
              retryConnection();
            }}
            className="btn btn-sm btn-outline"
            aria-label="Retry connection"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Reconnecting (with attempt counter and countdown)
  if (isReconnecting) {
    return (
      <div
        className="alert alert-warning shadow-lg mb-4"
        role="alert"
        aria-live="polite"
        aria-label={`Reconnecting. Attempt ${attemptNumber} of ${MAX_RECONNECT_ATTEMPTS}.${
          countdownSeconds ? ` Retrying in ${countdownSeconds} seconds.` : ''
        }`}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="loading loading-spinner loading-sm"></div>
            <div>
              <h3 className="font-semibold">Reconnecting...</h3>
              <p className="text-sm opacity-80">
                Attempt {attemptNumber} of {MAX_RECONNECT_ATTEMPTS}
                {countdownSeconds && ` • Next retry in ${countdownSeconds}s`}
              </p>
            </div>
          </div>
          <progress
            className="progress progress-warning"
            value={(attemptNumber / MAX_RECONNECT_ATTEMPTS) * 100}
            max="100"
            aria-label="Reconnection progress"
            style={{ width: '80px' }}
          ></progress>
        </div>
      </div>
    );
  }

  return null;
};

ReconnectingIndicator.displayName = 'ReconnectingIndicator';
