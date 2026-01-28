import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import { useExpressServer } from 'routing-controllers';
import { authorizationChecker, currentUserChecker } from './middleware/routingControllersAuth';
import { correlationIdMiddleware } from './middleware/correlationId.middleware';
import { requestLoggingMiddleware } from './middleware/requestLogging.middleware';
import { AuthController } from './controllers/auth.controller';
import { ConversationsController, AuditController, HealthController } from './controllers';
import { Database } from './infrastructure/db.client';
import { RedisClient } from './infrastructure/redis.client';
import { R2Client } from './infrastructure/r2.client';
import { Logger } from './infrastructure/logger';
import { BetterAuthClient } from './infrastructure/better-auth.client';
import { users, session, verification, account } from './infrastructure/db.schema';
import { config } from './config/config';

const app = express();

// ===== SETUP INFRASTRUCTURE WITH DI PATTERN =====
const db = new Database(config.database);
const redis = new RedisClient();
const r2 = new R2Client();
const logger = new Logger(config.logging);
const auth = new BetterAuthClient(
  db.getDrizzle(),
  { users: users, session: users, verification: users, account: users },
  config.auth
);

// ===== SETUP ROUTING-CONTROLLERS =====
useExpressServer(app, {
  controllers: [AuthController, ConversationsController, AuditController, HealthController],
  authorizationChecker: authorizationChecker,
  currentUserChecker: currentUserChecker,
  defaultErrorHandler: true,
  validation: {
    whitelist: true,
    forbidNonWhitelisted: true,
  },
  classTransformer: true,
  middlewares: [
    // Middleware order is critical: registered in this order
    correlationIdMiddleware,    // 1. Inject correlation ID
    requestLoggingMiddleware,    // 2. Log HTTP requests
  ],
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
