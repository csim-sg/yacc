import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import { useExpressServer } from 'routing-controllers';
import { checkDatabaseConnection } from './config/db';
import { authorizationChecker, currentUserChecker } from './middleware/routing-controllers-auth';
import { correlationIdMiddleware } from './middleware/correlation-id.middleware';
import { requestLoggingMiddleware } from './middleware/request-logging.middleware';
import { AuthController } from './controllers/auth.controller';
import { SimpleAuthController } from './controllers/simple-auth.controller';
import { ConversationsController } from './controllers/conversations.controller';
import { AuditController } from './controllers/audit.controller';
import { HealthController } from './controllers/health.controller';
import { config } from './config/config';

const app = express();

// ===== MIDDLEWARE ORDER (CRITICAL) =====
// 1. Correlation ID - Inject correlation ID into request context
app.use(correlationIdMiddleware);
// 2. Request Logging - Log HTTP requests with correlation ID
app.use(requestLoggingMiddleware);
// 3. Body Parsing - Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== SETUP ROUTING-CONTROLLERS =====
useExpressServer(app, {
  controllers: [AuthController, SimpleAuthController, ConversationsController, AuditController, HealthController],
  authorizationChecker: authorizationChecker,
  currentUserChecker: currentUserChecker,
  defaultErrorHandler: true,
  validation: {
    whitelist: true,
    forbidNonWhitelisted: true,
  },
  classTransformer: true,
});

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

    // Start server
    server.listen(config.app.port, () => {
      console.log(`🚀 Server running on port ${config.app.port}`);
      console.log(`📍 API: http://localhost:${config.app.port}/api`);
      console.log(`🔗 WebSocket: ws://localhost:${config.app.port}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
