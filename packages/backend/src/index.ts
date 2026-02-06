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
import { loginRateLimiter, passwordResetRateLimiter } from './middleware/rateLimit.middleware';
import { controllers } from './controllers';
import { socketControllers } from './socket-controllers';
import { config } from './config/config';
import { logger } from './infrastructure/logger';
import { messageQueueService } from './services/message-queue.service';
import { messageQueueProcessor } from './services/message-queue-processor';
import { wsGateway } from './websockets/gateway';
import { connectorManager } from './services/connector-manager';
import { TelegramConnector } from './connectors/telegram.connector';
import { IRCConnector } from './connectors/irc.connector';

const app = express();

// ===== SETUP ROUTING-CONTROLLERS =====
// Register all middleware via routing-controllers to comply with architecture standards
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
  middlewares: [
    // Global middleware - run for all requests before controllers
    correlationIdMiddleware,
    requestLoggingMiddleware,
  ],
});

// ===== SETUP RATE LIMITING =====
// Apply rate limiting to specific endpoints after routing-controllers setup
// These use app.post() to pre-register routes before controllers process them
app.post('/auth/sign-in/email', loginRateLimiter);
app.post('/auth/forgot-password', passwordResetRateLimiter);
app.post('/auth/reset-password', passwordResetRateLimiter);

// ===== SETUP EXPRESS SERVER =====
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.frontend.url,
    credentials: true,
    exposedHeaders: ['set-auth-token', 'x-total-count', 'x-current-page', 'x-total-pages'],
  },
});

// ===== DATABASE AND STARTUP =====
async function start() {
  try {
    console.log('✓ Configuration validated successfully');
    console.log(`  - Environment: ${config.app.env}`);
    console.log(`  - Port: ${config.app.port}`);
    console.log(`  - Log Level: ${config.logging.level}`);

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
      });
      logger.info('Socket-controllers registered successfully');

     // Register platform connectors
    logger.info('Registering platform connectors...');
    const telegramConnector = new TelegramConnector();
    const ircConnector = new IRCConnector();
    connectorManager.registerConnector('telegram', telegramConnector);
    connectorManager.registerConnector('irc', ircConnector);
    logger.info('Platform connectors registered successfully');

    // Initialize message queue service with processor
    logger.info('Initializing message queue service...');
    await messageQueueService.initialize(messageQueueProcessor);
    logger.info('Message queue service initialized successfully');

    // Setup graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received - shutting down gracefully');
      await messageQueueService.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received - shutting down gracefully');
      await messageQueueService.close();
      process.exit(0);
    });

    // Start server
    server.listen(config.app.port, () => {
      console.log(`🚀 Server running on port ${config.app.port}`);
      console.log(`📍 API: http://localhost:${config.app.port}/api`);
      console.log(`🔗 WebSocket: ws://localhost:${config.app.port}`);
      logger.info(`Server started on port ${config.app.port}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();
