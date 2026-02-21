/**
 * Custom HTTP Errors
 * Additional error types not available in routing-controllers
 */

import { HttpError } from 'routing-controllers';

/**
 * Conflict Error (HTTP 409)
 * Used for duplicate resources (e.g., email already exists)
 */
export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409);
    this.message = message;
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}
