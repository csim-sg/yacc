# BE-009/010: Message Retrieval & Send API - Implementation Plan

**Branch**: `task/BE-009-010-message-api`  
**Duration**: 6-8 hours  
**Start**: Feb 9, 2026  
**End**: Feb 10, 2026  
**Target**: Message send/receive cycle working with stub connector

---

## 📋 SCOPE

### Story BE-009: Message Retrieval
**Endpoint**: `GET /conversations/:id/messages`  
**Role**: All authenticated users  
**Purpose**: Fetch messages for a conversation

### Story BE-010: Message Send
**Endpoint**: `POST /conversations/:id/messages`  
**Role**: managers, users only  
**Purpose**: Send a reply to a conversation

---

## 🎯 ACCEPTANCE CRITERIA

### BE-009: Message Retrieval
- [ ] Fetch messages paginated (default 50 per page)
- [ ] Messages ordered chronologically (oldest first)
- [ ] Include sender info (name, avatar if available)
- [ ] Support filters: `page`, `limit`, `direction` (inbound/outbound)
- [ ] 404 if conversation not found
- [ ] Proper error handling (500 on DB error)
- [ ] ≥85% test coverage

### BE-010: Message Send
- [ ] Role validation (user, manager only)
- [ ] Conversation must exist (404 if not)
- [ ] Body validation (non-empty, max 10,000 chars)
- [ ] Message saved to DB with `status: pending`
- [ ] Direction set to `outbound`
- [ ] Sender ID populated from auth token
- [ ] Dispatch to stub connector (simulate send)
- [ ] Update message status to `sent` (success) or `failed` (error)
- [ ] WebSocket event stub (placeholder for BE-017)
- [ ] Audit logging (optional for Phase 2A)
- [ ] ≥85% test coverage

---

## 🔧 IMPLEMENTATION STEPS

### Step 1: Create Types (1 hour)

**File**: `packages/backend/src/types/message.types.ts`

```typescript
export interface GetMessagesQuery {
  page?: number;
  limit?: number;
  direction?: 'inbound' | 'outbound';
}

export interface SendMessageRequestBody {
  body: string;
  attachmentIds?: string[]; // Optional, Phase 2B
}

export interface MessageResponseDTO {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderName: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  direction: 'inbound' | 'outbound';
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendMessageResponseDTO extends MessageResponseDTO {
  externalMessageId?: string;
}

export interface ErrorDetails {
  code: string;
  message: string;
  timestamp: Date;
}
```

---

### Step 2: Create Message Service (2 hours)

**File**: `packages/backend/src/services/message.service.ts`

```typescript
import { db } from '../infrastructure/db.client.js';
import { messages } from '@yacc/common/db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import type { Message } from '@yacc/common/types';
import type { SendMessageRequestBody, GetMessagesQuery } from '../types/message.types.js';
import { logger } from '../infrastructure/logger.js';

export class MessageService {
  async getConversationMessages(
    conversationId: string,
    query: GetMessagesQuery
  ): Promise<{ messages: Message[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const offset = (page - 1) * limit;

    try {
      // Build query
      let queryBuilder = db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId));

      // Filter by direction if specified
      if (query.direction) {
        queryBuilder = queryBuilder.where(
          eq(messages.direction, query.direction)
        );
      }

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(eq(messages.conversationId, conversationId));

      const total = countResult[0]?.count || 0;

      // Fetch paginated, ordered by createdAt asc
      const msgs = await queryBuilder
        .orderBy(asc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      return { messages: msgs, total };
    } catch (error) {
      logger.error('Failed to fetch messages', {
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async sendMessage(
    conversationId: string,
    userId: string,
    payload: SendMessageRequestBody
  ): Promise<Message> {
    try {
      // Create message with pending status
      const newMessage = await db.insert(messages).values({
        conversationId,
        senderId: userId,
        senderName: 'You', // Will be replaced with actual user name (Phase 2B)
        body: payload.body,
        status: 'pending',
        direction: 'outbound',
        externalMessageId: undefined,
        metadata: null,
      }).returning();

      // Dispatch to connector (stub for Phase 2A)
      try {
        await this.dispatchToConnector(conversationId, newMessage[0]);
      } catch (connectorError) {
        logger.error('Connector dispatch failed', {
          messageId: newMessage[0].id,
          error: connectorError instanceof Error ? connectorError.message : 'Unknown',
        });
        // Don't throw; message is saved, status will be 'failed' when we get response
      }

      return newMessage[0];
    } catch (error) {
      logger.error('Failed to send message', {
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async dispatchToConnector(
    conversationId: string,
    message: Message
  ): Promise<void> {
    // Stub connector: simulate sending
    // In Phase 2B, this will dispatch to Telegram/IRC connectors
    logger.info('Dispatching message to connector', {
      messageId: message.id,
      conversationId,
    });

    // For now, immediately mark as sent (stub behavior)
    // In Phase 2B with real connectors, this will be async + event-driven
    await db
      .update(messages)
      .set({ status: 'sent', updatedAt: new Date() })
      .where(eq(messages.id, message.id));
  }
}

export const messageService = new MessageService();
```

---

### Step 3: Create Message Controller (1.5 hours)

**File**: `packages/backend/src/controllers/message.controller.ts`

```typescript
import { JsonController, Get, Post, Param, Body, QueryParams, Res, UseBefore } from 'routing-controllers';
import { Response } from 'express';
import { messageService } from '../services/message.service.js';
import type { AuthenticatedRequest } from '../types/auth.types.js';
import { authBetterAuthMiddleware } from '../middleware/authBetterAuth.middleware.js';
import { roleGuard } from '../middleware/roleGuard.middleware.js';
import type { GetMessagesQuery, SendMessageRequestBody } from '../types/message.types.js';
import { logger } from '../infrastructure/logger.js';
import { conversationService } from '../services/conversation.service.js';

@JsonController('/conversations/:conversationId/messages')
@UseBefore(authBetterAuthMiddleware)
export class MessageController {
  /**
   * GET /conversations/:conversationId/messages
   * Fetch messages for a conversation
   */
  @Get()
  async getMessages(
    @Param('conversationId') conversationId: string,
    @QueryParams() query: GetMessagesQuery,
    @Res() res: Response
  ) {
    try {
      // Validate conversation exists
      const conversation = await conversationService.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Fetch messages
      const { messages, total } = await messageService.getConversationMessages(
        conversationId,
        query
      );

      return res.status(200).json({
        messages,
        total,
        page: query.page || 1,
        limit: query.limit || 50,
      });
    } catch (error) {
      logger.error('GET /messages error', {
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  /**
   * POST /conversations/:conversationId/messages
   * Send a message to a conversation
   */
  @Post()
  @UseBefore(roleGuard(['user', 'manager']))
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() payload: SendMessageRequestBody,
    @Res() res: Response
  ) {
    try {
      // Validate request body
      if (!payload.body || payload.body.trim().length === 0) {
        return res.status(400).json({ error: 'Message body is required' });
      }
      if (payload.body.length > 10000) {
        return res.status(400).json({ error: 'Message body exceeds max length (10000 chars)' });
      }

      // Validate conversation exists
      const conversation = await conversationService.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Extract user ID from request (set by auth middleware)
      const userId = (res as any).locals?.userId || (res.req as AuthenticatedRequest).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Send message
      const message = await messageService.sendMessage(conversationId, userId, payload);

      return res.status(201).json(message);
    } catch (error) {
      logger.error('POST /messages error', {
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return res.status(500).json({ error: 'Failed to send message' });
    }
  }
}
```

---

### Step 4: Create Tests (2 hours)

**File**: `packages/backend/tests/BE-009-010-message-api.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../src/index.js';
import request from 'supertest';
import { db } from '../src/infrastructure/db.client.js';
import { messages, conversations } from '@yacc/common/db/schema.js';
import { eq } from 'drizzle-orm';

describe('BE-009/010: Message API', () => {
  let conversationId: string;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Setup: Create test user and conversation
    const loginRes = await request(app)
      .post('/auth/sign-in/email')
      .send({ email: 'test@example.com', password: 'TestPassword123' });

    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;

    // Create conversation
    const convRes = await db.insert(conversations).values({
      channel: 'test-channel',
      status: 'open',
      priority: 'normal',
    }).returning();

    conversationId = convRes[0].id;
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(messages).where(eq(messages.conversationId, conversationId));
    await db.delete(conversations).where(eq(conversations.id, conversationId));
  });

  describe('GET /conversations/:id/messages', () => {
    it('should return empty messages for new conversation', async () => {
      const res = await request(app)
        .get(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('should return 404 for non-existent conversation', async () => {
      const res = await request(app)
        .get(`/conversations/invalid-id/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Conversation not found');
    });

    it('should return 401 if not authenticated', async () => {
      const res = await request(app).get(`/conversations/${conversationId}/messages`);

      expect(res.status).toBe(401);
    });

    it('should support pagination', async () => {
      // Create 10 messages
      for (let i = 0; i < 10; i++) {
        await db.insert(messages).values({
          conversationId,
          senderId: userId,
          senderName: 'Test User',
          body: `Message ${i}`,
          status: 'sent',
          direction: 'inbound',
        });
      }

      const res = await request(app)
        .get(`/conversations/${conversationId}/messages`)
        .query({ page: 1, limit: 5 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBe(5);
      expect(res.body.total).toBe(10);
    });
  });

  describe('POST /conversations/:id/messages', () => {
    it('should send a message successfully', async () => {
      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Hello, World!' });

      expect(res.status).toBe(201);
      expect(res.body.body).toBe('Hello, World!');
      expect(res.body.status).toBe('sent'); // Stub connector marks as sent
      expect(res.body.direction).toBe('outbound');
      expect(res.body.senderId).toBe(userId);
    });

    it('should reject empty message body', async () => {
      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should reject message exceeding max length', async () => {
      const longBody = 'a'.repeat(10001);
      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: longBody });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('max length');
    });

    it('should return 404 for non-existent conversation', async () => {
      const res = await request(app)
        .post(`/conversations/invalid-id/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Test' });

      expect(res.status).toBe(404);
    });

    it('should reject unauthorized users (role validation)', async () => {
      // Create non-user account (e.g., super_admin)
      const adminRes = await request(app)
        .post('/auth/sign-in/email')
        .send({ email: 'admin@example.com', password: 'AdminPassword123' });

      const adminToken = adminRes.body.token;

      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Unauthorized' });

      expect(res.status).toBe(403);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .send({ body: 'Test' });

      expect(res.status).toBe(401);
    });
  });
});
```

---

### Step 5: Update Index Files (30 mins)

**Update**: `packages/backend/src/controllers/index.ts`

```typescript
// ... existing imports
import { MessageController } from './message.controller.js';

export const controllers = [
  AuthController,
  ConversationsController,
  MessageController,  // ADD THIS
  // ... other controllers
];
```

---

### Step 6: Update API Documentation (30 mins)

**File**: `.docs/02-api-and-data-model.md` (Message section)

- [ ] Document `GET /conversations/:id/messages` endpoint
- [ ] Document `POST /conversations/:id/messages` endpoint
- [ ] Include request/response examples
- [ ] Document status codes and error responses

---

## ⚙️ TECHNICAL DECISIONS

### Message Status Flow
- **pending**: Message created but not yet sent to connector
- **sent**: Connector confirmed delivery
- **failed**: Connector failed to deliver (retry later via BE-014)

### Stub Connector Behavior (Phase 2A)
- Immediately marks message as 'sent'
- In Phase 2B, will be replaced with real Telegram/IRC connectors
- Allows BE-009/010 to be completed independently

### Error Handling
- Roll back message creation on save failure
- Log all errors with correlation ID
- Return generic error messages to client (no stack traces)

### Pagination
- Default 50 messages per page
- Max 100 messages per request
- Page numbers start at 1

---

## 🚀 DEFINITION OF DONE

- [ ] BE-009: GET /messages endpoint working
- [ ] BE-010: POST /messages endpoint working
- [ ] 15+ unit/integration tests passing
- [ ] 85%+ code coverage
- [ ] Role-based access control enforced
- [ ] All error cases handled
- [ ] Stub connector working (marks as 'sent')
- [ ] API documented
- [ ] No TypeScript errors
- [ ] No `any` types
- [ ] Flat folder structure maintained
- [ ] PR created for review
- [ ] Architect approval received

---

## 📝 FILES TO CREATE

```
packages/backend/src/
├── controllers/message.controller.ts (NEW)
├── services/message.service.ts (NEW)
├── types/message.types.ts (NEW)
└── controllers/index.ts (UPDATE)

packages/backend/tests/
└── BE-009-010-message-api.spec.ts (NEW)

.docs/
└── 02-api-and-data-model.md (UPDATE - message section)
```

---

## ⏱️ TIME ESTIMATE

| Task | Duration |
|------|----------|
| Types | 1h |
| Service | 2h |
| Controller | 1.5h |
| Tests | 2h |
| Index/Docs | 1h |
| **TOTAL** | **7.5h** |

Fits within 6-8h estimate with 30min buffer.

---

**Status**: READY TO START  
**Approval**: Architect
