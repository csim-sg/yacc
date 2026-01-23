## Task Description
Create a shared TypeScript types package (`packages/common/`) to maintain type consistency between backend and frontend. This package will include domain entity interfaces, Zod validation schemas, API request/response types, and enums/constants shared across the monorepo.

### Technical Requirements

**1. Package Structure**
```
packages/common/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                 # Main export file
    ├── types/
    │   ├── entities.ts          # Domain entities (User, Conversation, Message, etc.)
    │   ├── api.ts               # API request/response types
    │   ├── auth.ts              # Auth-related types
    │   └── index.ts             # Export all types
    ├── schemas/
    │   ├── entities.ts          # Zod schemas for entities
    │   ├── api.ts               # Zod schemas for API requests/responses
    │   ├── auth.ts              # Auth validation schemas
    │   └── index.ts             # Export all schemas
    ├── constants/
    │   ├── roles.ts             # Role enum and permissions
    │   ├── status.ts            # Status enums (conversation, message, etc.)
    │   ├── errors.ts            # Error codes and messages
    │   └── index.ts             # Export all constants
    └── utils/
        ├── validation.ts        # Common validation utilities
        └── index.ts
```

**2. Package Configuration**

`packages/common/package.json`:
```json
{
  "name": "@omni-inbox/common",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist",
    "lint": "eslint src",
    "test": "jest"
  },
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0"
  }
}
```

`packages/common/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**3. Domain Entity Types**

`packages/common/src/types/entities.ts`:
```typescript
export interface User {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;  // ISO-8601
  updatedAt: string;  // ISO-8601
}

export interface Conversation {
  id: string;
  channel: Channel;
  externalThreadId: string;
  status: ConversationStatus;
  priority: Priority;
  assignedUserId?: string;
  assignedUser?: User;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  senderName?: string;
  body: string;
  status: MessageStatus;
  direction: MessageDirection;
  platformMessageId?: string;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  messageId: string;
  url: string;
  storageKey: string;
  type: string;  // MIME type
  name: string;
  size: number;
  uploadedById?: string;
  uploadedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdById: string;
  createdAt: string;
}

export interface Note {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  conversationId: string;
  actorId?: string;
  actorName?: string;
  isRead: boolean;
  createdAt: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  status: RoutingRuleStatus;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuleCondition {
  field: 'channel' | 'keyword' | 'sender' | 'tag' | 'time';
  operator: 'eq' | 'in' | 'contains' | 'matches' | 'gt' | 'lt';
  value: string | string[];
}

export interface RuleAction {
  type: 'assign' | 'tag' | 'priority';
  value: string;
}

export interface AuditLog {
  id: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface RawPayload {
  id: string;
  messageId: string;
  storageKey: string;
  createdAt: string;
  expiresAt: string;
}
```

**4. API Request/Response Types**

`packages/common/src/types/api.ts`:
```typescript
// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// Conversation Types
export interface GetConversationsQuery {
  page?: number;
  pageSize?: number;
  channel?: Channel;
  assignedUserId?: string;
  status?: ConversationStatus;
  priority?: Priority;
  tagId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateConversationResponse {
  conversation: Conversation;
}

export interface UpdateConversationRequest {
  status?: ConversationStatus;
  priority?: Priority;
  assignedUserId?: string;
}

// Message Types
export interface SendMessageRequest {
  body: string;
  attachments?: FileUpload[];
}

export interface FileUpload {
  name: string;
  type: string;
  size: number;
  url: string;  // CDN URL
}

// Collaboration Types
export interface AddTagRequest {
  tagId: string;
}

export interface CreateNoteRequest {
  body: string;
}

export interface AssignConversationRequest {
  assignedUserId: string;
}

// Bulk Actions
export interface BulkActionRequest {
  conversationIds: string[];
  action: 'assign' | 'tag' | 'changeStatus' | 'changePriority';
  data: {
    assignedUserId?: string;
    tagId?: string;
    status?: ConversationStatus;
    priority?: Priority;
  };
}

export interface BulkActionResponse {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
}

// Routing Rules
export interface CreateRoutingRuleRequest {
  name: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
}

export interface UpdateRoutingRuleRequest {
  name?: string;
  status?: RoutingRuleStatus;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  priority?: number;
}

// Search
export interface SearchConversationsQuery {
  q: string;
  page?: number;
  pageSize?: number;
  channel?: Channel;
  tagId?: string;
  assigneeId?: string;
  status?: ConversationStatus;
  dateFrom?: string;
  dateTo?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

// Error Response
export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, any>;
}
```

**5. Auth Types**

`packages/common/src/types/auth.ts`:
```typescript
export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface AuthSession {
  userId: string;
  email: string;
  role: Role;
}
```

**6. Enums & Constants**

`packages/common/src/constants/roles.ts`:
```typescript
export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
}

export enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

// Permission matrix
export const RolePermissions = {
  [Role.SUPER_ADMIN]: [
    'users:*',
    'roles:*',
    'integrations:*',
    'rules:*',
    'audit:*',
    'inbox:*',
    'messages:*',
    'collaboration:*',
  ],
  [Role.ADMIN]: [
    'inbox:*',
    'messages:*',
    'collaboration:*',
    'audit:read',
  ],
  [Role.MANAGER]: [
    'inbox:*',
    'messages:send',
    'messages:read',
    'collaboration:*',
    'audit:read',
    'rawPayloads:read',
  ],
  [Role.USER]: [
    'inbox:read',
    'messages:send',
    'messages:read',
    'collaboration:create',
    'collaboration:read',
  ],
};
```

`packages/common/src/constants/status.ts`:
```typescript
export enum Channel {
  TELEGRAM = 'telegram',
  IRC = 'irc',
}

export enum ConversationStatus {
  OPEN = 'open',
  PENDING = 'pending',
  RESOLVED = 'resolved',
}

export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

export enum NotificationType {
  ASSIGNMENT = 'assignment',
  MENTION = 'mention',
  UNREAD = 'unread',
}

export enum RoutingRuleStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}
```

`packages/common/src/constants/errors.ts`:
```typescript
export const ErrorCode = {
  // Auth errors
  INVALID_CREDENTIALS: 'invalid_credentials',
  TOKEN_EXPIRED: 'token_expired',
  TOKEN_INVALID: 'token_invalid',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',

  // Validation errors
  VALIDATION_ERROR: 'validation_error',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  INVALID_INPUT: 'invalid_input',

  // Resource errors
  NOT_FOUND: 'not_found',
  ALREADY_EXISTS: 'already_exists',
  CONFLICT: 'conflict',

  // Business logic errors
  CONVERSATION_NOT_FOUND: 'conversation_not_found',
  MESSAGE_SEND_FAILED: 'message_send_failed',
  FILE_TOO_LARGE: 'file_too_large',
  UNSUPPORTED_FILE_TYPE: 'unsupported_file_type',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',

  // Internal errors
  INTERNAL_ERROR: 'internal_error',
  DATABASE_ERROR: 'database_error',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export const ErrorMessage: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_CREDENTIALS]: 'Email or password is incorrect',
  [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.TOKEN_INVALID]: 'Invalid authentication token',
  [ErrorCode.UNAUTHORIZED]: 'You must be logged in to perform this action',
  [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action',
  [ErrorCode.VALIDATION_ERROR]: 'Validation error',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Missing required field',
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.ALREADY_EXISTS]: 'Resource already exists',
  [ErrorCode.CONFLICT]: 'Resource conflict',
  [ErrorCode.CONVERSATION_NOT_FOUND]: 'Conversation not found',
  [ErrorCode.MESSAGE_SEND_FAILED]: 'Failed to send message',
  [ErrorCode.FILE_TOO_LARGE]: 'File size exceeds maximum limit',
  [ErrorCode.UNSUPPORTED_FILE_TYPE]: 'Unsupported file type',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred',
  [ErrorCode.DATABASE_ERROR]: 'Database error occurred',
};
```

**7. Zod Validation Schemas**

`packages/common/src/schemas/entities.ts`:
```typescript
import { z } from 'zod';
import { Role, UserStatus, ConversationStatus, Priority, MessageDirection, MessageStatus, NotificationType, RoutingRuleStatus } from '../constants';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  status: z.nativeEnum(UserStatus),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  channel: z.enum(['telegram', 'irc']),
  externalThreadId: z.string(),
  status: z.nativeEnum(ConversationStatus),
  priority: z.nativeEnum(Priority),
  assignedUserId: z.string().uuid().optional(),
  lastMessageAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid().optional(),
  senderName: z.string().optional(),
  body: z.string(),
  status: z.nativeEnum(MessageStatus),
  direction: z.nativeEnum(MessageDirection),
  platformMessageId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  createdById: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const NoteSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string(),
  body: z.string().min(1).max(5000),
  createdAt: z.string().datetime(),
});

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.nativeEnum(NotificationType),
  conversationId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
  actorName: z.string().optional(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
});
```

`packages/common/src/schemas/api.ts`:
```typescript
import { z } from 'zod';

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordRequestSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8).max(128),
});

export const SendMessageRequestSchema = z.object({
  body: z.string().min(1).max(10000),
  attachments: z.array(z.object({
    name: z.string(),
    type: z.string(),
    size: z.number().max(5 * 1024 * 1024),  // 5MB
    url: z.string().url(),
  })).optional().max(5),
});

export const CreateNoteRequestSchema = z.object({
  body: z.string().min(1).max(5000),
});

export const AssignConversationRequestSchema = z.object({
  assignedUserId: z.string().uuid(),
});

export const BulkActionRequestSchema = z.object({
  conversationIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['assign', 'tag', 'changeStatus', 'changePriority']),
  data: z.object({
    assignedUserId: z.string().uuid().optional(),
    tagId: z.string().uuid().optional(),
    status: z.enum(['open', 'pending', 'resolved']).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  }),
});

export const SearchConversationsQuerySchema = z.object({
  q: z.string().min(1),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  channel: z.enum(['telegram', 'irc']).optional(),
  tagId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  status: z.enum(['open', 'pending', 'resolved']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
```

**8. Main Export File**

`packages/common/src/index.ts`:
```typescript
// Types
export * from './types/entities';
export * from './types/api';
export * from './types/auth';

// Schemas
export * from './schemas/entities';
export * from './schemas/api';
export * from './schemas/auth';

// Constants
export * from './constants/roles';
export * from './constants/status';
export * from './constants/errors';
```

**9. Monorepo Integration**

Update `pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

Update `packages/backend/package.json`:
```json
{
  "dependencies": {
    "@omni-inbox/common": "workspace:*",
    ...
  }
}
```

Update `packages/frontend/package.json`:
```json
{
  "dependencies": {
    "@omni-inbox/common": "workspace:*",
    ...
  }
}
```

**10. Build Scripts**

Add to root `package.json`:
```json
{
  "scripts": {
    "build:common": "cd packages/common && pnpm build",
    "dev:common": "cd packages/common && pnpm dev",
    "clean": "turbo run clean"
  }
}
```

Add to `turbo.json`:
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### Usage Examples

**Backend (API Validation)**:
```typescript
import { LoginRequestSchema, ErrorCode } from '@omni-inbox/common';
import { z } from 'zod';

export async function login(req: Request, res: Response) {
  try {
    const validated = LoginRequestSchema.parse(req.body);
    // ... authenticate user
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid input',
        details: error.errors,
      });
    }
  }
}
```

**Frontend (Type Safety)**:
```typescript
import { User, Role, ConversationStatus } from '@omni-inbox/common';

interface AppState {
  user: User | null;
  conversations: Conversation[];
}

function canAssignConversation(user: User): boolean {
  return [Role.ADMIN, Role.MANAGER].includes(user.role);
}

function getBadgeColor(status: ConversationStatus): string {
  switch (status) {
    case ConversationStatus.OPEN: return 'bg-green-500';
    case ConversationStatus.PENDING: return 'bg-yellow-500';
    case ConversationStatus.RESOLVED: return 'bg-gray-500';
  }
}
```

## Priority
P0 - Critical - blocks Phase 1 completion or release

## Assignee
Backend

## Acceptance Criteria
- [ ] `packages/common/` package created with proper structure
- [ ] `package.json` configured with dependencies (zod)
- [ ] `tsconfig.json` configured with proper TypeScript settings
- [ ] Domain entity types defined:
  - [ ] User, Conversation, Message, Attachment
  - [ ] Tag, Note, Notification, RoutingRule
  - [ ] AuditLog, RawPayload
- [ ] API request/response types defined:
  - [ ] LoginRequest, LoginResponse
  - [ ] ForgotPasswordRequest, ResetPasswordRequest
  - [ ] GetConversationsQuery, SendMessageRequest
  - [ ] Collaboration types (AddTagRequest, CreateNoteRequest, AssignConversationRequest)
  - [ ] BulkActionRequest, BulkActionResponse
  - [ ] CreateRoutingRuleRequest, UpdateRoutingRuleRequest
  - [ ] SearchConversationsQuery, PaginatedResponse
  - [ ] ErrorResponse
- [ ] Auth types defined (JWTPayload, AuthSession)
- [ ] Enums & constants defined:
  - [ ] Role, UserStatus
  - [ ] Channel, ConversationStatus, Priority
  - [ ] MessageDirection, MessageStatus
  - [ ] NotificationType, RoutingRuleStatus
  - [ ] ErrorCode, ErrorMessage
  - [ ] RolePermissions
- [ ] Zod validation schemas created:
  - [ ] Entity schemas (UserSchema, ConversationSchema, MessageSchema, etc.)
  - [ ] API schemas (LoginRequestSchema, SendMessageRequestSchema, etc.)
  - [ ] All schemas exported from schemas/index.ts
- [ ] Main export file (`src/index.ts`) re-exports all types, schemas, and constants
- [ ] Package builds successfully (`pnpm build`)
- [ ] TypeScript types generated in `dist/` directory
- [ ] Monorepo integration:
  - [ ] Added to `pnpm-workspace.yaml`
  - [ ] Backend and frontend reference as workspace dependency
  - [ ] Build pipeline configured in `turbo.json`
- [ ] Documentation created (README.md in packages/common/)
- [ ] Type imports work in both backend and frontend
- [ ] Unit tests for Zod schemas (validation logic)

## Status
Not Started

## Dependencies
- None (should be implemented first)

## Category
Backend
