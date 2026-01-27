/**
 * Offline Indicator Component
 * Shows visual feedback when user is offline
 * Displays compose box state and sync queue progress
 */

import React from 'react';

interface OfflineIndicatorProps {
  /** Whether user is currently offline */
  isOffline: boolean;

  /** Number of messages waiting to sync */
  pendingMessageCount?: number;

  /** Whether messages are currently syncing */
  isSyncing?: boolean;

  /** Called when user clicks retry button */
  onRetrySync?: () => void;

  /** Optional sync progress percentage (0-100) */
  syncProgress?: number;
}

/**
 * OfflineIndicator Component
 * Renders banner above compose box indicating offline status
 * Shows queue count and provides retry button
 */
export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOffline,
  pendingMessageCount = 0,
  isSyncing = false,
  onRetrySync,
  syncProgress = 0,
}) => {
  // Don't render if online
  if (!isOffline && !isSyncing) {
    return null;
  }

  const showProgress = isSyncing && syncProgress > 0 && syncProgress < 100;
  const isComplete = syncProgress === 100;

  return (
    <div
      className="flex items-center justify-between px-4 py-3 bg-warning/10 border-b-2 border-warning rounded-none"
      role="status"
      aria-live="polite"
      aria-label={
        isOffline
          ? `Offline mode. ${pendingMessageCount} messages waiting to send.`
          : `Syncing messages. ${syncProgress}% complete.`
      }
    >
      <div className="flex items-center gap-3 flex-1">
        {/* Offline icon */}
        {isOffline && !isSyncing && (
          <svg
            className="w-5 h-5 text-warning flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
        )}

        {/* Syncing icon */}
        {isSyncing && (
          <svg
            className="w-5 h-5 text-warning flex-shrink-0 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {/* Status text and queue info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-warning">
            {isOffline && !isSyncing && 'Offline mode'}
            {isSyncing && !isComplete && 'Syncing messages...'}
            {isComplete && 'Messages synced'}
          </div>

          {/* Queue or progress info */}
          {!isSyncing && pendingMessageCount > 0 && (
            <div
              className="text-xs text-warning/70"
              role="region"
              aria-label="Queue status"
            >
              {pendingMessageCount} {pendingMessageCount === 1 ? 'message' : 'messages'} waiting
              to send
            </div>
          )}

          {/* Sync progress */}
          {showProgress && (
            <div className="mt-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-warning/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-warning transition-all duration-300"
                    style={{ width: `${syncProgress}%` }}
                    role="progressbar"
                    aria-valuenow={syncProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <span className="text-xs text-warning/70 min-w-fit">{syncProgress}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Retry button */}
      {isOffline && !isSyncing && pendingMessageCount > 0 && onRetrySync && (
        <button
          className="ml-3 px-3 py-1 bg-warning text-warning-content text-sm font-medium rounded hover:bg-warning/90 transition-colors flex-shrink-0"
          onClick={onRetrySync}
          aria-label={`Retry syncing ${pendingMessageCount} messages`}
          type="button"
        >
          Retry
        </button>
      )}

      {/* Dismiss button when syncing */}
      {isSyncing && (
        <div className="ml-3 text-xs text-warning/70 flex-shrink-0">
          Messages will sync when connected
        </div>
      )}
    </div>
  );
};

OfflineIndicator.displayName = 'OfflineIndicator';
