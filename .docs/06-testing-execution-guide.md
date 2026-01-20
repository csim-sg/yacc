# 06. Testing Execution Guide

> **Version**: 1.0.0
> **Status**: Testing Execution & Automation Guide
> **Last Updated**: January 20, 2026

> **Note**: For test strategy, test cases, and acceptance criteria, see `.docs/04-qa-and-testing.md`. This document focuses on **how to execute tests**.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Data Setup](#test-data-setup)
3. [Testing by Endpoint](#testing-by-endpoint)
4. [Postman Collection](#postman-collection)
5. [Automated Testing](#automated-testing)
6. [Performance Testing](#performance-testing)
7. [Common Error Scenarios](#common-error-scenarios)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- Backend running on `http://localhost:3000`
- PostgreSQL database initialized
- `curl` command-line tool installed (or Postman)

### Verify Backend is Running

```bash
curl -X GET http://localhost:3000/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-20T11:30:00Z"
}
```

### View API Index

```bash
curl -X GET http://localhost:3000/api
```

**Expected Response**:
```json
{
  "message": "YACC Inbox API",
  "version": "0.1.0",
  "endpoints": {
    "health": "/health",
    "auth": "/api/auth",
    "conversations": "/api/conversations",
    "audit-logs": "/api/audit-logs",
    "messages": "/api/messages (Phase 2)",
    "users": "/api/users (Phase 2)"
  }
}
```

---

## Test Data Setup

### Step 1: Register Test Users

Create 4 test users with different roles for comprehensive testing.

#### User 1: Super Admin

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yacc.local",
    "password": "AdminPass123!",
    "name": "Admin User"
  }'
```

**Expected**: Status 201, user object with `role: "user"` (will be promoted in production)

Save the user ID from response (should be `1`)

#### User 2: Manager

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@yacc.local",
    "password": "ManagerPass123!",
    "name": "Manager User"
  }'
```

Save user ID (should be `2`)

#### User 3: Support Agent

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "agent@yacc.local",
    "password": "AgentPass123!",
    "name": "Support Agent"
  }'
```

Save user ID (should be `3`)

#### User 4: Customer Service Rep

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "support@yacc.local",
    "password": "SupportPass123!",
    "name": "Customer Service"
  }'
```

Save user ID (should be `4`)

### Step 2: Generate Auth Tokens

Login each user and save their tokens for later requests.

#### Login Admin

```bash
ADMIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yacc.local",
    "password": "AdminPass123!"
  }')

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.token')
echo "Admin Token: $ADMIN_TOKEN"
```

#### Login Manager

```bash
MANAGER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@yacc.local",
    "password": "ManagerPass123!"
  }')

MANAGER_TOKEN=$(echo $MANAGER_RESPONSE | jq -r '.token')
echo "Manager Token: $MANAGER_TOKEN"
```

#### Login Agent

```bash
AGENT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "agent@yacc.local",
    "password": "AgentPass123!"
  }')

AGENT_TOKEN=$(echo $AGENT_RESPONSE | jq -r '.token')
echo "Agent Token: $AGENT_TOKEN"
```

#### Login Support

```bash
SUPPORT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "support@yacc.local",
    "password": "SupportPass123!"
  }')

SUPPORT_TOKEN=$(echo $SUPPORT_RESPONSE | jq -r '.token')
echo "Support Token: $SUPPORT_TOKEN"
```

### Step 3: Create Test Conversations (via Database)

Since messaging endpoints are Phase 2, directly insert test conversations using PostgreSQL:

```sql
INSERT INTO conversations (channel, external_thread_id, title, status, priority, assigned_user_id)
VALUES
  ('telegram', 'tg_group_001', 'Sales Inquiry', 'open', 'high', 2),
  ('telegram', 'tg_group_002', 'Technical Support', 'open', 'urgent', 3),
  ('irc', 'irc_channel_001', '#support', 'pending', 'medium', NULL),
  ('telegram', 'tg_group_003', 'Billing Question', 'resolved', 'low', 2);

-- Get conversation IDs for later use
SELECT id, channel, title, status FROM conversations;
```

**Expected**: 4 conversations with IDs 1, 2, 3, 4

### Step 4: Create Test Tags (via Database)

```sql
INSERT INTO tags (name, color, created_by_id)
VALUES
  ('Urgent', '#FF0000', 1),
  ('VIP Customer', '#0000FF', 1),
  ('Bug Report', '#FFFF00', 2),
  ('Feature Request', '#00FF00', 2);

-- Get tag IDs
SELECT id, name, color FROM tags;
```

**Expected**: 4 tags with IDs 1, 2, 3, 4

### Setup Summary

You now have:
- ✅ 4 test users with tokens
- ✅ 4 test conversations
- ✅ 4 test tags
- ✅ Ready for endpoint testing

---

## Testing by Endpoint

### Auth Endpoints

#### POST /api/auth/register

**Scenario 1**: Register new user (valid)

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "NewPass123!",
    "name": "New User"
  }'
```

**Success Criteria**:
- ✅ Status code: 201
- ✅ Response contains `success: true`
- ✅ User object includes: id, email, name, role, status
- ✅ Role defaults to "user"

**Scenario 2**: Register with weak password (invalid)

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "another@example.com",
    "password": "weak",
    "name": "User"
  }'
```

**Success Criteria**:
- ✅ Status code: 400
- ✅ Error message mentions password requirement

**Scenario 3**: Register duplicate email

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yacc.local",
    "password": "DuplicatePass123!",
    "name": "Duplicate"
  }'
```

**Success Criteria**:
- ✅ Status code: 400 or 409
- ✅ Error message indicates duplicate email

---

#### POST /api/auth/login

**Scenario 1**: Login with correct credentials

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@yacc.local",
    "password": "ManagerPass123!"
  }'
```

**Success Criteria**:
- ✅ Status code: 200
- ✅ Response includes: user object, token, expiresIn
- ✅ Token is valid JWT format

**Scenario 2**: Login with wrong password

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@yacc.local",
    "password": "WrongPassword123!"
  }'
```

**Success Criteria**:
- ✅ Status code: 401
- ✅ Error message: "Invalid credentials"

---

#### POST /api/auth/logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Success Criteria**:
- ✅ Status code: 200
- ✅ Response: `success: true`

---

#### GET /api/auth/me

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Success Criteria**:
- ✅ Status code: 200
- ✅ Response includes current user's full profile

---

#### POST /api/auth/forgot-password

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@yacc.local"
  }'
```

**Success Criteria**:
- ✅ Status code: 200
- ✅ Response: generic success message
- ✅ Doesn't reveal if email exists (security)

---

#### POST /api/auth/reset-password

First, check the database for a valid reset token:

```sql
SELECT id, token, expires_at, used_at FROM password_reset_tokens
WHERE used_at IS NULL AND expires_at > NOW()
LIMIT 1;
```

Then reset with valid token:

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$RESET_TOKEN\",
    \"newPassword\": \"ResetPass456!\"
  }"
```

**Success Criteria**:
- ✅ Status code: 200
- ✅ Response: "Password reset successfully"
- ✅ Can now login with new password

---

### Conversation Endpoints

#### GET /api/conversations

**Scenario 1**: List all conversations (no filters)

```bash
curl -X GET http://localhost:3000/api/conversations \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Success Criteria**:
- ✅ Status code: 200
- ✅ Response includes: conversations array, total, page, limit, totalPages

**Scenario 2**: List with filters

```bash
curl -X GET "http://localhost:3000/api/conversations?channel=telegram&status=open" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Scenario 3**: List with pagination

```bash
curl -X GET "http://localhost:3000/api/conversations?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

#### GET /api/conversations/:id

```bash
curl -X GET http://localhost:3000/api/conversations/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Success Criteria**:
- ✅ Status code: 200
- ✅ Response includes: conversation object, messages array, tags, notes

---

#### PATCH /api/conversations/:id/status

```bash
curl -X PATCH http://localhost:3000/api/conversations/1/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "pending"
  }'
```

**Success Criteria**:
- ✅ Status code: 200
- ✅ Returned conversation has status: "pending"

---

#### PATCH /api/conversations/:id/priority

```bash
curl -X PATCH http://localhost:3000/api/conversations/2/priority \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "urgent"
  }'
```

---

#### PATCH /api/conversations/:id/assign

```bash
curl -X PATCH http://localhost:3000/api/conversations/3/assign \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assignedUserId": 3
  }'
```

**Success Criteria**:
- ✅ Status code: 200
- ✅ Response: "Conversation assigned to user 3"

---

#### POST /api/conversations/:id/tags

```bash
curl -X POST http://localhost:3000/api/conversations/1/tags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tagId": 1
  }'
```

---

#### DELETE /api/conversations/:id/tags/:tagId

```bash
curl -X DELETE http://localhost:3000/api/conversations/1/tags/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

### Audit Log Endpoints

#### GET /api/audit-logs

```bash
curl -X GET http://localhost:3000/api/audit-logs \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

**Success Criteria**:
- ✅ Status code: 200
- ✅ Response includes: logs array, total, page, limit, totalPages

**With filters**:
```bash
curl -X GET "http://localhost:3000/api/audit-logs?action=conversation_assigned" \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

---

#### GET /api/audit-logs/conversation/:conversationId

```bash
curl -X GET http://localhost:3000/api/audit-logs/conversation/1 \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

---

#### GET /api/audit-logs/actor/:actorId

```bash
curl -X GET http://localhost:3000/api/audit-logs/actor/2 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Postman Collection

### Import Collection

1. Save the following JSON as `YACC-Phase1.postman_collection.json`
2. In Postman: **File → Import** → Select file
3. Create Postman environment with variables:
   - `base_url`: `http://localhost:3000`
   - `admin_token`: (populated after login)
   - `manager_token`: (populated after login)
   - `agent_token`: (populated after login)
   - `support_token`: (populated after login)

### Collection JSON

```json
{
  "info": {
    "name": "YACC Phase 1 API",
    "version": "0.1.0",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Register User",
          "request": {
            "method": "POST",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "body": {
              "mode": "raw",
              "raw": "{\"email\":\"user@example.com\",\"password\":\"Pass123!\",\"name\":\"Test User\"}"
            },
            "url": {"raw": "{{base_url}}/api/auth/register", "protocol": "http", "host": ["{{base_url}}"], "path": ["/api/auth/register"]}
          }
        },
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "body": {
              "mode": "raw",
              "raw": "{\"email\":\"admin@yacc.local\",\"password\":\"AdminPass123!\"}"
            },
            "url": {"raw": "{{base_url}}/api/auth/login", "protocol": "http", "host": ["{{base_url}}"], "path": ["/api/auth/login"]}
          }
        },
        {
          "name": "Get Current User",
          "request": {
            "method": "GET",
            "header": [{"key": "Authorization", "value": "Bearer {{admin_token}}"}],
            "url": {"raw": "{{base_url}}/api/auth/me", "protocol": "http", "host": ["{{base_url}}"], "path": ["/api/auth/me"]}
          }
        },
        {
          "name": "Logout",
          "request": {
            "method": "POST",
            "header": [{"key": "Authorization", "value": "Bearer {{admin_token}}"}],
            "url": {"raw": "{{base_url}}/api/auth/logout", "protocol": "http", "host": ["{{base_url}}"], "path": ["/api/auth/logout"]}
          }
        },
        {
          "name": "Forgot Password",
          "request": {
            "method": "POST",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "body": {"mode": "raw", "raw": "{\"email\":\"admin@yacc.local\"}"},
            "url": {"raw": "{{base_url}}/api/auth/forgot-password", "protocol": "http", "host": ["{{base_url}}"], "path": ["/api/auth/forgot-password"]}
          }
        }
      ]
    },
    {
      "name": "Conversations",
      "item": [
        {
          "name": "List Conversations",
          "request": {
            "method": "GET",
            "header": [{"key": "Authorization", "value": "Bearer {{admin_token}}"}],
            "url": {
              "raw": "{{base_url}}/api/conversations?page=1&limit=20&channel=telegram&status=open",
              "protocol": "http",
              "host": ["{{base_url}}"],
              "path": ["/api/conversations"],
              "query": [{"key": "page", "value": "1"}, {"key": "limit", "value": "20"}, {"key": "channel", "value": "telegram"}, {"key": "status", "value": "open"}]
            }
          }
        },
        {
          "name": "Get Conversation",
          "request": {
            "method": "GET",
            "header": [{"key": "Authorization", "value": "Bearer {{admin_token}}"}],
            "url": {"raw": "{{base_url}}/api/conversations/1", "protocol": "http", "host": ["{{base_url}}"], "path": ["/api/conversations/1"]}
          }
        },
        {
          "name": "Update Status",
          "request": {
            "method": "PATCH",
            "header": [{"key": "Authorization", "value": "Bearer {{admin_token}}"}, {"key": "Content-Type", "value": "application/json"}],
            "body": {"mode": "raw", "raw": "{\"status\":\"pending\"}"},
            "url": {"raw": "{{base_url}}/api/conversations/1/status", "protocol": "http", "host": ["{{base_url}}"], "path": ["/api/conversations/1/status"]}
          }
        },
        {
          "name": "Update Priority",
          "request": {
            "method": "PATCH",
            "header": [{"key": "Authorization", "value": "Bearer {{admin_token}}"}, {"key": "Content-Type", "value": "application/json"}],
            "body": {"mode": "raw", "raw": "{\"priority\":\"urgent\"}"},
            "url": {"raw": "{{base_url}}/api/conversations/1/priority", "protocol": "http", "host": ["{{base_url}}"], "path": ["/api/conversations/1/priority"]}
          }
        },
        {
          "name": "Assign Conversation",
          "request": {
            "method": "PATCH",
            "header": [{"key": "Authorization", "value": "Bearer {{manager_token}}"}, {"key": "Content-Type", "value": "application/json"}],
            "body": {"mode": "raw", "raw": "{\"assignedUserId\":2}"},
            "url": {"raw": "{{base_url}}/api/conversations/1/assign", "protocol": "http", "host": ["{{base_url}}"], "path": ["/api/conversations/1/assign"]}
          }
        },
        {
          "name": "Add Tag",
          "request": {
            "method": "POST",
            "header": [{"key": "Authorization", "value": "Bearer {{admin_token}}"}, {"key": "Content-Type", "value": "application/json"}],
            "body": {"mode": "raw", "raw": "{\"tagId\":1}"},
            "url": {"raw": "{{base_url}}/api/conversations/1/tags", "protocol": "http", "host": ["{{base_url}}"], "path": ["/api/conversations/1/tags"]}
          }
        },
        {
          "name": "Remove Tag",
          "request": {
            "method": "DELETE",
            "header": [{"key": "Authorization", "value": "Bearer {{admin_token}}"}],
            "url": {"raw": "{{base_url}}/api/conversations/1/tags/1", "protocol": "http", "host": ["{{base_url}}"], "path": ["/api/conversations/1/tags/1"]}
          }
        }
      ]
    },
    {
      "name": "Audit Logs",
      "item": [
        {
          "name": "Query Audit Logs",
          "request": {
            "method": "GET",
            "header": [{"key": "Authorization", "value": "Bearer {{manager_token}}"}],
            "url": {
              "raw": "{{base_url}}/api/audit-logs?page=1&limit=20&action=conversation_assigned",
              "protocol": "http",
              "host": ["{{base_url}}"],
              "path": ["/api/audit-logs"],
              "query": [{"key": "page", "value": "1"}, {"key": "limit", "value": "20"}, {"key": "action", "value": "conversation_assigned"}]
            }
          }
        },
        {
          "name": "Get Conversation Audit Logs",
          "request": {
            "method": "GET",
            "header": [{"key": "Authorization", "value": "Bearer {{manager_token}}"}],
            "url": {"raw": "{{base_url}}/api/audit-logs/conversation/1", "protocol": "http", "host": ["{{base_url}}"], "path": ["/api/audit-logs/conversation/1"]}
          }
        },
        {
          "name": "Get Actor Audit Logs",
          "request": {
            "method": "GET",
            "header": [{"key": "Authorization", "value": "Bearer {{admin_token}}"}],
            "url": {"raw": "{{base_url}}/api/audit-logs/actor/1", "protocol": "http", "host": ["{{base_url}}"], "path": ["/api/audit-logs/actor/1"]}
          }
        }
      ]
    }
  ]
}
```

---

## Automated Testing

### Jest Setup

```bash
cd packages/backend
npm test
```

### Example Test Suite

File: `src/__tests__/auth.test.ts`

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../index';

describe('Auth Endpoints', () => {
  let authToken: string;
  let userId: number;

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPass123!',
          name: 'Test User',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.role).toBe('user');
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weak@example.com',
          password: 'weak',
          name: 'User',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('password');
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'DuplicatePass123!',
          name: 'Another User',
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');

      authToken = res.body.token;
      userId = res.body.user.id;
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPass123!',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(userId);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(401);
    });
  });
});
```

---

## Performance Testing

### Load Test: List Conversations

```bash
# Install artillery
npm install -g artillery

# Create config file: load-test.yml
cat > load-test.yml << 'EOF'
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
  scenarios:
  - name: 'List conversations'
    flow:
      - get:
          url: '/api/conversations'
          headers:
            Authorization: 'Bearer YOUR_TOKEN'
EOF

# Run test
artillery run load-test.yml
```

**Expected**: Response time < 500ms for typical queries

### Pagination Performance

Test with different limits:

```bash
# Small limit (fast)
curl "http://localhost:3000/api/conversations?limit=10" -H "Authorization: Bearer $TOKEN"

# Large limit (slower)
curl "http://localhost:3000/api/conversations?limit=100" -H "Authorization: Bearer $TOKEN"

# Measure time
time curl "http://localhost:3000/api/conversations?page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Criteria**:
- Limit 10: < 100ms
- Limit 50: < 300ms
- Limit 100: < 500ms

---

## Common Error Scenarios

### Scenario 1: Expired Token

**Symptom**: All authenticated requests return 401

```json
{ "error": "Invalid or expired token" }
```

**Solution**:
1. Re-login to get new token
2. Update `Authorization` header with new token
3. Ensure token not older than 7 days

---

### Scenario 2: Insufficient Permissions

**Symptom**: Request returns 403

```json
{ "error": "Missing permission: assign_conversation" }
```

**Solution**:
- Check user's role
- Verify role has required permission
- Use higher-privilege token if available
- Check RBAC matrix in `.docs/02-api-and-data-model.md`

---

### Scenario 3: Validation Error

**Symptom**: Request returns 400 with validation details

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["priority"],
      "message": "Invalid enum value"
    }
  ]
}
```

**Solution**:
- Review allowed values in `.docs/02-api-and-data-model.md`
- Ensure correct data types
- Check query parameter names

---

### Scenario 4: Database Connection Failed

**Symptom**: All requests return 500

```json
{ "error": "Internal Server Error" }
```

**Solution**:
1. Check PostgreSQL is running: `psql -h localhost -U yacc_user -d yacc_inbox`
2. Verify DATABASE_URL in .env
3. Check database migrations: review `migrations.ts`
4. Restart backend server

---

### Scenario 5: CORS Error (Frontend)

**Symptom**: Browser console shows CORS error

**Solution**:
1. Verify `FRONTEND_URL` env var on backend
2. Check Socket.io CORS config in `index.ts`
3. Add frontend URL to CORS allowlist

---

## Troubleshooting

### Issue: "Missing or invalid authorization header"

**Cause**: Token not included or malformed

**Fix**:
```bash
# Correct format
curl -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Wrong (missing "Bearer")
curl -H "Authorization: YOUR_TOKEN_HERE"  # ❌

# Wrong (extra spaces)
curl -H "Authorization:  Bearer YOUR_TOKEN"  # ❌
```

---

### Issue: "Conversation not found" but ID exists

**Cause**: ID type mismatch or wrong database

**Fix**:
```bash
# Ensure ID is integer
curl "http://localhost:3000/api/conversations/1"  # ✅

# Not string
curl "http://localhost:3000/api/conversations/01"  # May fail
```

---

### Issue: Audit logs empty

**Cause**: Audit service not logging or wrong user role

**Fix**:
1. Verify user role is Manager+
2. Check `auditService.logAction()` calls in routes
3. Query database: `SELECT COUNT(*) FROM audit_logs;`

---

### Issue: Tests fail with database errors

**Cause**: Database not initialized

**Fix**:
```bash
# Reset database
psql -h localhost -U yacc_user -d yacc_inbox -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Run migrations
npm run migrate

# Re-seed test data
# (See Test Data Setup section)
```

---

### Issue: Permission denied on file operations

**Cause**: Node process doesn't have write access

**Fix**:
```bash
# Check permissions
ls -la packages/backend

# Add permissions
chmod -R 755 packages/backend

# Or run with sudo (not recommended for production)
sudo npm run dev
```

---

## Next Steps

- Run full test suite after each backend change
- Use Postman collection for manual QA
- Add more integration tests as new endpoints are added
- Monitor performance in production-like environment

For test strategy and acceptance criteria, see `.docs/04-qa-and-testing.md`.

---

**Version**: 1.0.0  
**Last Updated**: January 20, 2026  
**Status**: Complete & Ready for Execution
