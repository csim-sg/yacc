# YACC Backend - Agent Guide

This is the **backend package** for YACC. This guide provides essentials summaries with links to detailed guides in `.docs/agents/`.

---

## 📍 PROJECT OVERVIEW

**Path**: `/packages/backend/`  
**Runtime**: Node.js 18+  
**Framework**: Express + routing-controllers  
**Database**: PostgreSQL + Drizzle ORM  
**Real-Time**: Socket.io WebSocket gateway  
**Message Queue**: Redis + BullMQ  
**File Storage**: Cloudflare R2  

### What You Build
- REST API endpoints (40+ across auth, inbox, messaging, rules)
- WebSocket gateway for real-time events
- Database models & migrations
- Business logic services (auth, messaging, search, rules engine, notifications, audit logging)
- External integrations (Telegram, IRC)
- Message queue workers (retry, dead-letter queue)

### Key Dependencies
- **Express + routing-controllers**: REST API framework
- **BetterAuth**: Authentication & authorization
- **Drizzle**: Type-safe database ORM
- **PostgreSQL**: Primary database
- **Redis + BullMQ**: Message queue for retries
- **Socket.io**: WebSocket for real-time
- **Cloudflare R2**: File storage
- **Pino**: Structured logging

📚 **For detailed overview**: See `.docs/agents/01-PROJECT-OVERVIEW.md`

---

## 🔧 BUILD & TEST COMMANDS

### Quick Start
```bash
pnpm --filter @yacc/backend dev        # Start dev server (port 3000)
pnpm --filter @yacc/backend test       # Run tests
pnpm --filter @yacc/backend build      # Build for production
pnpm --filter @yacc/backend lint       # Run ESLint
```

### Database Setup
```bash
docker-compose up -d                   # Start PostgreSQL, Redis, Mailhog
pnpm --filter @yacc/backend migrate    # Run migrations
```

### From Backend Directory
```bash
cd packages/backend
pnpm dev               # Start dev server
pnpm test              # Run tests
pnpm build             # Build
pnpm lint              # Lint code
pnpm db:migrate        # Run migrations
pnpm db:studio         # Open Drizzle Studio
```

📚 **For detailed build commands**: See `.docs/agents/02-BUILD-COMMANDS.md`

---

## 📂 FOLDER STRUCTURE (STRICT)

### Flat Structure (Required)
```
packages/backend/src/
├── controllers/        # API endpoints (@JsonController)
├── services/           # Business logic
├── middleware/         # Express middleware
├── config/             # Configuration objects (data only)
├── infrastructure/     # Singleton clients (DB, Redis, Logger, etc.)
├── types/              # TypeScript interfaces & DTOs
├── connectors/         # External platform integrations
├── websockets/         # Socket.io event handlers
├── workers/            # BullMQ job processors
├── utils/              # Utility functions
└── index.ts            # App entry point
```

### Anti-Patterns (DO NOT CREATE)
```
❌ NO: packages/backend/src/api/controllers/
❌ NO: packages/backend/src/domain/services/
❌ NO: packages/backend/src/infrastructure/clients/ (flat structure only)
```

### Key Constraints
- ✅ **One definition per file** (one class, interface, or function)
- ✅ **Direct imports** (no barrel exports with index.ts)
- ✅ **Flat structure** (no nested api/, domain/, infrastructure/ folders)

📚 **For detailed folder structure**: See `.docs/agents/03-FOLDER-STRUCTURE.md`

---

## 💻 CODE STYLE GUIDELINES

### Essentials (CRITICAL RULES)

1. **No `any` Types**
   - Always type variables, parameters, return values
   - Create interfaces extending `Request` for Express types

2. **Config vs Infrastructure Pattern**
   - **Config**: Plain data objects with env vars
   - **Infrastructure**: Singleton client classes (DB, Redis, Logger)

3. **No Wrapper Classes**
   - Use libraries directly (Drizzle, Pino, Redis)
   - Don't create `DatabaseClient`, `LoggerService` wrappers

4. **One Definition Per File**
   - One class/interface/function per file
   - Clear, single responsibility

5. **Middleware Registration**
   - Register via routing-controllers `middlewares` option
   - NOT via `app.use()`

6. **Type-Safe Database Queries**
   - Use Drizzle query builder
   - Never raw SQL strings

### Code Style Tools
- **Linter**: ESLint
- **Formatter**: Prettier (optional)
- **Type Checker**: TypeScript strict mode

📚 **For detailed code style**: See `.docs/agents/04-CODE-STYLE-GUIDELINES.md` + `DEVELOPER-AGENT-SYSTEM-PROMPT.md`

---

## 🧪 TESTING INSTRUCTIONS

### Quick Commands
```bash
pnpm --filter @yacc/backend test              # Run all tests
pnpm --filter @yacc/backend test:coverage     # With coverage report
pnpm --filter @yacc/backend test:watch        # Watch mode
```

### Testing Requirements
- **Coverage Target**: 85% minimum for all new code
- **Framework**: Vitest (Jest-compatible)
- **Test Structure**: Describe/it blocks (BDD style)
- **Location**: Co-locate with source or in `__tests__/` folder
- **Exceptions**: Infrastructure/config can be lower if simple

### Test Example
```typescript
describe('ConversationService', () => {
  it('should list conversations for user', async () => {
    // Arrange, Act, Assert
  });
});
```

📚 **For detailed testing**: See `.docs/agents/05-TESTING-INSTRUCTIONS.md`

---

## 🔐 SECURITY CONSIDERATIONS

### Essentials (CRITICAL)

1. **Error Handling**
   - Return proper HTTP status codes (400, 401, 403, 404, 500)
   - Never expose stack traces in production
   - Log errors with correlation ID

2. **Authentication**
   - Use BetterAuth for all auth flows
   - Check user status (active/inactive/suspended)
   - Enforce RBAC via decorators

3. **Input Validation**
   - Use Zod schemas for request validation
   - Never trust user input

4. **Database Security**
   - Drizzle prevents SQL injection (use query builder)
   - No raw SQL strings

5. **Secret Management**
   - Store secrets in `.env` files (never committed)
   - Load via `process.env`
   - Don't log sensitive data (passwords, tokens, API keys)

6. **Logging Security**
   - Never log passwords, tokens, or API keys
   - Always include correlation ID for tracing
   - Log authentication/authorization decisions

### Security Checklist
- [ ] No stack traces exposed in errors
- [ ] All inputs validated with Zod
- [ ] No hardcoded secrets
- [ ] No sensitive data in logs
- [ ] Authentication enforced on protected endpoints
- [ ] RBAC rules enforced
- [ ] SQL queries use Drizzle (no raw SQL)
- [ ] Error messages are generic (no info leakage)

📚 **For detailed security**: See `.docs/agents/06-SECURITY-GUIDELINES.md`

---

## 📋 DEVELOPMENT WORKFLOW

### Starting a Feature
1. Create feature branch: `git checkout -b feature/BE-XXX-description`
2. Implement feature following code style guidelines
3. Write tests (85%+ coverage)
4. Run `pnpm lint` to check code quality
5. Update `.docs/` files if needed
6. Commit with clear message
7. Create PR against `dev` branch
8. Wait for architect review

### Pre-Commit Checklist
- [ ] No `any` types used
- [ ] Flat folder structure (no nested api/, domain/)
- [ ] One definition per file
- [ ] Tests ≥ 85% coverage
- [ ] Lint passes
- [ ] Clear commit message
- [ ] `.docs/` files updated
- [ ] ADR referenced (if architectural change)

📚 **For detailed workflow**: See `.docs/agents/07-DEVELOPMENT-WORKFLOW.md`

---

## 🔗 KEY FILES & PATTERNS

### Entry Point
- `packages/backend/src/index.ts` — Initializes Express, middleware, database, WebSocket, workers

### Auth Flow
- `src/config/auth.ts` — Config
- `src/types/auth.types.ts` — Types
- `src/middleware/authBetterauth.middleware.ts` — Middleware
- `src/controllers/auth.controller.ts` — Endpoints
- `src/services/auth.service.ts` — Business logic

### Database
- `packages/common/src/db/schema.ts` — All table definitions
- `src/infrastructure/db.client.ts` — Drizzle client

### Real-Time (WebSocket)
- `src/websockets/gateway.ts` — Socket.io setup
- `src/websockets/handlers/` — Event handlers

### Message Queue
- `src/infrastructure/queue.client.ts` — BullMQ setup
- `src/workers/` — Job processors

📚 **For detailed patterns**: See `.docs/agents/08-KEY-PATTERNS.md`

---

## 🎯 COMMON TASKS

### Add New Endpoint
1. Create `controllers/feature.controller.ts`
2. Create `services/feature.service.ts`
3. Create `types/feature.types.ts`
4. Write tests (85%+ coverage)
5. Update API docs

### Add New Database Table
1. Define in `packages/common/src/db/schema.ts`
2. Create migration
3. Create service
4. Write tests

### Add New Job Type
1. Create `workers/job-name.worker.ts`
2. Enqueue in `infrastructure/queue.client.ts`
3. Register in `index.ts`
4. Write tests

📚 **For detailed task guides**: See `.docs/agents/09-COMMON-TASKS.md`

---

## 📚 DOCUMENTATION ROADMAP

| Topic | Location | Purpose |
|-------|----------|---------|
| **Project Overview** | `.docs/agents/01-PROJECT-OVERVIEW.md` | Detailed project context, goals, architecture |
| **Build Commands** | `.docs/agents/02-BUILD-COMMANDS.md` | All build, test, debug, deploy commands |
| **Folder Structure** | `.docs/agents/03-FOLDER-STRUCTURE.md` | Detailed folder organization & examples |
| **Code Style** | `.docs/agents/04-CODE-STYLE-GUIDELINES.md` | Naming, formatting, patterns, examples |
| **Testing** | `.docs/agents/05-TESTING-INSTRUCTIONS.md` | Mocking, fixtures, integration tests |
| **Security** | `.docs/agents/06-SECURITY-GUIDELINES.md` | Validation, auth, secrets, logging |
| **Workflow** | `.docs/agents/07-DEVELOPMENT-WORKFLOW.md` | Git flow, PR process, collaboration |
| **Patterns** | `.docs/agents/08-KEY-PATTERNS.md` | Real-world code examples |
| **Tasks** | `.docs/agents/09-COMMON-TASKS.md` | Step-by-step task guides |
| **System Prompt** | `DEVELOPER-AGENT-SYSTEM-PROMPT.md` | 10 code patterns + 11 boilerplate patterns |

---

## 🤖 FOR AI DEVELOPER AGENTS

**Primary Reference**: `DEVELOPER-AGENT-SYSTEM-PROMPT.md` (this directory)
- 10 code patterns with examples
- 11 boilerplate reduction patterns
- 5 anti-patterns to avoid
- 6 critical rules (non-negotiable)
- Pre-commit checklist

**Secondary Reference**: `.docs/agents/` (detailed guides)
- Use for deep dives on specific topics
- Reference when patterns need clarification
- Examples for implementation details

---

## 🚨 COMMON PITFALLS

1. ❌ Creating wrapper classes (DatabaseClient, LoggerService)
2. ❌ Nested folder structures (api/, domain/, infrastructure/)
3. ❌ Using `any` types
4. ❌ Forgetting 85% test coverage
5. ❌ Raw SQL instead of Drizzle
6. ❌ Logging sensitive data (passwords, tokens)
7. ❌ Not updating documentation
8. ❌ Exposing stack traces in errors

---

## 💬 WHEN TO ASK FOR HELP

- **Architecture questions** → Ask architect
- **API design unclear** → Ask architect + frontend dev
- **Database schema** → Ask architect
- **Testing strategy** → Ask QA
- **Code style questions** → See DEVELOPER-AGENT-SYSTEM-PROMPT.md
- **Security concerns** → See `.docs/agents/06-SECURITY-GUIDELINES.md`

---

## 📌 QUICK REFERENCE

**Setup**: `pnpm install && docker-compose up -d`  
**Dev Server**: `pnpm --filter @yacc/backend dev`  
**Tests**: `pnpm --filter @yacc/backend test`  
**Type Check**: TypeScript in strict mode  
**Lint**: `pnpm --filter @yacc/backend lint`  
**Coverage Target**: 85% minimum  
**Node Version**: 18+  
**Package Manager**: pnpm  

---

**Last Updated**: January 29, 2026  
**Maintained By**: Enterprise Architect  
**Status**: Active  
**Related**: DEVELOPER-AGENT-SYSTEM-PROMPT.md, `.docs/agents/` guides
