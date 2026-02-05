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
import { dbClient, checkDatabaseConnection } from './infrastructure/db.client';
import { redisClient, checkRedisHealth } from './infrastructure/redis.client';
import { r2Client, isR2Configured, checkR2Health } from './infrastructure/r2.client';
import { logger } from './infrastructure/logger';
import { betterAuthClient } from './infrastructure/better-auth.client';
import { appConfig } from './config/appConfig';

/**
 * Application entry point
 *
 * Sets up all infrastructure and starts the server
 */

const app = express();

// ===== SETUP INFRASTRUCTURE WITH SINGLETON PATTERN =====
const db = dbClient;
const redis = redisClient;
const r2 = r2Client;
const authInstance = betterAuthClient;

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
  cors: {
    origin: appConfig.APP_FRONTEND_URL,
    credentials: true,
    exposedHeaders: ['set-auth-token', 'x-total-count', 'x-current-page', 'x-total-pages'],
  },
});

// ===== SETUP WEBSOCKET SERVER =====
const server = http.createServer(app);
const wsServer = new WebSocketServer(server);

// ===== SETUP SERVER STARTUP =====
async function start() {
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

     // Check Redis connection
     const redisConnected = await checkRedisHealth();
     if (!redisConnected) {
       console.warn('⚠️  Redis connection failed - WebSocket features will be degraded');
     } else {
       console.log('✓ Redis connected');
     }

     // Check R2 connection
     const r2Configured = isR2Configured();
     if (r2Configured) {
       const r2Connected = await checkR2Health();
       if (r2Connected) {
         console.log('✓ R2 storage connected');
       } else {
         console.warn('⚠️  R2 storage connection failed - file uploads will be degraded');
       }
     } else {
       console.log('ℹ️  R2 storage not configured - file uploads disabled');
     }

     // Start HTTP + WebSocket server
     server.listen(appConfig.APP_PORT, () => {
       console.log(`🚀 Server running on port ${appConfig.APP_PORT}`);
       console.log(`📍 API: http://localhost:${appConfig.APP_PORT}/api`);
       console.log(`🔗 WebSocket: ws://localhost:${appConfig.APP_PORT}`);
     });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();

