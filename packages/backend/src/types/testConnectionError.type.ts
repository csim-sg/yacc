export type TestConnectionError =
  | { type: 'validation_error'; message: string }
  | { type: 'not_configured'; message: string }
  | { type: 'timeout'; message: string }
  | { type: 'internal_error'; message: string };
