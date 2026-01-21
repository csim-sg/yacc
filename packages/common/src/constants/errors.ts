/**
 * Error Codes and Messages
 * Standardized error codes for API responses
 */

export const ERROR_CODE = {
  // Auth errors
  INVALID_CREDENTIALS: 'invalid_credentials',
  TOKEN_EXPIRED: 'token_expired',
  TOKEN_INVALID: 'token_invalid',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',

  // Validation errors
  VALIDATION_ERROR: 'validation_error',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  INVALID_INPUT: 'invalid_input',

  // Resource errors
  NOT_FOUND: 'not_found',
  ALREADY_EXISTS: 'already_exists',
  CONFLICT: 'conflict',

  // Business logic errors
  CONVERSATION_NOT_FOUND: 'conversation_not_found',
  MESSAGE_SEND_FAILED: 'message_send_failed',
  FILE_TOO_LARGE: 'file_to_large',
  UNSUPPORTED_FILE_TYPE: 'unsupported_file_type',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',

  // Internal errors
  INTERNAL_ERROR: 'internal_error',
  DATABASE_ERROR: 'database_error',
} as const;

export type ErrorCode = typeof ERROR_CODE[keyof typeof ERROR_CODE];

export const ERROR_MESSAGE: Record<ErrorCode, string> = {
  [ERROR_CODE.INVALID_CREDENTIALS]: 'Email or password is incorrect',
  [ERROR_CODE.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ERROR_CODE.TOKEN_INVALID]: 'Invalid authentication token',
  [ERROR_CODE.UNAUTHORIZED]: 'You must be logged in to perform this action',
  [ERROR_CODE.FORBIDDEN]: 'You do not have permission to perform this action',
  [ERROR_CODE.VALIDATION_ERROR]: 'Validation error',
  [ERROR_CODE.MISSING_REQUIRED_FIELD]: 'Missing required field',
  [ERROR_CODE.INVALID_INPUT]: 'Invalid input provided',
  [ERROR_CODE.NOT_FOUND]: 'Resource not found',
  [ERROR_CODE.ALREADY_EXISTS]: 'Resource already exists',
  [ERROR_CODE.CONFLICT]: 'Resource conflict',
  [ERROR_CODE.CONVERSATION_NOT_FOUND]: 'Conversation not found',
  [ERROR_CODE.MESSAGE_SEND_FAILED]: 'Failed to send message',
  [ERROR_CODE.FILE_TOO_LARGE]: 'File size exceeds maximum limit',
  [ERROR_CODE.UNSUPPORTED_FILE_TYPE]: 'Unsupported file type',
  [ERROR_CODE.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [ERROR_CODE.INTERNAL_ERROR]: 'An unexpected error occurred',
  [ERROR_CODE.DATABASE_ERROR]: 'Database error occurred',
};
