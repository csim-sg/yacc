# YACC Phase 1 API Documentation

> **Version**: 0.1.0  
> **Status**: Phase 1 - Core Authentication & Conversations  
> **Last Updated**: January 17, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
   - [Auth Endpoints (6)](#auth-endpoints)
   - [Conversation Endpoints (7)](#conversation-endpoints)
   - [Audit Log Endpoints (3)](#audit-log-endpoints)
4. [Error Handling](#error-handling)
5. [Role-Based Access Control (RBAC)](#role-based-access-control)
6. [Data Models](#data-models)
7. [WebSocket Events (Phase 2)](#websocket-events-phase-2)

---

## Overview

The YACC API is a REST API built with Express.js and PostgreSQL. Phase 1 provides core functionality for user authentication, conversation management, and audit logging.

**Base URL**: `http://localhost:3000/api`

**Content-Type**: `application/json`

**Authentication**: JWT (Bearer token in Authorization header)

---

## Authentication

### JWT Token Format

Tokens are signed using HS256 and include the following claims:

```json
{
  "userId": 1,
  "email": "user@example.com",
  "role": "manager",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Authorization Header

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Expiration

- **Expiration**: 7 days from issuance
- **Format**: JWT (JSON Web Token)
- **Algorithm**: HS256

---

## API Endpoints

### Auth Endpoints

#### 1. POST /api/auth/register

Register a new user.

**Requirements**: No authentication required (first-time setup)

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "status": "active",
    "createdAt": "2026-01-17T10:30:00Z",
    "updatedAt": "2026-01-17T10:30:00Z"
  },
  "message": "User registered successfully"
}
```

**Error Responses**:
- `400 Bad Request`: Validation failed (invalid email, weak password, missing fields)
- `409 Conflict`: Email already registered

**Validation Rules**:
- Email must be valid format
- Password minimum 6 characters
- Name required (non-empty)

---

#### 2. POST /api/auth/login

Authenticate user and receive JWT token.

**Requirements**: No authentication required

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "manager",
    "status": "active",
    "lastLoginAt": "2026-01-17T11:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "7d"
}
```

**Error Responses**:
- `400 Bad Request`: Validation failed
- `401 Unauthorized`: Invalid credentials
- `404 Not Found`: User not found

**Audit Logging**: ✅ Logged as `user_login` with IP address

---

#### 3. POST /api/auth/logout

Logout current user (token invalidation in production).

**Requirements**: Authentication required (JWT token)

**Request Body**: Empty

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid token

**Audit Logging**: ✅ Logged as `user_logout` with IP address

**Example**:
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### 4. POST /api/auth/forgot-password

Request password reset link via email.

**Requirements**: No authentication required

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "If email exists, reset link sent to inbox"
}
```

**Notes**:
- Response is generic for security (doesn't reveal if email exists)
- Reset link valid for 24 hours
- Email contains reset token

**Error Responses**:
- `400 Bad Request`: Invalid email format

---

#### 5. POST /api/auth/reset-password

Reset password using token from email link.

**Requirements**: No authentication required

**Request Body**:
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass456!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid token or weak password
- `401 Unauthorized`: Token expired

**Validation Rules**:
- New password minimum 6 characters
- Token must not be expired (24 hours)
- Token must not have been used

---

#### 6. GET /api/auth/me

Get current authenticated user's profile.

**Requirements**: Authentication required (JWT token)

**Query Parameters**: None

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "manager",
    "status": "active",
    "createdAt": "2026-01-17T10:30:00Z",
    "updatedAt": "2026-01-17T10:30:00Z",
    "lastLoginAt": "2026-01-17T11:00:00Z"
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: User not found

**Example**:
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### 7. POST /api/auth/change-password (Bonus)

Change password for authenticated user.

**Requirements**: Authentication required (JWT token)

**Request Body**:
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses**:
- `400 Bad Request`: Current password incorrect or weak new password
- `401 Unauthorized`: Invalid token

---

### Conversation Endpoints

#### 8. GET /api/conversations

List all conversations with filtering, sorting, and pagination.

**Requirements**: Authentication required

**Query Parameters**:
```
page=1                          (optional, default: 1)
limit=20                        (optional, default: 20, max: 100)
channel=telegram                (optional: telegram, irc, email, slack)
status=open                     (optional: open, pending, resolved)
priority=high                   (optional: low, medium, high, urgent)
assignedUserId=5                (optional: user ID)
search=keyword                  (optional: free-text search)
sortBy=lastActivity             (optional: lastActivity, created, priority)
sortOrder=desc                  (optional: asc, desc)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": 101,
        "channel": "telegram",
        "externalThreadId": "group_123456",
        "title": "Sales Support Group",
        "status": "open",
        "priority": "high",
        "assignedUserId": 5,
        "metadata": {
          "senderName": "John Customer",
          "senderPhone": "+1234567890"
        },
        "createdAt": "2026-01-15T09:00:00Z",
        "updatedAt": "2026-01-17T11:30:00Z",
        "lastActivityAt": "2026-01-17T11:30:00Z"
      }
    ],
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid token

**Example**:
```bash
curl -X GET "http://localhost:3000/api/conversations?channel=telegram&status=open&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### 9. GET /api/conversations/:id

Get a single conversation with messages and metadata.

**Requirements**: Authentication required

**Path Parameters**:
- `id` (integer): Conversation ID

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": 101,
      "channel": "telegram",
      "externalThreadId": "group_123456",
      "title": "Sales Support Group",
      "status": "open",
      "priority": "high",
      "assignedUserId": 5,
      "metadata": {
        "senderName": "John Customer",
        "senderPhone": "+1234567890"
      },
      "createdAt": "2026-01-15T09:00:00Z",
      "updatedAt": "2026-01-17T11:30:00Z",
      "lastActivityAt": "2026-01-17T11:30:00Z"
    },
    "messages": [
      {
        "id": 501,
        "conversationId": 101,
        "senderId": null,
        "senderName": "John Customer",
        "body": "Hi, I need help with my order.",
        "status": "sent",
        "direction": "inbound",
        "externalMessageId": "msg_123456",
        "metadata": {},
        "createdAt": "2026-01-15T09:05:00Z"
      },
      {
        "id": 502,
        "conversationId": 101,
        "senderId": 5,
        "senderName": "Support Agent",
        "body": "Hello! I'll help you with that.",
        "status": "sent",
        "direction": "outbound",
        "externalMessageId": "msg_123457",
        "createdAt": "2026-01-15T09:10:00Z"
      }
    ],
    "tags": [
      {
        "id": 1,
        "name": "Urgent",
        "color": "#FF0000",
        "createdById": 2,
        "createdAt": "2026-01-15T09:00:00Z"
      }
    ],
    "notes": [
      {
        "id": 1,
        "conversationId": 101,
        "authorId": 5,
        "body": "Customer mentioned they have an active support plan.",
        "mentions": [],
        "createdAt": "2026-01-15T09:15:00Z",
        "updatedAt": "2026-01-15T09:15:00Z"
      }
    ]
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Conversation not found

---

#### 10. PATCH /api/conversations/:id/status

Update conversation status.

**Requirements**: Authentication required

**Path Parameters**:
- `id` (integer): Conversation ID

**Request Body**:
```json
{
  "status": "pending"
}
```

**Status Values**: `open`, `pending`, `resolved`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Conversation status updated to pending",
  "data": {
    "id": 101,
    "status": "pending",
    "updatedAt": "2026-01-17T11:35:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid status value
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Conversation not found

**Audit Logging**: ✅ Logged as `conversation_status_updated`

**Example**:
```bash
curl -X PATCH http://localhost:3000/api/conversations/101/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"pending"}'
```

---

#### 11. PATCH /api/conversations/:id/priority

Update conversation priority.

**Requirements**: Authentication required

**Path Parameters**:
- `id` (integer): Conversation ID

**Request Body**:
```json
{
  "priority": "urgent"
}
```

**Priority Values**: `low`, `medium`, `high`, `urgent`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Conversation priority updated to urgent",
  "data": {
    "id": 101,
    "priority": "urgent",
    "updatedAt": "2026-01-17T11:35:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid priority value
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Conversation not found

**Audit Logging**: ✅ Logged as `conversation_priority_updated`

---

#### 12. PATCH /api/conversations/:id/assign

Assign conversation to a user.

**Requirements**: Authentication required + `assign_conversation` permission (Manager+)

**Path Parameters**:
- `id` (integer): Conversation ID

**Request Body**:
```json
{
  "assignedUserId": 5
}
```

**Notes**:
- Pass `null` to unassign
- Only Manager+ roles allowed

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Conversation assigned to user 5",
  "data": {
    "id": 101,
    "assignedUserId": 5,
    "updatedAt": "2026-01-17T11:35:00Z"
  }
}
```

**Response (Unassign)** (200 OK):
```json
{
  "success": true,
  "message": "Conversation unassigned",
  "data": {
    "id": 101,
    "assignedUserId": null,
    "updatedAt": "2026-01-17T11:35:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid user ID
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions (requires Manager+)
- `404 Not Found`: Conversation not found

**Audit Logging**: ✅ Logged as `conversation_assigned`

**RBAC Matrix**:
| Role | Can Assign |
|------|-----------|
| Super Admin | ✅ |
| Admin | ✅ |
| Manager | ✅ |
| User | ❌ |

---

#### 13. POST /api/conversations/:id/tags

Add tag to conversation.

**Requirements**: Authentication required + `tag_conversation` permission

**Path Parameters**:
- `id` (integer): Conversation ID

**Request Body**:
```json
{
  "tagId": 3
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Tag added to conversation"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid tag ID
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Conversation or tag not found
- `409 Conflict`: Tag already added to conversation

**Audit Logging**: ✅ Logged as `conversation_tag_added`

**RBAC Matrix**:
| Role | Can Tag |
|------|---------|
| Super Admin | ✅ |
| Admin | ✅ |
| Manager | ✅ |
| User | ✅ |

---

#### 14. DELETE /api/conversations/:id/tags/:tagId

Remove tag from conversation.

**Requirements**: Authentication required + `tag_conversation` permission

**Path Parameters**:
- `id` (integer): Conversation ID
- `tagId` (integer): Tag ID

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Tag removed from conversation"
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Conversation or tag not found

**Audit Logging**: ✅ Logged as `conversation_tag_removed`

---

### Audit Log Endpoints

#### 15. GET /api/audit-logs

Query audit logs with filters.

**Requirements**: Authentication required + Manager+ role

**Query Parameters**:
```
page=1                          (optional, default: 1)
limit=20                        (optional, default: 20, max: 100)
actorId=5                       (optional: user ID)
action=conversation_assigned    (optional: any action)
entityType=conversation         (optional: conversation, message, user)
entityId=101                    (optional: entity ID)
dateFrom=2026-01-01T00:00:00Z  (optional: ISO 8601)
dateTo=2026-01-31T23:59:59Z    (optional: ISO 8601)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 2001,
        "actorId": 5,
        "action": "conversation_assigned",
        "entityType": "conversation",
        "entityId": 101,
        "metadata": {
          "newAssignedUserId": 5,
          "oldAssignedUserId": null
        },
        "ipAddress": "192.168.1.100",
        "createdAt": "2026-01-17T11:30:00Z"
      },
      {
        "id": 2000,
        "actorId": 3,
        "action": "conversation_status_updated",
        "entityType": "conversation",
        "entityId": 101,
        "metadata": {
          "newStatus": "open",
          "oldStatus": "pending"
        },
        "ipAddress": "192.168.1.50",
        "createdAt": "2026-01-17T10:00:00Z"
      }
    ],
    "total": 156,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid query parameters or date format
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Requires Manager+ role

**RBAC Matrix**:
| Role | Can View |
|------|----------|
| Super Admin | ✅ |
| Admin | ✅ |
| Manager | ✅ |
| User | ❌ |

---

#### 16. GET /api/audit-logs/conversation/:conversationId

Get audit logs for specific conversation.

**Requirements**: Authentication required + Manager+ role

**Path Parameters**:
- `conversationId` (integer): Conversation ID

**Query Parameters**:
```
page=1                          (optional, default: 1)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 2001,
        "actorId": 5,
        "action": "conversation_assigned",
        "entityType": "conversation",
        "entityId": 101,
        "metadata": {
          "newAssignedUserId": 5
        },
        "ipAddress": "192.168.1.100",
        "createdAt": "2026-01-17T11:30:00Z"
      }
    ],
    "total": 12,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Requires Manager+ role
- `404 Not Found`: Conversation not found

---

#### 17. GET /api/audit-logs/actor/:actorId

Get audit logs for specific actor (user).

**Requirements**: Authentication required + Admin+ role

**Path Parameters**:
- `actorId` (integer): User ID

**Query Parameters**:
```
page=1                          (optional, default: 1)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 2001,
        "actorId": 5,
        "action": "conversation_assigned",
        "entityType": "conversation",
        "entityId": 101,
        "metadata": {
          "newAssignedUserId": 5
        },
        "ipAddress": "192.168.1.100",
        "createdAt": "2026-01-17T11:30:00Z"
      }
    ],
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Requires Admin+ role
- `404 Not Found`: Actor not found

---

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Error message",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Successful GET, PATCH |
| 201 | Created | Successful registration |
| 400 | Bad Request | Validation error, missing fields |
| 401 | Unauthorized | Missing/invalid token, wrong credentials |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Email already exists, duplicate tag |
| 500 | Server Error | Database error, unexpected error |

### Common Error Scenarios

**Missing Authentication**:
```json
{
  "error": "Missing or invalid authorization header"
}
```

**Invalid Token**:
```json
{
  "error": "Invalid or expired token"
}
```

**Insufficient Permissions**:
```json
{
  "error": "Insufficient permissions"
}
```

**Specific Permission Missing**:
```json
{
  "error": "Missing permission: assign_conversation"
}
```

**Validation Error**:
```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "invalid_type",
      "expected": "number",
      "received": "string",
      "path": ["limit"],
      "message": "Expected number, received string"
    }
  ]
}
```

---

## Role-Based Access Control

### Role Hierarchy

```
Super Admin (Level 4)
    ↓
Admin (Level 3)
    ↓
Manager (Level 2)
    ↓
User (Level 1)
```

### Permission Matrix

| Permission | Super Admin | Admin | Manager | User |
|------------|------------|-------|---------|------|
| create_user | ✅ | ❌ | ❌ | ❌ |
| edit_user | ✅ | ❌ | ❌ | ❌ |
| delete_user | ✅ | ❌ | ❌ | ❌ |
| manage_roles | ✅ | ❌ | ❌ | ❌ |
| view_audit_logs | ✅ | ✅ | ✅ | ❌ |
| export_audit_logs | ✅ | ✅ | ❌ | ❌ |
| manage_integrations | ✅ | ❌ | ❌ | ❌ |
| manage_routing_rules | ✅ | ✅ | ❌ | ❌ |
| reply_to_conversation | ✅ | ✅ | ✅ | ✅ |
| assign_conversation | ✅ | ✅ | ✅ | ❌ |
| tag_conversation | ✅ | ✅ | ✅ | ✅ |
| create_note | ✅ | ✅ | ✅ | ✅ |
| view_raw_payload | ✅ | ✅ | ✅ | ❌ |

### Role Descriptions

**Super Admin**: Full system access. Can manage users, roles, integrations, and all operations.

**Admin**: Operations and audit oversight. Can manage routing rules, view audit logs, assign and tag conversations.

**Manager**: Team oversight with audit access. Can assign conversations, manage tags/notes, and view audit logs for team activities.

**User**: Standard inbox user. Can reply, create notes, and tag conversations. No administrative capabilities.

---

## Data Models

### User Object

```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "role": "manager",
  "status": "active",
  "createdAt": "2026-01-17T10:30:00Z",
  "updatedAt": "2026-01-17T10:30:00Z",
  "lastLoginAt": "2026-01-17T11:00:00Z"
}
```

**Fields**:
- `id` (integer): Unique identifier
- `email` (string): Unique email address
- `name` (string): User's display name
- `role` (string): One of `super_admin`, `admin`, `manager`, `user`
- `status` (string): One of `active`, `inactive`, `suspended`
- `createdAt` (datetime): Account creation timestamp
- `updatedAt` (datetime): Last profile update
- `lastLoginAt` (datetime): Last login timestamp

### Conversation Object

```json
{
  "id": 101,
  "channel": "telegram",
  "externalThreadId": "group_123456",
  "title": "Sales Support Group",
  "status": "open",
  "priority": "high",
  "assignedUserId": 5,
  "metadata": {
    "senderName": "John Customer",
    "senderPhone": "+1234567890"
  },
  "createdAt": "2026-01-15T09:00:00Z",
  "updatedAt": "2026-01-17T11:30:00Z",
  "lastActivityAt": "2026-01-17T11:30:00Z"
}
```

**Fields**:
- `id` (integer): Unique identifier
- `channel` (string): One of `telegram`, `irc`, `email`, `slack`
- `externalThreadId` (string): Platform-specific conversation ID
- `title` (string): Conversation title/subject
- `status` (string): One of `open`, `pending`, `resolved`
- `priority` (string): One of `low`, `medium`, `high`, `urgent`
- `assignedUserId` (integer, nullable): ID of assigned user
- `metadata` (object): Platform-specific metadata
- `createdAt` (datetime): Conversation creation
- `updatedAt` (datetime): Last status/priority update
- `lastActivityAt` (datetime): Last message activity

### Message Object

```json
{
  "id": 501,
  "conversationId": 101,
  "senderId": 5,
  "senderName": "John Doe",
  "body": "Hello, how can I help?",
  "status": "sent",
  "direction": "outbound",
  "externalMessageId": "msg_123456",
  "metadata": {},
  "createdAt": "2026-01-15T09:10:00Z",
  "updatedAt": "2026-01-15T09:10:00Z"
}
```

**Fields**:
- `id` (integer): Unique identifier
- `conversationId` (integer): Parent conversation ID
- `senderId` (integer, nullable): Sender user ID
- `senderName` (string): Display name of sender
- `body` (string): Message content
- `status` (string): One of `pending`, `sent`, `failed`
- `direction` (string): One of `inbound`, `outbound`
- `externalMessageId` (string, nullable): Platform message ID
- `metadata` (object): Platform-specific data
- `createdAt` (datetime): Message timestamp
- `updatedAt` (datetime): Last update (retries, etc.)

### Tag Object

```json
{
  "id": 1,
  "name": "Urgent",
  "color": "#FF0000",
  "createdById": 2,
  "createdAt": "2026-01-15T09:00:00Z"
}
```

**Fields**:
- `id` (integer): Unique identifier
- `name` (string): Tag name
- `color` (string): Hex color code (e.g., "#FF0000")
- `createdById` (integer): Creator user ID
- `createdAt` (datetime): Tag creation

### Note Object

```json
{
  "id": 1,
  "conversationId": 101,
  "authorId": 5,
  "body": "Customer mentioned they have an active support plan.",
  "mentions": [3, 7],
  "createdAt": "2026-01-15T09:15:00Z",
  "updatedAt": "2026-01-15T09:15:00Z"
}
```

**Fields**:
- `id` (integer): Unique identifier
- `conversationId` (integer): Parent conversation ID
- `authorId` (integer): Author user ID
- `body` (string): Note content (supports @mentions)
- `mentions` (array): Array of mentioned user IDs
- `createdAt` (datetime): Note creation
- `updatedAt` (datetime): Last edit

### Audit Log Object

```json
{
  "id": 2001,
  "actorId": 5,
  "action": "conversation_assigned",
  "entityType": "conversation",
  "entityId": 101,
  "metadata": {
    "newAssignedUserId": 5,
    "oldAssignedUserId": null
  },
  "ipAddress": "192.168.1.100",
  "createdAt": "2026-01-17T11:30:00Z"
}
```

**Fields**:
- `id` (integer): Unique identifier
- `actorId` (integer, nullable): User who performed the action
- `action` (string): Action name (e.g., `conversation_assigned`)
- `entityType` (string): Entity type (e.g., `conversation`)
- `entityId` (integer): Entity ID
- `metadata` (object): Additional context (old/new values)
- `ipAddress` (string, nullable): Source IP address
- `createdAt` (datetime): Action timestamp

---

## WebSocket Events (Phase 2)

The following events will be available in Phase 2 via Socket.io:

- `conversation_updated`: Conversation status/priority/assignment changed
- `message_sent`: New outbound message sent
- `message_failed`: Message delivery failed
- `notification_received`: User received a notification
- `conversation_reopened`: Resolved conversation reopened due to new inbound
- `presence_updated`: User online/offline status changed
- `typing_started`: User started typing
- `typing_stopped`: User stopped typing

**Reconnection Strategy** (Phase 2):
- Heartbeat: 60 seconds
- Message backlog: 1 hour on reconnect
- Exponential backoff: 1s → 60s max (5 attempts)

---

## Rate Limiting (Future)

Rate limiting will be implemented in Phase 2:
- 100 requests per minute per IP (authenticated)
- 20 requests per minute per IP (unauthenticated)

---

**Questions?** See `TESTING_GUIDE.md` for curl examples or `STARTUP_CHECKLIST.md` for deployment.
