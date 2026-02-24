/**
 * IRC Test Button Component
 *
 * A reusable button component for testing IRC connection configurations.
 * Sends a test request to the backend and displays success/failure feedback.
 *
 * Features:
 * - 10-second hard timeout on test request
 * - Loading spinner during test execution
 * - Success/failure state display with auto-dismiss for success
 * - Keyboard accessibility (Enter/Space)
 * - ARIA labels for accessibility
 * - Dark/light mode support via Tailwind
 *
 * @module @yacc/frontend/components/admin
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ircTestHandler,
  isTimeoutError,
  isApiError,
  type IRCTestConfig,
} from '../../lib/ircTestHandler';

/**
 * Test result state
 */
type TestState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Props for IRCTestButton component
 */
export interface IRCTestButtonProps {
  /** IRC configuration to test */
  ircConfig: IRCTestConfig;
  /** Callback when test starts */
  onTestStart?: () => void;
  /** Callback when test completes (success or failure) */
  onTestComplete?: (success: boolean, message?: string) => void;
  /** Disable button (e.g., if form has validation errors) */
  disabled?: boolean;
  /** Additional Tailwind classes */
  className?: string;
}

/**
 * IRC Test Button Component
 *
 * Allows testing IRC connection settings before saving.
 * Displays loading, success, and error states with appropriate UI feedback.
 */
export function IRCTestButton({
  ircConfig,
  onTestStart,
  onTestComplete,
  disabled = false,
  className = '',
}: IRCTestButtonProps): JSX.Element {
  const [testState, setTestState] = useState<TestState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Clear auto-dismiss timer on unmount
   */
  useEffect(() => {
    return () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
    };
  }, []);

  /**
   * Clear result and reset to idle state
   */
  const clearResult = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    setTestState('idle');
    setErrorMessage(null);
  }, []);

  /**
   * Handle test button click
   */
  const handleTest = useCallback(async () => {
    // Clear any previous result
    clearResult();

    // Notify parent that test is starting
    onTestStart?.();

    setTestState('loading');

    try {
      const response = await ircTestHandler(ircConfig);

      if (response.data.success) {
        setTestState('success');
        onTestComplete?.(true, response.data.message);

        // Auto-dismiss success after 5 seconds
        autoDismissTimerRef.current = setTimeout(() => {
          setTestState('idle');
          setErrorMessage(null);
        }, 5000);
      } else {
        setTestState('error');
        setErrorMessage(response.data.message || 'Connection test failed');
        onTestComplete?.(false, response.data.message);
      }
    } catch (error) {
      setTestState('error');

      let message: string;
      if (isTimeoutError(error)) {
        message = 'IRC test timed out after 10 seconds';
      } else if (isApiError(error)) {
        message = error.message;
      } else {
        message = error instanceof Error ? error.message : 'Connection test failed';
      }

      setErrorMessage(message);
      onTestComplete?.(false, message);
    }
  }, [ircConfig, onTestStart, onTestComplete, clearResult]);

  /**
   * Handle keyboard events for accessibility
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!disabled && testState !== 'loading') {
          handleTest();
        }
      }
    },
    [disabled, testState, handleTest]
  );

  /**
   * Handle dismiss click (stops propagation to prevent triggering test)
   */
  const handleDismiss = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    clearResult();
  }, [clearResult]);

  /**
   * Handle retry click (stops propagation to prevent double-triggering)
   */
  const handleRetry = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    handleTest();
  }, [handleTest]);

  // Success state - show result with dismiss button
  if (testState === 'success') {
    return (
      <div
        className={`alert alert-success ${className}`}
        role="status"
        aria-live="polite"
        data-testid="irc-test-button"
        data-state="success"
      >
        <span className="text-success text-lg" aria-hidden="true">✓</span>
        <span className="flex-1">Connected to IRC server successfully</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleDismiss}
          aria-label="Dismiss success message"
        >
          ✕
        </button>
      </div>
    );
  }

  // Error state - show result with dismiss and retry buttons
  if (testState === 'error') {
    return (
      <div
        className={`alert alert-error ${className}`}
        role="alert"
        aria-live="polite"
        data-testid="irc-test-button"
        data-state="error"
      >
        <div className="flex flex-col w-full">
          <div className="flex items-center">
            <span className="text-error text-lg" aria-hidden="true">✗</span>
            <span className="ml-2 flex-1">{errorMessage}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleDismiss}
              aria-label="Dismiss error message"
            >
              ✕
            </button>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline btn-error mt-2"
            onClick={handleRetry}
            aria-label="Retry connection test"
            data-testid="irc-retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading or idle state - show button
  const isButtonDisabled = disabled || testState === 'loading';

  return (
    <button
      type="button"
      className={`btn btn-primary ${testState === 'loading' ? 'loading' : ''} ${className}`}
      onClick={handleTest}
      onKeyDown={handleKeyDown}
      disabled={isButtonDisabled}
      aria-label="Test IRC connection"
      aria-busy={testState === 'loading'}
      data-testid="irc-test-button"
      data-state={testState}
    >
      {testState === 'loading' ? (
        <>
          <span className="loading loading-spinner loading-sm" aria-hidden="true"></span>
          <span className="ml-2">Testing...</span>
        </>
      ) : (
        'Test Connection'
      )}
    </button>
  );
}
