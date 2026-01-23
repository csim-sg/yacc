import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import 'reflect-metadata';
import { useExpressServer } from 'routing-controllers';
import { checkDatabaseConnection } from './infrastructure/db/client';
import { runMigrations } from './infrastructure/db/migrations';
import { authorizationChecker, currentUserChecker } from './api/middleware/routing-controllers-auth';
import { AuthController } from './api/controllers/auth.controller';
import { SimpleAuthController } from './api/controllers/simple-auth.controller';
import { ConversationsController } from './api/controllers/conversations.controller';
import { Router } from 'express';
import { AuditController } from './api/controllers/audit.controller';
import { HealthController } from './api/controllers/health.controller';
import { config } from './config/config';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.frontend.url,
    credentials: true,
  },
});

const PORT = config.app.port;

// Middleware
app.use(cors({
  origin: config.frontend.url,
  credentials: true,
  exposedHeaders: ['set-auth-token', 'x-total-count', 'x-current-page', 'x-total-pages'],
}));
app.use(express.json());

  // Setup routing-controllers
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

// Conversations list headers middleware
app.use('/api/conversations', (req, res, next) => {
  if (req.method === 'GET' && !req.path.match(/\/[0-9]+$/)) {
    res.setHeader('x-total-count', '0');
    res.setHeader('x-current-page', '1');
    res.setHeader('x-total-pages', '1');
  }
  next();
});

// WebSocket events (to be implemented)
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Error handling (routing-controllers handles this automatically)

// Initialize server and database
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

    // Run migrations
    await runMigrations();

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 API: http://localhost:${PORT}/api`);
      console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
