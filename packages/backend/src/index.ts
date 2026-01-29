/**
 * Backend Application Entry Point
 *
 * Initializes all infrastructure, sets up routing controllers, and starts HTTP + WebSocket servers
 */

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
import { ConversationsController } from './controllers/conversations.controller';
import { AuditController } from './controllers/audit.controller';
import { HealthController } from './controllers/health.controller';
import { WebSocketServer } from './websockets/websocket.server';
import { Database } from './infrastructure/db.client';
import { RedisClient } from './infrastructure/redis.client';
import { R2Client } from './infrastructure/r2.client';
import { Logger } from './infrastructure/logger';
import { BetterAuthClient } from './infrastructure/better-auth.client';
import { users, session, verification, account } from './infrastructure/db.schema';
import { config } from './config/config';

/**
 * Application entry point
 *
 * Sets up all infrastructure and starts the server
 */

const app = express();

// ===== SETUP INFRASTRUCTURE WITH DI PATTERN =====
const db = new Database(config.database);
const redis = new RedisClient();
const r2 = new R2Client();
const logger = new Logger(config.logging);
const auth = new BetterAuthClient(
  db.getDrizzle(),
  { users, session, verification, account: users },
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

// ===== SETUP WEBSOCKET SERVER =====
const server = http.createServer(app);
const wsServer = new WebSocketServer(server);

// ===== SETUP SERVER STARTUP =====
async function start() {
  try {
    console.log('✓ Configuration validated successfully');
    console.log(`  - Environment: ${config.app.env}`);
    console.log(`  - Port: ${config.app.port}`);
    console.log(`  - Log Level: ${config.logging.level}`);

    // Check database connection
    const dbConnected = await db.checkConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Check Redis connection
    const redisConnected = await redis.checkHealth();
    if (!redisConnected) {
      console.warn('⚠️  Redis connection failed - WebSocket features will be degraded');
    } else {
      console.log('✓ Redis connected');
    }

    // Check R2 connection
    const r2Configured = r2.isConfigured();
    if (r2Configured) {
      const r2Connected = await r2.checkHealth();
      if (r2Connected) {
        console.log('✓ R2 storage connected');
      } else {
        console.warn('⚠️  R2 storage connection failed - file uploads will be degraded');
      }
    } else {
      console.log('ℹ️  R2 storage not configured - file uploads disabled');
    }

    // Start HTTP + WebSocket server
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
