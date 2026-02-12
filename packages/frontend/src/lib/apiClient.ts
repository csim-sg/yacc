/// <reference types="vite/client" />

/**
 * API Client with Interceptors for YACC Backend
 * 
 * Enhanced with:
 * - Request interceptor (add Authorization header, X-Request-ID)
 * - Response interceptor (handle 401/403/500 errors)
 * - Automatic token refresh on 401 with request queuing
 * - Retry logic with exponential backoff
 * - Request timeout handling
 * 
 * Aligned with BetterAuth endpoints:
 * - POST /api/auth/sign-in/email (login)
 * - POST /api/auth/sign-out (logout)
 * - GET /api/auth/get-session (session)
 * - POST /api/auth/refresh-token (token refresh)
 * - POST /api/auth/forgot-password (reset email)
 * - POST /api/auth/reset-password (reset password)
 */

/**
 * Get API base URL from environment variable (Vite)
 * VITE_API_BASE_URL is defined in .env file
 */
function getApiBaseUrl(): string {
  // Vite provides import.meta.env at build time
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3000';
}

const API_BASE_URL = getApiBaseUrl();

export interface ApiError {
  error: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Fetch options with timeout and retry configuration
 */
interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
}

/**
 * Token refresh state management
 * Prevents multiple concurrent refresh requests
 */
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Get stored JWT token
 */
export function getToken(): string | null {
  return localStorage.getItem('yacc_token');
}

/**
 * Store JWT token
 */
export function setToken(token: string): void {
  localStorage.setItem('yacc_token', token);
}

/**
 * Remove JWT token
 */
export function clearToken(): void {
  localStorage.removeItem('yacc_token');
}

/**
 * Decode JWT token without verification
 * BetterAuth uses JWT standard (seconds for exp)
 */
function decodeToken(token: string): { exp?: number } {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return {};
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const { exp } = decodeToken(token);
  if (!exp) return true; // If no exp, assume valid
  
  // JWT exp is in seconds, Date.now() is in ms
  return Date.now() >= exp * 1000;
}

/**
 * Refresh access token
 * Uses BetterAuth's refresh-token endpoint
 * Prevents multiple concurrent refresh attempts
 */
async function attemptTokenRefresh(): Promise<boolean> {
  // Reuse existing refresh promise if already refreshing
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send session cookie
      });

      if (response.ok) {
        const data = await response.json() as Record<string, string>;

        if (data.token) {
          // BetterAuth returns new token in response
          setToken(data.token);
          console.log('✅ Token refreshed successfully');
          return true;
        }
      }

      return false;
    } catch (error: unknown) {
      console.error('❌ Token refresh failed:', error);
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Enhanced fetch with interceptors
 * - Adds Authorization header
 * - Handles 401 (token refresh or redirect)
 * - Handles 403 (permission denied)
 * - Handles 500+ (server errors)
 * - Retry logic with exponential backoff
 * - Request timeout handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {},
  responseType: 'json' | 'blob' = 'json'
): Promise<T> {
  const {
    timeout = 30000, // 30 seconds default
    retries = 3, // Retry 3 times
    ...fetchOptions
  } = options;
  
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-ID': crypto.randomUUID(),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (fetchOptions.headers) {
    Object.assign(headers, fetchOptions.headers);
  }
  
  const url = `${API_BASE_URL}${endpoint}`;
  let lastError: Error | null = null;
  let attempt = 0;
  
  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Response interceptor - handle success
      if (response.ok) {
        if (responseType === 'blob') {
          return await response.blob() as T;
        }
        return await response.json() as T;
      }
      
       // Response interceptor - handle 401 Unauthorized
       if (response.status === 401) {
         const refreshed = await attemptTokenRefresh();

         if (refreshed) {
           // Retry request with new token, preserving responseType (crucial for blob)
           return await apiFetch<T>(endpoint, {
             ...options,
             retries: 0, // Don't retry after refresh to avoid infinite loop
           }, responseType);
         } else {
           clearToken();
           window.location.href = '/login';
           throw new Error('Token expired. Please log in again.');
         }
       }
      
      // Response interceptor - handle 403 Forbidden
      if (response.status === 403) {
        const errorData = await response.json() as Record<string, string>;
        throw new Error(errorData.error || 'You do not have permission to access this resource');
      }
      
      // Response interceptor - handle 500+ server errors
      if (response.status >= 500) {
        if (attempt < retries) {
          const backoff = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.log(`⚠️ Server error (${response.status}), retrying in ${backoff}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise<void>((resolve) => setTimeout(resolve, backoff));
          attempt++;
          continue;
        }
      }
      
      // Other errors (400, 404, etc.)
      const errorData = await response.json() as Record<string, string>;
      lastError = new Error(errorData.error || 'Request failed');
      throw lastError;
      
    } catch (error: unknown) {
      // Network error or timeout
      if (error && (error as Error).name === 'AbortError') {
        if (attempt < retries) {
          const backoff = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.log(`⚠️ Request timeout (${timeout}ms), retrying in ${backoff}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise<void>((resolve) => setTimeout(resolve, backoff));
          attempt++;
          continue;
        }
      }
      
      lastError = error as Error;
      throw lastError;
    }
  }
  
  // Final error if all retries exhausted
  throw lastError || new Error('Request failed');
}

/**
 * HTTP Methods
 */
export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }, 'json'),
  
  post: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }, 'json'),
  
  patch: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }, 'json'),
  
  put: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }, 'json'),
  
  delete: <T>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'DELETE',
    }, 'json'),
  
  /**
   * Download blob (e.g., file export)
   * Returns response as Blob instead of JSON
   */
  blob: <T extends Blob>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }, 'blob'),
};
