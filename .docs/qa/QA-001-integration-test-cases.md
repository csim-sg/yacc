# QA-001: Integration Test Cases for BE-007-010 (Inbox API & Messaging)

**Issue**: #195  
**Status**: Ready for Implementation  
**Scope**: Integration tests for conversation listing, filtering, pagination, and message operations  
**Framework**: Vitest  
**Target Coverage**: ≥85%

---

## Overview

QA-001 covers comprehensive integration tests for the Inbox API endpoints:
- GET /conversations (list with filters & pagination)
- GET /conversations/:id (get single conversation)
- GET /conversations/:id/messages (list messages)
- POST /conversations/:id/messages (send message)
- PATCH /conversations/:id (update status/priority/assignment)

---

## Test Case Categories

### Category 1: Basic Listing (GET /conversations)

#### TC-001-001: List conversations - default pagination
```
Test ID: TC-001-001
Description: Should return conversations with default pagination (page=1, limit=20)
Preconditions:
  - 35 test conversations exist in database
  - User has manager role
  - User is authenticated
Steps:
  1. Call GET /conversations without query parameters
  2. Verify response status is 200
  3. Verify response has data, page, pageSize, total fields
  4. Verify data length <= 20
  5. Verify page = 1, pageSize = 20, total = 35
Expected Result: 
  ✓ Returns 20 conversations with pagination metadata
Pass Criteria: All verifications pass
```

#### TC-001-002: List conversations - auth required
```
Test ID: TC-001-002
Description: Should require authentication
Preconditions:
  - No authentication token
Steps:
  1. Call GET /conversations without Authorization header
Expected Result:
  ✓ Response status is 401
  ✓ Response includes error message
Pass Criteria: 401 status returned
```

#### TC-001-003: List conversations - response format
```
Test ID: TC-001-003
Description: Verify conversation summary structure matches API contract
Preconditions:
  - User is authenticated
  - Conversations exist
Steps:
  1. Call GET /conversations
  2. Extract first conversation from data array
  3. Verify conversation has all required fields:
     - id (uuid string)
     - channel (telegram|irc)
     - externalThreadId (string)
     - status (open|pending|resolved)
     - priority (low|medium|high|urgent)
     - assignedUserId (uuid|null)
     - assignedUserName (string|null)
     - tags (array of {id, name, color})
     - participants (array of {id, name, type})
     - unreadCount (number)
     - latestMessagePreview (string|null)
     - latestMessageAt (ISO8601|null)
     - createdAt (ISO8601)
     - updatedAt (ISO8601)
Expected Result:
  ✓ All required fields present with correct types
Pass Criteria: Schema validation passes
```

---

### Category 2: Pagination Tests (GET /conversations)

#### TC-002-001: Custom page size
```
Test ID: TC-002-001
Description: Should support custom limit parameter
Preconditions:
  - 50 test conversations exist
  - User authenticated
Steps:
  1. Call GET /conversations?limit=10
  2. Verify response status is 200
  3. Verify data.length = 10
  4. Verify pageSize = 10
  5. Call GET /conversations?limit=5
  6. Verify data.length = 5
  7. Verify pageSize = 5
Expected Result:
  ✓ Returns requested number of conversations
Pass Criteria: All limits work correctly
```

#### TC-002-002: Page offset
```
Test ID: TC-002-002
Description: Should support page parameter for offset
Preconditions:
  - 50 test conversations exist
  - User authenticated
Steps:
  1. Call GET /conversations?limit=10&page=1
  2. Store first conversation ID from response
  3. Call GET /conversations?limit=10&page=2
  4. Store first conversation ID from response
  5. Verify conversation IDs are different
  6. Call GET /conversations?limit=10&page=5
  7. Verify status 200
  8. Verify data length = 10
Expected Result:
  ✓ Pages return different conversations
  ✓ Page offsets work correctly
Pass Criteria: Page offset logic correct
```

#### TC-002-003: Total pages calculation
```
Test ID: TC-002-003
Description: Should calculate total pages correctly
Preconditions:
  - 35 test conversations exist
  - User authenticated
Steps:
  1. Call GET /conversations?limit=10
  2. Calculate expectedPages = ceil(35 / 10) = 4
  3. Verify total = 35
  4. Verify page = 1
  5. Call GET /conversations?limit=7
  6. Calculate expectedPages = ceil(35 / 7) = 5
  7. Verify total = 35
Expected Result:
  ✓ Pages calculated correctly for all limits
Pass Criteria: total field matches expected value
```

#### TC-002-004: Out of range page
```
Test ID: TC-002-004
Description: Should return empty data for page beyond total
Preconditions:
  - 35 test conversations exist
  - User authenticated
Steps:
  1. Call GET /conversations?limit=10&page=100
Expected Result:
  ✓ Response status 200
  ✓ data array is empty
  ✓ total = 35, page = 100
Pass Criteria: Graceful handling of out-of-range page
```

---

### Category 3: Filtering Tests (GET /conversations)

#### TC-003-001: Filter by channel
```
Test ID: TC-003-001
Description: Should filter conversations by channel
Preconditions:
  - Conversations exist for both telegram and irc
  - User authenticated
Steps:
  1. Call GET /conversations?channel=telegram
  2. Verify all returned conversations have channel = "telegram"
  3. Verify total count matches telegram conversations
  4. Call GET /conversations?channel=irc
  5. Verify all returned conversations have channel = "irc"
Expected Result:
  ✓ Returns only conversations for selected channel
Pass Criteria: Channel filter works correctly
```

#### TC-003-002: Filter by status
```
Test ID: TC-003-002
Description: Should filter conversations by status
Preconditions:
  - Conversations with different statuses exist
  - User authenticated
Steps:
  1. Call GET /conversations?status=open
  2. Verify all data items have status = "open"
  3. Call GET /conversations?status=pending
  4. Verify all data items have status = "pending"
  5. Call GET /conversations?status=resolved
  6. Verify all data items have status = "resolved"
Expected Result:
  ✓ Returns only conversations with selected status
Pass Criteria: Status filter works for all values
```

#### TC-003-003: Filter by priority
```
Test ID: TC-003-003
Description: Should filter conversations by priority
Preconditions:
  - Conversations with different priorities exist
  - User authenticated
Steps:
  1. Call GET /conversations?priority=high
  2. Verify all data items have priority = "high"
  3. Call GET /conversations?priority=urgent
  4. Verify all data items have priority = "urgent"
  5. Call GET /conversations?priority=low
  6. Verify all data items have priority = "low"
Expected Result:
  ✓ Returns only conversations with selected priority
Pass Criteria: Priority filter works for all values
```

#### TC-003-004: Filter by assignee
```
Test ID: TC-003-004
Description: Should filter conversations by assigned user
Preconditions:
  - Conversations assigned to different users exist
  - User authenticated
Steps:
  1. Store a user ID (e.g., user-123)
  2. Call GET /conversations?assignedUserId=user-123
  3. Verify all data items have assignedUserId = "user-123"
  4. Verify total matches assigned conversations count
Expected Result:
  ✓ Returns only conversations assigned to user
Pass Criteria: Assignee filter works correctly
```

#### TC-003-005: Multiple filters combined
```
Test ID: TC-003-005
Description: Should apply multiple filters together (AND logic)
Preconditions:
  - Conversations with various combinations exist
  - User authenticated
Steps:
  1. Call GET /conversations?channel=telegram&status=open&priority=high
  2. Verify all data items satisfy ALL three filters
  3. Count matches = expected for intersection
  4. Call GET /conversations?channel=irc&status=pending
  5. Verify all data items satisfy both filters
Expected Result:
  ✓ Multiple filters apply correctly with AND logic
Pass Criteria: Combined filters return correct subset
```

---

### Category 4: Search Tests (GET /conversations)

#### TC-004-001: Full-text search on message bodies
```
Test ID: TC-004-001
Description: Should search message bodies (case-insensitive)
Preconditions:
  - Conversation with message containing "refund"
  - User authenticated
Steps:
  1. Call GET /conversations?search=refund
  2. Verify returned conversations contain messages with "refund"
  3. Verify search is case-insensitive by searching "REFUND"
  4. Verify same results returned
Expected Result:
  ✓ Finds conversations by message content
  ✓ Search is case-insensitive
Pass Criteria: Full-text search works correctly
```

#### TC-004-002: Search on sender names
```
Test ID: TC-004-002
Description: Should search sender names
Preconditions:
  - Conversation with sender "Alice Johnson"
  - User authenticated
Steps:
  1. Call GET /conversations?search=Alice
  2. Verify returned conversations have participant "Alice"
  3. Call GET /conversations?search=alice
  4. Verify same results (case-insensitive)
Expected Result:
  ✓ Finds conversations by sender name
Pass Criteria: Sender name search works
```

#### TC-004-003: Search with no matches
```
Test ID: TC-004-003
Description: Should return empty results for non-matching search
Preconditions:
  - User authenticated
Steps:
  1. Call GET /conversations?search=xyznonexistentstring
  2. Verify data array is empty
  3. Verify total = 0
Expected Result:
  ✓ Returns empty data for no matches
Pass Criteria: Graceful handling of no search results
```

---

### Category 5: Date Range Filtering (GET /conversations)

#### TC-005-001: Filter by date range
```
Test ID: TC-005-001
Description: Should filter conversations by dateFrom and dateTo
Preconditions:
  - Conversations with various dates exist
  - User authenticated
Steps:
  1. Call GET /conversations?dateFrom=2026-02-01&dateTo=2026-02-06
  2. Verify all returned conversations have lastActivityAt between dates
  3. Verify no conversations outside range
Expected Result:
  ✓ Returns only conversations within date range
Pass Criteria: Date filtering works correctly
```

#### TC-005-002: Filter from date only
```
Test ID: TC-005-002
Description: Should filter with dateFrom only
Preconditions:
  - Conversations with various dates exist
  - User authenticated
Steps:
  1. Call GET /conversations?dateFrom=2026-02-01
  2. Verify all returned conversations have lastActivityAt >= 2026-02-01
Expected Result:
  ✓ Returns conversations from dateFrom onwards
Pass Criteria: dateFrom filter works alone
```

#### TC-005-003: Filter to date only
```
Test ID: TC-005-003
Description: Should filter with dateTo only
Preconditions:
  - Conversations with various dates exist
  - User authenticated
Steps:
  1. Call GET /conversations?dateTo=2026-02-06
  2. Verify all returned conversations have lastActivityAt <= 2026-02-06
Expected Result:
  ✓ Returns conversations up to dateTo
Pass Criteria: dateTo filter works alone
```

---

### Category 6: Sorting Tests (GET /conversations)

#### TC-006-001: Sort by last activity (default)
```
Test ID: TC-006-001
Description: Should sort by lastActivityAt descending by default
Preconditions:
  - Multiple conversations with different activity dates exist
  - User authenticated
Steps:
  1. Call GET /conversations (no sortBy parameter)
  2. Verify conversations ordered by lastActivityAt DESC
  3. Verify most recent activity first
Expected Result:
  ✓ Default sort is by lastActivityAt descending
Pass Criteria: Default sorting matches specification
```

#### TC-006-002: Sort by creation date
```
Test ID: TC-006-002
Description: Should support sorting by createdAt
Preconditions:
  - Multiple conversations with different creation dates
  - User authenticated
Steps:
  1. Call GET /conversations?sortBy=created&sortOrder=desc
  2. Verify conversations ordered by createdAt DESC
  3. Call GET /conversations?sortBy=created&sortOrder=asc
  4. Verify conversations ordered by createdAt ASC
Expected Result:
  ✓ Created date sorting works in both directions
Pass Criteria: Sort by created date works correctly
```

#### TC-006-003: Sort by priority
```
Test ID: TC-006-003
Description: Should support sorting by priority
Preconditions:
  - Conversations with different priorities exist
  - User authenticated
Steps:
  1. Call GET /conversations?sortBy=priority
  2. Verify conversations ordered by priority (urgent→high→medium→low)
Expected Result:
  ✓ Priority sorting works correctly
Pass Criteria: Sort by priority works
```

---

### Category 7: Conversation Detail (GET /conversations/:id)

#### TC-007-001: Get conversation by ID
```
Test ID: TC-007-001
Description: Should return full conversation details
Preconditions:
  - Conversation conv-123 exists
  - User authenticated
Steps:
  1. Call GET /conversations/conv-123
  2. Verify response status 200
  3. Verify response.data has all conversation fields
  4. Verify conversation ID matches request
Expected Result:
  ✓ Returns complete conversation details
Pass Criteria: Full conversation data returned
```

#### TC-007-002: Get non-existent conversation
```
Test ID: TC-007-002
Description: Should return 404 for non-existent conversation
Preconditions:
  - User authenticated
Steps:
  1. Call GET /conversations/non-existent-id
Expected Result:
  ✓ Response status is 404
  ✓ Error message indicates conversation not found
Pass Criteria: 404 error returned
```

---

### Category 8: Message Listing (GET /conversations/:id/messages)

#### TC-008-001: Get conversation messages
```
Test ID: TC-008-001
Description: Should return messages for conversation with pagination
Preconditions:
  - Conversation with 3 messages exists
  - User authenticated
Steps:
  1. Call GET /conversations/conv-1/messages
  2. Verify status 200
  3. Verify response has data, page, pageSize, total
  4. Verify data array contains all 3 messages
  5. Verify messages ordered by createdAt ascending
Expected Result:
  ✓ Returns paginated message list
  ✓ Messages in chronological order
Pass Criteria: Message listing works correctly
```

#### TC-008-002: Message pagination
```
Test ID: TC-008-002
Description: Should paginate messages correctly
Preconditions:
  - Conversation with 50 messages exists
  - User authenticated
Steps:
  1. Call GET /conversations/conv-1/messages?limit=10
  2. Verify data.length = 10, total = 50
  3. Call GET /conversations/conv-1/messages?limit=10&page=2
  4. Verify different messages returned
Expected Result:
  ✓ Message pagination works correctly
Pass Criteria: Page offset applies to messages
```

---

### Category 9: Send Message (POST /conversations/:id/messages)

#### TC-009-001: Send outbound message
```
Test ID: TC-009-001
Description: Should create outbound message
Preconditions:
  - Conversation conv-1 exists
  - User authenticated with outbound permission
  - Message body provided
Steps:
  1. Call POST /conversations/conv-1/messages
     Body: { "body": "Hello customer" }
  2. Verify status 200 or 201
  3. Verify response.data.message.body = "Hello customer"
  4. Verify message.direction = "outbound"
  5. Verify message.status = "sent" or "pending"
Expected Result:
  ✓ Message created successfully
  ✓ Message stored in database
Pass Criteria: Message sent and recorded
```

#### TC-009-002: Send message triggers conversation update
```
Test ID: TC-009-002
Description: Should update conversation lastActivityAt when message sent
Preconditions:
  - Conversation conv-1 exists
  - User authenticated
Steps:
  1. Get conversation lastActivityAt before
  2. Send message POST /conversations/conv-1/messages
  3. Get conversation lastActivityAt after
  4. Verify lastActivityAt is updated to current time
Expected Result:
  ✓ Conversation lastActivityAt updated
Pass Criteria: Activity timestamp reflects message
```

---

### Category 10: RBAC Tests (Role-Based Access Control)

#### TC-010-001: User cannot access other user's data
```
Test ID: TC-010-001
Description: Should enforce RBAC for conversation access
Preconditions:
  - User-1 creates conversation conv-1
  - User-2 is authenticated with minimal role
Steps:
  1. User-2 calls GET /conversations/conv-1
  2. Verify appropriate access control (401/403)
Expected Result:
  ✓ Unauthorized access rejected
Pass Criteria: RBAC enforced correctly
```

#### TC-010-002: Manager can update status
```
Test ID: TC-010-002
Description: Manager role should be able to update conversation status
Preconditions:
  - User has manager role
  - Conversation conv-1 exists
  - User authenticated
Steps:
  1. Call PATCH /conversations/conv-1
     Body: { "status": "pending" }
  2. Verify status 200
  3. Verify conversation status updated
Expected Result:
  ✓ Manager can update conversation
Pass Criteria: Manager role permission works
```

#### TC-010-003: User role cannot update conversation
```
Test ID: TC-010-003
Description: Basic user role should not update status
Preconditions:
  - User has basic user role
  - Conversation conv-1 exists
Steps:
  1. Call PATCH /conversations/conv-1
     Body: { "status": "pending" }
Expected Result:
  ✓ Request returns 403 Forbidden
Pass Criteria: User role correctly restricted
```

---

### Category 11: Error Handling

#### TC-011-001: Invalid channel filter
```
Test ID: TC-011-001
Description: Should handle invalid channel parameter gracefully
Preconditions:
  - User authenticated
Steps:
  1. Call GET /conversations?channel=invalid_channel
Expected Result:
  ✓ Response status 400 with error message
Pass Criteria: Validation error returned
```

#### TC-011-002: Invalid date format
```
Test ID: TC-011-002
Description: Should reject invalid date format
Preconditions:
  - User authenticated
Steps:
  1. Call GET /conversations?dateFrom=invalid-date
Expected Result:
  ✓ Response status 400 with error message
Pass Criteria: Date validation works
```

#### TC-011-003: Invalid pagination parameters
```
Test ID: TC-011-003
Description: Should handle invalid limit/page parameters
Preconditions:
  - User authenticated
Steps:
  1. Call GET /conversations?limit=abc
  2. Verify error response
  3. Call GET /conversations?limit=0
  4. Verify error response
Expected Result:
  ✓ Invalid parameters rejected
Pass Criteria: Parameter validation works
```

---

## Execution Guide

### Setup
```bash
# 1. Start local database
docker-compose up -d

# 2. Run test fixtures to seed data
pnpm --filter @yacc/backend run db:fixtures

# 3. Create test user
pnpm --filter @yacc/backend run db:seed
```

### Running Tests
```bash
# Run all QA-001 tests
pnpm --filter @yacc/backend test qa-001

# Run specific category
pnpm --filter @yacc/backend test qa-001-002

# Run with coverage
pnpm --filter @yacc/backend test --coverage qa-001

# Run in watch mode
pnpm --filter @yacc/backend test --watch qa-001
```

### Coverage Requirements
- **Minimum**: 85% coverage for all tested endpoints
- **Target**: 95% coverage
- **Excluded**: Error handling edge cases (10% acceptable miss rate)

---

## Success Criteria

✅ All test cases pass  
✅ ≥85% code coverage  
✅ All endpoints tested for happy path  
✅ All filter combinations tested  
✅ RBAC enforcement verified  
✅ Error handling validated  
✅ Response formats match API contract  

---

## Notes

- Tests should run independently (no shared state)
- Use fresh test database for each run
- Mock external services (Telegram, IRC)
- Tests should complete in <5 seconds for full suite
- Use realistic data that matches production use cases
