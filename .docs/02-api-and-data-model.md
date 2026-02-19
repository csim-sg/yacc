# 02. API Contract & Data Model

**YACC - Complete API Specification + Database Schema**

---

## Phase Scope Notes
- **Phase 1** includes WebSocket gateway + message retry queue delivery + Telegram + IRC integration, including Telegram/IRC messaging endpoints. Phase 1 UI filters must only show Telegram + IRC despite forward-compatible enums.
- **Phase 2** includes collaboration + rules (tags, notes, assignments, routing rules, notifications, bulk actions, audit query/export).
- **Post-MVP** includes additional platforms (WhatsApp, WeChat, Meta, X).
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

### Dead Letter Queue (DLQ) Entry
```json
{
  "id": "uuid",
  "messageId": "uuid",
  "conversationId": "uuid",
  "payload": {
    "messageId": "uuid",
    "conversationId": "uuid",
    "recipientId": "uuid",
    "body": "Message content",
    "direction": "outbound",
    "platformType": "telegram",
    "retryCount": 3,
    "lastError": "Platform error"
  },
  "failureReason": "max_retries_exceeded" | "validation_error" | "platform_error" | "network_error" | "unknown",
  "totalAttempts": 3,
  "lastError": "Error details",
  "movedAt": "2026-01-16T10:00:00Z",
  "expiresAt": "2026-01-23T10:00:00Z",
  "retryAttempt": false,
  "retriedAt": "2026-01-16T11:00:00Z",
  "retriedBy": "uuid",
  "createdAt": "2026-01-16T10:00:00Z",
  "updatedAt": "2026-01-16T10:00:00Z"
}
```

**Purpose**: Stores messages that failed after 3 retry attempts for ops investigation and manual retry

**Retention**: 7 days (auto-cleanup via scheduled job)

**Access**: Manager+ roles only

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

### Password Reset Tokens
```sql
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL,  -- bcrypt hash of 64-char hex token
  expires_at TIMESTAMP NOT NULL,  -- 60 minutes from creation
  used_at TIMESTAMP,  -- NULL if unused, set when reset completes
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(user_id),
  INDEX(expires_at),
  INDEX(token)  -- for finding token by hash
);
```

**Notes:**
- `token` field stores bcrypt hash, never the raw token
- Raw token (64-char hex) is sent only once via email
- Tokens expire 60 minutes after creation
- Each user can only have ONE valid (non-used, non-expired) token
- Old tokens are deleted when new one is requested
- `used_at` is set when password is successfully reset

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

### Dead Letter Queue (DLQ)
```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Original message payload for re-sending
  payload JSONB NOT NULL,

  -- Failure tracking
  failure_reason VARCHAR(255) NOT NULL,  -- max_retries_exceeded, validation_error, platform_error, network_error, unknown
  total_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT NOT NULL,

  -- Timestamps
  moved_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,  -- Set to NOW() + 7 days

  -- Re-queue tracking (if manually retried from DLQ)
  retry_attempt BOOLEAN DEFAULT FALSE,
  retried_at TIMESTAMP,
  retried_by UUID,  -- User who retried

  -- Metadata
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  INDEX(message_id),
  INDEX(conversation_id),
  INDEX(moved_at),
  INDEX(expires_at),  -- For cleanup queries
  INDEX(failure_reason),
  INDEX(retry_attempt)
);
```

**Purpose**: Stores messages that failed after 3 retry attempts for ops investigation and manual retry

**Retention**: 7 days (auto-cleanup via scheduled job)

**Access**: Manager+ roles only

### Audit Logs
Audit events are emitted across multiple entity types (e.g., `conversation`, `routing_rule`, `user`, `message`).
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

#### `POST /api/auth/login`
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

#### `POST /api/auth/logout`
**Response (200):**
```json
{ "data": { "success": true } }
```

---

#### `POST /api/auth/forgot-password`

Initiates password reset flow by sending a reset email. **Always returns 200** to prevent user enumeration attacks.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "If the email exists, a password reset link has been sent"
}
```

**Behavior:**
- Valid email → Token generated, email sent, returns 200
- Non-existent email → No token/email, returns 200 (identical response)
- Invalid email format → Rejected with 400
- No timing difference between valid/invalid emails (prevents enumeration)
- Reset token expires in 60 minutes
- Old tokens are invalidated when new one is requested

---

#### `POST /api/auth/reset-password`

Resets user password using a valid reset token.

**Request:**
```json
{
  "token": "64hexcharacterstoken...",
  "newPassword": "NewPassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Errors:**
- `400 Bad Request`: Invalid or expired token (generic message prevents enumeration)
- `400 Bad Request`: Password requirements not met (8+ chars, 1 uppercase, 1 number)

**Token Validation:**
- Token must be 64-character hexadecimal string
- Token must not be expired (60 min from generation)
- Token must not have been used already
- Token validates using timing-safe bcrypt comparison
- All validation failures return generic "Invalid or expired token" error

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 number (0-9)
- Reused tokens cannot be used again (prevents reuse attacks)

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

#### `POST /api/conversations/bulk`

Bulk action endpoint for assign, tag, or status update on multiple conversations.

**Request:**
```json
{
  "conversationIds": ["uuid", "uuid", "uuid"],
  "action": "assign" | "tag" | "status",
  "data": {
    // For assign: { "assigneeId": "user-uuid-or-null" }
    // For tag: { "tagId": 123 }
    // For status: { "status": "open" | "pending" | "resolved" }
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
      { "id": "conversation-uuid", "reason": "Conversation not found" },
      { "id": "conversation-uuid", "reason": "Tag not found" }
    ]
  }
}
```

**Auth**: Manager+ only

**Features**:
- **Best-effort**: Partial success is OK (not all-or-nothing)
- **Max 100**: Enforced per request
- **Failures**: Detailed array with conversation ID and reason for each failure
- **Audit logged**: Each successful action is logged as `bulk_action_applied`
- **Atomic per conversation**: Each conversation update is processed independently; partial success is acceptable

**Error Codes**:
- `400`: Invalid request (validation error on conversationIds, action, or data)
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (insufficient role - requires manager+)

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

#### `GET /conversations/:id/messages/:messageId/status`
**Response:**
```json
{
  "messageId": "uuid",
  "status": "pending" | "sent" | "failed",
  "createdAt": "ISO-8601 timestamp",
  "updatedAt": "ISO-8601 timestamp"
}
```

**Auth**: User can access their own messages, managers+ can access any message

**Error Codes:**
- `404`: Conversation or message not found, or message doesn't belong to conversation

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

### Dead Letter Queue (DLQ)

#### `GET /api/dlq`
**Query**: `page`, `limit`, `failureReason`

**Auth**: Manager+ only

**Response:**
```json
{
  "entries": [/* DLQ Entry models */],
  "page": 1,
  "limit": 25,
  "total": 150
}
```

---

#### `GET /api/dlq/stats`
**Auth**: Manager+ only

**Response:**
```json
{
  "total": 150,
  "byFailureReason": {
    "max_retries_exceeded": 80,
    "validation_error": 20,
    "platform_error": 30,
    "network_error": 15,
    "unknown": 5
  }
}
```

---

#### `POST /dlq/:id/re-queue`
**Auth**: Manager+ only

**Response:**
```json
{
  "message": "Entry marked for manual retry",
  "entry": {/* DLQ Entry model (updated) */}
}
```

---

#### `DELETE /dlq/:id`
**Auth**: super_admin only (strict access control)

**Response:**
```json
{
  "message": "DLQ entry deleted successfully",
  "deletedEntry": {
    "id": "uuid",
    "messageId": "uuid",
    "conversationId": "uuid",
    "failureReason": "max_retries_exceeded"
  }
}
```

---

### Tags

#### `GET /api/tags`
**Response:**
```json
{ "data": [/* Tag models */] }
```

---

#### `POST /api/tags`
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

#### `POST /api/conversations/:id/tags`
**Request:**
```json
{ "tagId": 123 }
```

**Response:**
```json
{ "data": { "tags": [/* Tag models */] } }
```

**Response Codes:**
- `201 Created` when request is accepted (idempotent if already tagged)
- `400 Bad Request` invalid `tagId`
- `403 Forbidden` not authorized to access the conversation (user not assigned)
- `404 Not Found` conversation or tag not found

---

#### `DELETE /api/conversations/:id/tags/:tagId`
**Response:**
```json
{ "data": { "tags": [/* Tag models */] } }
```

**Response Codes:**
- `200 OK` (graceful if tag was not present)
- `403 Forbidden` not authorized to access the conversation (user not assigned)
- `404 Not Found` conversation or tag not found

---

### Notes

#### `GET /api/conversations/:id/notes`
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

#### `POST /api/conversations/:id/notes`
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

#### `POST /api/conversations/:id/assign`
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

#### `GET /api/notifications`
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

#### `PATCH /api/notifications/:id`
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

#### `GET /api/routing-rules`
**Response:**
```json
{ "data": [/* Routing Rule models */] }
```

---

#### `POST /api/routing-rules`
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

#### `PATCH /api/routing-rules/:id`
**Request:**
```json
{ "status": "disabled", "priority": 150 }
```

**Response:**
```json
{ "data": { /* Routing Rule model */ } }
```

---

#### `DELETE /api/routing-rules/:id`
**Response:**
```json
{ "data": { "success": true } }
```

---

#### `GET /api/routing-rules/:id/executions`
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

Phase 1 includes Telegram + IRC integration. Additional platforms are deferred to post-MVP (WhatsApp, WeChat, Meta, X).

#### `POST /api/integrations/telegram/connect`
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

#### `POST /api/integrations/irc/config` (INT-006)
**RBAC**: super_admin only

Save/upsert IRC configuration with encrypted password storage. No auto-connect side effects.

**Request:**
```json
{
  "server": "irc.libera.chat",
  "port": 6697,
  "username": "botname",
  "password": "bot-password-optional",
  "channels": ["#channel1", "#channel2"]
}
```

**Response: 200 OK**
```json
{
  "data": {
    "server": "irc.libera.chat",
    "port": 6697,
    "username": "botname",
    "channels": ["#channel1", "#channel2"],
    "hasPassword": true,
    "updatedAt": "2026-02-19T15:30:00.000Z"
  }
}
```

**Validation**:
- `server`: required, non-empty string
- `port`: required, integer 1-65535
- `username`: required, non-empty string
- `channels`: required, array of min 1 item, each must start with '#'
- `password`: optional; if provided, encryption key must be set (INTEGRATION_CREDENTIALS_ENCRYPTION_KEY env var)

**Errors**:
- `400 validation_error`: Invalid input (server, port, username, channels)
- `400 encryption_key_missing`: Password provided but encryption key not set
- `403 forbidden`: Not super_admin
- `500 internal_error`: Database or encryption failure

**Notes**:
- Password never returned in response (only `hasPassword` flag)
- Audit logged without plaintext password
- Upsert behavior: if config already exists, it is updated (not duplicated)
- No auto-connect triggered by save

---

#### `POST /api/integrations/irc/connect` (INT-007)
**RBAC**: super_admin only

Manual connect initiation using stored config. Request body is ignored; uses DB config or environment fallback.

**Request:**
```json
{}
```

**Response: 200 OK**
```json
{
  "data": {
    "status": "retrying",
    "attemptCount": 0,
    "lastChangedAt": "2026-02-19T15:30:00.000Z",
    "lastConnectedAt": null,
    "lastError": null
  }
}
```

**Behavior**:
- Retrieves configuration from DB (first) or environment fallback
- Sets status to `retrying` with `attemptCount=0` for manual initiation (always, even if already connected/retrying)
- Non-idempotent: each call triggers a reset and reconnect attempt (manual semantics)
- Delegates actual connection to IRC connector (non-blocking)
- Connector updates `ircStatusClient` as connection progresses

**Errors**:
- `409 irc_not_configured`: No DB config and no environment fallback (IRC_SERVER, IRC_USERNAME, IRC_CHANNELS env vars)
- `403 forbidden`: Not super_admin
- `500 internal_error`: Connector or configuration loading failure

**Notes**:
- Request body completely ignored (for idempotency and simplicity)
- Audit logged with source (db|env) and reconnect flag
- Actual connection status updates pushed via WebSocket to clients

---

#### `POST /api/integrations/irc/test` (INT-008)
**RBAC**: super_admin only

Test IRC connection without modifying live connector state. Body-first validation with fallback to stored config.

**Request (body-first):**
```json
{
  "server": "irc.libera.chat",
  "port": 6697,
  "username": "testuser",
  "password": "optional-password"
}
```

**Response: 200 OK**
```json
{
  "data": {
    "success": true,
    "message": "Successfully connected to irc.libera.chat:6697"
  }
}
```

**Request (stored config fallback):**
```json
{}
```

**Behavior**:
- Body-first: if server/port/username provided in request, test with those credentials
- Fallback: if body missing, uses stored config (DB first, then environment)
- Uses temporary IRC client (irc-framework) - does NOT modify live connector
- Hard 10-second timeout - test fails if no registered message received
- Sanitized response messages - no credentials exposed

**Errors**:
- `400 validation_error`: Body test mode requires server, port, AND username
- `409 irc_not_configured`: No body provided AND no stored config (DB or env)
- `403 forbidden`: Not super_admin
- `500 internal_error`: IRC client creation or connection test failure

**Notes**:
- Does NOT set any IRC connector status or state
- Does NOT trigger reconnect logic
- Audit logged with source (body|db|env) and success flag
- Response message never contains credentials or sensitive data
- Timeout error sanitized (no server details exposed)

---

#### `GET /api/integrations/irc/status` (INT-009)
**RBAC**: admin+ (super_admin, admin)

Get current IRC connection status. Works even when IRC is unconfigured; does not expose configuration secrets.

**Response: 200 OK**
```json
{
  "data": {
    "status": "connected|retrying|disconnected|failed",
    "attemptCount": 0,
    "lastChangedAt": "2026-02-19T15:30:00.000Z",
    "lastConnectedAt": "2026-02-19T15:25:00.000Z",
    "lastError": null,
    "reconnectIncidentId": "incident-uuid"
  }
}
```

**Field Descriptions**:
- `status`: Current connection state (connected, retrying, disconnected, failed)
- `attemptCount`: Number of reconnection attempts in current incident (0-5); resets to 0 on successful connection
- `lastChangedAt`: ISO-8601 timestamp of last status change
- `lastConnectedAt`: ISO-8601 timestamp of last successful connection (null if never connected)
- `lastError`: Sanitized error message (null if no error); no secrets exposed
- `reconnectIncidentId`: Unique identifier for current reconnection incident; optional, only present when status = 'retrying' or 'failed'

---

#### `GET /api/integrations/status`
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

#### `GET /api/audit-logs`
Query audit logs across all entity types with optional filters and pagination.

**Query Parameters**:
- `actorId`: Filter by user ID who performed the action
- `action`: Filter by action type (e.g., `conversation_assigned`, `bulk_action_applied`)
- `entityType`: Filter by entity type (e.g., `conversation`, `tag`)
- `entityId`: Filter by specific entity UUID
- `dateFrom`: Filter by start date (ISO 8601 string)
- `dateTo`: Filter by end date (ISO 8601 string)
- `page`: Pagination page number (default 1)
- `limit`: Results per page (default 20, max 100)

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "actorId": "uuid",
      "action": "conversation_assigned",
      "entityType": "conversation",
      "entityId": "uuid",
      "metadata": { /* action-specific data */ },
      "createdAt": "2026-01-16T10:00:00Z"
    }
  ],
  "total": 250,
  "page": 1,
  "limit": 20,
  "pages": 13
}
```

**Auth**: Manager+ only

**Notes**:
- Supports multi-entity queries (conversations, routing rules, users, messages, etc.)
- Filters can be combined
- Results sorted by created_at DESC (newest first)
- Limit capped at 100 (requests for higher limit are reduced to 100)

---

#### `GET /api/audit-logs/conversations/:conversationId`
Convenience endpoint: get audit logs for a specific conversation only.

**Query Parameters**:
- `action`: Filter by action type
- `entityType`: Filter by entity type
- `dateFrom`: Filter by start date
- `dateTo`: Filter by end date
- `page`: Pagination page number (default 1)
- `limit`: Results per page (default 20, max 100)

**Response**: Same structure as `/api/audit-logs`, filtered to specified conversation

**Auth**: Manager+ only

---

#### `POST /api/audit-logs/export`
Export filtered audit logs as CSV or JSON file.

**Request**:
```json
{
  "format": "csv" | "json",
  "filters": {
    "actorId": "uuid",
    "action": "conversation_assigned",
    "entityType": "conversation",
    "entityId": "uuid",
    "dateFrom": "2026-01-01T00:00:00Z",
    "dateTo": "2026-02-11T23:59:59Z"
  }
}
```

**Response**: File download (CSV: `text/csv`, JSON: `application/json`)
- Content-Disposition header set to `attachment; filename="audit-logs-<timestamp>.<format>"`
- CSV includes headers: ID, Actor ID, Action, Entity Type, Entity ID, Created At, Metadata
- CSV values starting with `=`, `+`, `-`, `@` are escaped to prevent formula injection

**Auth**: Admin+ only (stricter than read queries)

**Notes**:
- `format` defaults to `csv` if not specified
- `filters` object is optional (empty filters export all matching logs)
- Large exports may take longer but use pagination internally

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

### Events
**Format**: Socket.io events emit raw payloads (no envelope wrapper). Example: `socket.on('message.sent', payload => {...})`

#### `conversation.updated`
**Fired when**: Conversation status, priority, or assignment changes

**Payload**:
```json
{
  "conversationId": "uuid",
  "updatedFields": { "status": "pending", "priority": "high" },
  "changedBy": "uuid",
  "changedAt": "2026-01-16T10:00:00Z"
}
```
**Notes**: 
- `updatedFields`: Map of changed field names and new values
- `changedBy`: UUID of user who made the change
- `changedAt`: ISO8601 timestamp of change

---

#### `message.received`
**Fired when**: New inbound message arrives from Telegram or IRC

**Payload**:
```json
{
  "conversationId": "uuid",
  "messageId": "uuid",
  "platform": "telegram",
  "senderId": "123456789",
  "senderName": "John Doe",
  "body": "Message text",
  "timestamp": "2026-01-16T10:00:00Z",
  "attachments": [
    { "url": "https://...", "type": "image", "name": "file.jpg" }
  ]
}
```
**Notes**:
- `platform`: "telegram" or "irc"
- `attachments`: Optional array of attachment objects with url, type, name

---

#### `message.sent`
**Fired when**: Outbound message successfully delivered to platform

**Payload**:
```json
{
  "conversationId": "uuid",
  "messageId": "uuid",
  "status": "sent",
  "sentAt": "2026-01-16T10:00:00Z"
}
```
**Notes**:
- `sentAt`: ISO8601 timestamp when platform confirmed delivery
- Backend only emits when successfully delivered to external platform

---

#### `message.failed`
**Fired when**: Outbound message fails to deliver (will retry)

**Payload**:
```json
{
  "conversationId": "uuid",
  "messageId": "uuid",
  "status": "failed",
  "error": "Network timeout",
  "retryAt": "2026-01-16T10:01:00Z",
  "attempt": 1
}
```
**Notes**:
- `error`: Description of delivery failure
- `retryAt`: ISO8601 timestamp of next automatic retry (exponential backoff: 1m, 5m, 30m)
- `attempt`: Current retry attempt (1-3)
- After 3 failed attempts, message moves to Dead Letter Queue for ops review

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
