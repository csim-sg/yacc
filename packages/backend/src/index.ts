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
import { AuditController } from './api/controllers/audit.controller';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  exposedHeaders: ['set-auth-token', 'x-total-count', 'x-current-page', 'x-total-pages'],
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.get('/api', (_req, res) => {
  res.json({
    message: 'YACC Inbox API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      conversations: '/api/conversations',
      'audit-logs': '/api/audit-logs',
      messages: '/api/messages (Phase 2)',
      users: '/api/users (Phase 2)',
    },
  });
});

// Setup routing-controllers
useExpressServer(app, {
  routePrefix: '/api',
  controllers: [AuthController, SimpleAuthController, ConversationsController, AuditController],
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
