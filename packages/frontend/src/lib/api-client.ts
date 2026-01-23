/**
 * API Client for YACC Backend
 * Base configuration for all API requests
 */

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3000/api';

export interface ApiError {
  error: string;
  details?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

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
 * Base fetch wrapper with auth handling
 * Supports BetterAuth token extraction from response headers
 */
async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Important: Send cookies for refresh token
    });

    // Extract access token from response header (BetterAuth)
    const authToken = response.headers.get('set-auth-token');
    if (authToken) {
      setToken(authToken);
    }

    const data = await response.json();

    if (!response.ok) {
      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401) {
        clearToken();
        // Optionally trigger a re-login or refresh flow here
      }

      throw {
        status: response.status,
        error: data.error || data.message || 'Request failed',
        details: data.details,
      };
    }

    return data;
  } catch (error: any) {
    // Network error or JSON parse error
    if (!error.status) {
      throw {
        status: 0,
        error: 'Network error. Please check your connection.',
      };
    }
    throw error;
  }
}

/**
 * HTTP Methods
 */
export const api = {
  get: <T = any>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),

  put: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
};
