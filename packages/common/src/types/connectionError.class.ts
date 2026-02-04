/**
 * Connection Error Class
 *
 * Error thrown when connector fails to connect
 */

export class ConnectionError extends Error {
  code?: string;
  retryable: boolean = true;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ConnectionError';
    this.code = code;
  }
}
