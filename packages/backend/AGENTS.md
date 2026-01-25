# YACC Backend - Agent Guide

This is the **backend package** for YACC. This guide supplements the root `AGENTS.md` with backend-specific guidance.

## 📍 Location
- **Path**: `/packages/backend/`
- **Runtime**: Node.js 18+
- **Framework**: Express + routing-controllers

## 🎯 Backend Developer Responsibilities

### What You Build
- REST API endpoints (40+ endpoints across auth, inbox, messages, rules, etc.)
- WebSocket gateway for real-time events
- Database models and migrations (PostgreSQL + Drizzle)
- Business logic services (auth, messaging, search, rules engine, notifications, audit logging)
- Connector implementations (Telegram, IRC)
- Message queue workers (retry, DLQ processing)

### Key Dependencies
- **Express + routing-controllers**: REST API framework
- **BetterAuth**: Authentication & authorization
- **Drizzle**: Type-safe database ORM
- **PostgreSQL**: Primary database
- **Redis + BullMQ**: Message queue for retries
- **Socket.io**: WebSocket for real-time updates
- **Cloudflare R2**: File storage
- **Pino**: Logging (replaces Winston for performance)

## 📂 Folder Structure (STRICT - Non-Negotiable)

### Current Structure (Flat, NOT Layered)
```
packages/backend/src/
├── controllers/        # API endpoints (@Controller, @Post, etc.)
├── middleware/         # Express middleware
├── services/           # Business logic
├── config/             # Configuration objects (data only)
├── infrastructure/     # Singleton client classes
├── connectors/         # Telegram, IRC implementations
├── websockets/         # Socket.io gateway
├── workers/            # BullMQ job handlers
├── types/              # TypeScript interfaces & types
├── utils/              # Utility functions
└── index.ts            # App entry point
```

### Do NOT Create (Anti-Pattern)
```
❌ WRONG: packages/backend/src/
  ├── api/              # DON'T create this
  │   ├── controllers/
  │   └── middleware/
  ├── domain/           # DON'T create this
  │   └── services/
  └── infrastructure/   # DON'T create this (files go directly in src)
```

## 🔧 Key Technical Constraints

### 1. No `any` Types
```typescript
// ❌ WRONG
const login = (req: any) => {
  const user = req.user;
};

// ✅ CORRECT
import { Request } from 'express';
interface AuthRequest extends Request {
  user?: AuthUser;
  correlationId?: string;
}
const login = (req: AuthRequest) => {
  const user = req.user;
};
```

### 2. Config vs Infrastructure Pattern (ADR-005)

**Config Folder** (Simple data objects):
```typescript
// config/auth.ts - Simple object with env vars
export const authConfig = {
  jwtSecret: process.env.JWT_SECRET,
  sessionDuration: parseInt(process.env.SESSION_DURATION_HOURS || '48'),
  passwordMinLength: 8,
};
```

**Infrastructure Folder** (Client initialization):
```typescript
// infrastructure/database-client.ts - Singleton class
export class DatabaseClient {
  private static instance: DatabaseClient;
  private pool: PgPool;

  constructor() {
    this.pool = new PgPool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  static getInstance() {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient();
    }
    return DatabaseClient.instance;
  }

  query(sql: string, params?: any[]) {
    return this.pool.query(sql, params);
  }
}
```

### 3. Routing-Controllers Middleware Registration

```typescript
// ❌ WRONG (DON'T DO THIS)
const app = express();
app.use(correlationIdMiddleware);
app.use(requestLoggingMiddleware);
useExpressServer(app, { /* ... */ });

// ✅ CORRECT (USE THIS)
const app = express();
useExpressServer(app, {
  middlewares: [
    correlationIdMiddleware,  // Injected by routing-controllers
    requestLoggingMiddleware,
  ],
  controllers: [__dirname + '/controllers/**/*{.ts,.js}'],
  // ... other config
});
```

### 4. No Global `/api` Prefix

```typescript
// ❌ WRONG
@Controller('/api/conversations')
export class ConversationController {
  @Post('/send')
  async send() { /* ... */ }
  // Route: POST /api/conversations/send ✗
}

// ✅ CORRECT
@Controller('/conversations')
export class ConversationController {
  @Post('/send')
  async send() { /* ... */ }
  // Route: POST /conversations/send ✓ (no /api prefix on controller)
}
```

### 5. One Definition Per File

```
✅ CORRECT:
- controllers/conversation.controller.ts (ConversationController class)
- controllers/message.controller.ts (MessageController class)
- services/conversation.service.ts (ConversationService class)
- services/message.service.ts (MessageService class)
- types/conversation.types.ts (ConversationDTO interface)
- types/message.types.ts (MessageDTO interface)

❌ WRONG:
- controllers/all.controller.ts (multiple controller classes)
- services/business-logic.ts (multiple service classes)
- types/all-types.ts (multiple interfaces)
```

## 📋 Development Workflow

### Starting a New Task
1. Create feature branch from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/BE-XXX-description
   ```

2. Implement feature following constraints above
3. Write tests (target ≥ 85% coverage)
4. Update `.docs/` files if needed
5. Create PR against `dev` branch with clear description
6. Reference ADR if architectural decision made
7. Wait for architect review

### Code Review Checklist (Self-Check Before PR)
- [ ] No `any` types used
- [ ] Flat folder structure (no `api/`, `domain/`, `infrastructure/` folders)
- [ ] Routing-controllers middleware via `middlewares` option
- [ ] One definition per file
- [ ] Config = data objects, Infrastructure = singleton classes
- [ ] No global `/api` prefix on controllers
- [ ] Tests ≥ 85% coverage
- [ ] Clear commit messages
- [ ] `.docs/` files updated if needed
- [ ] ADR referenced if architectural change

## 🧪 Testing Requirements

### Jest Configuration
```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Coverage Target
- **Minimum**: 85% for all new code
- **Exception**: Infrastructure/config can be lower if simple
- **Location**: Co-locate tests with source files or in `__tests__/` folder

### Test Structure
```typescript
// services/conversation.service.test.ts
describe('ConversationService', () => {
  describe('createConversation', () => {
    it('should create conversation with valid input', async () => {
      // Setup, act, assert
    });
  });
});
```

## 🔐 Security Standards

### Error Handling
- Return proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Include error message in response body
- Log errors with correlation ID
- Never expose stack traces in production

```typescript
// ✅ CORRECT
@Post('/login')
async login(@Body() body: LoginDTO) {
  try {
    const user = await this.authService.login(body);
    return { success: true, user };
  } catch (error) {
    const correlationId = this.req.correlationId;
    this.logger.error({ correlationId, error: error.message });
    throw new BadRequestException('Invalid credentials');
  }
}
```

### Authentication & Authorization
- Use BetterAuth for all auth flows
- Check user status (active/inactive/suspended)
- Enforce role-based access via decorators
- Log all authorization decisions

## 📚 Key Files & Patterns

### Backend Entry Point
```
packages/backend/src/index.ts
- Initializes Express app
- Registers middleware via routing-controllers
- Connects to database
- Starts WebSocket gateway
- Starts BullMQ workers
```

### Auth Flow
```
packages/backend/src/config/auth.ts          # Config
packages/backend/src/types/auth.types.ts     # Types
packages/backend/src/middleware/routing-controllers-auth.ts  # Middleware
packages/backend/src/controllers/auth.controller.ts  # Endpoints
packages/backend/src/services/auth.service.ts       # Business logic
```

### Database
```
packages/backend/src/config/db.ts            # Config & Drizzle setup
packages/backend/src/infrastructure/database-client.ts  # Client
packages/common/src/db/schema.ts             # Tables (shared)
```

### WebSocket
```
packages/backend/src/websockets/gateway.ts   # Socket.io setup
packages/backend/src/websockets/handlers/    # Event handlers
```

### Message Queue
```
packages/backend/src/infrastructure/queue-client.ts  # BullMQ setup
packages/backend/src/workers/retry-worker.ts  # Retry handler
packages/backend/src/workers/dlq-worker.ts    # Dead-letter handler
```

## 🎯 Common Tasks

### Add New Endpoint
1. Create controller: `controllers/your-feature.controller.ts`
2. Create service: `services/your-feature.service.ts`
3. Add types: `types/your-feature.types.ts`
4. Write tests (85%+ coverage)
5. Update API docs in `.docs/02-api-and-data-model.md`

### Add New Database Table
1. Define schema in `packages/common/src/db/schema.ts`
2. Create migration (Drizzle migration)
3. Create service to interact with table
4. Write tests
5. Update data model docs in `.docs/02-api-and-data-model.md`

### Add New Job Type (BullMQ)
1. Create worker: `workers/your-job.worker.ts`
2. Enqueue job: `infrastructure/queue-client.ts`
3. Start worker: Register in `index.ts`
4. Write tests
5. Add job type to `types/jobs.types.ts`

## 📖 Documentation References

- **AGENTS.md** (root): Overall project guidance
- **03-implementation-guide.md**: Architecture, tech decisions, code patterns
- **02-api-and-data-model.md**: API endpoints, database schema, WebSocket events
- **ADR-005**: Infrastructure and config pattern (STRICT)
- **04-qa-and-testing.md**: Testing strategy and test cases
- **GOV-008**: Governance and technical debt tracking

## 🔗 Backend-Specific Links

| Document | Purpose |
|----------|---------|
| `.docs/02-api-and-data-model.md` | 40+ endpoints, request/response formats |
| `.docs/03-implementation-guide.md` | Architecture, tech decisions, code examples |
| `.docs/adr/ADR-005-infrastructure-config-pattern.md` | Config vs Infrastructure pattern |
| `packages/backend/package.json` | Dependencies, scripts |
| `packages/common/src/db/schema.ts` | Shared database schema |

## ⚡ Quick Commands

```bash
# Development
npm run dev                 # Start dev server with hot reload
npm run build               # Build TypeScript
npm start                   # Run built app

# Testing
npm run test                # Run all tests
npm run test:coverage       # Run with coverage report
npm run test:watch          # Run tests in watch mode

# Linting
npm run lint                # Check code style
npm run lint:fix            # Fix linting issues

# Database
npm run db:migrate          # Run migrations
npm run db:generate         # Generate migration files
npm run db:studio           # Open Drizzle Studio
```

## 🚨 Common Pitfalls

1. **Forgetting to register middleware via routing-controllers**: Always use `middlewares` option, not `app.use()`
2. **Using `any` types**: Always create proper interfaces extending `Request`
3. **Creating layered folder structure**: Use flat structure (controllers, services, config, infrastructure)
4. **Not testing business logic**: Mock database and external services in tests
5. **Forgetting to update documentation**: Update `.docs/` files in the same PR
6. **Missing correlation ID in logs**: Always log with correlation ID for tracing
7. **Exposing stack traces in errors**: Return generic error messages in production

## 💬 When to Ask for Help

- **Architecture questions**: Ask architect
- **API design unclear**: Ask architect + frontend dev
- **Database schema design**: Ask architect
- **Testing strategy**: Ask QA
- **Constraints unclear**: Reference AGENTS.md → Code Architecture Constraints section

---

**Last Updated**: January 25, 2026  
**Maintained By**: Enterprise Architect  
**Status**: Active (BE-003 Complete)
