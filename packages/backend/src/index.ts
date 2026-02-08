import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import { useExpressServer } from 'routing-controllers';
import { SocketControllers } from 'socket-controllers';
import { checkDatabaseConnection } from './infrastructure/db.client';
import { authorizationChecker, currentUserChecker } from './middleware/routingControllersAuth';
import { correlationIdMiddleware } from './middleware/correlationId.middleware';
import { requestLoggingMiddleware } from './middleware/requestLogging.middleware';
import { bodyParserMiddleware } from './middleware/bodyParser.middleware';
import { controllers } from './controllers';
import { socketControllers } from './socket-controllers';
import { appConfig } from './config/appConfig';
import { logger } from './infrastructure/logger';
import { wsGateway } from './websockets/gateway';

// ===== EXPRESS APP =====
const app = express();

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
    bodyParserMiddleware,
  ],
});

// ===== HTTP & WEBSOCKET SERVER =====
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: appConfig.APP_FRONTEND_URL,
    credentials: true,
    exposedHeaders: ['set-auth-token', 'x-total-count', 'x-current-page', 'x-total-pages'],
  },
});

// ===== DATABASE AND STARTUP =====
export async function start(): Promise<void> {
  try {
    console.log('✓ Configuration validated successfully');
    console.log(`  - Environment: ${appConfig.APP_ENV}`);
    console.log(`  - Port: ${appConfig.APP_PORT}`);
    console.log(`  - Log Level: ${appConfig.LOG_LEVEL}`);

    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Initialize WebSocket gateway
    logger.info('Initializing WebSocket gateway...');
    wsGateway.initialize(io);
    logger.info('WebSocket gateway initialized successfully');

    // Initialize socket-controllers for declarative WebSocket event handling
    logger.info('Registering socket-controllers...');
    new SocketControllers({
      io,
      controllers: socketControllers,
      container: {
        get<T>(Class: new (...args: unknown[]) => T): T {
          return new Class();
        },
      },
    });
    logger.info('Socket-controllers registered successfully');

    // Setup graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received - shutting down gracefully');
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received - shutting down gracefully');
      process.exit(0);
    });

    // Start server
    server.listen(appConfig.APP_PORT, () => {
      console.log(`🚀 Server running on port ${appConfig.APP_PORT}`);
      console.log(`📍 API: http://localhost:${appConfig.APP_PORT}/api`);
      console.log(`🔗 WebSocket: ws://localhost:${appConfig.APP_PORT}`);
      logger.info(`Server started on port ${appConfig.APP_PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Do not auto-start on import; packages/backend/index.ts is the entrypoint.
