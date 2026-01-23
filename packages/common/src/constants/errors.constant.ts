import { z } from 'zod';

export const ErrorCodeEnum = z.enum([
  // Auth errors
  'invalid_credentials',
  'token_expired',
  'token_invalid',
  'unauthorized',
  'forbidden',

  // Validation errors
  'validation_error',
  'missing_required_field',
  'invalid_input',

  // Resource errors
  'not_found',
  'already_exists',
  'conflict',

  // Business logic errors
  'conversation_not_found',
  'message_send_failed',
  'file_too_large',
  'unsupported_file_type',

  // Rate limiting
  'rate_limit_exceeded',

  // Internal errors
  'internal_error',
  'database_error',
]);

export const ErrorCodes = {
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
  FILE_TOO_LARGE: 'file_too_large',
  UNSUPPORTED_FILE_TYPE: 'unsupported_file_type',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',

  // Internal errors
  INTERNAL_ERROR: 'internal_error',
  DATABASE_ERROR: 'database_error',
} as const;

export const ErrorMessages: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect',
  token_expired: 'Your session has expired. Please log in again.',
  token_invalid: 'Invalid authentication token',
  unauthorized: 'You must be logged in to perform this action',
  forbidden: 'You do not have permission to perform this action',
  validation_error: 'Validation error',
  missing_required_field: 'Missing required field',
  invalid_input: 'Invalid input provided',
  not_found: 'Resource not found',
  already_exists: 'Resource already exists',
  conflict: 'Resource conflict',
  conversation_not_found: 'Conversation not found',
  message_send_failed: 'Failed to send message',
  file_too_large: 'File size exceeds maximum limit',
  unsupported_file_type: 'Unsupported file type',
  rate_limit_exceeded: 'Rate limit exceeded',
  internal_error: 'An unexpected error occurred',
  database_error: 'Database error occurred',
};

export const parseErrorCode = (value: unknown) => ErrorCodeEnum.parse(value);
