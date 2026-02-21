import type { TestConnectionError } from './testConnectionError.type';

export class TestConnectionFailedError extends Error {
  constructor(public readonly errorInfo: TestConnectionError) {
    super(errorInfo.message);
    this.name = 'TestConnectionFailedError';
  }
}
