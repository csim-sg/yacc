import type { Platform } from './Platform.type';

export class ConnectionError extends Error {
  public readonly platform: Platform;
  public readonly code: string;

  constructor(message: string, platform: Platform, code: string) {
    super(message);
    this.name = 'ConnectionError';
    this.platform = platform;
    this.code = code;
  }
}
