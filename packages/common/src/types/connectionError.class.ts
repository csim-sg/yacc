/**
 * Connection Error Class
 *
 * Error thrown when connector fails to connect
 */

export class ConnectionError extends Error {
  code?: string;
  platform?: string;
  retryable: boolean = true;

  constructor(message: string, platform?: string, code?: string) {
    super(message);
    this.name = 'ConnectionError';
    this.platform = platform;
    this.code = code;
  }
}
