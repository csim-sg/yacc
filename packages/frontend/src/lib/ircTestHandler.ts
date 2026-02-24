/**
 * IRC Test Handler
 *
 * Handles IRC connection test API calls with timeout support.
 * Used by IRCTestButton component to test IRC configurations before saving.
 *
 * Endpoint: POST /api/integrations/irc/test
 * Request: { server?, port?, username?, password? }
 * Response: { data: { success: boolean, message: string } }
 */

/**
 * IRC test request configuration
 * All fields are optional - backend uses stored config if body is empty
 */
export interface IRCTestConfig {
  server?: string;
  port?: number;
  username?: string;
  password?: string;
}

/**
 * IRC test response from backend
 */
export interface IRCTestResponse {
  data: {
    success: boolean;
    message: string;
  };
}

/**
 * Error response from backend
 */
export interface IRCTestError {
  code: string;
  message: string;
}

/**
 * Custom error for timeout scenarios
 */
export class IRCTestTimeoutError extends Error {
  constructor(message: string = 'IRC test timed out after 10 seconds') {
    super(message);
    this.name = 'IRCTestTimeoutError';
  }
}

/**
 * Custom error for API errors
 */
export class IRCTestApiError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'api_error') {
    super(message);
    this.name = 'IRCTestApiError';
    this.code = code;
  }
}

/**
 * Default timeout in milliseconds (10 seconds)
 */
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Test IRC connection with timeout
 *
 * Makes a POST request to /api/integrations/irc/test with the provided config.
 * Uses AbortController to implement a hard timeout.
 *
 * @param config - IRC configuration to test (server, port, username, password)
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise resolving to test result
 * @throws IRCTestTimeoutError if request times out
 * @throws IRCTestApiError if API returns an error
 */
export async function ircTestHandler(
  config: IRCTestConfig,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<IRCTestResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Use fetch directly to have control over AbortController
    const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/integrations/irc/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(config),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = (await response.json()) as IRCTestError;
      throw new IRCTestApiError(
        errorData.message || `Request failed with status ${response.status}`,
        errorData.code || 'api_error'
      );
    }

    return (await response.json()) as IRCTestResponse;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new IRCTestTimeoutError();
    }

    if (error instanceof IRCTestApiError || error instanceof IRCTestTimeoutError) {
      throw error;
    }

    // Wrap unknown errors
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new IRCTestApiError(message, 'unknown_error');
  }
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): error is IRCTestTimeoutError {
  return error instanceof IRCTestTimeoutError;
}

/**
 * Check if an error is an API error
 */
export function isApiError(error: unknown): error is IRCTestApiError {
  return error instanceof IRCTestApiError;
}
