/**
 * Centralized API Error Handler
 *
 * Handles common API error scenarios and coordinates responses
 * Integrates with auth context, notification system, and logging
 *
 * Error Handling Strategy:
 * - 401 (Unauthorized): User session expired, logout and redirect to login
 * - 403 (Forbidden): Permission denied, show toast notification
 * - 404 (Not Found): Resource not found, show error to user
 * - 5xx (Server Error): Backend error, show error toast with retry option
 * - Network Error: Connection issue, show offline toast
 * - Timeout Error: Request took too long, offer retry
 *
 * Usage with TanStack Query:
 * ```typescript
 * const { data } = useQuery({
 *   queryKey: ['data'],
 *   queryFn: async () => {
 *     try {
 *       return await apiClient.get('/api/data');
 *     } catch (error) {
 *       handleApiError(error);
 *       throw error; // Re-throw for React Query to handle
 *     }
 *   },
 *   onError: (error) => {
 *     handleQueryError(error);
 *   },
 * });
 * ```
 */

import { ApiError } from './client';

/**
 * Error context information
 */
export interface ErrorContext {
  /** Human-readable operation name for logging */
  operation?: string;

  /** Whether to show toast notification to user */
  showToast?: boolean;

  /** Custom error message override */
  message?: string;
}

/**
 * Handle API errors from mutations or queries
 *
 * Logs the error, shows notifications, and triggers side effects
 * (like logout on 401)
 *
 * @param error - Error from API client
 * @param context - Optional context for error handling
 *
 * @example
 * try {
 *   await apiClient.post('/api/messages', data);
 * } catch (error) {
 *   handleApiError(error, { operation: 'Send Message', showToast: true });
 * }
 */
export function handleApiError(error: unknown, context?: ErrorContext): void {
  if (!(error instanceof ApiError)) {
    // Handle non-API errors (network, timeout, etc.)
    console.error('[API Error Handler] Non-API error:', error);
    if (context?.showToast) {
      showErrorToast('An unexpected error occurred. Please try again.');
    }
    return;
  }

  const { statusCode, message, data } = error;
  const operation = context?.operation || 'API Request';

  // Log error details
  console.error(`[API Error] ${operation}`, {
    statusCode,
    message,
    data,
  });

  // Handle specific status codes
  switch (statusCode) {
    case 401:
      handle401Unauthorized();
      break;

    case 403:
      handle403Forbidden(context);
      break;

    case 404:
      handle404NotFound(context);
      break;

    case 408:
      handle408Timeout(context);
      break;

    case 422:
      handle422ValidationError(context, data);
      break;

    case 429:
      handle429RateLimit(context);
      break;

    case 500:
    case 502:
    case 503:
    case 504:
      handleServerError(statusCode, context);
      break;

    default:
      handleGenericError(statusCode, message, context);
  }
}

/**
 * 401 Unauthorized - User session expired or invalid token
 * Action: Logout user and redirect to login page
 */
function handle401Unauthorized(): void {
  console.warn('[Auth Error] User session expired');

  // TODO: Integrate with BetterAuth logout
  // auth.logout();
  // redirect('/login');

  // For now, show user-friendly message
  showErrorToast('Your session has expired. Please log in again.');

  // Redirect to login after a short delay
  setTimeout(() => {
    window.location.href = '/login';
  }, 1000);
}

/**
 * 403 Forbidden - User lacks permission for this action
 * Action: Show permission denied message, don't retry
 */
function handle403Forbidden(context?: ErrorContext): void {
  const message = context?.message || 'You do not have permission to perform this action.';
  console.warn('[Permission Error]', message);

  if (context?.showToast !== false) {
    showWarningToast(message);
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 * Action: Show not found message, log for debugging
 */
function handle404NotFound(context?: ErrorContext): void {
  const message = context?.message || 'The requested resource was not found.';
  console.warn('[Not Found Error]', message);

  if (context?.showToast !== false) {
    showErrorToast(message);
  }
}

/**
 * 408 Request Timeout - Request took too long
 * Action: Show timeout message, suggest retry
 */
function handle408Timeout(context?: ErrorContext): void {
  const message = context?.message || 'Request timed out. Please try again.';
  console.warn('[Timeout Error]', message);

  if (context?.showToast !== false) {
    showErrorToast(message);
  }
}

/**
 * 422 Unprocessable Entity - Validation error
 * Action: Show validation errors to user
 */
function handle422ValidationError(context?: ErrorContext, data?: unknown): void {
  console.warn('[Validation Error]', data);

  if (context?.showToast !== false) {
    const message = context?.message || 'Please check your input and try again.';
    showErrorToast(message);
  }
}

/**
 * 429 Too Many Requests - Rate limited
 * Action: Show rate limit message, don't retry immediately
 */
function handle429RateLimit(context?: ErrorContext): void {
  const message = context?.message || 'Too many requests. Please try again later.';
  console.warn('[Rate Limit Error]', message);

  if (context?.showToast !== false) {
    showWarningToast(message);
  }
}

/**
 * 5xx Server Errors - Backend is having issues
 * Action: Show error, suggest retry
 */
function handleServerError(statusCode: number, context?: ErrorContext): void {
  const message = context?.message || `Server error (${statusCode}). Please try again.`;
  console.error('[Server Error]', message);

  if (context?.showToast !== false) {
    showErrorToast(message);
  }
}

/**
 * Generic error handling for unexpected status codes
 */
function handleGenericError(statusCode: number, message: string, context?: ErrorContext): void {
  const errorMessage = context?.message || `Error: ${message}`;
  console.error('[API Error]', { statusCode, message });

  if (context?.showToast !== false) {
    showErrorToast(errorMessage);
  }
}

/**
 * Show error toast notification
 *
 * TODO: Integrate with actual toast/notification library
 * (e.g., react-hot-toast, react-toastify)
 */
function showErrorToast(message: string): void {
  // Placeholder - integrate with notification system
  console.error('[Toast]', message);

  // TODO: Implement with actual toast library
  // toast.error(message, { duration: 5000 });
}

/**
 * Show warning toast notification
 *
 * TODO: Integrate with actual toast/notification library
 */
function showWarningToast(message: string): void {
  // Placeholder - integrate with notification system
  console.warn('[Toast]', message);

  // TODO: Implement with actual toast library
  // toast.warn(message, { duration: 5000 });
}

/**
 * Handle errors in TanStack Query hooks
 *
 * Wrapper for use in query onError callbacks
 *
 * @param error - Error from React Query
 * @param context - Optional context for error handling
 *
 * @example
 * const { data, error } = useQuery({
 *   queryKey: ['conversations'],
 *   queryFn: () => apiClient.get('/api/conversations'),
 *   onError: (error) => {
 *     handleQueryError(error, { operation: 'Load Conversations' });
 *   },
 * });
 */
export function handleQueryError(error: unknown, context?: ErrorContext): void {
  // Default to showing toast for query errors
  const defaultContext = { showToast: true, ...context };
  handleApiError(error, defaultContext);
}

/**
 * Handle errors in TanStack Query mutations
 *
 * Wrapper for use in mutation onError callbacks
 *
 * @param error - Error from React Query
 * @param context - Optional context for error handling
 *
 * @example
 * const sendMessage = useMutation({
 *   mutationFn: (data) => apiClient.post('/api/messages', data),
 *   onError: (error) => {
 *     handleMutationError(error, { operation: 'Send Message' });
 *   },
 * });
 */
export function handleMutationError(error: unknown, context?: ErrorContext): void {
  // Default to showing toast for mutation errors
  const defaultContext = { showToast: true, ...context };
  handleApiError(error, defaultContext);
}

/**
 * Check if error is a specific type
 *
 * Helper functions for error type checking in catch blocks
 */
export const errorChecks = {
  /**
   * Check if error is 401 Unauthorized
   */
  isUnauthorized: (error: unknown): error is ApiError => {
    return error instanceof ApiError && error.statusCode === 401;
  },

  /**
   * Check if error is 403 Forbidden
   */
  isForbidden: (error: unknown): error is ApiError => {
    return error instanceof ApiError && error.statusCode === 403;
  },

  /**
   * Check if error is 404 Not Found
   */
  isNotFound: (error: unknown): error is ApiError => {
    return error instanceof ApiError && error.statusCode === 404;
  },

  /**
   * Check if error is a server error (5xx)
   */
  isServerError: (error: unknown): error is ApiError => {
    return error instanceof ApiError && error.statusCode >= 500;
  },

  /**
   * Check if error is a timeout (408)
   */
  isTimeout: (error: unknown): error is ApiError => {
    return error instanceof ApiError && error.statusCode === 408;
  },

  /**
   * Check if error is validation error (422)
   */
  isValidationError: (error: unknown): error is ApiError => {
    return error instanceof ApiError && error.statusCode === 422;
  },

  /**
   * Check if error is rate limit (429)
   */
  isRateLimit: (error: unknown): error is ApiError => {
    return error instanceof ApiError && error.statusCode === 429;
  },
};
