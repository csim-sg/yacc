# 02. API Contract & Data Model

**YACC - Complete API Specification + Database Schema**

---

## Phase Scope Notes
- **Phase 1** includes WebSocket gateway + message retry queue delivery + Telegram + IRC integration, including Telegram/IRC messaging endpoints. Phase 1 UI filters must only show Telegram + IRC despite forward-compatible enums.
- **Phase 2** includes additional platforms (WhatsApp, WeChat, Meta, X).
- Channel enums remain inclusive of future platforms (WhatsApp, WeChat, Meta, X, email, slack) for forward compatibility.

---

## Table of Contents

1. [API Conventions](#1-api-conventions)
2. [Enums & Constants](#2-enums--constants)
3. [Data Models](#3-data-models)
4. [Database Schema](#4-database-schema)
5. [REST API Endpoints](#5-rest-api-endpoints)
6. [WebSocket Events](#6-websocket-events)

---

## 1. API Conventions

### Request/Response Format
- **Auth**: JWT-only via BetterAuth bearer plugin
  - **Access TTL**: 48h (`ACCESS_TOKEN_TTL_SECONDS`)
  - **Refresh TTL**: 30d (`REFRESH_TOKEN_TTL_SECONDS`)
  - **Refresh Token**: HttpOnly cookie with single-use rotation
- **Content-Type**: `application/json`
- **Response Envelope** (Success): `{ "data": {...} }`
- **Response Envelope** (Error): `{ "code": "string", "message": "string", "details": {} }`
- **Timestamps**: ISO-8601 strings (UTC)
- **IDs**: UUID strings (unless noted)

### Pagination
- **Query Params**: `page` (default 1), `pageSize` (default 20)
- **Response**:
  ```json
  {
    "data": [...],
    "page": 1,
    "pageSize": 20,
    "total": 150
  }
  ```

### Error Handling
```json
{
  "code": "invalid_credentials",
  "message": "Email or password is incorrect",
  "details": {
    "field": "password"
  }
}
```

---

## 2. Enums & Constants

### Role
```
super_admin | admin | manager | user
```

### User Status
```
active | disabled
```

### Conversation Status
```
open | pending | resolved
```

### Priority
```
low | normal | high | urgent
```

### Channel
```
telegram | irc | whatsapp | wechat | meta | x | email | slack
```

### Message Direction
```
inbound | outbound
```

### Message Status
```
pending | sent | failed
```

### Participant Type
```
contact | agent
```

### Routing Rule Status
```
active | disabled
```

### Notification Type
```
assignment | mention | unread
```

### Audit Action Types
```
conversation.assigned
conversation.status_changed
conversation.tag_added
conversation.tag_removed
message.sent
message.failed
message.retry
note.created
tag.created
user.role_changed
user.status_changed
rule.created
rule.updated
rule.deleted
rule.executed
attachment.accessed
integration.connected
bulk_action_applied
```

---

## 3. Data Models

### User
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "manager",
  "status": "active",
  "createdAt": "2026-01-16T10:00:00Z",
  "updatedAt": "2026-01-16T10:00:00Z"
}
```

### Role
```json
{
  "id": "uuid",
  "name": "manager"
}
```

### Tag
```json
{
  "id": "uuid",
  "name": "Urgent",
  "color": "#FF5A5F",
  "createdById": "uuid",
  "createdAt": "2026-01-16T10:00:00Z"
}
```

### Note
```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "authorId": "uuid",
  "authorName": "John",
  "body": "Follow up with customer",
  "createdAt": "2026-01-16T10:00:00Z"
}
```

### Assignment
```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "assignedUserId": "uuid",
  "assignedById": "uuid",
  "createdAt": "2026-01-16T10:00:00Z"
}
```

### Attachment
```json
{
  "id": "uuid",
  "messageId": "uuid",
  "url": "https://cdn.example.com/attachments/...",
  "storageKey": "attachments/conv-id/filename.pdf",
  "type": "application/pdf",
  "name": "document.pdf",
  "size": 102400,
  "uploadedById": "uuid",
  "uploadedAt": "2026-01-16T10:00:00Z"
}
```

### Message
```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "senderId": "external-or-user-id",
  "senderName": "Alice",
  "direction": "inbound",
  "body": "Hello there!",
  "attachments": [
    {
      "id": "uuid",
      "url": "https://...",
      "type": "image/png",
      "name": "file.png",
      "size": 102400
    }
  ],
  "status": "sent",
  "rawPayloadRef": "s3-key-or-reference",
  "createdAt": "2026-01-16T10:00:00Z"
}
```

### Conversation Summary
```json
{
  "id": "uuid",
  "channel": "telegram",
  "externalThreadId": "ext-123",
  "status": "open",
  "priority": "normal",
  "assignedUserId": "uuid",
  "assignedUserName": "John",
  "tags": [
    {
      "id": "uuid",
      "name": "Urgent",
      "color": "#FF5A5F"
    }
  ],
  "participants": [
    {
      "id": "ext-contact-1",
      "name": "Alice",
      "type": "contact"
    }
  ],
  "unreadCount": 2,
  "latestMessagePreview": "Last inbound message...",
  "latestMessageAt": "2026-01-16T10:00:00Z",
  "createdAt": "2026-01-16T10:00:00Z",
  "updatedAt": "2026-01-16T10:05:00Z"
}
```

### Conversation Detail
```json
{
  "id": "uuid",
  "channel": "telegram",
  "externalThreadId": "ext-123",
  "status": "open",
  "priority": "normal",
  "assignedUserId": "uuid",
  "tags": [],
  "participants": [
    {
      "id": "external-1",
      "name": "Alice",
      "type": "contact"
    }
  ],
  "createdAt": "2026-01-16T10:00:00Z",
  "updatedAt": "2026-01-16T10:05:00Z"
}
```

### Notification
```json
{
  "id": "uuid",
  "userId": "uuid",
  "type": "assignment",
  "conversationId": "uuid",
  "actorId": "uuid",
  "actorName": "Manager Name",
  "body": "You have been assigned a conversation",
  "isRead": false,
  "createdAt": "2026-01-16T10:00:00Z",
  "readAt": null
}
```

### Routing Rule
```json
{
  "id": "uuid",
  "name": "VIP Routing",
  "status": "active",
  "priority": 100,
  "conditions": [
    {
      "field": "channel",
      "operator": "eq",
      "value": "telegram"
    }
  ],
  "actions": [
    {
      "type": "assign",
      "value": "uuid"
    }
  ],
  "lastRunAt": "2026-01-16T10:00:00Z",
  "createdAt": "2026-01-10T08:00:00Z"
}
```

### Audit Log
```json
{
  "id": "uuid",
  "actorId": "uuid",
  "actorName": "John Doe",
  "action": "conversation.assigned",
  "entityType": "conversation",
  "entityId": "uuid",
  "metadata": {
    "oldAssignedUserId": null,
    "newAssignedUserId": "uuid"
  },
  "createdAt": "2026-01-16T10:00:00Z"
}
```

---

## 4. Database Schema

### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(50) NOT NULL,  -- super_admin, admin, manager, user
  status VARCHAR(50) DEFAULT 'active',  -- active, disabled
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Conversations
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  channel VARCHAR(50) NOT NULL,  -- telegram, irc (Phase 1); whatsapp, wechat, meta, x, email, slack (future)
  external_thread_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'open',  -- open, pending, resolved
  priority VARCHAR(50) DEFAULT 'normal',  -- low, normal, high, urgent
  assigned_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(channel),
  INDEX(status),
  INDEX(assigned_user_id)
);
```

### Messages
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  sender_id VARCHAR(255) NOT NULL,
  sender_name VARCHAR(255),
  direction VARCHAR(50) NOT NULL,  -- inbound, outbound
  body TEXT,
  status VARCHAR(50) DEFAULT 'sent',  -- pending, sent, failed
  raw_payload_ref VARCHAR(1024),  -- R2 storage key
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(conversation_id),
  INDEX(created_at)
);
```

### Conversation Participants
```sql
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  participant_id VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  type VARCHAR(50),  -- contact, agent
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(conversation_id),
  INDEX(participant_id)
);
```

### Attachments
```sql
CREATE TABLE attachments (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  url VARCHAR(1024) NOT NULL,
  storage_key VARCHAR(255) NOT NULL,  -- R2 path
  type VARCHAR(100) NOT NULL,  -- MIME type
  name VARCHAR(255) NOT NULL,
  size INT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(message_id),
  INDEX(conversation_id)
);
```

### Tags
```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50),
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(name)
);
```

### Conversation Tags
```sql
CREATE TABLE conversation_tags (
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  tag_id UUID NOT NULL REFERENCES tags(id),
  
  PRIMARY KEY(conversation_id, tag_id)
);
```

### Notes
```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  author_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(conversation_id)
);
```

### Notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,  -- assignment, mention, unread
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  actor_id UUID NOT NULL REFERENCES users(id),
  actor_name VARCHAR(255),
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP NULL,
  dismissed_at TIMESTAMP NULL,
  
  INDEX(user_id, is_read),
  INDEX(created_at DESC)
);
```

### Routing Rules
```sql
CREATE TABLE routing_rules (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',  -- active, disabled
  priority INT DEFAULT 100,
  conditions JSON NOT NULL,
  actions JSON NOT NULL,
  last_run_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(status, priority)
);
```

### Routing Rule Executions
```sql
CREATE TABLE routing_rule_executions (
  id UUID PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES routing_rules(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  matched_conditions JSON NOT NULL,
  applied_actions JSON NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(rule_id),
  INDEX(conversation_id)
);
```

### Raw Payloads
```sql
CREATE TABLE raw_payloads (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id),
  storage_key VARCHAR(1024) NOT NULL,  -- R2 key
  content_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  INDEX(message_id),
  INDEX(created_at)
);
```

### Audit Logs
Conversation-scoped audit events only (entity_type is always `conversation`).
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  INDEX(actor_id),
  INDEX(action),
  INDEX(entity_type),
  INDEX(created_at DESC)
);
```

---

## 5. REST API Endpoints

### Auth

#### `POST /auth/login`
**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response (200):**
```json
{
  "data": {
    "user": { /* User model */ },
    "token": "jwt-token",
    "expiresAt": "2026-01-16T12:00:00Z"
  }
}
```

**Errors**: `invalid_credentials` (401), `user_disabled` (403)

---

#### `POST /auth/logout`
**Response (200):**
```json
{ "data": { "success": true } }
```

---

#### `POST /auth/forgot-password`
**Request:**
```json
{ "email": "user@example.com" }
```

**Response (200):**
```json
{ "data": { "success": true } }
```

**Note**: Always returns success (no user enumeration)

---

#### `POST /auth/reset-password`
**Request:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "new-password"
}
```

**Response (200):**
```json
{ "data": { "success": true } }
```

**Errors**: `invalid_or_expired_token` (400)

---

### Users

#### `GET /users`
**Query**: `page`, `pageSize`, `role`, `status`, `search`

**Response:**
```json
{
  "data": [/* User models */],
  "page": 1,
  "pageSize": 20,
  "total": 100
}
```

---

#### `POST /users`
**Request:**
```json
{
  "email": "user@example.com",
  "role": "manager",
  "password": "password"
}
```

**Response (201):**
```json
{ "data": { /* User model */ } }
```

**Auth**: Super Admin only

---

#### `PATCH /users/:id`
**Request:**
```json
{
  "role": "admin",
  "status": "disabled",
  "password": "new-password"  // optional
}
```

**Response (200):**
```json
{ "data": { /* User model */ } }
```

---

#### `DELETE /users/:id`
**Response (200):**
```json
{ "data": { "success": true } }
```

**Note**: Soft delete (deactivates user)

---

#### `GET /roles`
**Response:**
```json
{ "data": [/* Role models */] }
```

---

### Conversations

#### `GET /conversations`
**Query**: `page`, `pageSize`, `channel`, `tag`, `assignee`, `status`, `priority`, `search`, `dateFrom`, `dateTo`, `unread`

**Response:**
```json
{
  "data": [/* Conversation Summary models */],
  "page": 1,
  "pageSize": 20,
  "total": 150
}
```

---

#### `GET /conversations/:id`
**Response:**
```json
{ "data": { /* Conversation Detail model */ } }
```

---

#### `PATCH /conversations/:id`
**Request:**
```json
{
  "status": "pending",
  "priority": "high",
  "assignedUserId": "uuid"
}
```

**Response:**
```json
{ "data": { /* Conversation Detail model */ } }
```

**Note**: Emits WebSocket event `conversation.updated`

---

#### `POST /conversations/bulk`
**Request:**
```json
{
  "conversationIds": ["uuid", "uuid", "uuid"],
  "action": {
    "type": "assign",  // assign, tag, status
    "value": "uuid"    // user_id, tag_id, status_value
  }
}
```

**Response:**
```json
{
  "data": {
    "successCount": 98,
    "failureCount": 2,
    "failures": [
      { "conversationId": "uuid", "reason": "Conversation not found" }
    ]
  }
}
```

**Note**: Max 100 conversations per request

---

### Messages

#### `GET /conversations/:id/messages`
**Query**: `page`, `pageSize`

**Response:**
```json
{
  "data": [/* Message models */],
  "page": 1,
  "pageSize": 50,
  "total": 200
}
```

---

#### `POST /conversations/:id/messages`
**Request:**
```json
{
  "body": "Hello!",
  "attachmentIds": ["uuid"]  // optional
}
```

**Response:**
```json
{ "data": { /* Message model */ } }
```

**Note**: Only users and managers can send. Emits WebSocket event `message.sent` or `message.failed`

---

#### `POST /conversations/:id/messages/:msgId/retry`
**Response:**
```json
{ "data": { /* Message model (updated status) */ } }
```

**Note**: User-initiated retry (one additional attempt)

---

#### `GET /messages/:id/raw-payload`
**Response:**
```json
{
  "data": {
    "payload": "raw text content",
    "contentType": "application/json"
  }
}
```

**Auth**: Manager+ only, audit-logged

---

### Tags

#### `GET /tags`
**Response:**
```json
{ "data": [/* Tag models */] }
```

---

#### `POST /tags`
**Request:**
```json
{
  "name": "Urgent",
  "color": "#FF5A5F"
}
```

**Response:**
```json
{ "data": { /* Tag model */ } }
```

---

#### `POST /conversations/:id/tags`
**Request:**
```json
{ "tagId": "uuid" }  // or create inline
```

**Response:**
```json
{ "data": { "tags": [/* Tag models */] } }
```

---

#### `DELETE /conversations/:id/tags/:tagId`
**Response:**
```json
{ "data": { "tags": [/* Tag models */] } }
```

---

### Notes

#### `GET /conversations/:id/notes`
**Query**: `page`, `pageSize`

**Response:**
```json
{
  "data": [/* Note models */],
  "page": 1,
  "pageSize": 50,
  "total": 10
}
```

---

#### `POST /conversations/:id/notes`
**Request:**
```json
{ "body": "Internal note with @mention support" }
```

**Response:**
```json
{ "data": { /* Note model */ } }
```

**Note**: Support `@username` syntax for mentions

---

### Assignments

#### `POST /conversations/:id/assign`
**Request:**
```json
{ "assignedUserId": "uuid" }
```

**Response:**
```json
{ "data": { /* Assignment model */ } }
```

**Note**: Emits notification to assignee

---

### Notifications

#### `GET /notifications`
**Query**: `page`, `pageSize`, `unread`, `type`

**Response:**
```json
{
  "data": [/* Notification models */],
  "page": 1,
  "pageSize": 20,
  "total": 50
}
```

---

#### `PATCH /notifications/:id`
**Request:**
```json
{ "isRead": true }
```

**Response:**
```json
{ "data": { /* Notification model */ } }
```

---

#### `DELETE /notifications/:id`
**Response:**
```json
{ "data": { "success": true } }
```

---

#### `POST /notifications/mark-all-read`
**Response:**
```json
{ "data": { "success": true } }
```

---

### Search

#### `GET /search/conversations`
**Query**: `q`, `dateFrom`, `dateTo`, `channel`, `tag`, `assignee`, `status`, `priority`, `page`, `pageSize`

**Response:**
```json
{
  "data": [
    {
      "conversation": { /* Conversation Summary */ },
      "snippet": "Message body snippet with highlighted query terms...",
      "relevanceScore": 0.95
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 150
}
```

---

### Attachments

#### `POST /conversations/:id/attachments`
**Request**: `multipart/form-data` with `file` field

**Response:**
```json
{ "data": { /* Attachment model */ } }
```

**Note**: Max 5 MB per file

---

#### `GET /attachments/:id`
**Response**: File download (binary)

**Note**: Access audit-logged

---

### Routing Rules

#### `GET /routing-rules`
**Response:**
```json
{ "data": [/* Routing Rule models */] }
```

---

#### `POST /routing-rules`
**Request:**
```json
{
  "name": "VIP Routing",
  "status": "active",
  "priority": 100,
  "conditions": [
    { "field": "channel", "operator": "eq", "value": "telegram" }
  ],
  "actions": [
    { "type": "assign", "value": "uuid" }
  ]
}
```

**Response:**
```json
{ "data": { /* Routing Rule model */ } }
```

---

#### `PATCH /routing-rules/:id`
**Request:**
```json
{ "status": "disabled", "priority": 150 }
```

**Response:**
```json
{ "data": { /* Routing Rule model */ } }
```

---

#### `DELETE /routing-rules/:id`
**Response:**
```json
{ "data": { "success": true } }
```

---

#### `GET /routing-rules/:id/executions`
**Query**: `page`, `pageSize`

**Response:**
```json
{
  "data": [/* Routing Rule Execution models */],
  "page": 1,
  "pageSize": 50,
  "total": 100
}
```

---

### Integrations

Phase 1 includes Telegram + IRC integration. Additional platforms are deferred to Phase 2 (WhatsApp, WeChat, Meta, X).

#### `POST /integrations/telegram/connect`
**Request:**
```json
{ "botToken": "bot-token-from-telegram" }
```

**Response:**
```json
{
  "data": {
    "status": "connected",
    "botName": "MyChatBot",
    "webhookUrl": "https://api.example.com/webhooks/telegram"
  }
}
```

---

#### `POST /integrations/irc/connect`
**Request:**
```json
{
  "server": "irc.example.com",
  "port": 6667,
  "username": "botname",
  "password": "bot-password"
}
```

**Response:**
```json
{
  "data": {
    "status": "connected",
    "server": "irc.example.com"
  }
}
```

---

#### `GET /integrations/status`
**Response:**
```json
{
  "data": {
    "telegram": {
      "status": "connected",
      "lastConnectedAt": "2026-01-16T10:00:00Z"
    },
    "irc": {
      "status": "disconnected",
      "lastError": "Connection refused"
    }
  }
}
```

---

### Audit Logs

#### `GET /api/conversations/:conversationId/audit-logs`
Get audit logs for a specific conversation. Audit logs are conversation-scoped only.

**Query**: `page`, `limit`

**Response:**
```json
{
  "success": true,
  "data": [/* Audit Log models */],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

**Auth**: Manager+ only

---

## 6. WebSocket Events

### Connection & Authentication
```
Client connects with auth token in handshake:
  socket.io-client({ auth: { token: 'jwt-token' } })
```

### Heartbeat
- **Interval**: 60 seconds
- **Client**: Listens for `ping` event, responds with `pong`
- **Purpose**: Detect stale connections

### Event Envelope
```json
{
  "type": "conversation.updated",
  "payload": { /* event data */ },
  "timestamp": "2026-01-16T10:00:00Z"
}
```

### Events

#### `conversation.updated`
**Fired when**: Conversation status, priority, or assignment changes

**Payload**:
```json
{
  "conversation": { /* Conversation Summary */ }
}
```

---

#### `message.received`
**Fired when**: New inbound message arrives

**Payload**:
```json
{
  "conversationId": "uuid",
  "message": { /* Message model */ }
}
```

---

#### `message.sent`
**Fired when**: Outbound message successfully delivered

**Payload**:
```json
{
  "conversationId": "uuid",
  "message": { /* Message model with status: sent */ }
}
```

---

#### `message.failed`
**Fired when**: Outbound message fails to deliver

**Payload**:
```json
{
  "conversationId": "uuid",
  "message": { /* Message model with status: failed */ },
  "canRetry": true
}
```

---

#### `notification.received`
**Fired when**: User receives a new notification

**Payload**:
```json
{
  "notification": { /* Notification model */ }
}
```

---

#### `conversation.reopened`
**Fired when**: Resolved conversation auto-reopens due to new inbound message

**Payload**:
```json
{
  "conversation": { /* Conversation Summary */ },
  "reason": "new_inbound_message"
}
```

---

#### `presence.updated`
**Fired when**: User logs in/out or goes idle

**Payload**:
```json
{
  "userId": "uuid",
  "status": "online",
  "updatedAt": "2026-01-16T10:00:00Z"
}
```

---

#### `typing.started`
**Fired when**: User starts typing

**Payload**:
```json
{
  "conversationId": "uuid",
  "userId": "uuid"
}
```

---

#### `typing.stopped`
**Fired when**: User stops typing (after 5 second inactivity)

**Payload**:
```json
{
  "conversationId": "uuid",
  "userId": "uuid"
}
```

---

### WebSocket Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| **Heartbeat Interval** | 60 seconds | Ping/pong to detect stale connections |
| **Message Backlog** | 1 hour | Client receives missed events on reconnect |
| **Reconnect Attempts** | 5 | Max attempts before giving up |
| **Reconnect Backoff** | Exponential (1s → 60s max) | Start 1s, double each attempt, max 60s |

---

**Version**: 1.0  
**Last Updated**: January 17, 2026  
**Status**: Complete & Ready for Implementation
