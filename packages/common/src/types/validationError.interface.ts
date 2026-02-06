/**
 * Validation Error Interface
 *
 * Error from validating connector configuration
 */

export interface ValidationError {
  field: string;
  message: string;
}
