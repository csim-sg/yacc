import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import { useExpressServer } from 'routing-controllers';
import { checkDatabaseConnection } from '../../infrastructure/db/client';
import { runMigrations } from '../../infrastructure/db/migrations';
import { authorizationChecker, currentUserChecker } from '../../api/middleware/routing-controllers-auth';
import { correlationIdMiddleware } from '../../api/middleware/correlation-id.middleware';
import { requestLoggingMiddleware } from '../../api/middleware/request-logging.middleware';
import { AuthController } from '../../api/controllers/auth.controller';
import { SimpleAuthController } from '../../api/controllers/simple-auth.controller';
import { ConversationsController } from '../../api/controllers/conversations.controller';
import { Router } from 'express';
import { AuditController } from '../../api/controllers/audit.controller';
import { HealthController } from '../../api/controllers/health.controller';
import { config } from '../../config/config';

const app = express();

// ===== MIDDLEWARE ORDER (CRITICAL) =====
// 1. Correlation ID - Inject correlation ID into request context
app.use(correlationIdMiddleware);
// 2. Request Logging - Log HTTP requests with correlation ID
app.use(requestLoggingMiddleware);
// 3. Body Parsing - Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 4. Authentication - Attach user to request
// app.use(authorizationChecker);
// 5. RBAC - Check role/permissions
// app.use(rbacMiddleware);
// 6. Routes - Route to controllers
// app.use('/api', apiRouter);
// 7. Error Handler - Global error handling
// app.use(errorHandler);

// ===== SETUP ROUTING-CONTROLLERS =====
const apiRouter = Router();
apiRouter.use('/auth', AuthController);
apiRouter.use('/simple-auth', SimpleAuthController);
apiRouter.use('/conversations', ConversationsController);
apiRouter.use('/audit', AuditController);
apiRouter.use('/health', HealthController);

// ===== SETUP EXPRESS SERVER =====
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.frontend.url,
    credentials: true,
    exposedHeaders: ['set-auth-token', 'x-total-count', 'x-current-page', 'x-total-pages'],
  },
});

// ===== ERROR HANDLING (routing-controllers handles this automatically) =====

// ===== DATABASE AND MIGRATIONS =====
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
