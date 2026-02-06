# Phase 1.4 MVP Development Guide

**Status**: 🚀 In Progress  
**Timeline**: February 10-20, 2026 (2 weeks)  
**Goal**: Deliver working inbox + messaging + real-time MVP  

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL running (docker-compose up)
- Redis running (docker-compose up)
- BetterAuth configured (completed in BE-003)

### Setup
```bash
# Clone and install
git clone https://github.com/csim-sg/yacc.git
cd yacc
pnpm install

# Start Docker services
docker-compose up -d

# Create feature branch
git checkout -b feature/BE-007-inbox-api

# Run tests
pnpm test
```

---

## Task Overview

### Backend Tasks (14 endpoints/events)

#### Week 1: Foundation APIs
- **BE-007**: GET /conversations (inbox listing with filters)
  - Filters: channel, status, priority, assignee, tag, search, date range
  - Pagination: page, limit (default 20)
  - Sorting: by lastActivity (default)
  - Response: conversation summary array

- **BE-008**: GET /conversations/:id (conversation detail)
  - Returns: full conversation + metadata + recent messages
  - RBAC enforced

#### Week 2: Message Flow + Real-Time
- **BE-009**: GET /conversations/:id/messages (message history, paginated)
- **BE-010**: POST /conversations/:id/messages (send reply, queue delivery)
- **BE-017**: WebSocket event `message.received` (push on inbound)
- **BE-018**: WebSocket event `message.sent` (push on success)
- **BE-019**: WebSocket event `message.failed` (push on failure)

### Frontend Tasks (7 pages/components)

#### Week 1: UI Scaffolding
- **FE-008**: Inbox list page (cards, filters, pagination)
- **FE-009**: Conversation detail page (timeline, metadata)

#### Week 2: Integration + Real-Time
- **FE-010**: Reply composer (text input, send button)
- **FE-013**: message.received listener (new messages in inbox)
- **FE-014**: message.sent listener (status → sent)
- **FE-015**: message.failed listener (status → failed + retry button)

### QA Tasks (3 test suites)

#### Deliverables
- **QA-001**: Integration tests (API flows, filters, pagination)
- **QA-002**: E2E tests (user workflows via UI)
- **QA-003**: Real-time tests (WebSocket events, reconnection)

---

## Architecture Standards (MANDATORY)

### Code Quality
- ✅ **85%+ test coverage** required for all code
- ✅ **No `any` types** - use proper TypeScript
- ✅ **Flat folder structure** - no nested api/domain/infrastructure
- ✅ **One definition per file** - each class/interface in separate file
- ✅ **Config vs Infrastructure** (ADR-005) - config = data, infrastructure = init
- ✅ **Drizzle ORM only** - no raw SQL
- ✅ **RBAC enforcement** - 4-role matrix (Super Admin/Admin/Manager/User)

### Error Handling
- ✅ **Proper HTTP status codes** (200, 201, 400, 401, 403, 404, 500)
- ✅ **Generic error messages** (prevent user enumeration)
- ✅ **Correlation IDs** in all logs (for tracing)
- ✅ **No hardcoded secrets** - use environment variables
- ✅ **Never expose stack traces** in production responses

### Architecture Verification
Architect will verify on each PR:
1. Architecture compliance (flat structure, types, RBAC)
2. Test coverage (≥85%)
3. Code quality (no `any`, proper error handling)
4. Security controls (auth, validation, logging)
5. Documentation (updated, clear)

**PRs without these standards will be REJECTED** before code review.

---

## Daily Development Workflow

### Morning (Before 10:00 AM UTC)
1. **Standup** (10:00 AM UTC, 15 min):
   - What did you ship yesterday? (1-2 min)
   - What are you shipping today? (1-2 min)
   - Any blockers? (3-5 min)
   - Integration issues? (3-5 min)

2. **Start coding**: Continue from yesterday's progress

### During Day
- **Code in small commits** (every 2-3 hours)
- **Test as you go** - run tests after each feature
- **Ask questions early** - don't wait for blockers to pile up
- **Architecture questions?** Ask architect in Slack immediately

### Evening (EOD)
- **Push commits** to feature branch
- **Open PR for review** (if ready) or request feedback
- **Document progress** - what's done, what's next, any blockers

### Blocker Protocol
- **Blocker >30 minutes?** Reach out to architect immediately
- **Don't wait** for daily sync
- **Slack/Teams** for urgent issues
- **Code reviews** can be requested anytime

---

## Git Workflow

### Branches
- **main**: Production (never push directly)
- **dev**: Integration branch (all PRs merge here)
- **feature/BE-007-inbox-api**: Your feature branch

### Commits
```bash
# Feature branch work
git checkout -b feature/BE-007-inbox-api

# Make small commits
git add src/services/conversation.service.ts tests/BE-007-inbox-api.spec.ts
git commit -m "feat(BE-007): Implement conversation listing service with filters

- Add listConversations method with pagination
- Support filters: channel, status, priority, assignee
- Add comprehensive unit tests (15 test cases)
- Coverage: 92%"

# Push and create PR
git push origin feature/BE-007-inbox-api
gh pr create --title "feat(BE-007): Inbox API with filters" --body "..."
```

### PR Requirements
- ✅ All tests passing (run locally first)
- ✅ ≥85% test coverage
- ✅ Documentation updated
- ✅ No architecture violations
- ✅ Clear commit messages
- ✅ References GitHub issues (#183-197)

---

## Testing Strategy

### Unit Tests (Service Layer)
```typescript
// tests/BE-007-inbox-api.spec.ts
describe('ConversationService', () => {
  it('should list conversations with pagination', () => {
    // Arrange
    // Act
    // Assert
  });
  
  it('should filter by channel', () => {
    // Test filtering logic
  });
});
```

### Integration Tests (Controller Layer)
```typescript
// tests/integration/conversations-integration.test.ts
describe('GET /conversations', () => {
  it('should return 200 with conversations', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});
```

### E2E Tests (Frontend + Backend)
```typescript
// packages/frontend/e2e/inbox.spec.ts
describe('Inbox List Page', () => {
  it('should display conversations and filter by channel', async () => {
    await page.goto('/inbox');
    await page.selectOption('[data-test=channel-filter]', 'telegram');
    // Verify Telegram conversations shown
  });
});
```

### Coverage Targets
- **Unit**: 85%+ for services, utils
- **Integration**: 85%+ for API endpoints
- **E2E**: Key user workflows (5+ scenarios)

---

## API Contracts (Reference)

### GET /conversations
**Endpoint**: `GET /api/conversations?channel=telegram&status=open&page=1&limit=20`

**Request**:
```typescript
Query: {
  channel?: 'telegram' | 'irc' | ...
  status?: 'open' | 'pending' | 'resolved'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assignedUserId?: uuid
  tag?: string
  search?: string
  dateFrom?: ISO-8601 string
  dateTo?: ISO-8601 string
  page?: number (default 1)
  limit?: number (default 20)
  sortBy?: 'lastActivity' | 'created' | 'priority' (default 'lastActivity')
  sortOrder?: 'asc' | 'desc' (default 'desc')
}
```

**Response** (200):
```json
{
  "data": [
    {
      "id": "uuid",
      "channel": "telegram",
      "externalThreadId": "ext-123",
      "status": "open",
      "priority": "medium",
      "assignedUserId": "uuid|null",
      "assignedUserName": "John",
      "tags": [{ "id": "uuid", "name": "Urgent", "color": "#FF5A5F" }],
      "participants": [{ "id": "ext-1", "name": "Alice", "type": "contact" }],
      "unreadCount": 2,
      "latestMessagePreview": "Last message...",
      "latestMessageAt": "2026-02-06T10:00:00Z",
      "createdAt": "2026-02-06T09:00:00Z",
      "updatedAt": "2026-02-06T10:05:00Z"
    }
  ],
  "page": 1,
  "totalCount": 150,
  "totalPage": 8
}
```

**Error** (400):
```json
{
  "code": "invalid_channel",
  "message": "Invalid channel value",
  "details": { "field": "channel" }
}
```

---

## Frontend Integration Guide

### API Client Setup (TanStack Query)
```typescript
// Frontend API integration
const { data, isLoading, error } = useQuery({
  queryKey: ['conversations', { channel, status, page }],
  queryFn: ({ queryKey }) => {
    const [, filters] = queryKey;
    return api.get('/conversations', { params: filters });
  },
});
```

### Component Structure
```typescript
// pages/inbox.tsx
<InboxPage>
  <FilterBar />         // Channel, Status, Priority, Search
  <ConversationList />  // Cards with pagination
  <ConversationDetail /> // Timeline + reply composer
</InboxPage>
```

---

## Troubleshooting

### Tests Failing
```bash
# Check database setup
docker-compose ps
docker-compose logs postgres

# Verify migrations
pnpm --filter @yacc/backend db:migrate

# Run tests with debug output
DEBUG=* pnpm test
```

### API Returns 401
- ✅ Check token is in Authorization header
- ✅ Verify token hasn't expired (48h TTL)
- ✅ Check user status is 'active'

### Real-Time Events Not Arriving
- ✅ Check WebSocket connection: `wsStatus` in dev tools
- ✅ Verify Socket.io is initialized (check server logs)
- ✅ Check CORS configuration for WebSocket

### Performance Issues
- ✅ Check database indexes exist (conversations_channel_idx, etc.)
- ✅ Verify pagination is working (limit, offset)
- ✅ Monitor N+1 queries in service layer

---

## Success Criteria (Week 2 EOD)

### Backend
- [ ] All BE-007-019 endpoints implemented
- [ ] ≥85% test coverage on all new code
- [ ] No architecture violations (architect approval)
- [ ] Security review passed (RBAC, auth, validation)
- [ ] Documentation updated (API contracts in .docs/02-api-and-data-model.md)

### Frontend
- [ ] All FE-008-015 UI pages/components implemented
- [ ] ≥85% test coverage on all new code
- [ ] Real-time updates working (WebSocket integration)
- [ ] RBAC visibility enforced (role-based access)
- [ ] Accessibility standards met (WCAG 2.1 AA)

### QA
- [ ] All integration tests passing (QA-001)
- [ ] All E2E tests passing (QA-002)
- [ ] All real-time tests passing (QA-003)
- [ ] No critical bugs found
- [ ] Documentation of test cases complete

### MVP Complete
- [ ] Users can view inbox (Telegram + IRC)
- [ ] Users can filter conversations (channel, status, etc.)
- [ ] Users can read message history
- [ ] Users can send replies
- [ ] Real-time updates work (new messages, status changes)
- [ ] RBAC enforced (4 roles, proper permissions)
- [ ] ≥85% code coverage across all layers
- [ ] Zero architecture violations
- [ ] Production-ready code (no todos, clean logs)

---

## Key References

| Document | Purpose |
|----------|---------|
| `.docs/02-api-and-data-model.md` | API contracts + data models |
| `.docs/03-implementation-guide.md` | Architecture decisions |
| `.docs/governance/GOV-012-*.md` | Approval + requirements |
| `packages/backend/src/services/conversation.service.ts` | Existing implementation |
| `packages/backend/src/controllers/conversations.controller.ts` | Existing endpoints |
| GitHub Issues #183-197 | Task briefs with AC |

---

## Team

| Role | Tasks | Contact |
|------|-------|---------|
| **Backend Dev** | BE-007-019 | Opens PRs for review |
| **Frontend Dev** | FE-008-015 | Opens PRs for review |
| **QA** | QA-001-003 | QA signoff before MVP |
| **Architect** | Code review + unblocking | Daily sync 10:00 AM UTC |

---

**Status**: 🚀 Ready to develop. Start with BE-007, frontend follows with mocks.

