/**
 * API Client - Fetch-based (No Axios)
 *
 * Simple, lightweight HTTP client using native fetch API
 * Integrated with TanStack Query for data fetching and caching
 *
 * Features:
 * - Base URL from environment
 * - Correlation ID injection (X-Request-ID header)
 * - Authorization header injection
 * - 30-second timeout
 * - Error handling (401, 403, 5xx)
 * - Request/response logging
 *
 * Usage with TanStack Query:
 * ```typescript
 * const { data } = useQuery({
 *   queryKey: ['conversations'],
 *   queryFn: () => apiClient.get('/conversations', { params: { page: 1 } }),
 * });
 * ```
 */

import { ErrorResponseSchema } from './schemas';

/**
 * API Error class
 * Custom error type for API errors with status codes
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Correlation ID generator
 * Unique ID for tracking requests across logs
 */
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Build query string from object
 * Helper to convert object to URL query string
 */
function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return value.map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`).join('&');
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    });

  return entries.join('&');
}

/**
 * API Request Options
 */
interface RequestOptions {
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
  skipAuth?: boolean; // Skip Authorization header
}

/**
 * API Client Class
 * Lightweight fetch wrapper for making HTTP requests
 */
class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number = 30000; // 30 seconds

  constructor(baseUrl?: string) {
    // Get base URL from: constructor param > env variable > default
    this.baseUrl = baseUrl || process.env.REACT_APP_API_URL || 'http://localhost:3000';
  }

  /**
   * Build full URL with query params
   */
  private buildUrl(endpoint: string, params?: Record<string, unknown>): string {
    let url = this.baseUrl + endpoint;

    if (params && Object.keys(params).length > 0) {
      const queryString = buildQueryString(params);
      url += `?${queryString}`;
    }

    return url;
  }

  /**
   * Build request headers
   */
  private buildHeaders(options?: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': generateCorrelationId(),
      ...options?.headers,
    };

    // Add authorization header if not skipped
    if (!options?.skipAuth) {
      const token = this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Get auth token from storage
   * Assumes BetterAuth stores token in cookie or localStorage
   */
  private getAuthToken(): string | null {
    // Try to get from cookies first (BetterAuth stores here)
    const cookies = document.cookie.split('; ');
    const authCookie = cookies.find((c) => c.startsWith('auth_token=') || c.startsWith('session='));

    if (authCookie) {
      return authCookie.split('=')[1];
    }

    // Fallback to localStorage
    return localStorage.getItem('auth_token');
  }

  /**
   * Handle API errors
   */
  private handleError(statusCode: number, error: ApiError, endpoint: string): never {
    console.error(`[API Error] ${endpoint}:`, {
      status: statusCode,
      message: error.message,
      data: error.data,
    });

    throw error;
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(endpoint, options?.params);
    const headers = this.buildHeaders(options);
    const timeout = options?.timeout || this.defaultTimeout;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include', // Send cookies
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.handleErrorResponse(response, endpoint);
      }

      const data = await response.json() as T;
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.handleError(
          408,
          new ApiError(408, `Request timeout (${timeout}ms)`),
          endpoint
        );
      }

      if (error instanceof Error) {
        return this.handleError(
          0,
          new ApiError(0, `Network error: ${error.message}`),
          endpoint
        );
      }

      throw error;
    }
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(endpoint);
    const headers = this.buildHeaders(options);
    const timeout = options?.timeout || this.defaultTimeout;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.handleErrorResponse(response, endpoint);
      }

      const data = await response.json() as T;
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.handleError(
          408,
          new ApiError(408, `Request timeout (${timeout}ms)`),
          endpoint
        );
      }

      if (error instanceof Error) {
        return this.handleError(
          0,
          new ApiError(0, `Network error: ${error.message}`),
          endpoint
        );
      }

      throw error;
    }
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(endpoint);
    const headers = this.buildHeaders(options);
    const timeout = options?.timeout || this.defaultTimeout;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.handleErrorResponse(response, endpoint);
      }

      const data = await response.json() as T;
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.handleError(
          408,
          new ApiError(408, `Request timeout (${timeout}ms)`),
          endpoint
        );
      }

      if (error instanceof Error) {
        return this.handleError(
          0,
          new ApiError(0, `Network error: ${error.message}`),
          endpoint
        );
      }

      throw error;
    }
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(endpoint);
    const headers = this.buildHeaders(options);
    const timeout = options?.timeout || this.defaultTimeout;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.handleErrorResponse(response, endpoint);
      }

      const data = await response.json() as T;
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.handleError(
          408,
          new ApiError(408, `Request timeout (${timeout}ms)`),
          endpoint
        );
      }

      if (error instanceof Error) {
        return this.handleError(
          0,
          new ApiError(0, `Network error: ${error.message}`),
          endpoint
        );
      }

      throw error;
    }
  }

  /**
   * Handle error responses from API
   */
  private async handleErrorResponse(response: Response, endpoint: string): Promise<never> {
    const statusCode = response.status;

    try {
      const errorData = await response.json() as unknown;
      const parsedError = ErrorResponseSchema.safeParse(errorData);
      const errorMessage = parsedError.success
        ? parsedError.data.error.message
        : 'Unknown error';

      throw new ApiError(statusCode, errorMessage, errorData);
    } catch (e) {
      if (e instanceof ApiError) {
        return this.handleError(statusCode, e, endpoint);
      }

      // Fallback error message
      throw new ApiError(
        statusCode,
        response.statusText || `HTTP ${statusCode}`,
        null
      );
    }
  }
}

/**
 * Global API client instance
 * Single instance used throughout the app
 */
export const apiClient = new ApiClient();
