## Task Description
Set up structured logging infrastructure using Winston or Pino, implement correlation ID middleware for request tracing, create audit log writer for all system actions, and configure log levels and outputs for different environments (development, production, test).

### Technical Requirements

**1. Logger Setup**
- Choose Winston or Pino (Pino preferred for performance)
- Install packages: `pino`, `pino-pretty`, `pino-multi-stream`
- Create singleton logger in `packages/backend/src/infrastructure/logging/logger.ts`

**2. Log Configuration**
Support multiple output streams:
- Development: Pretty console output with colors
- Production: JSON output to stdout (for log aggregation)
- File: Rotating files for logs with size-based rotation
- Audit: Separate log file for audit trail

```typescript
// Logger configuration
interface LoggerConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format: 'json' | 'pretty';
  streams: {
    console: boolean;
    file: {
      enabled: boolean;
      filename: string;
      maxSize: string;  // '10M'
      maxFiles: number;  // 5
    };
    audit: {
      enabled: boolean;
      filename: string;
      maxSize: string;
      maxFiles: number;
    };
  };
}
```

**3. Log Levels**
- **error**: Critical errors that require immediate attention
- **warn**: Warning messages for potential issues
- **info**: General informational messages (default in production)
- **debug**: Detailed debug information (development only)

**4. Structured Log Format**
Logs should be JSON-structured with standard fields:

```typescript
interface LogEntry {
  timestamp: string;        // ISO-8601
  level: string;            // error | warn | info | debug
  message: string;
  correlationId?: string;   // Request correlation ID
  userId?: string;          // Authenticated user ID
  action?: string;          // Action being performed
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  duration?: number;       // Request duration in ms
  metadata?: Record<string, any>;  // Additional context
}
```

**5. Correlation ID Middleware**
Create middleware to generate and propagate correlation IDs:

```typescript
// packages/backend/src/infrastructure/logging/correlation.middleware.ts
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage<string>();

export const correlationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Get existing correlation ID from header or generate new one
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();

  // Store in async local storage
  asyncLocalStorage.run(correlationId, () => {
    // Add correlation ID to request object
    req.correlationId = correlationId;

    // Add to response header
    res.setHeader('x-correlation-id', correlationId);

    next();
  });
};

export const getCorrelationId = (): string | undefined => {
  return asyncLocalStorage.getStore();
};
```

**6. Audit Log Writer**
Create dedicated service for writing audit logs:

```typescript
// packages/backend/src/infrastructure/logging/audit-logger.ts
import { logger } from './logger';
import { getCorrelationId } from './correlation.middleware';

export interface AuditLogEntry {
  actorId?: string;        // User who performed the action
  actorEmail?: string;     // User email
  action: string;          // e.g., 'conversation.assigned'
  entityType: string;       // e.g., 'conversation', 'message'
  entityId: string;         // Entity ID
  metadata?: Record<string, any>;  // Additional details
  ip?: string;             // Client IP
  userAgent?: string;      // Client user agent
}

export const auditLog = (entry: AuditLogEntry): void => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    correlationId: getCorrelationId(),
    level: 'info',
    type: 'audit',
    ...entry,
  };

  // Write to audit log file (separate stream)
  logger.audit(logEntry);

  // Also write to database asynchronously
  // This will be implemented with AuditLog model
};
```

**7. Logger Service Interface**

```typescript
interface ILogger {
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, error?: Error | unknown, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
  child(context: Record<string, any>): ILogger;
  audit(entry: AuditLogEntry): void;
}
```

**8. Request Logging Middleware**
Log all HTTP requests with timing:

```typescript
// packages/backend/src/infrastructure/logging/request-logger.middleware.ts
export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 500) {
      logger.error('HTTP Request Error', undefined, logData);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP Request Warning', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};
```

### Environment Variables

```env
# Logging Configuration
LOG_LEVEL=info              # error | warn | info | debug
LOG_FORMAT=json             # json | pretty
LOG_FILE_ENABLED=true       # Enable file logging
LOG_FILE_PATH=logs/app.log  # File path for logs
LOG_FILE_MAX_SIZE=10M       # Max file size before rotation
LOG_FILE_MAX_FILES=5        # Number of rotated files to keep
AUDIT_LOG_ENABLED=true      # Enable audit logging
AUDIT_LOG_PATH=logs/audit.log
AUDIT_LOG_MAX_SIZE=10M
AUDIT_LOG_MAX_FILES=10
```

### File Structure

```
packages/backend/src/infrastructure/logging/
├── logger.ts                    # Main logger setup
├── logger.config.ts             # Logger configuration
├── correlation.middleware.ts    # Correlation ID middleware
├── request-logger.middleware.ts # Request logging middleware
├── audit-logger.ts              # Audit log writer
├── index.ts                     # Export logging utilities
└── README.md                    # Usage documentation

logs/                            # Created at runtime (gitignored)
├── app.log                      # Application logs
├── app.log.1
├── audit.log                    # Audit logs
└── audit.log.1
```

### Example Usage

```typescript
import { logger } from './infrastructure/logging';
import { auditLog } from './infrastructure/logging/audit-logger';
import { getCorrelationId } from './infrastructure/logging/correlation.middleware';

// Basic logging
logger.info('User logged in', { userId: 'abc-123', email: 'user@example.com' });
logger.warn('Rate limit approaching', { ip: '192.168.1.1', count: 9, limit: 10 });
logger.error('Database connection failed', error, { host: 'localhost', port: 5432 });
logger.debug('Processing message', { messageId: 'msg-123', status: 'pending' });

// Child logger with context
const conversationLogger = logger.child({ conversationId: 'conv-123' });
conversationLogger.info('Conversation updated', { status: 'pending' });

// Audit logging
auditLog({
  actorId: 'user-123',
  actorEmail: 'admin@example.com',
  action: 'conversation.assigned',
  entityType: 'conversation',
  entityId: 'conv-123',
  metadata: { assignedTo: 'user-456' },
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
});

// Access correlation ID in async context
const correlationId = getCorrelationId();  // Returns UUID string
```

### Integration with Other Components

**Middleware Order (Express app)**:
```typescript
import express from 'express';
import { correlationMiddleware } from './infrastructure/logging/correlation.middleware';
import { requestLoggerMiddleware } from './infrastructure/logging/request-logger.middleware';

const app = express();

// 1. Correlation ID middleware (first, to wrap all requests)
app.use(correlationMiddleware);

// 2. Request logging middleware
app.use(requestLoggerMiddleware);

// ... other middleware

// 3. Routes
app.use('/api', apiRoutes);
```

**Database Error Logging**:
```typescript
try {
  await db.conversation.update(...);
  logger.info('Conversation updated successfully', { conversationId });
} catch (error) {
  logger.error('Failed to update conversation', error, { conversationId });
  auditLog({
    action: 'conversation.update_failed',
    entityType: 'conversation',
    entityId: conversationId,
    actorId: userId,
    metadata: { error: error.message },
  });
  throw error;
}
```

### Testing Requirements

- Unit tests for logger configuration
- Test correlation ID generation and propagation
- Test child logger context
- Test audit log formatting
- Test request logging middleware timing
- Test log level filtering
- Test file rotation (mock file system)

### Deployment Notes

- Log files should be stored outside the Docker container (volume mount)
- Use JSON format in production for log aggregation (ELK stack, Datadog, etc.)
- Ensure `/logs` directory has write permissions
- Configure log rotation to prevent disk full issues
- Monitor log levels and adjust based on environment

## Priority
P0 - Critical - blocks Phase 1 completion or release

## Assignee
Backend

## Acceptance Criteria
- [ ] Logger properly configured with Pino (or Winston)
- [ ] Logger supports multiple output streams:
  - [ ] Console (pretty for dev, JSON for prod)
  - [ ] File with rotation (size-based)
  - [ ] Audit log file (separate stream)
- [ ] Correlation ID middleware:
  - [ ] Generates UUID for new requests
  - [ ] Uses existing ID from X-Correlation-ID header
  - [ ] Propagates through async context using AsyncLocalStorage
  - [ ] Adds to response headers
  - [ ] Accessible via `getCorrelationId()` utility
- [ ] Request logging middleware:
  - [ ] Logs all HTTP requests
  - [ ] Captures method, URL, status code, duration, IP, user agent
  - [ ] Logs at different levels based on status code
  - [ ] Includes correlation ID in log entry
- [ ] Audit log writer:
  - [ ] Implements `auditLog(entry)` function
  - [ ] Writes to separate audit log file
  - [ ] Includes actor, action, entity, metadata
  - [ ] Includes correlation ID and timestamp
- [ ] Log levels configured (error, warn, info, debug)
- [ ] Environment variables control logging behavior:
  - [ ] LOG_LEVEL sets minimum log level
  - [ ] LOG_FORMAT switches between JSON and pretty
  - [ ] File rotation settings configurable
- [ ] Logger can create child contexts with `.child()`
- [ ] Integration tests verify correlation ID propagation
- [ ] Documentation includes usage examples
- [ ] Unit tests achieve 90%+ coverage

## Status
Not Started

## Dependencies
- BE-026: Create environment configuration scaffolding (for LOG_* env vars)

## Category
Backend
