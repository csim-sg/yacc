/**
 * Express App Factory
 *
 * Creates and configures an Express app with all middleware and routing-controllers setup.
 * Used by both src/index.ts (main server) and tests/test-helpers.ts (test app).
 * Follows: One responsibility, one function; reusable across contexts.
 */

import express, { Express } from 'express';
import { useExpressServer } from 'routing-controllers';
import { authorizationChecker, currentUserChecker } from './middleware/routingControllersAuth';
import { correlationIdMiddleware } from './middleware/correlationId.middleware';
import { requestLoggingMiddleware } from './middleware/requestLogging.middleware';
import { controllers } from './controllers';
import { appConfig } from './config/appConfig';

/**
 * Creates a fully configured Express app
 * - Body parsing middleware (JSON + URL-encoded)
 * - routing-controllers setup with all handlers
 * - CORS configuration
 * - Global middleware
 *
 * @returns Configured Express app ready for use
 */
export function createApp(): Express {
  const app = express();

  // Body parsing middleware required for POST/PUT endpoints
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  useExpressServer(app, {
    controllers: controllers,
    authorizationChecker: authorizationChecker,
    currentUserChecker: currentUserChecker,
    defaultErrorHandler: true,
    validation: {
      whitelist: true,
      forbidNonWhitelisted: true,
    },
    classTransformer: true,
    cors: {
      origin: appConfig.APP_FRONTEND_URL,
      credentials: true,
      exposedHeaders: ['set-auth-token', 'x-total-count', 'x-current-page', 'x-total-pages'],
    },
    middlewares: [
      correlationIdMiddleware,
      requestLoggingMiddleware,
    ],
  });

  return app;
}
