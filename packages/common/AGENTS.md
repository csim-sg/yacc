# YACC Common - Agent Guide

This is the **common/shared package** for YACC. This guide supplements the root `AGENTS.md` with common package-specific guidance.

## 📍 Location
- **Path**: `/packages/common/`
- **Runtime**: Node.js + Browser (isomorphic)
- **Purpose**: Shared types, database schema, utilities used by both backend and frontend

## 🎯 Shared Package Responsibilities

### What You Maintain
- **Database schema** (Drizzle ORM tables used by backend)
- **Shared types & interfaces** (DTOs, domain models, API contracts)
- **Type definitions** for constants (roles, permissions, status values)
- **Utility functions** used by both frontend and backend
- **Validation schemas** (Zod for runtime validation)
- **Environment configuration types**

### Key Dependencies
- **Drizzle**: Database ORM (schema definitions)
- **Zod**: Schema validation library
- **TypeScript**: Type definitions

## 📂 Folder Structure

### Current Structure
```
packages/common/
├── src/
│   ├── db/
│   │   └── schema.ts       # Drizzle table definitions
│   ├── types/
│   │   ├── api.ts          # API request/response types
│   │   ├── domain.ts       # Domain models
│   │   ├── auth.ts         # Auth-related types
│   │   ├── message.ts      # Message types
│   │   ├── conversation.ts # Conversation types
│   │   └── index.ts        # Main export
│   ├── schemas/
│   │   ├── auth.schema.ts  # Zod schemas for validation
│   │   ├── message.schema.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── date-utils.ts
│   │   ├── error.ts        # Error classes
│   │   └── index.ts
│   └── constants/
│       ├── roles.ts        # Role constants & permissions
│       ├── status.ts       # Status enums
│       └── index.ts
├── tsconfig.json
└── package.json
```

## 🔧 Key Patterns & Constraints

### 1. Database Schema (Drizzle)

```typescript
// src/db/schema.ts
import { pgTable, serial, text, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password_hash: text('password_hash').notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  channel: varchar('channel', { length: 255 }).notNull(),
  external_thread_id: varchar('external_thread_id', { length: 255 }),
  status: varchar('status', { length: 50 }).default('open'),
  priority: varchar('priority', { length: 50 }).default('normal'),
  assigned_user_id: serial('assigned_user_id').references(() => users.id),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});
```

### 2. Shared Type Definitions

```typescript
// src/types/domain.ts
export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  channel: string;
  externalThreadId?: string;
  status: ConversationStatus;
  priority: Priority;
  assignedUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'user';
export type UserStatus = 'active' | 'inactive' | 'suspended';
export type ConversationStatus = 'open' | 'pending' | 'resolved';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
```

### 3. API Request/Response Types

```typescript
// src/types/api.ts
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
  token: string;
}

export interface GetConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SendMessageRequest {
  conversationId: string;
  body: string;
  attachmentIds?: string[];
}

export interface SendMessageResponse {
  id: string;
  conversationId: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
}
```

### 4. Zod Validation Schemas

```typescript
// src/schemas/auth.schema.ts
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const PasswordResetSchema = z.object({
  token: z.string().min(1, 'Token required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain number'),
});

export type PasswordResetInput = z.infer<typeof PasswordResetSchema>;
```

### 5. Constants & Enums

```typescript
// src/constants/roles.ts
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
} as const;

export const ROLE_HIERARCHY = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  user: 1,
} as const;

// src/constants/status.ts
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;

export const CONVERSATION_STATUS = {
  OPEN: 'open',
  PENDING: 'pending',
  RESOLVED: 'resolved',
} as const;
```

## 🎯 Usage in Backend & Frontend

### Backend Usage
```typescript
// Backend imports from common
import { users, conversations } from '@yacc/common/db/schema';
import type { User, Conversation, LoginRequest } from '@yacc/common/types';
import { LoginSchema } from '@yacc/common/schemas';
import { ROLES } from '@yacc/common/constants';

// In backend service
export class AuthService {
  async login(payload: LoginRequest): Promise<User> {
    // Validate input
    const validated = LoginSchema.parse(payload);
    
    // Query database
    const user = await db.query.users.findFirst({
      where: (u) => eq(u.email, validated.email),
    });
    
    // Type is inferred from schema
    return user;
  }
}
```

### Frontend Usage
```typescript
// Frontend imports from common
import type { User, Conversation, LoginResponse } from '@yacc/common/types';
import { ROLES, CONVERSATION_STATUS } from '@yacc/common/constants';

// In frontend hook
export const useConversationStatus = () => {
  const [status, setStatus] = React.useState<ConversationStatus>(
    CONVERSATION_STATUS.OPEN
  );
  
  return status;
};

// In component
const ConversationBadge = ({ status }: { status: ConversationStatus }) => {
  if (status === CONVERSATION_STATUS.RESOLVED) {
    return <span className="badge-resolved">Resolved</span>;
  }
  return <span className="badge-open">Open</span>;
};
```

## 📋 Development Workflow

### Adding a New Type
1. Create type file in `src/types/`
2. Export from `src/types/index.ts`
3. Create corresponding Zod schema if validation needed
4. Document in TypeScript comments

### Adding a New Database Table
1. Define table in `src/db/schema.ts`
2. Create corresponding type interface in `src/types/`
3. Create Zod schema for operations if needed
4. Export from index files
5. Create database migration (backend responsibility)

### Adding Shared Constants
1. Create constant file in `src/constants/`
2. Use `as const` for type inference
3. Export from `src/constants/index.ts`
4. Use in backend and frontend consistently

## 🧪 Testing

```bash
npm run test                # Run tests
npm run test:coverage       # Run with coverage
```

### Test Strategy
- Types are verified at compile time (TypeScript)
- Zod schemas tested with jest
- Constants tested for consistency
- Database schema tested in backend integration tests

## 🔗 Import Patterns

### Correct Imports
```typescript
// ✅ CORRECT: Specific imports from subfolders
import type { User, Conversation } from '@yacc/common/types';
import { users, conversations } from '@yacc/common/db/schema';
import { LoginSchema } from '@yacc/common/schemas';
import { ROLES, ROLE_HIERARCHY } from '@yacc/common/constants';

// ✅ CORRECT: Namespace imports when needed
import * as Types from '@yacc/common/types';
import * as Constants from '@yacc/common/constants';

// ❌ WRONG: Importing from main index for large modules
import { User, Conversation, /* 50+ other types */ } from '@yacc/common';
```

### Package.json Configuration
```json
{
  "exports": {
    "./db": "./dist/db/index.js",
    "./types": "./dist/types/index.js",
    "./schemas": "./dist/schemas/index.js",
    "./constants": "./dist/constants/index.js",
    "./utils": "./dist/utils/index.js"
  }
}
```

## 📖 Documentation References

- **AGENTS.md** (root): Overall project guidance
- **02-api-and-data-model.md**: Database schema, API types
- **03-implementation-guide.md**: Architecture patterns

## 🚨 Common Pitfalls

1. **Type definitions too specific to one system**: Keep types generic, usable by both
2. **Not exporting types properly**: Always export from index files
3. **Mixing database schema with API types**: Keep separate (schema.ts vs api.ts)
4. **Not validating with Zod**: Always use Zod for runtime validation
5. **Inconsistent constants**: Use CONSTANT_NAME pattern, centralize in constants/
6. **Circular dependencies**: Don't import backend services in frontend types
7. **Hardcoded values**: Use constants instead

## 💬 When to Ask for Help

- **Type design unclear**: Ask architect
- **Database schema design**: Ask architect + backend dev
- **API contract unclear**: Ask architect + backend + frontend dev
- **Constants organization**: Ask architect

## ⚡ Quick Commands

```bash
npm run build                # Build TypeScript
npm run test                 # Run tests
npm test:coverage           # Run with coverage
npm run lint                # Check code style
npm run lint:fix            # Fix linting issues
```

## 📚 Key Files to Know

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Drizzle table definitions |
| `src/types/domain.ts` | Domain models shared across systems |
| `src/types/api.ts` | API request/response types |
| `src/types/auth.ts` | Authentication types |
| `src/schemas/auth.schema.ts` | Zod validation schemas |
| `src/constants/roles.ts` | Role and permission constants |

---

**Last Updated**: January 25, 2026  
**Maintained By**: Enterprise Architect  
**Status**: Active (Phase 1 Development)
