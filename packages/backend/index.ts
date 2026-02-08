import 'reflect-metadata';

import { start } from './src/index';

// Entrypoint for dev/prod. Tests should import app/server wiring directly.
if (process.env.NODE_ENV !== 'test') {
  void start();
}
