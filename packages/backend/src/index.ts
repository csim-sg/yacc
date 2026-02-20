import 'reflect-metadata';
import 'dotenv/config';
import http from 'http';
import express from 'express';
import { useExpressServer } from 'routing-controllers';
import { SocketControllers } from 'socket-controllers';
import { appConfig } from './config/appConfig';
import { controllers } from './controllers';
import { checkDatabaseConnection } from './infrastructure/db.client';
import { logger } from './infrastructure/logger';
import { bodyParserMiddleware } from './middleware/bodyParser.middleware';
import { correlationIdMiddleware } from './middleware/correlationId.middleware';
import { requestLoggingMiddleware } from './middleware/requestLogging.middleware';
import { authorizationChecker, currentUserChecker } from './middleware/routingControllersAuth';
import { initializeIntegrationsRuntime } from './services/integrations-runtime.service';
import { setWebSocketGateway } from './services/websocket/websocket-gateway';
import { socketControllers } from './socket-controllers';
import { wsGateway } from './websockets/gateway';
import { WebSocketServer } from './websockets/websocket.server';
import { getRetryWorker, closeRetryWorker } from './workers/messageRetryWorker';

// ===== EXPRESS APP =====
const app = express();

// Register body parser middleware BEFORE routing-controllers
// This ensures request.body is available in all route handlers
app.use(bodyParserMiddleware);

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

// ===== HTTP & WEBSOCKET SERVER =====
const server = http.createServer(app);
const webSocketServer = new WebSocketServer(server);
const io = webSocketServer.getServer();

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
    // Wire the typed WebSocket gateway used by services (conversation.updated, backlog, etc.)
    setWebSocketGateway(webSocketServer);

    // Legacy gateway (kept for compatibility with existing emitters)
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

    // Initialize integrations (Telegram, IRC) - non-blocking, won't crash on missing creds
    logger.info('Initializing integrations runtime...');
    try {
      await initializeIntegrationsRuntime();
      logger.info('Integrations runtime initialized');
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error initializing integrations runtime'
      );
      // Non-blocking; continue startup
    }

    // Start retry worker for message delivery retries
    logger.info('Starting message retry worker...');
    try {
      getRetryWorker();
      logger.info('Message retry worker started');
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error starting retry worker'
      );
      // Non-blocking; continue startup
    }

    // Setup graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received - shutting down gracefully');
      try {
        await closeRetryWorker();
      } catch (err) {
        logger.error({ error: err }, 'Error closing retry worker');
      }
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received - shutting down gracefully');
      try {
        await closeRetryWorker();
      } catch (err) {
        logger.error({ error: err }, 'Error closing retry worker');
      }
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
