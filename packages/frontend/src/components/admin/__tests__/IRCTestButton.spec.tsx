/**
 * Unit Tests for IRCTestButton Component
 *
 * Tests cover:
 * - Button rendering (enabled/disabled states)
 * - Click handler and loading state
 * - Success state display
 * - Failure state display
 * - Timeout error handling
 * - Retry functionality
 * - Keyboard interaction
 * - ARIA accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IRCTestButton } from '../IRCTestButton';
import {
  ircTestHandler,
  IRCTestTimeoutError,
  IRCTestApiError,
  isTimeoutError,
  isApiError,
} from '../../../lib/ircTestHandler';

// Mock the ircTestHandler and helper functions
vi.mock('../../../lib/ircTestHandler', () => {
  const TimeoutError = class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'IRCTestTimeoutError';
    }
  };

  const ApiError = class extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = 'IRCTestApiError';
      this.code = code;
    }
  };

  return {
    ircTestHandler: vi.fn(),
    IRCTestTimeoutError: TimeoutError,
    IRCTestApiError: ApiError,
    isTimeoutError: vi.fn((error: Error) => error.name === 'IRCTestTimeoutError'),
    isApiError: vi.fn((error: Error) => error.name === 'IRCTestApiError'),
  };
});

const mockedIrcTestHandler = vi.mocked(ircTestHandler);
const mockedIsTimeoutError = vi.mocked(isTimeoutError);
const mockedIsApiError = vi.mocked(isApiError);

describe('IRCTestButton', () => {
  const defaultConfig = {
    server: 'irc.example.com',
    port: 6667,
    username: 'testuser',
    password: 'testpass',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsTimeoutError.mockImplementation((error) => error instanceof Error && error.name === 'IRCTestTimeoutError');
    mockedIsApiError.mockImplementation((error) => error instanceof Error && error.name === 'IRCTestApiError');
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ========================================================================
  // Rendering Tests
  // ========================================================================

  describe('Rendering', () => {
    it('should render with default props', () => {
      render(<IRCTestButton ircConfig={defaultConfig} />);
      expect(screen.getByTestId('irc-test-button')).toBeInTheDocument();
      expect(screen.getByText('Test Connection')).toBeInTheDocument();
    });

    it('should render disabled state when disabled prop is true', () => {
      render(<IRCTestButton ircConfig={defaultConfig} disabled />);
      expect(screen.getByTestId('irc-test-button')).toBeDisabled();
    });

    it('should apply custom className', () => {
      render(<IRCTestButton ircConfig={defaultConfig} className="custom-class" />);
      expect(screen.getByTestId('irc-test-button')).toHaveClass('custom-class');
    });

    it('should have correct ARIA attributes', () => {
      render(<IRCTestButton ircConfig={defaultConfig} />);
      const button = screen.getByTestId('irc-test-button');
      expect(button).toHaveAttribute('aria-label', 'Test IRC connection');
      expect(button).toHaveAttribute('aria-busy', 'false');
    });
  });

  // ========================================================================
  // Loading State Tests
  // ========================================================================

  describe('Loading State', () => {
    it('should show loading spinner during test execution', async () => {
      let resolvePromise: (value: { data: { success: boolean; message: string } }) => void;
      mockedIrcTestHandler.mockImplementation(() => new Promise((resolve) => { resolvePromise = resolve; }));

      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(screen.getByText('Testing...')).toBeInTheDocument());
      expect(screen.getByTestId('irc-test-button')).toHaveAttribute('data-state', 'loading');
      expect(screen.getByTestId('irc-test-button')).toHaveAttribute('aria-busy', 'true');

      resolvePromise!({ data: { success: true, message: 'Connected' } });
    });

    it('should disable button during loading', async () => {
      let resolvePromise: (value: { data: { success: boolean; message: string } }) => void;
      mockedIrcTestHandler.mockImplementation(() => new Promise((resolve) => { resolvePromise = resolve; }));

      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(screen.getByTestId('irc-test-button')).toBeDisabled());
      resolvePromise!({ data: { success: true, message: 'Connected' } });
    });
  });

  // ========================================================================
  // Success State Tests
  // ========================================================================

  describe('Success State', () => {
    it('should display success message on successful test', async () => {
      mockedIrcTestHandler.mockResolvedValue({ data: { success: true, message: 'Connected successfully' } });

      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(screen.getByText('Connected to IRC server successfully')).toBeInTheDocument());
      expect(screen.getByTestId('irc-test-button')).toHaveAttribute('data-state', 'success');
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('should allow manual dismiss of success message', async () => {
      mockedIrcTestHandler.mockResolvedValue({ data: { success: true, message: 'Connected successfully' } });

      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(screen.getByText('Connected to IRC server successfully')).toBeInTheDocument());
      fireEvent.click(screen.getByLabelText('Dismiss success message'));

      await waitFor(() => expect(screen.getByText('Test Connection')).toBeInTheDocument());
    });

    it('should call onTestComplete with success on successful test', async () => {
      mockedIrcTestHandler.mockResolvedValue({ data: { success: true, message: 'Connected successfully' } });
      const onTestComplete = vi.fn();

      render(<IRCTestButton ircConfig={defaultConfig} onTestComplete={onTestComplete} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(onTestComplete).toHaveBeenCalledWith(true, 'Connected successfully'));
    });
  });

  // ========================================================================
  // Failure State Tests
  // ========================================================================

  describe('Failure State', () => {
    it('should display error message on failed test', async () => {
      mockedIrcTestHandler.mockResolvedValue({ data: { success: false, message: 'Connection refused' } });

      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(screen.getByText('Connection refused')).toBeInTheDocument());
      expect(screen.getByTestId('irc-test-button')).toHaveAttribute('data-state', 'error');
      expect(screen.getByText('✗')).toBeInTheDocument();
    });

    it('should show retry button in error state', async () => {
      mockedIrcTestHandler.mockResolvedValue({ data: { success: false, message: 'Connection refused' } });

      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(screen.getByTestId('irc-retry-button')).toBeInTheDocument());
    });

    it('should retry when retry button is clicked', async () => {
      mockedIrcTestHandler
        .mockResolvedValueOnce({ data: { success: false, message: 'Connection refused' } })
        .mockResolvedValueOnce({ data: { success: true, message: 'Connected' } });

      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(screen.getByText('Connection refused')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('irc-retry-button'));

      await waitFor(() => expect(screen.getByText('Connected to IRC server successfully')).toBeInTheDocument());
      expect(mockedIrcTestHandler).toHaveBeenCalledTimes(2);
    });

    it('should allow manual dismiss of error message', async () => {
      mockedIrcTestHandler.mockResolvedValue({ data: { success: false, message: 'Connection refused' } });

      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(screen.getByText('Connection refused')).toBeInTheDocument());
      fireEvent.click(screen.getByLabelText('Dismiss error message'));

      await waitFor(() => expect(screen.getByText('Test Connection')).toBeInTheDocument());
    });

    it('should call onTestComplete with failure on failed test', async () => {
      mockedIrcTestHandler.mockResolvedValue({ data: { success: false, message: 'Connection refused' } });
      const onTestComplete = vi.fn();

      render(<IRCTestButton ircConfig={defaultConfig} onTestComplete={onTestComplete} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(onTestComplete).toHaveBeenCalledWith(false, 'Connection refused'));
    });
  });

  // ========================================================================
  // Timeout Error Tests
  // ========================================================================

  describe('Timeout Error', () => {
    it('should display timeout error message on abort', async () => {
      const timeoutError = new IRCTestTimeoutError();
      mockedIrcTestHandler.mockRejectedValue(timeoutError);
      mockedIsTimeoutError.mockReturnValue(true);

      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(screen.getByText('IRC test timed out after 10 seconds')).toBeInTheDocument());
    });

    it('should allow retry after timeout', async () => {
      const timeoutError = new IRCTestTimeoutError();
      mockedIrcTestHandler
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({ data: { success: true, message: 'Connected' } });
      mockedIsTimeoutError.mockReturnValueOnce(true).mockReturnValueOnce(false);

      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(screen.getByText('IRC test timed out after 10 seconds')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('irc-retry-button'));

      await waitFor(() => expect(screen.getByText('Connected to IRC server successfully')).toBeInTheDocument());
    });
  });

  // ========================================================================
  // API Error Tests
  // ========================================================================

  describe('API Error', () => {
    it('should display API error message', async () => {
      const apiError = new IRCTestApiError('Server not found', 'not_found');
      mockedIrcTestHandler.mockRejectedValue(apiError);
      mockedIsApiError.mockReturnValue(true);
      mockedIsTimeoutError.mockReturnValue(false);

      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(screen.getByText('Server not found')).toBeInTheDocument());
    });
  });

  // ========================================================================
  // Callback Tests
  // ========================================================================

  describe('Callbacks', () => {
    it('should call onTestStart when test begins', async () => {
      mockedIrcTestHandler.mockResolvedValue({ data: { success: true, message: 'Connected' } });
      const onTestStart = vi.fn();

      render(<IRCTestButton ircConfig={defaultConfig} onTestStart={onTestStart} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      expect(onTestStart).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Keyboard Interaction Tests
  // ========================================================================

  describe('Keyboard Interaction', () => {
    it('should trigger test on Enter key', async () => {
      mockedIrcTestHandler.mockResolvedValue({ data: { success: true, message: 'Connected' } });

      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.keyDown(screen.getByTestId('irc-test-button'), { key: 'Enter' });

      await waitFor(() => expect(mockedIrcTestHandler).toHaveBeenCalled());
    });

    it('should trigger test on Space key', async () => {
      mockedIrcTestHandler.mockResolvedValue({ data: { success: true, message: 'Connected' } });

      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.keyDown(screen.getByTestId('irc-test-button'), { key: ' ' });

      await waitFor(() => expect(mockedIrcTestHandler).toHaveBeenCalled());
    });

    it('should not trigger test on other keys', () => {
      render(<IRCTestButton ircConfig={defaultConfig} />);
      fireEvent.keyDown(screen.getByTestId('irc-test-button'), { key: 'Tab' });
      expect(mockedIrcTestHandler).not.toHaveBeenCalled();
    });

    it('should not trigger test when disabled', () => {
      render(<IRCTestButton ircConfig={defaultConfig} disabled />);
      fireEvent.keyDown(screen.getByTestId('irc-test-button'), { key: 'Enter' });
      expect(mockedIrcTestHandler).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Config Passing Tests
  // ========================================================================

  describe('Config Passing', () => {
    it('should pass config to ircTestHandler', async () => {
      mockedIrcTestHandler.mockResolvedValue({ data: { success: true, message: 'Connected' } });
      const config = { server: 'custom.server.com', port: 7000, username: 'customuser', password: 'custompass' };

      render(<IRCTestButton ircConfig={config} />);
      fireEvent.click(screen.getByTestId('irc-test-button'));

      await waitFor(() => expect(mockedIrcTestHandler).toHaveBeenCalledWith(config));
    });
  });
});
