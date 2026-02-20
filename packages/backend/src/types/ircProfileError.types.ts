/**
 * IRC Profile Error Types
 * Provides type-safe error handling without using `any`
 */

import type { IrcProfileErrorCode } from './ircProfile.types';

/**
 * Custom error class for IRC profile operations
 * Includes code and statusCode without needing type assertions
 */
export class IrcProfileError extends Error {
  constructor(
    message: string,
    public code: IrcProfileErrorCode,
    public statusCode: number
  ) {
    super(message);
    this.name = 'IrcProfileError';
    Object.setPrototypeOf(this, IrcProfileError.prototype);
  }
}
